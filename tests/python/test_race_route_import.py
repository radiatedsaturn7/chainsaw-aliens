import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import race_route_import as route
import race_track_import as track


def way(id,nodes,coords,**tags):
    return {'id':id,'nodes':nodes,'geometry':[{'lat':y,'lon':x} for x,y in coords],'tags':{'highway':'service',**tags}}

class RouteImportTests(unittest.TestCase):
    def setUp(self):
        self.ways=[way(10,[1,2,3],[(0,0),(.001,0),(.002,0)]),way(20,[2,4,5],[(.001,0),(.001,.001),(.002,.001)]),way(30,[5,3],[(.002,.001),(.002,0)])]
    def test_ordered_via_keeps_source_geometry(self):
        p=route.trace(self.ways,(0,0),[{'x':10,'y':0},{'x':111,'y':-111},{'x':210,'y':0}])
        self.assertAlmostEqual(p[0]['x'],10);self.assertAlmostEqual(p[-1]['x'],210)
        self.assertIn(20,[x['tags']['osmWayId'] for x in p]);self.assertLess(min(x['y'] for x in p),-100)
    def test_reverse_and_oneway(self):
        p=route.trace(self.ways[:1],(0,0),[{'x':200,'y':0},{'x':20,'y':0}]);self.assertGreater(p[0]['x'],p[-1]['x'])
        self.ways[0]['tags']['oneway']='yes'
        with self.assertRaisesRegex(ValueError,'not connected'):route.trace(self.ways[:1],(0,0),[{'x':200,'y':0},{'x':20,'y':0}])
    def test_crossing_is_not_junction(self):
        ways=[way(1,[1,2],[(-.001,0),(.001,0)]),way(2,[3,4],[(0,-.001),(0,.001)])]
        with self.assertRaisesRegex(ValueError,'not connected'):route.trace(ways,(0,0),[{'x':-100,'y':0},{'x':0,'y':-100}])
    def test_no_repeated_edges_option_takes_alternate_streets(self):
        anchors=[{'x':111.1950802335,'y':0},{'x':222.390160467,'y':0},{'x':111.1950802335,'y':0}]
        normal=route.trace(self.ways,(0,0),anchors)
        unique=route.trace(self.ways,(0,0),anchors,avoid_repeated_edges=True)
        self.assertTrue(all(abs(p['y'])<.01 for p in normal))
        self.assertLess(min(p['y'] for p in unique),-100)
        edges=[tuple(sorted(((round(a['x'],3),round(a['y'],3)),(round(b['x'],3),round(b['y'],3))))) for a,b in zip(unique,unique[1:])]
        self.assertEqual(len(edges),len(set(edges)))
        with self.assertRaisesRegex(ValueError,'not connected'):
            route.trace(self.ways[:1],(0,0),anchors,avoid_repeated_edges=True)

    def test_open_elevation_and_reference(self):
        points=route.trace(self.ways[:1],(0,0),[{'x':0,'y':0},{'x':220,'y':0}])
        layout={'points':points,'open':True,'name':'Hill','place':{'lat':0,'lon':0,'country':'us'},'routeReference':{'waypoints':[1,2]}}
        from urllib.parse import parse_qs,urlparse
        def fetch(url):return {'value':float(parse_qs(urlparse(url).query)['x'][0])*800000}
        result=track.build(layout,fetch=fetch)['race']
        self.assertEqual(result['type'],'destination');self.assertEqual(result['laps'],1)
        self.assertGreater(result['road']['nodes'][-1]['elevation'],100)
        self.assertEqual(result['source']['routeReference'],layout['routeReference'])
        self.assertEqual(result['road']['segments'][0]['curve'],0)
    def test_fallback_is_explicit(self):
        data={'place':{'lat':0,'lon':0,'name':'Test'},'ways':self.ways}
        def fail(url):raise ValueError('offline')
        r=route.route(data,[{'x':0,'y':0},{'x':220,'y':0}],fetch=fail)
        self.assertIn('fallback',r['warning'] if 'fallback' in r['warning'] else track.recall(r['layouts'][0]['id'],'layout')['routeReference']['provider'])
    def test_valhalla_matches_ordered_source_ways(self):
        def encode(coords):
            result='';previous=[0,0]
            for lat,lon in coords:
                for i,v in enumerate((lat,lon)):
                    n=round(v*1e6);delta=n-previous[i];previous[i]=n
                    value=~(delta<<1) if delta<0 else delta<<1
                    while value>=32:result+=chr((32|(value&31))+63);value>>=5
                    result+=chr(value+63)
            return result
        # Forward then reverse on the same source way must remain two traversals.
        shape=encode([(0,0),(0,.002),(0,.0002)])
        def fetch(url, data=None):
            if '/route?' in url:return {'trip':{'legs':[{'shape':shape}]}}
            if '/trace_attributes' in url:return {'shape':shape,'edges':[{'way_id':10,'begin_shape_index':0,'end_shape_index':1},{'way_id':10,'begin_shape_index':1,'end_shape_index':2}]}
            return {'elements':self.ways[:1]}
        points,reference=route.valhalla([{'x':0,'y':0},{'x':22,'y':0}],(0,0),fetch)
        self.assertGreater(max(p['x'] for p in points),220)
        self.assertAlmostEqual(points[-1]['x'],22.239016,places=4)
        self.assertEqual(len(reference['matchedEdges']),2)
        self.assertEqual(route.decode_polyline(shape)[1],{'lat':0,'lon':.002})

    def test_invalid_points(self):
        with self.assertRaises(ValueError):route.route({},[{'x':float('nan'),'y':0},{}])

if __name__=='__main__':unittest.main()

class RouteCacheTests(unittest.TestCase):
    def test_routing_response_reused_from_disk(self):
        import tempfile
        from unittest.mock import patch
        from io import BytesIO
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(track,'CACHE',Path(directory)),patch.object(track,'urlopen',return_value=BytesIO(b'{"trip":{"legs":[]}}')) as urlopen:
                first=track.request_json('https://example.invalid/route?json=test')
                second=track.request_json('https://example.invalid/route?json=test')
                self.assertEqual(first,second);self.assertEqual(urlopen.call_count,1)

class RoadLookupTests(unittest.TestCase):
    def test_named_mountain_road_uses_small_query(self):
        calls=[]
        def fetch(url):
            calls.append(url)
            return {'elements':[{'type':'way',**way(1,[1,2],[(-71.25,44.28),(-71.26,44.29)],name='Mount Washington Auto Road')}]}
        result=route.network({'name':'Mount Washington Auto Road, New Hampshire','lat':44.2811197,'lon':-71.246017},fetch=fetch)
        from urllib.parse import parse_qs,urlparse
        q=parse_qs(urlparse(calls[0]).query)['data'][0]
        self.assertIn('["name"="Mount Washington Auto Road"]',q)
        self.assertIn('(44.19,-71.38,44.38,-71.12)',q)
        self.assertNotIn('around:',q);self.assertEqual(len(calls),1)
        self.assertIn('Named road',result['scope'])
    def test_missing_named_road_falls_back_to_area(self):
        calls=[]
        def fetch(url):
            calls.append(url)
            return {'elements':[] if len(calls)==1 else [{'type':'way',**way(1,[1,2],[(0,0),(.001,0)])}]}
        result=route.network({'name':'Example Road','lat':0,'lon':0},fetch=fetch)
        self.assertEqual(len(calls),2);self.assertEqual(result['scope'],'Roads in the selected area')
    def test_cached_mirror_does_not_contact_primary(self):
        from unittest.mock import patch
        from urllib.parse import urlencode
        import tempfile,hashlib,json
        query='test-cached-mirror'
        with tempfile.TemporaryDirectory() as directory,patch.object(track,'CACHE',Path(directory)),patch.dict(route.os.environ,{'RTG_OVERPASS_URL':'https://primary.invalid','RTG_OVERPASS_FALLBACK_URL':'https://mirror.invalid'}):
            url='https://mirror.invalid?'+urlencode({'data':query})
            key=hashlib.sha256((url+str(None)).encode()).hexdigest()
            (Path(directory)/(key+'.json')).write_text(json.dumps({'elements':[{'id':123}]}))
            with patch.object(track,'urlopen',side_effect=AssertionError('No network expected')):
                self.assertEqual(route.overpass(query,track.request_json),[{'id':123}])
    def test_mount_washington_alias(self):
        for name in ['mt. washington','Mt Washington','Mt. Washington Auto Road']:
            self.assertEqual(track.normalize_track_name(name),'Mount Washington Auto Road')
