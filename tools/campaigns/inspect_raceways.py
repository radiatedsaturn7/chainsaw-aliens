"""Inspect editor importer layout candidates from reproducible OSM snapshots."""
import sys,json,re,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
import race_route_import as route
import import_side_races as side
ROOT=Path('data/campaigns/america/raceways')
def candidate_layouts(spec):
 ways=json.loads((ROOT/'sources'/f"{spec['key']}.json").read_text())
 # Shared connectors may run opposite ways in different official layouts.
 # Apply only explicitly reviewed way-direction overrides; never join by proximity.
 directions=spec.get('wayDirections',{})
 ways=[{**w,'tags':{**w.get('tags',{}),'oneway':directions[str(w['id'])]}} if str(w['id']) in directions else w for w in ways]
 raw_ways=ways
 if spec.get('reviewedLayouts'):
  # Figure-eight laps can revisit a junction without repeating an edge.
  # Explicit reviewed way order retains source node identity at every seam.
  by_id={w['id']:w for w in ways};result=[]
  for selection in spec['reviewedLayouts']:
   points=[];last=None;first=None;seen=set()
   for signed_id in selection['orderedWays']:
    w=by_id[abs(signed_id)];ns=w['nodes'];geometry=w['geometry']
    if signed_id<0:ns=ns[::-1];geometry=geometry[::-1]
    if last is not None and ns[0]!=last:raise ValueError('Disconnected reviewed circuit ways')
    if first is None:first=ns[0]
    for i in range(len(ns)-1):
     edge=frozenset((ns[i],ns[i+1]))
     if edge in seen:raise ValueError('Repeated reviewed circuit edge')
     seen.add(edge);g=geometry[i];x,y=track.metric(g['lat'],g['lon'],(spec['lat'],spec['lon']))
     points.append(dict(x=x,y=y,**g,tags={**w.get('tags',{}),'osmWayId':w['id']}))
    last=ns[-1]
   if last!=first:raise ValueError('Reviewed circuit is not closed')
   points.append({**points[0],'tags':{}})
   length=sum(math.hypot(b['x']-a['x'],b['y']-a['y']) for a,b in zip(points,points[1:]))
   result.append(dict(name=selection['name'],points=points,lengthM=length))
  return result
 ways=[w for w in ways if w.get('tags',{}).get('area')!='yes' and not track.is_service_raceway(w.get('tags',{})) and not re.search(r'kart',str(w.get('tags',{})),re.I)]
 if spec.get('separateComponents'):
  # A nearby driver-training maze must not consume the main circuit's cycle budget.
  pending=list(ways);layouts=[]
  while pending:
   component=[pending.pop()];nodes=set(component[0]['nodes']);changed=True
   while changed:
    changed=False
    for w in pending[:]:
     if nodes.intersection(w['nodes']):component.append(w);nodes.update(w['nodes']);pending.remove(w);changed=True
   try:layouts.extend(track.extract_layouts(component,(spec['lat'],spec['lon']),max_layouts=256,max_cycles=512))
   except ValueError:pass
  if spec.get('raceRelationWayIds'):
   # Public road one-way restrictions apply outside race closures. The mapped
   # race relation supplies the course, while its direction is reviewed below.
   ids=set(spec['raceRelationWayIds'])
   relation=[{**w,'tags':{**w['tags'],'oneway':'no'}} for w in raw_ways if w['id'] in ids]
   if len(relation)!=len(ids):raise ValueError('Incomplete race relation snapshot')
   layouts.extend(track.extract_layouts(relation,(spec['lat'],spec['lon'])))
  return sorted(layouts,key=lambda l:-l['lengthM'])
 return track.extract_layouts(ways,(spec['lat'],spec['lon']),max_layouts=256,max_cycles=512)

if __name__=='__main__':
 for spec in json.loads(Path('tools/campaigns/raceway_sources.json').read_text()):
  if len(sys.argv)>1 and spec['key'] not in sys.argv[1:]:continue
  path=ROOT/'sources'/f"{spec['key']}.json"
  try:
   if path.exists():ways=json.loads(path.read_text())
   else:
    ways=side.snapshot([spec['lat'],spec['lon'],'circuit',0]) if spec.get('country','us')=='us' else route.overpass(f'[out:json][timeout:25];way(around:{spec.get("radius",3000)},{spec["lat"]},{spec["lon"]})["highway"="raceway"];out geom;',track.request_json)
    path.write_text(json.dumps(ways,separators=(',',':'))+'\n')
   layouts=candidate_layouts(spec)
   (ROOT/f"{spec['key']}-layouts.json").write_text(json.dumps(layouts,separators=(',',':'))+'\n')
   print(spec['key'],[(i,round(l['lengthM']),l['name']) for i,l in enumerate(layouts)],flush=True)
  except Exception as e:print(spec['key'],'ERROR',str(e),flush=True)
