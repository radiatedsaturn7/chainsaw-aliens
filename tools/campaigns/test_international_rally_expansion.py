import json,math,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from inspect_raceways import candidate_layouts
from import_famous_rally import SPECS,source_points
import race_track_import as track

class ExpansionTests(unittest.TestCase):
 def test_terrain_resample_keeps_planar_heights_and_road_nodes(self):
  from resample_import_terrain import resample_import_terrain
  cells={f'{x},{y}':{'elevation':(x+.5)*45*.01+(y+.5)*45*.02,'tileId':'grass'} for x in range(8) for y in range(8)}
  nodes=[{'x':30,'y':60,'elevation':7}]
  race={'road':{'nodes':nodes,'tileMap':{'cellSizeM':45,'cells':cells,'defaultTileId':'grass'}},'source':{}}
  resample_import_terrain(race,80)
  self.assertIs(race['road']['nodes'],nodes);self.assertEqual(nodes[0]['elevation'],7)
  for x in range(4):
   for y in range(4):self.assertAlmostEqual(race['road']['tileMap']['cells'][f'{x},{y}']['elevation'],(x+.5)*80*.01+(y+.5)*80*.02)

 def test_circuit_choices_match_reviewed_geometry(self):
  expected={'nordschleife':6,'hockenheim':2,'hungaroring':1,'sepang':3};count=0
  for spec in json.loads(Path('tools/campaigns/raceway_sources.json').read_text()):
   if spec['key'] not in expected:continue
   self.assertEqual(len(spec['layouts']),expected[spec['key']]);layouts=candidate_layouts(spec)
   for selection in spec['layouts']:
    layout=layouts[selection['index']];self.assertAlmostEqual(layout['lengthM'],selection['mappedLengthM']);self.assertEqual(track.layout_review_issues(layout),[]);count+=1
    if selection['key']=='full':continue
    points=layout['points'];area=sum(a['x']*b['y']-b['x']*a['y'] for a,b in zip(points,points[1:]));self.assertGreater(area*(-1 if selection.get('reverse') else 1),0)
    self.assertNotIn('Rallycross',layout['name']);self.assertNotIn('Boxengasse',layout['name'])
    if selection['key']=='nls':
     self.assertNotIn('Variante 24h-Rennen',layout['name']);self.assertLess(abs(layout['lengthM']-24358),100)
  self.assertEqual(count,12)
 def test_rally_geometry_is_contiguous_and_not_repeated(self):
  for spec in SPECS:
   points,_=source_points(spec);layout={'points':points,'open':True};self.assertEqual(track.layout_review_issues(layout),[],spec['key'])
   edges=[tuple(sorted(((round(a['lat'],7),round(a['lon'],7)),(round(b['lat'],7),round(b['lon'],7))))) for a,b in zip(points,points[1:])]
   self.assertEqual(len(edges),len(set(edges)),spec['key'])
   self.assertLess(max(math.hypot(a['x']-b['x'],a['y']-b['y']) for a,b in zip(points,points[1:])),400,spec['key'])
 def test_official_fafe_start_finish_and_mixed_surface(self):
  spec=next(s for s in SPECS if s['key']=='fafe');points,_=source_points(spec)
  self.assertAlmostEqual(points[0]['lat'],41.4582537392542);self.assertAlmostEqual(points[-1]['lon'],-8.09041852964504)
  self.assertIn('asphalt',{p['tags']['surface'] for p in points})
if __name__=='__main__':unittest.main()
