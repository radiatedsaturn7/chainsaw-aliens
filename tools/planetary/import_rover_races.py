"""Build simulator stages from planetary traverses and actual orbital terrain.
Uses the existing race importer for editable road geometry; planetary projection
and DEM sampling stay offline. Earth vehicle handling is intentionally retained.
"""
import sys,json,gzip,math,struct,hashlib
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
from inspect_sources import lunar_latlon
from probe_terrain import FloatStripTiff,FloatPdsImage
ROOT=Path('data/campaigns/planetary');CACHE=Path('artifacts/planetary');RAD=math.pi/180
MARS_URL='https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif'
MOON_URL='https://pds.mcp.nasa.gov/data/store/img/lunar_reconnaissance_orbiter/pds4/lroc/lro-l-lroc-5-rdr/LROLRC_2001/DATA/SDP/NAC_DTM/APOLLO17/NAC_DTM_APOLLO17.TIF'
def sample_many(url,coords,key):
 path=CACHE/(key+'-height-samples.json');digest=hashlib.sha256(json.dumps(coords).encode()).hexdigest()
 if path.exists():
  saved=json.loads(path.read_text())
  if saved['digest']==digest:return saved['heights']
 raster=FloatPdsImage(url) if url.endswith(".IMG") else FloatStripTiff(url)
 sx,sy,_=raster.tags[33550];px,py,_,east,north,_=raster.tags[33922];rows={}
 for i,(e,n) in enumerate(coords):
  x=math.floor(px+(e-east)/sx);y=math.floor(py+(north-n)/sy)
  if not (0<=x<raster.width and 0<=y<raster.height):raise ValueError(f'{key}: terrain outside DEM coverage')
  rows.setdefault(y,[]).append((i,x))
 heights=[None]*len(coords);stride=raster.tags[278][0];nodata=float(raster.tags.get(42113,'nan').strip('\0'))
 def row(job):
  y,items=job;x0=min(x for _,x in items);x1=max(x for _,x in items)
  data=raster.row_values(y,x0,x1);out=[]
  for i,x in items:
   h=struct.unpack_from(raster.endian+'f',data,(x-x0)*4)[0]
   if not math.isfinite(h) or abs(h)>1e7 or h==nodata:raise ValueError(f'{key}: DEM has missing data')
   out.append((i,h))
  return out
 with ThreadPoolExecutor(max_workers=6) as pool:
  for out in pool.map(row,rows.items()):
   for i,h in out:heights[i]=h
 path.write_text(json.dumps({'digest':digest,'heights':heights}))
 return heights

def build(body):
 if body=='Moon':
  line=next(l for l in json.loads((ROOT/'apollo17-traverses.json').read_text())['lines'] if l['sourceRecord']==8)
  raw=line['projectedPointsM'];e0,n0=raw[0]
  coords=[(e-e0,n0-n,*lunar_latlon(e,n)) for e,n in raw]
  def terrain(x,z):
   lat,lon=lunar_latlon(e0+x,n0-z)
   return 1737400*RAD*(lon-180)*math.cos(20*RAD),1737400*RAD*lat
  name='Moon — Apollo 17 Taurus-Littrow';key='apollo17-taurus-littrow';url=MOON_URL;reference={'sourceRecord':8,'mission':'Apollo 17','route':'Haase et al. 2018 reconstructed traverse'}
 else:
  data=json.loads(gzip.decompress((ROOT/'perseverance-localizations.json.gz').read_bytes()))['records']
  # One continuous pre-rim traverse, within the original HiRISE DEM footprint.
  data=[r for r in data if 700583343<=r['sclk']<=704139420]
  raw=[(3396190*RAD*r['point'][4],3396190*RAD*r['point'][3],r) for r in data];e0,n0,_=raw[0]
  coords=[]
  for e,n,r in raw:
   p=(e-e0,n0-n,r['point'][3],r['point'][4])
   if not coords or math.dist(coords[-1][:2],p[:2])>=5:coords.append(p)
  def terrain(x,z):return e0+x,n0-z
  name='Mars — Perseverance Jezero';key='perseverance-jezero';url=MARS_URL;reference={'solStart':data[0]['sol'],'solEnd':data[-1]['sol'],'startSclk':data[0]['sclk'],'endSclk':data[-1]['sclk'],'mission':'Perseverance','route':'NASA/JPL PDS best_interp localizations'}
 return build_route(body,name,key,url,reference,coords,terrain)

def build_route(body,name,key,url,reference,coords,terrain):
 points=[{'x':x,'y':z,'lat':lat,'lon':lon,'tags':{'surface':'gravel'}} for x,z,lat,lon in coords]
 layout={'points':points,'open':True,'name':name,'displayName':name,'place':{'name':name,'lat':coords[0][2],'lon':coords[0][3],'country':''}}
 issues=track.layout_review_issues({**layout,'points':track.simplify(points)})
 if issues:raise ValueError('Rover section needs continuity review: '+'; '.join(issues))
 race=track.build(layout,width=8,use_elevation=False,max_segment_length_m=35,max_control_points=2000)['race']
 nodes=race['road']['nodes'];cell=40;buffer=400
 xmin=math.floor((min(n['x'] for n in nodes)-buffer)/cell);xmax=math.ceil((max(n['x'] for n in nodes)+buffer)/cell)
 zmin=math.floor((min(n['y'] for n in nodes)-buffer)/cell);zmax=math.ceil((max(n['y'] for n in nodes)+buffer)/cell)
 tiles=[(x,z) for z in range(zmin,zmax+1) for x in range(xmin,xmax+1)]
 locations=[terrain(n['x'],n['y']) for n in nodes]+[terrain((x+.5)*cell,(z+.5)*cell) for x,z in tiles]
 print(key,'sampling',len(nodes),'road nodes and',len(tiles),'terrain cells',flush=True)
 heights=sample_many(url,locations,key);base=heights[0]
 for n,h in zip(nodes,heights):n['elevation']=(h-base)/12
 for i,s in enumerate(race['road']['segments']):s.update(elevation=nodes[i+1]['elevation'],surface='gravel',bumpiness=.055)
 race['road']['tileMap'].update(cellSizeM=cell,defaultTileId='gravel',cells={f'{x},{z}':{'tileId':'gravel','elevation':(h-base)/12} for (x,z),h in zip(tiles,heights[len(nodes):])})
 race['road']['autoExtend']=False
 race['id']='space-'+key;race['location']={'body':body,'country':'','stateCode':'','place':reference['mission'],'lat':coords[0][2],'lon':coords[0][3]}
 race['source'].update(provider=reference['route'],origin={**layout['place'],'body':body},elevationProvider=url,elevationDatumM=base,elevationSmoothingRadiusM=12,planetarySimulator=True,traverseSelection=reference,terrainSampleSpacingM=cell,warnings=['Fictional 8 m-wide rally corridor follows a recorded/reconstructed rover traverse, not a real road.','Earth car handling intentionally retained.','40 m terrain samples from orbital DEM; no claim of surveyed boulders or sub-metre surface roughness.','Start and finish mark a selected section; no invented connections between source lines.'])
 race['description']='Planetary simulator: real rover route and sampled orbital terrain, ordinary vehicle handling. '
 race['weather']='clear';race['timeOfDay']='night' if body=='Moon' else 'day';race['brightness']=.8;race['margin']={'marginMode':'hidden'}
 out=CACHE/(key+'-race.json');out.write_text(json.dumps(race,separators=(',',':'))+'\n')
 return {'id':race['id'],'name':name,'raceRef':name,'body':body,'generatedPath':str(out),'lengthM':sum(s['length'] for s in race['road']['segments']),'elevationRangeM':max(heights[:len(nodes)])-min(heights[:len(nodes)]),'terrainCells':len(tiles),'source':reference}
if __name__=='__main__':
 report=json.loads((ROOT/'report.json').read_text()) if (ROOT/'report.json').exists() else []
 for body in ['Moon','Mars']:
  row=build(body);report=[r for r in report if r['id']!=row['id']]+[row];(ROOT/'report.json').write_text(json.dumps(report,indent=2)+'\n')
