import unittest,copy,json,subprocess
from pathlib import Path
import audit_race_lines as a
class RaceLinesTests(unittest.TestCase):
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
   original=json.loads(subprocess.check_output(['git','show','HEAD:'+str(p)]))
   if '__chainsawStorage' in original:original=json.loads(a.zlib.decompress(a.base64.b64decode(original['data']),31))
   coords=lambda n:(n['x'],n['y'],n.get('elevation',0))
   originalNodes={coords(n) for n in original['race']['road']['nodes']}
   self.assertTrue(all(coords(n) in originalNodes for n in r['road']['nodes']),row['name'])
   self.assertEqual(r.get('roadTextures'),original['race'].get('roadTextures'))
   self.assertEqual(len(r.get('scenery',[])),len(original['race'].get('scenery',[])))
   if r['type']!='circuit':
    self.assertTrue(r['road']['continuations']['start']);self.assertTrue(r['road']['continuations']['finish'])
   checked+=1
  self.assertGreater(checked,50)
 def test_short_circuit_does_not_get_a_fabricated_straight(self):
  nodes=[{'x':0,'y':0},{'x':10,'y':0},{'x':0,'y':10},{'x':0,'y':0}]
  r={'name':'tiny','type':'circuit','road':{'nodes':nodes,'segments':[{'length':10}]*3}}
  original=copy.deepcopy(r);self.assertEqual(a.place(r)['status'],'manual-review');self.assertEqual(r,original)
if __name__=='__main__':unittest.main()
