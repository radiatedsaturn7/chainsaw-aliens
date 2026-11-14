"""Focused Bayard art registration and native scene invariants."""
import base64,gzip,json,math,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def read(p):
 d=json.loads((ROOT/p).read_text());return json.loads(gzip.decompress(base64.b64decode(d['data']))) if d.get('__chainsawStorage') else d
class BayardArtTest(unittest.TestCase):
 def setUp(self):
  self.manifest=read('data/server-storage/files/manifest.json')['folders']
  self.race=read('data/server-storage/files/'+self.manifest['races']['Bayard — Road 77 to City Park'])['race']
 def test_native_lighting_and_sky(self):
  r=self.race;self.assertEqual((r['timeOfDay'],r['brightness'],r['visualFx']['preset']),('day',1,'noon'))
  self.assertEqual(r['skyboxArtRef'],'skybox-bayard-noon-2994');self.assertEqual(r['skyboxSettings']['offsetYRatio'],-.1)
 def test_exact_refs_and_safe_existing_footprints(self):
  r=self.race;nodes=r['road']['nodes']
  for label in ['Community Bible Church','City Park Water Tower']:
   p=next(s for s in r['scenery'] if s.get('label')==label)
   self.assertTrue(p['artRef'].startswith('landmark-bayard-'))
   art=read('data/server-storage/files/'+self.manifest['art'][p['artRef']]);self.assertTrue(any(v is None for v in art['frames'][0]))
   self.assertIn(p['doodadRef'],self.manifest['doodads'])
   distances=[]
   for a,b in zip(nodes,nodes[1:]):
    dx=b['x']-a['x'];dz=b['y']-a['y'];t=max(0,min(1,((p['x']-a['x'])*dx+(p['z']-a['y'])*dz)/(dx*dx+dz*dz or 1)))
    distances.append(math.hypot(p['x']-a['x']-t*dx,p['z']-a['y']-t*dz))
   self.assertGreater(min(distances)-p['widthM']/2-max(s.get('roadWidthM',r['road']['width']) for s in r['road']['segments'])/2,8)
if __name__=='__main__':unittest.main()
