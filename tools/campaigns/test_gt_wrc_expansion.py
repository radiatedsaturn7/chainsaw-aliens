"""New circuit/recreation provenance, topology and playable rally coverage."""
import base64,copy,gzip,json,math,unittest
from pathlib import Path
import inspect_raceways
from import_rally_collections import prepare
from import_famous_rally import source_points
import race_track_import as track
COUNTS={'barcelona':2,'mugello':1,'sonoma':2,'long-beach':1,'autopolis':2,'goodwood':1,'dunsfold':1}
GROUPS={'latvia','estonia','sardinia','croatia','poland','central-europe','corsica','ypres','australia'}
ROOT=Path('data/server-storage/files')
def read(p):
 d=json.loads(Path(p).read_text())
 return json.loads(gzip.decompress(base64.b64decode(d['data']))) if '__chainsawStorage' in d else d
class Expansion(unittest.TestCase):
 def test_current_circuit_geometry_and_saved_previews(self):
  specs=[s for s in read('tools/campaigns/raceway_sources.json') if s['key'] in COUNTS]
  self.assertEqual({s['key']:len(s['layouts']) for s in specs},COUNTS)
  catalog={r['id']:r for r in read('data/campaigns/america/raceways/catalog.json')}
  menu=read(ROOT/'menus/Game Menu/document.json')
  for s in specs:
   layouts=inspect_raceways.candidate_layouts(s)
   for selection in s['layouts']:
    with self.subTest(venue=s['key'],layout=selection['key']):
     self.assertTrue(selection['currentLayout']);layout=layouts[selection['index']]
     self.assertAlmostEqual(layout['lengthM'],selection['mappedLengthM'])
     self.assertEqual(track.layout_review_issues(layout),[])
     a,b=layout['points'][0],layout['points'][-1]
     self.assertLess(math.hypot(a['x']-b['x'],a['y']-b['y']),1)
     entry=catalog[f"raceway-{s['key']}-{selection['key']}"]
     race=read(ROOT/entry['documentPath'])['race']
     self.assertEqual(race['source']['layoutEra'],'current')
     self.assertEqual(race['source']['origin']['country'],s['country'])
     self.assertIn(entry['raceRef'],menu['parameters']['campaignRoutePreviews'])
     self.assertFalse(race['road']['autoExtend'])
  self.assertNotIn('raceway-sonoma-indycar',catalog)
 def test_figure_eight_revisits_junction_but_not_edges(self):
  s=next(s for s in read('tools/campaigns/raceway_sources.json') if s['key']=='dunsfold')
  p=inspect_raceways.candidate_layouts(s)[0]['points']
  vertices=[(n['lat'],n['lon']) for n in p[:-1]]
  self.assertLess(len(set(vertices)),len(vertices),'crossover junction retained')
  edges=[frozenset(((a['lat'],a['lon']),(b['lat'],b['lon']))) for a,b in zip(p,p[1:])]
  self.assertEqual(len(edges),len(set(edges)))
  self.assertTrue(2750<sum(math.hypot(b['x']-a['x'],b['y']-a['y']) for a,b in zip(p,p[1:]))<2900)
 def test_reviewed_way_order_rejects_disconnected_and_repeated_edges(self):
  s=next(s for s in read('tools/campaigns/raceway_sources.json') if s['key']=='dunsfold')
  disconnected=copy.deepcopy(s);disconnected['reviewedLayouts'][0]['orderedWays'][1:3]=disconnected['reviewedLayouts'][0]['orderedWays'][1:3][::-1]
  with self.assertRaisesRegex(ValueError,'Disconnected'):inspect_raceways.candidate_layouts(disconnected)
  repeated=copy.deepcopy(s);ids=repeated['reviewedLayouts'][0]['orderedWays'];ids.extend(ids[:])
  with self.assertRaisesRegex(ValueError,'Repeated'):inspect_raceways.candidate_layouts(repeated)
 def test_rally_sources_have_no_repeated_edges_or_unreviewed_reversals(self):
  specs=read('tools/campaigns/gt_wrc_rally_sources.json')
  self.assertEqual({s['collection'] for s in specs},GROUPS)
  for s in specs:
   with self.subTest(stage=s['key']):
    p,_=source_points(prepare(s))
    edges=[frozenset(((round(a['lat'],7),round(a['lon'],7)),(round(b['lat'],7),round(b['lon'],7)))) for a,b in zip(p,p[1:])]
    self.assertEqual(len(edges),len(set(edges)))
    self.assertEqual(set(track.layout_review_issues({'points':p,'open':True})),set(s.get('reviewedLayoutIssues',[])))
    self.assertTrue(s['url'].startswith('https://'));self.assertIn('method',s)
 def test_each_new_rally_has_six_sections_and_both_formats(self):
  groups=[g for g in read('data/campaigns/america/raceways/rally-sections.json')['collections'] if g['id'] in GROUPS]
  self.assertEqual({g['id'] for g in groups},GROUPS)
  menu=read(ROOT/'menus/Game Menu/document.json');manifest=read(ROOT/'manifest.json')
  for g in groups:
   self.assertEqual(g['formats'],[4,12],g['id']);self.assertEqual(len(g['sections']),6,g['id'])
   for section in g['sections']:
    self.assertTrue(section['ref'] in manifest['folders']['races'],section['ref']);self.assertTrue(section['ref'] in menu['parameters']['campaignRoutePreviews'],section['ref'])
    self.assertGreaterEqual(section['lengthM'],1200)
if __name__=='__main__':unittest.main()
