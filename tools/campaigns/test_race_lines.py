import unittest,copy,json,subprocess
from pathlib import Path
import audit_race_lines as a
class RaceLinesTests(unittest.TestCase):
 def test_landmark_timed_annotations_keep_signed_continuation_reference(self):
  marks=[{'name':'before','routeDistanceM':0,'worldX':11,'worldZ':22},
         {'name':'after','routeDistanceM':150,'worldX':33,'worldZ':44},
         {'name':'inside','routeDistanceM':70,'worldX':55,'worldZ':66}]
  r={'source':{'landmarks':copy.deepcopy(marks)}}
  a.shift_calls(r,43,100)
  before,after,inside=r['source']['landmarks']
  self.assertEqual((before['routeDistanceM'],before['routeMiles'],before['signedRouteDistanceM']),(0,0,-43))
  self.assertEqual((after['routeDistanceM'],after['signedRouteDistanceM']),(100,107))
  self.assertEqual(inside['routeDistanceM'],27);self.assertNotIn('signedRouteDistanceM',inside)
  self.assertEqual([(m['worldX'],m['worldZ']) for m in r['source']['landmarks']],[(m['worldX'],m['worldZ']) for m in marks])
  a.shift_calls(r,10,80)
  self.assertEqual((before['routeDistanceM'],before['signedRouteDistanceM']),(0,-53))
  self.assertEqual((after['routeDistanceM'],after['signedRouteDistanceM']),(80,97))
  self.assertEqual(inside['routeDistanceM'],17)
  a.shift_calls(r,-60,200)
  self.assertEqual((before['routeDistanceM'],before['signedRouteDistanceM']),(7,7))
  self.assertEqual((after['routeDistanceM'],after['signedRouteDistanceM']),(157,157))
  a.shift_calls(r,20,100,True)
  self.assertEqual(before['routeDistanceM'],87);self.assertNotIn('signedRouteDistanceM',before)
  self.assertEqual(after['routeDistanceM'],37);self.assertNotIn('signedRouteDistanceM',after)
 def test_chicago_landmark_annotation_matches_saved_source_without_relocating(self):
  notes=a.read(Path('data/campaigns/america/state-expansion/landmarks/IL.json'))
  manifest=a.read(a.ROOT/'manifest.json')
  doc=a.read(a.ROOT/manifest['folders']['races'][notes['raceRef']])
  self.assertEqual(notes['landmarks'],doc['race']['source']['landmarks'])
  pier=notes['landmarks'][0]
  self.assertEqual((pier['name'],pier['routeDistanceM'],pier['routeMiles'],pier['signedRouteDistanceM']),('Navy Pier',0,0,-43))
  self.assertEqual((pier['worldX'],pier['worldZ']),(1974.818557798633,-756.1154260804785))
 def test_applied_documents_match_report_and_keep_road_geometry(self):
  report=a.read(Path('data/campaigns/america/line-placement-audit.json'))
  manifest=a.read(a.ROOT/'manifest.json');checked=0
  for row in report['races']:
   p=a.ROOT/manifest['folders']['races'][row['name']];r=a.read(p)['race']
   if row['status'] not in ('adjusted','already-reviewed'):continue
   self.assertFalse(row.get('remainingReview'),row['name'])
   before=copy.deepcopy(r);result=a.place(r);self.assertEqual(result['status'],'already-reviewed');self.assertEqual(r,before)
   self.assertLessEqual(max(row['afterDegrees']),10,row['name'])
   self.assertEqual(len(r['road']['segments']),len(r['road']['nodes'])-1)
   self.assertEqual(r['road']['nodes'][0]['role'],'start');self.assertEqual(r['road']['nodes'][-1]['role'],'finish')
   checked+=1
   baseline=subprocess.run(['git','show','HEAD:'+str(p)],capture_output=True)
   if baseline.returncode:continue # locally imported race has no committed baseline yet
   original=json.loads(baseline.stdout)
   if '__chainsawStorage' in original:original=json.loads(a.zlib.decompress(a.base64.b64decode(original['data']),31))
   coords=lambda n:(n['x'],n['y'],n.get('elevation',0))
   originalNodes={coords(n) for n in original['race']['road']['nodes']}
   self.assertTrue(all(coords(n) in originalNodes for n in r['road']['nodes']),row['name'])
   self.assertEqual(r.get('roadTextures'),original['race'].get('roadTextures'))
   self.assertGreaterEqual(len(r.get('scenery',[])),len(original['race'].get('scenery',[])))
   if r['type']!='circuit':
    self.assertTrue(r['road']['continuations']['start']);self.assertTrue(r['road']['continuations']['finish'])
  self.assertGreater(checked,50)
 def test_grid_and_runout_check_both_sides_and_preserve_coordinates(self):
  nodes=[{'x':x,'y':0,'elevation':0} for x in range(0,301,10)]
  r={'name':'city corner','type':'destination','road':{'nodes':nodes,'segments':[{'length':10} for _ in nodes[:-1]],'continuations':{'start':[{'offset':-10,'x':0,'z':-10,'elevation':0}],'finish':[{'offset':10,'x':300,'z':10,'elevation':0}]}}}
  original=copy.deepcopy(nodes);result=a.place(r)
  self.assertEqual(result['status'],'adjusted')
  self.assertGreaterEqual(result['trimStartM'],35);self.assertGreaterEqual(result['trimFinishM'],40)
  road=r['road'];d=a.distances(road['nodes'])
  self.assertLessEqual(a.line_corridor(road,road['nodes'],d,0,0),10)
  self.assertLessEqual(a.line_corridor(road,road['nodes'],d,len(d)-1,1),10)
  self.assertTrue(all(n['x'] in [p['x'] for p in original] for n in road['nodes']))
  self.assertEqual(a.place(r)['status'],'already-reviewed')
 def test_short_circuit_does_not_get_a_fabricated_straight(self):
  nodes=[{'x':0,'y':0},{'x':10,'y':0},{'x':0,'y':10},{'x':0,'y':0}]
  r={'name':'tiny','type':'circuit','road':{'nodes':nodes,'segments':[{'length':10}]*3}}
  original=copy.deepcopy(r);self.assertEqual(a.place(r)['status'],'manual-review');self.assertEqual(r,original)
if __name__=='__main__':unittest.main()
