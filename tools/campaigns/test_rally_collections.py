import json, math, sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from import_rally_collections import SOURCES, prepare, coordinates
from import_famous_rally import source_points
import race_track_import as track

class RallyCollectionTests(unittest.TestCase):
 def test_new_sections_keep_real_material_transitions_and_tunnel(self):
  additions=json.loads(Path('data/campaigns/america/raceways/rally-additions.json').read_text())
  self.assertEqual(len(additions),6)
  for s in additions:
   prepared=prepare(s);self.assertIsNone(prepared['year'])
   points,_=source_points(prepared)
   if s['key']=='spain-fatarella':self.assertEqual({p['tags']['surface'] for p in points},{'paved','gravel'})
   if s['key']=='germany-panzerplatte':self.assertEqual({p['tags']['surface'] for p in points},{'asphalt','concrete'})
   if s['key']=='japan-isegami':
    self.assertEqual({p['tags']['osmWayId'] for p in points if p['tags'].get('tunnel')=='yes'},{32837065})

 def test_tunnel_deck_ignores_hill_over_bore_and_retains_portals(self):
  from rally_structures import apply_tunnel_decks
  nodes=[dict(x=x,y=0,elevation=h) for x,h in [(0,0),(50,1),(100,8),(200,2),(250,3)]]
  race={'road':{'width':4.5,'nodes':nodes,'segments':[{} for _ in range(4)]}}
  samples=[{'tags':{'tunnel':'yes'} if i in (1,2) else {}} for i in range(5)]
  apply_tunnel_decks(race,samples)
  self.assertAlmostEqual(nodes[2]['elevation'],1+50/150)
  self.assertEqual(nodes[1]['elevation'],1);self.assertEqual(nodes[3]['elevation'],2)
  self.assertEqual([e['structure'] for e in race['road']['network']['edges']],['road','tunnel','road'])
  self.assertEqual(race['road']['segments'][1]['elevation'],nodes[2]['elevation'])

 def test_unpaved_surface_aliases_do_not_become_asphalt(self):
  for source,expected in [('fine_gravel','gravel'),('pebblestone','gravel'),('sand','dirt'),('unpaved','dirt'),('asphalt','asphalt')]:
   points=[{'x':i*60,'y':0,'lat':40,'lon':-100+i*.0007,'tags':{'surface':source}} for i in range(6)]
   layout={'name':'Surface fixture','open':True,'points':points,'place':{'name':'Fixture','lat':40,'lon':-100,'country':'us'}}
   race=track.build(layout,use_elevation=False)['race']
   self.assertEqual({s['surface'] for s in race['road']['segments']},{expected})

 def test_named_paddock_bend_is_track_not_a_pit_lane(self):
  self.assertFalse(track.is_service_raceway({'name':'Paddock Bend'}))
  for name in ['Paddock','Paddock access','Pit Lane']:
   self.assertTrue(track.is_service_raceway({'name':name}))
 def test_only_competitive_trace_is_selected(self):
  line=' '.join(f'{1+i*.001},51,0' for i in range(25))
  xml=f'<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Stage</name><LineString><coordinates>{line}</coordinates></LineString></Placemark><Placemark><name>Liaison</name><LineString><coordinates>0,0 1,1</coordinates></LineString></Placemark></Document></kml>'.encode()
  result=coordinates(xml,'kml','Stage');self.assertEqual(len(result),25);self.assertEqual(result[0],[51,1])
  with self.assertRaises(ValueError):coordinates(xml,'kml','Missing stage')
  with self.assertRaises(ValueError):coordinates(xml.replace(b'</LineString>',b'</LineString><LineString><coordinates>0,0 1,1</coordinates></LineString>',1),'kml','Stage')

 def test_only_identical_repeated_passes_can_be_deduplicated(self):
  line=' '.join(f'{1+i*.001},51,0' for i in range(25))
  placemark=f'<Placemark><name>Stage</name><LineString><coordinates>{line}</coordinates></LineString></Placemark>'
  xml=f'<kml xmlns="http://www.opengis.net/kml/2.2"><Document>{placemark}{placemark}</Document></kml>'.encode()
  with self.assertRaises(ValueError):coordinates(xml,'kml','Stage')
  self.assertEqual(len(coordinates(xml,'kml','Stage',identical_passes=True)),25)
  different=xml.replace(b'1.024,51,0',b'1.025,51,0',1)
  with self.assertRaises(ValueError):coordinates(different,'kml','Stage',identical_passes=True)

 def test_all_routes_are_finite_contiguous_and_not_repeated(self):
  for spec in SOURCES:
   p,_=source_points(prepare(spec))
   with self.subTest(stage=spec['key']):
    self.assertEqual(track.layout_review_issues({'points':p,'open':True}),spec.get('reviewedLayoutIssues',[]))
    edges=[tuple(sorted(((round(a['lat'],7),round(a['lon'],7)),(round(b['lat'],7),round(b['lon'],7))))) for a,b in zip(p,p[1:])]
    self.assertEqual(len(edges),len(set(edges)))
    # Organizer Mineral de Pozos trace has one 441 m sparse segment; retain source resolution.
    self.assertLess(max(math.hypot(a['x']-b['x'],a['y']-b['y']) for a,b in zip(p,p[1:])),600 if spec['format']=='mapped-snow' else (450 if spec['key']=='mexico-mineral-pozos-2025' else 400))
    dense=track.densify(p,60)
    self.assertLessEqual(max(math.hypot(a['x']-b['x'],a['y']-b['y']) for a,b in zip(dense,dense[1:])),60.01)

 def test_reviewed_sharp_turns_are_connected_junctions_not_retraced_spurs(self):
  expected={'kenya-hells-gate':(190,35283035,35283037),'japan-naekawa':(302,226201402,226201413)}
  for key,(index,incoming,outgoing) in expected.items():
   spec=prepare(next(s for s in SOURCES if s['key']==key));points,source=source_points(spec)
   self.assertEqual(points[index-1]['tags']['osmWayId'],incoming)
   self.assertEqual(points[index]['tags']['osmWayId'],outgoing)
   ways={w['id']:w for w in json.loads(source.read_text())}
   shared=set(ways[incoming]['nodes']) & set(ways[outgoing]['nodes'])
   self.assertTrue(shared)
   junctions=[p for w in [ways[incoming]] for n,p in zip(w['nodes'],w['geometry']) if n in shared]
   self.assertTrue(any(abs(p['lat']-points[index]['lat'])<1e-7 and abs(p['lon']-points[index]['lon'])<1e-7 for p in junctions))
   self.assertIn('junction',spec['method'])

 def test_winter_recreations_use_snow_and_have_honest_provenance(self):
  for spec in SOURCES:
   if spec['format']!='mapped-snow':continue
   ready=prepare(spec);points,_=source_points(ready)
   self.assertIsNone(ready['year'])
   self.assertEqual({p['tags']['surface'] for p in points},{'snow'})
   self.assertIn('recreation',ready['method'])
   self.assertTrue(ready['reference'].startswith('https://'))

 def test_historical_tarzan_variants_are_distinct(self):
  lengths=[]
  for key in ['acropolis-tarzan-2021','acropolis-tarzan-2024']:
   p,_=source_points(prepare(next(s for s in SOURCES if s['key']==key)))
   lengths.append(sum(math.hypot(a['x']-b['x'],a['y']-b['y']) for a,b in zip(p,p[1:])))
  self.assertGreater(lengths[1]-lengths[0],10000)

 def test_nefr_does_not_claim_exact_historical_edition(self):
  for spec in SOURCES:
   if spec['collection']!='new-england':continue
   ready=prepare(spec);self.assertIsNone(ready['year']);self.assertIn('Road Section',ready['name']);self.assertIn('not a reconstruction',ready['method'])

if __name__=='__main__':unittest.main()
