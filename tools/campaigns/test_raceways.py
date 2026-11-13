import unittest,json,sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parent))
import race_track_import as track
from inspect_raceways import candidate_layouts
from rebuild_legacy_stages import sample_terrain_grid

class MappedRaceways(unittest.TestCase):
 def test_terrain_samples_use_same_geographic_axes_and_datum_as_road(self):
  origin=(43.98,7.39)
  cells={key:{'elevation':0} for key in ['-2,3','4,-5','0,0']}
  road={'tileMap':{'cellSizeM':50,'cells':cells}}
  def slope(lat,lon):
   x,y=track.metric(lat,lon,origin)
   return 800+x*.1+y*.3
  sample_terrain_grid(road,origin,800,slope)
  for key,value in cells.items():
   ix,iy=map(int,key.split(','))
   self.assertAlmostEqual(value['elevation'],((ix+.5)*5+(iy+.5)*15)/12,places=7)

 def test_selected_layouts_are_closed_unique_contiguous_source_edges(self):
  root=Path('data/campaigns/america/raceways')
  for venue in json.loads(Path('tools/campaigns/raceway_sources.json').read_text()):
   layouts=candidate_layouts(venue)
   ways=json.loads((root/'sources'/f"{venue['key']}.json").read_text())
   edges=set()
   for w in ways:
    g=w['geometry']
    for a,b in zip(g,g[1:]):edges.add(frozenset([(a['lat'],a['lon']),(b['lat'],b['lon'])]))
   for choice in venue.get('layouts',[]):
    with self.subTest(venue=venue['key'],layout=choice['key']):
     layout=layouts[choice['index']];points=layout['points']
     self.assertLess(abs(layout['lengthM']-choice['mappedLengthM']),2)
     coords=[(p['lat'],p['lon']) for p in points]
     self.assertEqual(coords[0],coords[-1]);used=set()
     for a,b in zip(coords,coords[1:]):
      edge=frozenset([a,b]);self.assertIn(edge,edges);self.assertNotIn(edge,used);used.add(edge)
     self.assertFalse(any('pit' in p.get('tags',{}).get('name','').lower() for p in points))
 def test_editor_limits_remain_bounded_and_default_limit_unchanged(self):
  # Offline dense routes opt in; interactive imports retain the existing 600 cap.
  points=[{'x':i*10,'y':(i%2)*10,'lat':40+i*.0001,'lon':-75,'tags':{}} for i in range(650)]
  layout={'points':points,'name':'dense test','open':True,'place':{'lat':40,'lon':-75,'country':'us'}}
  with self.assertRaisesRegex(ValueError,'limit 600'):track.build(layout,use_elevation=False)
  race=track.build(layout,use_elevation=False,max_control_points=1200)['race']
  self.assertEqual(len(race['road']['nodes']),650)

if __name__=='__main__':unittest.main()
