"""Reviewed state events and landmark city routes using the editor road importer.
Never invent a connector or silently install another location after a source failure.
"""
import sys,json,math,itertools,hashlib,argparse,re
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
import race_route_import as route
import import_america as america
import terrain_tiles
from import_side_races import mapped_road_width
from rebuild_legacy_stages import sample_terrain_grid
from audit_race_lines import place
ROOT=Path('data/campaigns/america/state-expansion')
OUT=Path('artifacts/campaign-import/state-expansion')

def right_angle_turns(points):
 count=0
 for a,b,c in zip(points,points[1:],points[2:]):
  ab=(b['x']-a['x'],b['y']-a['y']);bc=(c['x']-b['x'],c['y']-b['y'])
  if min(math.hypot(*ab),math.hypot(*bc))<2:continue
  angle=abs(math.degrees(math.atan2(ab[0]*bc[1]-ab[1]*bc[0],ab[0]*bc[0]+ab[1]*bc[1])))
  if 60<=angle<=120:count+=1
 return count

def city_route(row,ways,use_junctions=True):
 origin=(row['lat'],row['lon']);nodes,edges=route.graph(ways,origin)
 targets=[dict(zip(('x','y'),track.metric(m['lat'],m['lon'],origin))) for m in row['landmarks']]
 # Public-street junctions around the landmark district provide approaches and
 # exits. They are actual OSM nodes, not synthetic zig-zags or freeway links.
 degree={}
 for a,b,_ in edges:
  degree.setdefault(a,set()).add(b);degree.setdefault(b,set()).add(a)
 # Anchor to the connected public-street core, not isolated access stubs.
 adjacency={};reverse={}
 for a,b,tags in edges:
  one=str(tags.get('oneway','yes' if tags.get('junction')=='roundabout' else '')).lower()
  for u,v in ([(a,b)] if one in ('yes','1','true') else [(b,a)] if one=='-1' else [(a,b),(b,a)]):
   adjacency.setdefault(u,[]).append(v);reverse.setdefault(v,[]).append(u)
 seen=set();order=[]
 for n in nodes:
  if n in seen:continue
  stack=[(n,False)]
  while stack:
   u,finished=stack.pop()
   if finished:order.append(u);continue
   if u in seen:continue
   seen.add(u);stack.append((u,True));stack.extend((v,False) for v in adjacency.get(u,[]) if v not in seen)
 seen=set();components=[]
 for n in reversed(order):
  if n in seen:continue
  component=set();stack=[n];seen.add(n)
  while stack:
   u=stack.pop();component.add(u)
   for v in reverse.get(u,[]):
    if v not in seen:seen.add(v);stack.append(v)
  components.append(component)
 core=max(components,key=len)
 # Exclude cul-de-sac districts reachable only by retracing one bridge edge.
 # This is graph connectivity, unrelated to an OSM physical bridge tag.
 discovery={};low={};parent={};bridges=set();clock=0
 for root in core:
  if root in discovery:continue
  clock+=1;discovery[root]=low[root]=clock;stack=[(root,iter(degree.get(root,())))]
  while stack:
   u,it=stack[-1]
   try:v=next(it)
   except StopIteration:
    stack.pop()
    if u in parent:
     p=parent[u];low[p]=min(low[p],low[u])
     if low[u]>discovery[p]:bridges.add(frozenset((p,u)))
    continue
   if v not in core or parent.get(u)==v:continue
   if v in discovery:low[u]=min(low[u],discovery[v]);continue
   parent[v]=u;clock+=1;discovery[v]=low[v]=clock;stack.append((v,iter(degree.get(v,()))))
 groups=[];seen=set()
 for root in core:
  if root in seen:continue
  group=set();stack=[root];seen.add(root)
  while stack:
   u=stack.pop();group.add(u)
   for v in degree.get(u,()):
    if v in core and v not in seen and frozenset((u,v)) not in bridges:seen.add(v);stack.append(v)
  groups.append(group)
 core=max(groups,key=len)
 candidates=[nodes[n] for n,d in degree.items() if len(d)>=3 and n in core]
 if not candidates:raise ValueError('No connected local-street junctions')
 # Landmarks can sit inside pedestrian parks or dead-end access roads. Pass
 # their nearest through-street intersection instead of routing into a driveway.
 if use_junctions:targets=[min(candidates,key=lambda p:math.hypot(p['x']-m['x'],p['y']-m['y'])) for m in targets]
 xs=[p['x'] for p in targets];ys=[p['y'] for p in targets]
 corners=[(min(xs)-600,min(ys)-600),(max(xs)+600,min(ys)-600),(max(xs)+600,max(ys)+600),(min(xs)-600,max(ys)+600)]
 approaches=[min(candidates,key=lambda p:math.hypot(p['x']-x,p['y']-y)) for x,y in corners]
 best=None;failures=0
 # Try both directions and alternate landmark orders; one-way streets determine
 # the actual path. Avoid using the same edge again, even in reverse.
 for order in itertools.permutations(range(len(targets))):
  for start,end in [(0,2),(2,0),(1,3),(3,1)]:
   anchors=[approaches[start],*[targets[i] for i in order],approaches[end]]
   try:points=route.trace(ways,origin,anchors,max_snap=500,avoid_repeated_edges=True)
   except ValueError:failures+=1;continue
   length=america.profile(points)[0][-1];turns=right_angle_turns(points)
   if not 2500<=length<=15000 or turns<4:continue
   # Prefer 6–10 km city races, enough blocks to brake/accelerate repeatedly.
   score=abs(length-7500)+max(0,10-turns)*150
   if best is None or score<best[0]:best=(score,points,order,anchors,turns)
   if score<250:break
  if best is not None and best[0]<250:break
 if best is None and use_junctions:return city_route(row,ways,False)
 if best is None:raise ValueError(f'No connected non-repeating local route with four square turns ({failures} disconnected candidates)')
 _,points,order,anchors,turns=best
 return points,{'landmarkOrder':[row['landmarks'][i]['name'] for i in order],'waypoints':[{'x':p['x'],'y':p['y']} for p in anchors],'rightAngleTurns':turns,'routing':'OSM connected local streets; one-way aware; no repeated edges; no motorway/trunk roads. Turn-restriction relations are not modeled for these fictional closed-road events.'}

def circuit_layout(row,ways):
 if row.get('includeWayIds'):ways=[w for w in ways if w['id'] in row['includeWayIds']]
 ways=[w for w in ways if w.get('tags',{}).get('area')!='yes' and not re.search(r'\bpit\b|pitlane|kart|drag',str(w.get('tags',{})),re.I)]
 layouts=track.extract_layouts(ways,(row['lat'],row['lon']),max_layouts=256,max_cycles=512)
 if not layouts:raise ValueError('No mapped closed circuit')
 preview=ROOT/'previews';preview.mkdir(exist_ok=True)
 (preview/f"{row['id']}.json").write_text(json.dumps(layouts,separators=(',',':'))+'\n')
 if 'layoutIndex' not in row:raise ValueError('Circuit candidates cached; review layoutIndex before import')
 layout=layouts[row['layoutIndex']]
 if abs(layout['lengthM']-row['mappedLengthM'])>2:raise ValueError('Circuit selection changed; review again')
 return layout['points'],{'layoutIndex':row['layoutIndex'],'mappedLengthM':layout['lengthM'],'layoutReference':row['references'][0],'layoutNotes':row.get('layoutNotes',row.get('notes','Mapped centerline reviewed against published course information.'))}

def build(row):
 snapshot=ROOT/'sources'/f"{row['id']}.json";raw=snapshot.read_bytes();snapshot_hash=hashlib.sha256(raw).hexdigest();ways=json.loads(raw)
 if row.get('excludeName'):ways=[w for w in ways if not re.search(row['excludeName'],w.get('tags',{}).get('name',''),re.I)]
 for w in ways:
  tags=w.setdefault('tags',{});tags['width']=str(mapped_road_width(tags,11 if row['kind']=='circuit' else row.get('defaultWidthM',7)))
  if row.get('sourceSurface'):tags['surface']=row['sourceSurface']
  if tags.get('surface') in ('fine_gravel','pebblestone','rock'):tags['surface']='gravel'
 if row['kind']=='city':
  cached_path=OUT/f"{row['id']}.json"
  cached=json.loads(cached_path.read_text()) if cached_path.exists() else {}
  source=cached.get('source',{});reference=source.get('routeReference',{})
  if source.get('landmarkPlan')==row['landmarks'] and reference.get('waypoints') and source.get('sourceSnapshotSha256',snapshot_hash)==snapshot_hash:
   points=route.trace(ways,(row['lat'],row['lon']),reference['waypoints'],max_snap=500,avoid_repeated_edges=True)
  else:points,reference=city_route(row,ways)
 elif row['kind']=='circuit':points,reference=circuit_layout(row,ways)
 elif row.get('waypoints'):
  selected=[w for w in ways if w.get('tags',{}).get('highway') not in ('service','track','motorway','motorway_link') or w['id'] in row.get('allowedServiceWayIds',[])]
  origin=(row['lat'],row['lon'])
  anchors=[dict(zip(('x','y'),track.metric(p['lat'],p['lon'],origin))) for p in row['waypoints']]
  points=route.trace(selected,origin,anchors,max_snap=10,avoid_repeated_edges=True)
  reference={'routing':'Ordered GPS waypoints on connected public OSM roads; no repeated edges; service roads require explicit reviewed way IDs.', 'waypoints':row['waypoints'],'allowedServiceWayIds':row.get('allowedServiceWayIds',[])}
 else:
  points=america.longest_connected_trace(ways,(row['lat'],row['lon']))
  # These are interesting named-road sections, not artificially lengthened tours.
  if row.get('finishElevation'):
   rising=terrain_tiles.elevation(points[-1]['lat'],points[-1]['lon'])>terrain_tiles.elevation(points[0]['lat'],points[0]['lon'])
   if rising!=(row['finishElevation']=='highest'):points=[{**p,'tags':points[max(0,i-1)].get('tags',{})} for i,p in reversed(list(enumerate(points)))]
   _,times,_=america.profile(points,row.get('paceCapMps',28))
   first=next((i for i,t in enumerate(times) if times[-1]-t<=row.get('targetSeconds',660)),0)
   points=points[first:]
  elif row.get('targetSeconds'):
   america.TARGET_SECONDS=row['targetSeconds'];points=america.select_section(points,row)
  elif america.profile(points)[0][-1]>14000:
   distances=america.profile(points)[0]
   options=[(right_angle_turns(points[i:j]),i,j) for i in range(0,len(points),20) for j in [next((j for j in range(i+1,len(points)) if distances[j]-distances[i]>=11000),len(points)-1)] if distances[j]-distances[i]>=7500]
   if not options:raise ValueError('No suitable contiguous road segment')
   _,i,j=max(options);points=points[i:j+1]
  reference={'routing':'Longest connected named-road section, bounded to a practical contiguous driving stage.'}
  if row.get('targetSeconds'):reference.update(targetSeconds=row['targetSeconds'],paceCapMps=row.get('paceCapMps',28),finishElevation=row.get('finishElevation'),excludeName=row.get('excludeName'),sourceSurface=row.get('sourceSurface'))
 if row.get('reverse'):
  points=[{**p,'tags':points[i-1].get('tags',{})} for i,p in reversed(list(enumerate(points)))];reference['direction']='Reverse of mapped source traversal, selected for uphill progression.'
 length=america.profile(points)[0][-1]
 if length<1500:raise ValueError(f'Only {length:.0f} m of mapped road; expand the extract')
 layout={'name':row['name'],'displayName':row['name'],'place':{'name':row['name'],'lat':row['lat'],'lon':row['lon'],'country':'us'},'points':points,'lengthM':length,'open':row['kind']!='circuit'}
 race=track.build(layout,width=11 if row['kind']=='circuit' else row.get('defaultWidthM',7),fetch=terrain_tiles.importer_fetch,max_segment_length_m=25 if row['kind']=='city' else 40,max_control_points=1200)['race']
 if any('unavailable' in w or 'flat editable' in w for w in race['source']['warnings']):raise ValueError('DEM missing; do not install flat substitute')
 sampled=track.densify(track.simplify(points),25 if row['kind']=='city' else 40)
 if len(sampled)!=len(race['road']['nodes']):raise ValueError('Control-point sampling changed')
 for n,p in zip(race['road']['nodes'],sampled):n['elevation']=(terrain_tiles.elevation(p['lat'],p['lon'])-race['source']['elevationDatumM'])/12
 # DEM samples describe ground/water, not the deck of a mapped bridge.
 bridges=0;i=0
 while i<len(sampled)-1:
  if sampled[i].get('tags',{}).get('bridge') not in ('yes','viaduct'):
   i+=1;continue
  first=i
  while i<len(sampled)-1 and sampled[i].get('tags',{}).get('bridge') in ('yes','viaduct'):i+=1
  a,b=max(0,first-1),min(len(sampled)-1,i+1)
  chain=race['road']['nodes'][a:b+1];ds=[0]
  for u,v in zip(chain,chain[1:]):ds.append(ds[-1]+math.hypot(v['x']-u['x'],v['y']-u['y']))
  lo,hi=chain[0]['elevation'],chain[-1]['elevation']
  for n,d in zip(chain,ds):n['elevation']=lo+(hi-lo)*d/max(.001,ds[-1])
  bridges+=1
 race['source']['bridgeDeckApproximations']=bridges
 for i,s in enumerate(race['road']['segments']):
  s['elevation']=race['road']['nodes'][i+1]['elevation'];s['bumpiness']=.012 if s['surface']=='asphalt' else .06
 missing_terrain=[]
 def terrain_sample(lat,lon):
  try:return terrain_tiles.elevation(lat,lon)
  except ValueError as exc:
   if 'No valid DEM elevation' not in str(exc):raise
   # Coastal DEM tiles contain offshore no-data. This is terrain-only: road
   # control points above still require a valid measured DEM sample.
   missing_terrain.append({'lat':lat,'lon':lon});return 0
 sample_terrain_grid(race['road'],(row['lat'],row['lon']),race['source']['elevationDatumM'],terrain_sample)
 if missing_terrain:
  race['source']['terrainNoDataSeaLevelCells']=missing_terrain
  race['source']['warnings'].append(f'{len(missing_terrain)} terrain-only DEM no-data cells use sea level; coastal/bathymetric terrain is approximate. Road elevations have no sea-level fallback.')
 race['id']=row['id'];race['name']=row['name'];race['road']['autoExtend']=False
 race['source'].update(provider='OpenStreetMap / Mapzen Terrain Tiles',elevationProvider='Mapzen / Tilezen Terrarium DEM zoom 12',sourceSnapshot=str(snapshot),sourceSnapshotSha256=snapshot_hash,state=row['state'],stateCode=row['stateCode'],city=row.get('city'),references=row['references'],routeReference=reference,layoutGeometrySha256=hashlib.sha256(json.dumps(points,sort_keys=True).encode()).hexdigest(),terrainSampling='DEM at every terrain cell and road control point; not surveyed road-deck heights')
 if row.get('surfaceNote'):race['source']['surfaceVerification']=row['surfaceNote']
 race['source']['warnings']=[w.replace('USGS 3DEP','Mapzen DEM').replace('USGS','DEM') for w in race['source']['warnings']]
 race['source']['linePlacement']=place(race)
 race['laps']=3 if row['kind']=='circuit' else 1
 _,times,_=america.profile(points,row.get('paceCapMps',45 if row['kind']=='city' else 65),row.get('paceSettings'))
 race['source']['estimatedDrivingSeconds']=round(times[-1]*race['laps'])
 race['source']['durationModel']='Curvature-limited reference pace; traffic-free closed roads; car, weather and driver change the result.'
 hubs=json.loads(Path('data/campaigns/america/catalog.json').read_text())
 hub=min(hubs,key=lambda h:math.hypot(*track.metric(row['lat'],row['lon'],(h['location']['lat'],h['location']['lon']))))
 race['campaign']={'optional':True,'hubStage':hub['stage'],'sideEventId':row['id'],'eventType':'City run' if row['kind']=='city' else 'Circuit race' if row['kind']=='circuit' else 'Scenic road stage'}
 race['description']=f"{row['state']}: {row['name']}. Real mapped roads adapted as a closed-road event in the frozen 2994 setting."
 if row['kind']=='city':race['source']['landmarkPlan']=row['landmarks']
 OUT.mkdir(parents=True,exist_ok=True);out=OUT/f"{row['id']}.json";out.write_text(json.dumps(race,separators=(',',':'))+'\n')
 return {'id':row['id'],'name':row['name'],'displayName':row['name'],'status':'imported','state':row['state'],'stateCode':row['stateCode'],'location':{'lat':row['lat'],'lon':row['lon']},'city':row.get('city'),'kind':row['kind'],'event_type':race['campaign']['eventType'],'import_kind':'circuit' if row['kind']=='circuit' else 'road','venueKey':row['id'] if row['kind']=='circuit' else None,'venueName':row['name'] if row['kind']=='circuit' else None,'layoutLabel':'Road Course' if row['kind']=='circuit' else None,'hubStage':hub['stage'],'lengthM':length,'estimatedDrivingSeconds':race['source']['estimatedDrivingSeconds'],'laps':race['laps'],'surface':sorted({s['surface'] for s in race['road']['segments']}),'generatedPath':str(out),'references':row['references'],'routeReference':reference,**{k:row[k] for k in ['artHubStage','weather','palette','uphill','targetSeconds','paceCapMps'] if k in row}}

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--sources');ap.add_argument('--output-root');ap.add_argument('--cities',action='store_true');ap.add_argument('--only',nargs='*');args=ap.parse_args()
 if args.output_root:ROOT=Path(args.output_root);OUT=Path('artifacts/campaign-import')/ROOT.name
 ROOT.mkdir(parents=True,exist_ok=True)
 rows=json.loads(Path(args.sources or ('tools/campaigns/city_run_sources.json' if args.cities else 'tools/campaigns/state_gap_sources.json')).read_text())
 p=ROOT/'report.json';report={r['id']:r for r in json.loads(p.read_text())} if p.exists() else {}
 failures=[]
 for row in rows:
  if args.only and row['id'] not in args.only:continue
  try:
   result=build(row);report={r['id']:r for r in json.loads(p.read_text())} if p.exists() else {};report[row['id']]=result;print(row['id'],'IMPORTED',round(result['lengthM']),result['routeReference'].get('rightAngleTurns',''),flush=True)
  except Exception as exc:failures.append(row['id']);print(row['id'],'NEEDS REVIEW',str(exc),flush=True)
  p.write_text(json.dumps(list(report.values()),indent=2)+'\n')

 if failures:sys.exit(1)
