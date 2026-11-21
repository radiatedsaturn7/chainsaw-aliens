"""Offline source continuity, direction and overpass regression checks."""
import json,math,sys,unittest,gzip,base64
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
from inspect_raceways import candidate_layouts
from circuit_grade_separation import crossing
from fetch_circuit_map import parse_map
KEYS={'silverstone','brands-hatch','spa','suzuka','monza','imola','bathurst','red-bull-ring','interlagos','tsukuba','fuji','donington','lemans','portimao','zandvoort','gilles-villeneuve','phillip-island'}
def saved(key):
 root=Path('data/server-storage/files');rows=json.loads(Path('data/campaigns/america/raceways/catalog.json').read_text());row=next(r for r in rows if r['id']==key);d=json.loads((root/row['documentPath']).read_text());return (json.loads(gzip.decompress(base64.b64decode(d['data']))) if '__chainsawStorage' in d else d)['race']

class WorldCircuitTests(unittest.TestCase):
 def test_real_corner_names_are_not_service_lanes(self):
  for name in ['National Pit Straight','Pit Straight','Paddock Hill']:self.assertFalse(track.is_service_raceway({'name':name}))
  for name in ['Pit Lane','Paddock','False Grid','National pit lane']:self.assertTrue(track.is_service_raceway({'name':name}))
 def test_api_conversion_retains_node_identity_and_coordinates(self):
  raw=b'<osm><node id="1" lat="1" lon="2"/><node id="2" lat="3" lon="4"/><way id="7"><nd ref="1"/><nd ref="2"/><tag k="highway" v="raceway"/></way></osm>'
  w=parse_map(raw)[0];self.assertEqual(w['nodes'],[1,2]);self.assertEqual(w['geometry'][1],{'lat':3,'lon':4});self.assertEqual(w['id'],7)
 def test_all_reviewed_layouts_have_no_reversals_and_match_frozen_sources(self):
  count=0
  for spec in json.loads(Path('tools/campaigns/raceway_sources.json').read_text()):
   if spec['key'] not in KEYS:continue
   layouts=candidate_layouts(spec)
   for s in spec['layouts']:
    l=layouts[s['index']];self.assertAlmostEqual(l['lengthM'],s['mappedLengthM']);self.assertEqual(track.layout_review_issues(l),[],(spec['key'],s['key']));count+=1
  self.assertEqual(count,38)
 def test_bathurst_uses_counterclockwise_lap_and_actual_elevations(self):
  r=saved('raceway-bathurst-full');ns=r['road']['nodes']
  self.assertLess(sum(a['x']*b['y']-b['x']*a['y'] for a,b in zip(ns,ns[1:])),0)
  h=[n['elevation']*12 for n in ns];self.assertGreater(max(h)-min(h),140)
 def test_suzuka_has_independent_bridge_and_ground_routes(self):
  for key in ['full','west']:
   r=saved(f'raceway-suzuka-{key}');ns=r['road']['nodes'];network=r['road']['network']
   self.assertNotEqual(network['startNodeId'],network['finishNodeId'])
   for c in r['source']['gradeSeparation']['crossings']:
    i,j=c['upperSegment'],c['lowerSegment'];t,u=crossing(ns[i],ns[i+1],ns[j],ns[j+1]);upper=(1-t)*ns[i]['elevation']+t*ns[i+1]['elevation'];lower=(1-u)*ns[j]['elevation']+u*ns[j+1]['elevation']
    self.assertGreaterEqual((upper-lower)*12,6.49);self.assertEqual(network['edges'][i]['structure'],'bridge');self.assertEqual(network['edges'][j]['structure'],'road')
if __name__=='__main__':unittest.main()
