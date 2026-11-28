"""Additional rally roads must be real connected, unrepeated OSM edges."""
import json,unittest,copy,math
from pathlib import Path
from import_rally_collections import SOURCES,prepare
from import_famous_rally import source_points
import race_track_import as track
ROOT=Path('data/campaigns/america/raceways')
PAIRS=[('chile-conuco-forest','chile-conuco'),('wales-hafren-forest','wales-sweet-lamb'),('germany-baumholder-range','germany-panzerplatte'),('japan-otaga-mountain','japan-isegami'),('100aw-kp-road','100aw-cattle-guard')]
def edge(a,b):return tuple(sorted((tuple(round(a[k],7) for k in ('lat','lon')),tuple(round(b[k],7) for k in ('lat','lon')))))
class Completion(unittest.TestCase):
 def test_additional_roads_do_not_repeat_existing_stage_edges(self):
  for key,parent in PAIRS:
   with self.subTest(key=key):
    spec=prepare(next(s for s in SOURCES if s['key']==key));pts,path=source_points(spec)
    old,_=source_points(prepare(next(s for s in SOURCES if s['key']==parent)))
    edges=[edge(a,b) for a,b in zip(pts,pts[1:])];oldedges={edge(a,b) for a,b in zip(old,old[1:])}
    self.assertEqual(len(edges),len(set(edges)));self.assertFalse(set(edges)&oldedges)
    ways=json.loads(path.read_text());sourceedges={edge(a,b) for w in ways for a,b in zip(w['geometry'],w['geometry'][1:])}
    self.assertTrue(set(edges)<=sourceedges)
    self.assertTrue(all(w.get('sourceWayId') and len(w['nodes'])==2 for w in ways))
    self.assertEqual(track.layout_review_issues(dict(points=pts,open=True)),[])
 def test_winding_aichi_can_search_further_without_changing_other_imports(self):
  from audit_race_lines import place
  spec=prepare(next(s for s in SOURCES if s['key']=='japan-otaga-mountain'))
  pts,_=source_points(spec);pts=track.densify(track.simplify(pts),60)
  nodes=[dict(x=p['x'],y=p['y'],elevation=0) for p in pts]
  r=dict(name='Otaga test',type='sprint',road=dict(nodes=nodes,segments=[dict(length=math.hypot(b['x']-a['x'],b['y']-a['y'])) for a,b in zip(nodes,nodes[1:])]))
  original=copy.deepcopy(r);self.assertEqual(place(r)['status'],'manual-review');self.assertEqual(r,original)
  result=place(r,max_search_m=spec['timingSearchDistanceM']);self.assertEqual(result['status'],'adjusted')
  self.assertGreater(result['trimStartM'],1000);self.assertGreater(result['lengthAfterM'],9000)
  self.assertTrue(all(v<=10 for v in result['corridorDegrees']))
  coords={(n['x'],n['y']) for n in nodes};self.assertTrue(all((n['x'],n['y']) in coords for n in r['road']['nodes']))
if __name__=='__main__':unittest.main()
