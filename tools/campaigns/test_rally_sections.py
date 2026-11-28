import copy, unittest
from rally_sections import partition,section
class Sections(unittest.TestCase):
 def fixture(self):
  return dict(name='Parent',id='parent',type='sprint',road=dict(nodes=[dict(x=i*40,y=0,elevation=i*.001) for i in range(451)],segments=[dict(length=40,surface='gravel',curve=0) for i in range(450)],width=6),source=dict(rallyCollection=dict(id='test',name='Test')),codriver=dict(calls=[dict(at=4200,endAt=4300)]),scenery=[dict(x=5000,z=10,trackDistance=5000)])
 def test_partition_preserves_nonoverlapping_geometry_and_surfaces(self):
  race=self.fixture();original=copy.deepcopy(race);ranges=partition(race,6)
  self.assertEqual(len(ranges),6)
  for i,(a,b) in enumerate(ranges):
   r=section(race,a,b,name=f'Stage {i+1}',race_id=f'test-{i}',number=i+1)
   self.assertEqual([(p['x'],p['y'],p['elevation']) for p in r['road']['nodes']],[(p['x'],p['y'],p['elevation']) for p in race['road']['nodes'][a:b+1]])
   self.assertEqual(len(r['road']['segments']),len(r['road']['nodes'])-1)
   self.assertTrue(all(s['surface']=='gravel' for s in r['road']['segments']))
   self.assertEqual(r['road']['nodes'][0]['role'],'start');self.assertEqual(r['road']['nodes'][-1]['role'],'finish')
   if i:self.assertTrue(r['road']['continuations']['start']);self.assertEqual(a,ranges[i-1][1])
  self.assertEqual(race,original)
 def test_rebase_notes(self):
  r=section(self.fixture(),100,200,name='Part',race_id='part',number=2)
  self.assertEqual(r['codriver']['calls'][0]['at'],200)
  self.assertEqual(r['scenery'][0]['trackDistance'],1000)
 def test_reject_tiny_sections_and_networks(self):
  r=self.fixture()
  with self.assertRaises(ValueError):partition(r,20)
  r['road']['network']={'nodes':[]}
  with self.assertRaises(ValueError):partition(r,6)
if __name__=='__main__':unittest.main()
