"""Current GRID venue additions: source continuity and installed menu coverage."""
import base64,gzip,json,unittest
from pathlib import Path
from inspect_raceways import candidate_layouts
import race_track_import as track
COUNTS={'cota':4,'mont-tremblant':5,'jarama':1,'istanbul':2,'yas-marina':8}
ROOT=Path('data/server-storage/files')
def read(path):
 d=json.loads(path.read_text())
 return json.loads(gzip.decompress(base64.b64decode(d['data']))) if '__chainsawStorage' in d else d
class GridCircuits(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.specs=[s for s in read(Path('tools/campaigns/raceway_sources.json')) if s['key'] in COUNTS]
 def test_current_reviewed_layouts_are_closed_and_distinct(self):
  self.assertEqual({s['key']:len(s['layouts']) for s in self.specs},COUNTS)
  for spec in self.specs:
   layouts=candidate_layouts(spec);shapes=set()
   for selection in spec['layouts']:
    with self.subTest(venue=spec['key'],layout=selection['key']):
     self.assertTrue(selection['currentLayout'])
     layout=layouts[selection['index']];points=layout['points']
     self.assertAlmostEqual(layout['lengthM'],selection['mappedLengthM'])
     self.assertEqual(track.layout_review_issues(layout),[])
     self.assertLess((points[0]['x']-points[-1]['x'])**2+(points[0]['y']-points[-1]['y'])**2,1)
     shape=tuple((round(p['x'],2),round(p['y'],2)) for p in points)
     self.assertNotIn(shape,shapes);shapes.add(shape)
 def test_saved_layouts_have_sources_previews_and_location(self):
  catalog={r['id']:r for r in read(Path('data/campaigns/america/raceways/catalog.json'))}
  manifest=read(ROOT/'manifest.json');menu=read(ROOT/'menus/Game Menu/document.json')
  for spec in self.specs:
   for selection in spec['layouts']:
    key=f"raceway-{spec['key']}-{selection['key']}"
    with self.subTest(layout=key):
     row=catalog[key];self.assertEqual(row['status'],'installed')
     race=read(ROOT/row['documentPath'])['race'];source=race['source']
     self.assertEqual(source['layoutEra'],'current')
     self.assertEqual(source['origin']['country'],spec['country'])
     self.assertEqual(source['layoutName'],selection['label'])
     self.assertTrue(source['osmWayIds']);self.assertTrue(source['layoutReference'])
     self.assertFalse(race['road']['autoExtend'])
     self.assertEqual(manifest['folders']['races'][row['raceRef']],row['documentPath'])
     self.assertTrue(row['raceRef'] in menu['parameters']['campaignRoutePreviews'],row['raceRef'])
     if spec['key']=='cota':self.assertEqual(source['stateCode'],'TX')
 def test_current_yas_and_nascar_not_obsolete_lengths(self):
  specs={s['key']:s for s in self.specs}
  nascar=next(s for s in specs['cota']['layouts'] if s['key']=='nascar-national')
  self.assertTrue(3800<nascar['mappedLengthM']<3900)
  gp=next(s for s in specs['yas-marina']['layouts'] if s['key']=='gp')
  self.assertTrue(5200<gp['mappedLengthM']<5350)
  handling=next(s for s in specs['yas-marina']['layouts'] if s['key']=='north-handling')
  self.assertEqual(handling['widthM'],9.55)
if __name__=='__main__':unittest.main()
