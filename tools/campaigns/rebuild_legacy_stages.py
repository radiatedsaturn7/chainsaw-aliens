"""Rebuild the legacy mountain/gravel examples from actual named road geometry.
These are geographic driving routes, not claims of an exact year's WRC timing lines.
"""
import sys,json,math,hashlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
import race_route_import as route
import import_america as america
import terrain_tiles
from audit_race_lines import place
ROOT=Path('data/campaigns/america/raceways')

def sample_terrain_grid(road, origin, datum, sample=terrain_tiles.elevation):
 tile=road['tileMap'];cell=tile['cellSizeM']
 for key,value in tile['cells'].items():
  ix,iy=map(int,key.split(','));x,y=(ix+.5)*cell,(iy+.5)*cell
  lat=origin[0]-y/6371008.8*180/math.pi
  lon=origin[1]+x/(6371008.8*math.cos(math.radians(origin[0])))*180/math.pi
  value['elevation']=(sample(lat,lon)-datum)/12

SPECS=[
 {'key':'turini','name':'Col de Turini','id':'col-de-turini','lat':43.9776,'lon':7.3916,'country':'fr','query':'way["highway"]["ref"~"^(M 70|D 70|D 2566|M 2566)$"](43.92,7.30,44.01,7.44);','start':[43.9906,7.3220],'end':[43.9776,7.3916],'width':6,'reference':'https://acm.mc/en/racefeed/ss15-la-bollene-vesubie-moulinet-1/'},
 {'key':'ouninpohja','name':'Ouninpohja','id':'ouninpohja','lat':61.765,'lon':24.971,'country':'fi','query':'way["highway"]["name"~"Ouninpohjantie|Kakaristontie|Hassintie"](61.67,24.8,61.88,25.15);','width':5,'reference':'https://www.rally-maps.com/Rally-Finland-2025/Ouninpohja'}]
if __name__=='__main__':
 for spec in SPECS:
  try:
   path=ROOT/'sources'/f"{spec['key']}.json"
   if path.exists():ways=json.loads(path.read_text())
   else:
    ways=route.overpass('[out:json][timeout:25];'+spec['query']+'out geom;',track.request_json);path.write_text(json.dumps(ways,separators=(',',':'))+'\n')
   origin=(spec['lat'],spec['lon'])
   if spec.get('start'):
    targets=[dict(zip(('x','y'),track.metric(*spec[k],origin))) for k in ['start','via','end'] if k in spec]
    points=route.trace(ways,origin,targets,max_snap=250)
   else:
    # Use Ouninpohjantie itself, excluding unrelated long approach roads.
    ways=[w for w in ways if w.get('tags',{}).get('name')=='Ouninpohjantie']
    points=america.longest_connected_trace(ways,origin)
   for i,p in enumerate(points):
    if not p.get('tags'):p['tags']=dict(points[max(0,i-1)].get('tags') or points[min(len(points)-1,i+1)].get('tags',{}))
   length=america.profile(points)[0][-1]
   print(spec['name'],round(length),len(points),flush=True)
   (ROOT/f"{spec['key']}-route.json").write_text(json.dumps({'spec':spec,'points':points,'lengthM':length},separators=(',',':'))+'\n')
   layout={'name':spec['name'],'displayName':spec['name'],'points':points,'lengthM':length,'open':True,'place':{'name':spec['name'],'lat':spec['lat'],'lon':spec['lon'],'country':'us'}}
   race=track.build(layout,width=spec['width'],fetch=terrain_tiles.importer_fetch,max_segment_length_m=50,max_control_points=1200)['race']
   race['id']=spec['id'];race['road']['autoExtend']=False
   if any('unavailable' in w or 'flat editable' in w for w in race['source']['warnings']):raise ValueError('DEM unavailable; replacement must not be flat')
   race['source']['origin']['country']=spec['country']
   # Sample every control point on these longer stages, retaining the native DEM
   # baseline; sparse 64-point interpolation would flatten mountain switchbacks.
   sampled=track.densify(track.simplify(points),50)
   for node,p in zip(race['road']['nodes'],sampled):node['elevation']=(terrain_tiles.elevation(p['lat'],p['lon'])-race['source']['elevationDatumM'])/12
   for i,seg in enumerate(race['road']['segments']):
    seg['elevation']=race['road']['nodes'][i+1]['elevation'];seg['bumpiness']=.065 if spec['key']=='ouninpohja' else .015
   if spec['key']=='turini':
    # A 5x5 survey and a broad excavation cap are unsuitable for tightly folded
    # mountain roads: adjacent switchbacks can be hundreds of metres apart in
    # height. Sample the actual terrain grid; the runtime road-first mesher
    # grades the immediate roadside without excavating entire survey cells.
    sample_terrain_grid(race['road'],origin,race['source']['elevationDatumM'])
    race['source']['terrainSampling']='DEM at every terrain grid cell; road-first runtime roadside grading'
   else:
    track.fit_terrain_to_road(race['road'])
   race['source'].update(provider='OpenStreetMap / Mapzen Terrain Tiles',sourceSnapshot=str(path),elevationProvider='Mapzen / Tilezen Terrarium DEM zoom 12',layoutReference=spec['reference'],geometryMethod='Mapped contiguous road; not a particular WRC edition or surveyed timing line',layoutGeometrySha256=hashlib.sha256(json.dumps(points,sort_keys=True).encode()).hexdigest())
   race['source']['warnings']=[w.replace('USGS 3DEP','Mapzen DEM') for w in race['source']['warnings']]
   race['source']['linePlacement']=place(race)
   out=Path('artifacts/campaign-import/raceways')/f"legacy-{spec['key']}.json";out.write_text(json.dumps(race,separators=(',',':'))+'\n')
   report_path=ROOT/'report.json';report=json.loads(report_path.read_text());id='legacy-'+spec['key']
   report=[r for r in report if r['id']!=id]
   report.append({'id':id,'status':'imported','name':spec['name'],'raceRef':spec['name'],'replaceRaceRef':spec['name'],'venueKey':spec['key'],'venueName':spec['name'],'layoutLabel':'Mapped road stage','hubStage':None,'artHubStage':2 if spec['key']=='turini' else 5,'import_kind':'road','event_type':'Rally stage','lengthM':length,'laps':1,'generatedPath':str(out),'warnings':race['source']['warnings']})
   report_path.write_text(json.dumps(report,indent=2)+'\n')

  except Exception as e:print(spec['key'],'FAILED',str(e),flush=True)
