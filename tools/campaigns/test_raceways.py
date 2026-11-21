import unittest,json,sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
sys.path.insert(0,str(Path(__file__).resolve().parent))
import race_track_import as track
from inspect_raceways import candidate_layouts
from rebuild_legacy_stages import sample_terrain_grid

class MappedRaceways(unittest.TestCase):
 def test_service_classifier_distinguishes_pit_routes_from_circuit_names(self):
  for name in ('Pit Lane','Pitlane','Pit Exit','Paddock Access','False Grid'):
   with self.subTest(name=name):
    self.assertTrue(track.is_service_raceway({'name':name}))
  for name in ('National Pit Straight','Pit Straight','Spitzkehre','Paddock Hill Bend'):
   with self.subTest(name=name):
    self.assertFalse(track.is_service_raceway({'name':name}))

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
  # Reviewed course straights/hairpins, not service links. Keep their exact OSM ways.
  named_circuit_ways={
   ('silverstone','gp'):(3571477,'National Pit Straight'),
   ('silverstone','national'):(3571477,'National Pit Straight'),
   ('bathurst','full'):(306192512,'Pit Straight'),
   ('hockenheim','gp'):(117570502,'Spitzkehre'),
  }
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
     selected_tags=[p.get('tags',{}) for p in points[:-1]]
     for tags in selected_tags:
      self.assertNotEqual(tags.get('raceway'),'pit_lane',tags)
      self.assertNotEqual(tags.get('service'),'pit_lane',tags)
      self.assertFalse(track.is_service_raceway(tags),tags)
     reviewed=named_circuit_ways.get((venue['key'],choice['key']))
     if reviewed:
      self.assertIn(reviewed,{(tags.get('osmWayId'),tags.get('name')) for tags in selected_tags})
 def test_editor_limits_remain_bounded_and_default_limit_unchanged(self):
  # Offline dense routes opt in; interactive imports retain the existing 600 cap.
  points=[{'x':i*10,'y':(i%2)*10,'lat':40+i*.0001,'lon':-75,'tags':{}} for i in range(650)]
  layout={'points':points,'name':'dense test','open':True,'place':{'lat':40,'lon':-75,'country':'us'}}
  with self.assertRaisesRegex(ValueError,'limit 600'):track.build(layout,use_elevation=False)
  race=track.build(layout,use_elevation=False,max_control_points=1200)['race']
  self.assertEqual(len(race['road']['nodes']),650)

if __name__=='__main__':unittest.main()
