import unittest,json,sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
from repair_circuit_spurs import reversals,read
class CircuitSpurs(unittest.TestCase):
 def test_pit_names_are_not_track_layout_edges(self):
  for name in ['Pit In','Pit Out','Hot Pit Lane','Paddock Access','False Grid']:
   self.assertTrue(track.is_service_raceway({'name':name}))
  for name in ['North Track','South Track','The Hairpin','Pittsburgh Raceway']:
   self.assertFalse(track.is_service_raceway({'name':name}))
 def test_pittsburgh_full_course_survives_pit_exclusion(self):
  ways=json.loads(Path('data/campaigns/america/side-races/sources/H03-S09.json').read_text())
  layouts=track.extract_layouts(ways,(40.85,-80.347),max_layouts=256,max_cycles=512)
  full=[l for l in layouts if 4300<l['lengthM']<4450 and not reversals(l['points'])]
  self.assertTrue(full)
  self.assertTrue(all(not track.is_service_raceway(p.get('tags',{})) for l in layouts for p in l['points']))
 def test_repaired_circuits_are_closed_without_spurs(self):
  for prefix in ['Pittsburgh','Ozarks International','NCM Motorsports']:
   path=next(Path('data/server-storage/files/races').glob(prefix+'*/document.json'));r=read(path)['race'];n=r['road']['nodes']
   self.assertEqual(len(r['road']['segments']),len(n)-1)
   self.assertEqual((n[0]['x'],n[0]['y']),(n[-1]['x'],n[-1]['y']))
   self.assertEqual(reversals(n),[])
   self.assertTrue(all(math.isfinite(p['elevation']) for p in n))
 def test_thompson_uses_upper_oval_without_drift_connectors(self):
  ways=json.loads(Path('data/campaigns/america/side-races/sources/H01-S05.json').read_text())
  old=track.extract_layouts(ways,(41.98,-71.825),max_layouts=256,max_cycles=512)
  broken=min(old,key=lambda l:abs(l['lengthM']-2736))
  self.assertTrue(track.layout_review_issues(broken))
  review=json.loads(Path('tools/campaigns/circuit_route_overrides.json').read_text())['H01-S05']
  track.apply_reviewed_way_directions(ways,review)
  new=track.extract_layouts(ways,(41.98,-71.825),max_layouts=256,max_cycles=512)
  selected=next(l for l in new if l['name']==review['name'] and abs(l['lengthM']-review['lengthM'])<1)
  self.assertFalse(track.layout_review_issues(selected))
  ids={p.get('tags',{}).get('osmWayId') for p in selected['points']}
  self.assertIn(343462914,ids);self.assertNotIn(151397704,ids);self.assertNotIn(701943115,ids)
 def test_real_hairpin_is_not_a_junction_reversal(self):
  pts=[{'x':50*math.cos(i*math.pi/20),'y':50*math.sin(i*math.pi/20),'tags':{'osmWayId':1}} for i in range(21)]
  self.assertFalse(track.layout_review_issues({'points':pts,'open':True}))
 def test_closed_seam_is_checked(self):
  pts=[{'x':0,'y':0},{'x':10,'y':0},{'x':11,'y':2},{'x':0,'y':0}]
  self.assertTrue(track.layout_review_issues({'points':pts}))
 def test_new_repairs_are_closed_and_have_no_sharp_junction_spurs(self):
  names=['Thompson','Podium Club','Virginia International Raceway']
  for p in Path('data/server-storage/files/races').glob('*/document.json'):
   r=read(p).get('race',{})
   if r.get('id') not in ['side-h01-s05','side-h10-s08','raceway-vir-south']:continue
   n=r['road']['nodes'];self.assertEqual(len(r['road']['segments']),len(n)-1)
   self.assertEqual((n[0]['x'],n[0]['y']),(n[-1]['x'],n[-1]['y']))
   self.assertFalse(reversals(n,120),r['name'])
if __name__=='__main__':unittest.main()
