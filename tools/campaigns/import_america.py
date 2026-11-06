"""Rebuild the America campaign with the existing OSM route/track importers.
Run from the repository root, then python tools/campaigns/finish_america_terrain.py,
then node tools/campaigns/install_america.mjs.
Source ways are archived in data/campaigns; generated tracks go to artifacts.
Installed race documents retain GPS traces, elevation results and ODbL attribution.
"""
import sys, json, math, heapq, re, os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import race_track_import as track
import race_route_import as route
import terrain_tiles

ROOT = Path('data/campaigns/america')
OUTPUT = Path('artifacts/campaign-import/america')
# Local scenic stages, not thousands of kilometres of connecting highway.
ROUTES = {
 'north': [
  ('Providence - Blackstone', 'Blackstone Boulevard',41.84,-71.385),
  ('Mohawk Trail', 'Mohawk Trail',42.64,-72.94),
  ('Tunnel of Trees', 'North Lake Shore Drive|Lake Shore Drive',45.48,-85.08),
  ('Badlands Loop', '.*',43.84,-102.20,'SD 240'),
  ('Beartooth Pass', 'Beartooth Highway',44.97,-109.46),
  ('Sawtooth Scenic Byway', '.*',43.95,-114.84,'ID 75'),
  ('Tioga Pass', 'Tioga Road',37.91,-119.26),
  ('LA - Angeles Crest', '.*',34.25,-118.17,'CA 2')],
 'middle': [
  ('Providence - River Road', 'River Road',41.84,-71.38),
  ('Hawks Nest', '.*',41.42,-74.735,'NY 97'),
  ('Hocking Hills', '.*',39.43,-82.54,'SR 374'),
  ('Ozark Pig Trail', '.*',35.70,-93.80,'AR 23'),
  ('Trail Ridge Road', 'Trail Ridge Road',40.42,-105.75),
  ('Utah Scenic 12', '.*',37.88,-111.43,'SR 12'),
  ('Death Valley', "Artists Drive|Artist Drive|Artist's Drive",36.36,-116.80),
  ('LA - Mulholland', 'Mulholland Drive',34.12,-118.43)],
 'south': [
  ('Providence - Harbor', 'Allens Avenue',41.80,-71.402),
  ('Skyline Drive', 'Skyline Drive',38.59,-78.38),
  ('Blue Ridge Parkway', 'Blue Ridge Parkway',35.98,-81.83),
  ('Natchez Trace', 'Natchez Trace Parkway',32.43,-90.14),
  ('Big Bend River Road', '.*',29.30,-103.99,'FM 170'),
  ('Coronado Trail', '.*',33.57,-109.35,'US 191'),
  ('Palms to Pines', '.*',33.60,-116.45,'CA 74'),
  ('LA - Sunset', 'Sunset Boulevard',34.07,-118.51)]
}

def spec(entry):
 name,pattern,lat,lon,*ref=entry
 return {'name':name,'pattern':pattern,'lat':lat,'lon':lon,'ref':ref[0] if ref else None}

def query(s):
 key='ref' if s['ref'] else 'name'
 names=(s['ref'] or s['pattern']).split('|')
 bbox=f'{s["lat"]-.08:.4f},{s["lon"]-.12:.4f},{s["lat"]+.08:.4f},{s["lon"]+.12:.4f}'
 return '('+''.join(f'way["{key}"={json.dumps(name)}]({bbox});' for name in names)+');'

def matches(w,s):
 tags=w.get('tags',{})
 if not re.search(s['ref'] or s['pattern'],tags.get('ref' if s['ref'] else 'name','')):return False
 return any(abs(p['lat']-s['lat'])<.08 and abs(p['lon']-s['lon'])<.12 for p in w.get('geometry',[]))

def choose_stage(ways,origin,limit):
 """Choose a continuous directed road section; never join disconnected geometry."""
 points,edges=route.graph(ways,origin);adj={}
 for a,b,tags in edges:
  d=math.hypot(points[a]['x']-points[b]['x'],points[a]['y']-points[b]['y'])
  one=str(tags.get('oneway','yes' if tags.get('junction')=='roundabout' else '')).lower()
  if one!='-1':adj.setdefault(a,[]).append((b,d))
  if one not in ('yes','1','true'):adj.setdefault(b,[]).append((a,d))
 ordered=sorted(points,key=lambda n:points[n]['lon'],reverse=True)
 candidates=list(dict.fromkeys(ordered[::max(1,len(ordered)//16)]+[n for n in ordered if len(adj.get(n,[]))==1][:40]))
 best=None
 for start in candidates:
  dist={start:0};q=[(0,start)]
  while q:
   cost,u=heapq.heappop(q)
   if cost!=dist[u]:continue
   for v,d in adj.get(u,[]):
    if cost+d<=limit and cost+d<dist.get(v,math.inf):dist[v]=cost+d;heapq.heappush(q,(cost+d,v))
  separated=[n for n in dist if math.hypot(points[n]['x']-points[start]['x'],points[n]['y']-points[start]['y'])>=200]
  if not separated:continue
  finish=max(separated,key=dist.get);length=dist[finish]
  # Prefer westbound when lengths are comparable.
  score=length+(100 if points[finish]['lon']<points[start]['lon'] else 0)
  if best is None or score>best[0]:best=(score,start,finish,length)
 if not best or best[3]<300:raise ValueError('No continuous section at least 300 m long')
 return [{k:points[n][k] for k in ('x','y')} for n in best[1:3]]

def download(entry):
 s=spec(entry)
 print('Fetching '+s['name'],flush=True)
 # The main OSM API supplies complete ways and their nodes for a small
 # local bbox, avoiding a busy Overpass query queue.
 dx,dy=(.012,.008) if s["name"].startswith(("Providence","LA -")) else (.025,.02)
 bbox=f'{s["lon"]-dx:.4f},{s["lat"]-dy:.4f},{s["lon"]+dx:.4f},{s["lat"]+dy:.4f}'
 try:
  data=track.request_json('https://api.openstreetmap.org/api/0.6/map.json?bbox='+bbox)
  nodes={n['id']:n for n in data['elements'] if n['type']=='node'}
  result=[{**w,'geometry':[{'lat':nodes[n]['lat'],'lon':nodes[n]['lon']} for n in w['nodes']]} for w in data['elements'] if w['type']=='way' and w.get('tags',{}).get('highway')]
  result=[w for w in result if matches(w,s)]
  if not result:raise ValueError('Named road absent from small area')
 except (ValueError,KeyError) as error:
  print("  Main OSM API fallback: "+str(error),flush=True)
  result=route.overpass('[out:json][timeout:20];'+query(s)+'out geom;',track.request_json)
 if not result:raise ValueError('No mapped roads for '+s['name'])
 print(f'  {s["name"]}: {len(result)} ways',flush=True)
 return result

def build_stage(task):
 branch,i,entry,ways=task
 s=spec(entry);rid=f'america-{branch}-{i+1:02}';out=OUTPUT/(rid+'.json')
 if out.exists():
  race=json.loads(out.read_text());return race['campaign']
 selected=[w for w in ways if matches(w,s)]
 if not selected:raise ValueError(f'No source ways: {s}')
 place={'name':s['name'],'lat':s['lat'],'lon':s['lon'],'country':'us'}
 waypoints=choose_stage(selected,(s['lat'],s['lon']),2500+i*650)
 result=route.route({'place':place,'ways':selected},waypoints,'direct')
 layout=track.recall(result['layouts'][0]['id'],'layout');layout['displayName']=f'{branch.title()} {i+1:02} - {s["name"]}'
 print(f'Importing {layout["displayName"]}: {layout["lengthM"]:.0f} m',flush=True)
 race=track.build(layout,width=11-i*.55,use_elevation=True,fetch=terrain_tiles.importer_fetch)['race'];race['id']=rid
 race['source']['provider']='OpenStreetMap / Mapzen Terrain Tiles'
 race['source']['elevationProvider']='Mapzen / Tilezen Terrain Tiles, zoom 12, bilinear DEM samples'
 race['source']['elevationSourceUrl']='https://registry.opendata.aws/terrain-tiles/'
 race['source']['warnings']=[w.replace('USGS 3DEP','Mapzen Terrain Tiles DEM').replace('USGS elevation','DEM elevation') for w in race['source']['warnings']]
 weather=['clear','clear','rain','rain','storm','snow' if branch=='north' else 'storm','snow' if branch=='north' else 'storm','storm'][i]
 surface=['asphalt','asphalt','wet-asphalt','gravel','wet-gravel','snow' if branch=='north' else 'mud','slush' if branch=='north' else 'wet-gravel','wet-gravel'][i]
 race['weather']=weather;race['timeOfDay']='night' if i>=6 else 'day'
 race['road']['width']=11-i*.55
 for segment in race['road']['segments']:
  segment['surface']=surface;segment['roadWidthM']=11-i*.55;segment['bumpiness']=round(i*.025,3)
 ground='snow' if branch=='north' and i>=5 else 'sand-solid' if i>=4 and branch!='north' else 'grass'
 race['road']['tileMap']['defaultTileId']=ground
 for cell in race['road']['tileMap']['cells'].values():cell['tileId']=ground
 race['description']=f'{branch.title()} route, stage {i+1}/8. {s["name"]}: a real OSM road section. Difficulty {i+1}/8; {surface}, {weather}, {race["timeOfDay"]}. Weather, surface and race width are fictional event conditions.'
 race['campaign']={'id':rid,'branch':branch,'stage':i+1,'difficulty':i+1,'name':race['name'],'location':s,'lengthM':layout['lengthM'],'weather':weather,'surface':surface,'timeOfDay':race['timeOfDay']}
 race['source']['campaignConditions']='Fictional weather, surface, width and bumps; GPS geometry from OSM and elevations from Mapzen Terrain Tiles where available.'
 out.write_text(json.dumps(race,separators=(',',':'))+'\n')
 warnings=[w for w in race['source']['warnings'] if 'unavailable' in w or 'incomplete' in w]
 if warnings:print('  '+ '; '.join(warnings),flush=True)
 return race["campaign"]

def main():
 ROOT.mkdir(parents=True,exist_ok=True)
 OUTPUT.mkdir(parents=True,exist_ok=True)
 source=ROOT/'osm-ways.json'
 ways=json.loads(source.read_text()) if source.exists() else []
 os.environ.setdefault('RTG_OVERPASS_URL','https://overpass-api.de/api/interpreter')
 os.environ.setdefault('RTG_OVERPASS_FALLBACK_URL','https://overpass.private.coffee/api/interpreter')
 for stages in ROUTES.values():
  for entry in stages:
   if not any(matches(w,spec(entry)) for w in ways):
    ways=list({w['id']:w for w in ways+download(entry)}.values())
    source.write_text(json.dumps(ways,separators=(',',':'))+'\n')
 print(f'{len(ways)} source ways',flush=True)
 tasks=[(branch,i,entry,ways) for branch,stages in ROUTES.items() for i,entry in enumerate(stages)]
 with ThreadPoolExecutor(max_workers=2) as pool:entries=list(pool.map(build_stage,tasks))
 (ROOT/'catalog.json').write_text(json.dumps(entries,indent=2)+'\n')
 print('Imported all 24 stages.',flush=True)

if __name__=='__main__':
 if '--probe-elevation' in sys.argv:print(terrain_tiles.elevation(44.97,-109.46),flush=True)
 else:main()
