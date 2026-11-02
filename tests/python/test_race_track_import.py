import json
import math
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import race_track_import as imp


def way(ids,coords,tags=None,identifier=1):
    return {'type':'way','id':identifier,'nodes':ids,'geometry':[{'lat':40-y/111195,'lon':-71+x/(111195*math.cos(math.radians(40)))} for x,y in coords], 'tags':{'highway':'raceway',**(tags or {})}}


def fixture():
    return [way([1,2,3],[(0,0),(300,0),(300,300)],{'name':'Test Oval','width':'14'}),way([3,4,1],[(300,300),(0,300),(0,0)],{'name':'Test Oval'})]


def layout():
    return {'place':{'lat':40,'lon':-71,'country':'us','name':'Test venue'},**imp.extract_layouts(fixture(),(40,-71))[0]}


class ImportTests(unittest.TestCase):
    def test_split_ways_form_one_closed_metric_loop(self):
        result=imp.extract_layouts(fixture(),(40,-71))
        self.assertEqual(len(result),1)
        self.assertAlmostEqual(result[0]['lengthM'],1200,delta=1)
        self.assertEqual(result[0]['points'][0]['x'],result[0]['points'][-1]['x'])

    def test_junction_returns_distinct_layouts_and_excludes_pit(self):
        diagonal=way([2,4],[(300,0),(0,300)],identifier=3)
        self.assertEqual(len(imp.extract_layouts(fixture()+[diagonal],(40,-71))),3)
        diagonal['tags']['raceway']='pit_lane'
        self.assertEqual(len(imp.extract_layouts(fixture()+[diagonal],(40,-71))),1)

    def test_disconnected_nearby_geometry_not_joined(self):
        broken=fixture();broken[1]['nodes']=[30,4,10]
        with self.assertRaisesRegex(ValueError,'No complete'):imp.extract_layouts(broken,(40,-71))

    def test_build_flat_closed_editable_race(self):
        result=imp.build(layout(),use_elevation=False);r=result['race']
        self.assertEqual(r['type'],'circuit');self.assertEqual(len(r['road']['nodes']),len(r['road']['segments'])+1)
        self.assertEqual(r['road']['nodes'][0]['role'],'start');self.assertEqual(r['road']['nodes'][-1]['role'],'finish')
        self.assertTrue(all(n['elevation']==0 for n in r['road']['nodes']))
        self.assertEqual(r['road']['segments'][0]['roadWidthM'],14)
        self.assertIn('OpenStreetMap',r['source']['attribution'])
        self.assertTrue(all(s['banking']==0 for s in r['road']['segments']))

    def test_elevations_terrain_and_loop_seam(self):
        def fetch(url,**kw):
            from urllib.parse import urlparse,parse_qs
            q=parse_qs(urlparse(url).query);return {'value':100+(float(q['x'][0])+71)*10000}
        r=imp.build(layout(),fetch=fetch)['race']
        self.assertGreater(max(n['elevation'] for n in r['road']['nodes']),1)
        self.assertEqual(r['road']['nodes'][0]['elevation'],r['road']['nodes'][-1]['elevation'])
        self.assertTrue(r['road']['tileMap']['cells'])
        self.assertLess(len(r['road']['tileMap']['cells']),27000)

    def test_missing_elevation_warns_and_never_invents_height(self):
        r=imp.build(layout(),fetch=lambda *a,**kw:{'value':-1000000})
        self.assertTrue(any('unavailable' in s for s in r['warnings']))
        self.assertTrue(all(n['elevation']==0 for n in r['race']['road']['nodes']))

    def test_non_us_never_calls_usgs(self):
        l=layout();l['place']['country']='gb'
        def fail(*args,**kwargs):raise AssertionError('USGS called')
        r=imp.build(l,fetch=fail)
        self.assertTrue(any('US-only' in s for s in r['warnings']))

    def test_input_validation_and_tokens(self):
        with self.assertRaises(ValueError):imp.search('a')
        with self.assertRaises(ValueError):imp.build(layout(),width=float('nan'))
        with self.assertRaises(ValueError):imp.recall('missing','layout')
        token=imp.remember({'kind':'place'})
        with self.assertRaises(ValueError):imp.recall(token,'layout')

    def test_name_lookup_and_layout_pipeline(self):
        def fetch(url,**kw):
            if 'search?' in url:return [{'lat':'40','lon':'-71','display_name':'Test venue','address':{'country_code':'us'}}]
            return {'elements':fixture()}
        places=imp.search('Test venue',fetch)['places']
        result=imp.layouts(places[0]['id'],fetch)
        self.assertEqual(len(result['layouts']),1)
        self.assertAlmostEqual(result['layouts'][0]['lengthM'],1200,delta=1)


class ImportDirectionTests(unittest.TestCase):
    def test_oneway_excludes_impossible_layouts(self):
        elements=fixture()
        for w in elements:w['tags']['oneway']='yes'
        elements.append(way([2,4],[(300,0),(0,300)],{'oneway':'yes'},3))
        result=imp.extract_layouts(elements,(40,-71))
        self.assertEqual(len(result),2)

    def test_named_pit_lane_is_excluded_even_without_raceway_subtype(self):
        elements=fixture()+[way([2,4],[(300,0),(0,300)],{'name':'Pit Lane'},3)]
        self.assertEqual(len(imp.extract_layouts(elements,(40,-71))),1)

    def test_overpass_fallback_on_service_error(self):
        calls=[]
        def fetch(url,**kw):
            calls.append(url)
            if len(calls)==1:raise ValueError('502')
            return {'elements':fixture()}
        token=imp.remember({'kind':'place','name':'Test','lat':40,'lon':-71,'country':'us'})
        self.assertEqual(len(imp.layouts(token,fetch)['layouts']),1)
        self.assertEqual(len(calls),2)

class TrackNameTests(unittest.TestCase):
    def test_real_track_name_variants(self):
        cases={'seekonk motorspeedway':'Seekonk Speedway','New hampshire motorspeedway':'New Hampshire Motor Speedway',
               'NH Motor Speedway':'New Hampshire Motor Speedway','leguna-seca':'WeatherTech Raceway Laguna Seca',
               'Laguna Seca':'WeatherTech Raceway Laguna Seca','limerock':'Lime Rock Park'}
        from urllib.parse import urlparse,parse_qs
        for name,expected in cases.items():
            calls=[]
            def fetch(url,**kw):
                calls.append(parse_qs(urlparse(url).query)['q'][0])
                return [{'lat':'40','lon':'-71','display_name':expected,'address':{'country_code':'us'}}]
            result=imp.search(name,fetch)
            self.assertEqual(calls,[expected]);self.assertEqual(result['searchedName'],expected)

    def test_generic_joined_motor_speedway_fallback(self):
        from urllib.parse import urlparse,parse_qs
        calls=[]
        def fetch(url,**kw):
            q=parse_qs(urlparse(url).query)['q'][0];calls.append(q)
            return [] if len(calls)==1 else [{'lat':'40','lon':'-71','display_name':'Example Speedway'}]
        result=imp.search('Example motorspeedway',fetch)
        self.assertEqual(calls,['Example motor speedway','Example Speedway'])
        self.assertEqual(result['searchedName'],'Example Speedway')

    def test_unknown_names_are_not_silently_changed_to_another_track(self):
        self.assertEqual(imp.normalize_track_name('Maple Valley'),'Maple Valley')
        self.assertEqual(imp.normalize_track_name('Example Raceway'),'Example Raceway')

class LayoutTerrainTests(unittest.TestCase):
    def test_main_lime_rock_precedes_short_single_name_autocross(self):
        layouts=[{'name':'Autocross Course','lengthM':750},{'name':'Big Bend / Lime Rock Park / Sam Posey Straight','lengthM':2400}]
        self.assertEqual(imp.rank_layouts(layouts,'Lime Rock Park')[0]['lengthM'],2400)
        nh=[{'name':'New Hampshire Motor Speedway / Road Course','lengthM':2600},{'name':'New Hampshire Motor Speedway','lengthM':1670}]
        self.assertEqual(imp.rank_layouts(nh,'New Hampshire Motor Speedway')[0]['lengthM'],1670)

    def test_main_layout_not_lost_before_venue_ranking(self):
        rows=[{'name':f'Autocross {i}','lengthM':500} for i in range(30)]
        rows.append({'name':'Lime Rock Park / Big Bend','lengthM':2400})
        self.assertEqual(imp.rank_layouts(rows,'Lime Rock Park')[:24][0]['lengthM'],2400)

    def test_road_cuts_through_high_terrain_and_flat_fallback(self):
        for terrain in [{},{f'{x},{y}':{'tileId':'grass','elevation':5} for x in range(-10,20) for y in range(-10,20)}]:
            road={'nodes':[{'x':0,'y':0,'elevation':-1},{'x':100,'y':0,'elevation':1}],
                  'segments':[{'roadWidthM':12}], 'tileMap':{'cellSizeM':10,'cells':terrain}}
            imp.fit_terrain_to_road(road)
            for x in range(0,101,2):
                for y in [-6,0,6]:
                    gx,gy=x/10-.5,y/10-.5;a,b=math.floor(gx),math.floor(gy);tx,ty=gx-a,gy-b
                    get=lambda ix,iy:road['tileMap']['cells'].get(f'{ix},{iy}',{}).get('elevation',0)
                    h=(get(a,b)*(1-tx)+get(a+1,b)*tx)*(1-ty)+(get(a,b+1)*(1-tx)+get(a+1,b+1)*tx)*ty
                    self.assertLess(h,-1+x/50)
            if terrain.get('15,15'):self.assertEqual(terrain['15,15']['elevation'],5)

if __name__=='__main__':unittest.main()
