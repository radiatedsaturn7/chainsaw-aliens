import unittest,json,sys,math,hashlib,gzip,base64
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_route_import as route
from import_state_expansion import right_angle_turns,mapped_road_width

class StateExpansion(unittest.TestCase):
 def test_landmark_lookup_rejects_a_different_nearby_museum(self):
  from unittest.mock import patch
  from prepare_state_sources import geocode
  place={'name':'Idaho State Museum','lat':43.61,'lon':-116.20,'country':'us'}
  with patch('prepare_state_sources.track.search',return_value={'places':[{'id':'one'}]}),patch('prepare_state_sources.track.recall',return_value=place):
   with self.assertRaisesRegex(ValueError,'Ambiguous'):geocode('Basque Museum, Boise, Idaho',(43.61,-116.20))
   place['name']='Basque Museum'
   self.assertEqual(geocode('Basque Museum, Boise, Idaho',(43.61,-116.20)),place)
 def test_bounded_map_download_stops_only_after_route_acceptance(self):
  from unittest.mock import patch
  from import_side_races import snapshot
  calls=[]
  def fetch(url):
   calls.append(url)
   if len(calls)==1:raise ValueError('HTTP 400 size limit')
   return {'elements':[{'type':'node','id':1,'lat':40,'lon':-75},{'type':'node','id':2,'lat':40.001,'lon':-75},{'type':'way','id':10,'nodes':[1,2],'tags':{'highway':'residential','name':'Test Street'}}]}
  with patch('import_side_races.track.cached_json',return_value={}),patch('import_side_races.track.request_json',side_effect=fetch):
   roads=snapshot([40,-75,'nameOrRef','.*'],accept=lambda roads:len(roads)==1)
  self.assertEqual(len(calls),2);self.assertEqual(roads[0]['nodes'],[1,2])
  calls.clear()
  with patch('import_side_races.track.cached_json',return_value={}),patch('import_side_races.track.request_json',side_effect=fetch):
   snapshot([40,-75,'nameOrRef','.*'],accept=lambda roads:False)
  self.assertEqual(len(calls),5,'A rejected partial district must fetch remaining quadrants')
 def test_each_city_uses_connected_non_repeating_local_streets(self):
  report=json.loads(Path('data/campaigns/america/state-expansion/report.json').read_text())
  cities=[r for r in report if r.get('city')];self.assertTrue(cities)
  installed={r['id']:r for r in json.loads(Path('data/campaigns/america/raceways/catalog.json').read_text())}
  for r in cities:
   with self.subTest(city=r['id']):
    stored=json.loads((Path('data/server-storage/files')/installed[r['id']]['documentPath']).read_text())
    doc=json.loads(gzip.decompress(base64.b64decode(stored['data']))) if stored.get('__chainsawStorage') else stored
    race=doc['race'];source=race['source'];origin=source['origin']
    ways=json.loads(Path(source['sourceSnapshot']).read_text())
    for w in ways:
     tags=w.setdefault('tags',{});tags['width']=str(mapped_road_width(tags,7))
     if tags.get('surface') in ('fine_gravel','pebblestone','rock'):tags['surface']='gravel'
    points=route.trace(ways,(origin['lat'],origin['lon']),source['routeReference']['waypoints'],max_snap=500,avoid_repeated_edges=True)
    self.assertEqual(hashlib.sha256(json.dumps(points,sort_keys=True).encode()).hexdigest(),source['layoutGeometrySha256'],'Saved geometry must reproduce from its committed street snapshot')
    self.assertGreaterEqual(right_angle_turns(points),4)
    self.assertTrue(all(p['tags']['highway'] in ('primary','secondary','tertiary','residential','unclassified','primary_link','secondary_link','tertiary_link') for p in points))
    edges=[frozenset(((round(a['x'],4),round(a['y'],4)),(round(b['x'],4),round(b['y'],4)))) for a,b in zip(points,points[1:])]
    self.assertEqual(len(edges),len(set(edges)))
    self.assertEqual(len(source['landmarkPlan']),4)
    self.assertGreater(source['estimatedDrivingSeconds'],0)
 def test_all_missing_states_have_reviewed_non_oval_sources(self):
  specs=json.loads(Path('tools/campaigns/state_gap_sources.json').read_text());self.assertEqual(len(specs),29)
  report={r['id']:r for r in json.loads(Path('data/campaigns/america/state-expansion/report.json').read_text())}
  for r in specs:
   self.assertIn(r['id'],report);self.assertTrue(r['references'])
   if r['kind']=='circuit':self.assertIn('layoutIndex',r);self.assertGreater(r['mappedLengthM'],2500)

if __name__=='__main__':unittest.main()
