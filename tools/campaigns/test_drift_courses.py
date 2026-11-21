import base64,gzip,json,math,unittest
from pathlib import Path
from unittest.mock import patch
from inspect_raceways import candidate_layouts
import race_track_import as track
import japan_terrain_tiles as gsi
ROOT=Path('data/server-storage/files')
def read(path):
 d=json.loads(path.read_text())
 return json.loads(gzip.decompress(base64.b64decode(d['data']))) if '__chainsawStorage' in d else d
class DriftImports(unittest.TestCase):
 def test_ten_reviewed_source_layouts_are_closed_and_have_no_spurs(self):
  count=0
  for spec in read(Path('tools/campaigns/raceway_sources.json')):
   selections=[s for s in spec.get('layouts',[]) if s.get('driftChallenge')]
   if not selections:continue
   layouts=candidate_layouts(spec)
   for sel in selections:
    count+=1;l=layouts[sel['index']]
    self.assertAlmostEqual(l['lengthM'],sel['mappedLengthM'])
    self.assertEqual(track.layout_review_issues(l),[])
    self.assertEqual(sel['maxSegmentLengthM'],20)
    self.assertAlmostEqual(l['points'][0]['x'],l['points'][-1]['x'])
    self.assertAlmostEqual(l['points'][0]['y'],l['points'][-1]['y'])
    if spec['key']=='tsukuba':
     p=l['points'];area=sum(a['x']*b['y']-a['y']*b['x'] for a,b in zip(p,p[1:]))
     self.assertGreater(area,0);self.assertTrue(sel['reverse'],'drift direction must be anticlockwise')
  self.assertEqual(count,10)
 def test_installed_courses_have_elevation_scenery_art_and_menu_previews(self):
  manifest=read(ROOT/'manifest.json');menu=read(ROOT/'menus/Game Menu/document.json')
  rows=read(Path('data/campaigns/america/drift-courses/report.json'))
  self.assertEqual(len(rows),10)
  shapes=set()
  for row in rows:
   with self.subTest(race=row['raceRef']):
    r=read(ROOT/manifest['folders']['races'][row['raceRef']])['race']
    self.assertEqual(r['campaign']['scoring'],'drift')
    self.assertEqual(r['competition']['mode'],'solo')
    self.assertEqual(r['location']['country'],'JP')
    self.assertEqual(r['weather'],'clear')
    self.assertEqual(r['timeOfDay'],'day')
    self.assertFalse(r['road']['autoExtend'])
    self.assertIn('GSI',r['source']['elevationProvider'])
    self.assertTrue(r['source']['elevationLayersUsed'])
    self.assertTrue(r['scenery'])
    for prop in r['scenery']:
     if prop.get('doodadRef'):self.assertIn(prop['doodadRef'],manifest['folders']['doodads'])
    self.assertIn(r['roadTextures']['road']['artRef'],manifest['folders']['art'])
    nodes=r['road']['nodes']
    self.assertTrue(all(math.isfinite(n[k]) for n in nodes for k in ['x','y','elevation']))
    self.assertAlmostEqual(nodes[0]['elevation'],nodes[-1]['elevation'])
    shape=tuple((round(n['x'],2),round(n['y'],2)) for n in nodes)
    self.assertNotIn(shape,shapes);shapes.add(shape)
    self.assertIn(row['raceRef'],menu['parameters']['campaignRoutePreviews'])
    entry=next(e for e in menu['parameters']['raceIndex'] if e['ref']==row['raceRef'])
    self.assertTrue(entry['properCircuit'])
class GsiAdapter(unittest.TestCase):
 def test_text_tile_validates_dimensions_nodata_and_finite_elevations(self):
  raw=(',' .join(['12.5']*255+['e'])+'\n')*256
  decoded=gsi.decode_text(raw.encode())
  self.assertEqual(decoded[0][0],12.5);self.assertIsNone(decoded[0][-1])
  for data in [b'1,2\n',raw.replace('12.5','nan').encode()]:
   with self.assertRaises(ValueError):gsi.decode_text(data)
 def test_nodata_uses_next_resolution_not_zero_or_fabricated_flat_ground(self):
  with patch.object(gsi,'tile',side_effect=lambda layer,*args:[[None]*256 for _ in range(256)] if layer=='dem5a' else [[123.5]*256 for _ in range(256)]):
   self.assertEqual(gsi.elevation(37.64,140.37),123.5)
  with patch.object(gsi,'tile',return_value=None):
   with self.assertRaises(ValueError):gsi.elevation(37.64,140.37)
if __name__=='__main__':unittest.main()
