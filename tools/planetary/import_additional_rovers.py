"""Install additional real traverse sections through the existing planetary importer.
No Earth geocoder, invented links between source features, or altered car physics.
Source snapshots retain native projection, point order and selection provenance.
"""
import csv,gzip,hashlib,json,math,sys,struct
from pathlib import Path
from import_rover_races import ROOT,CACHE,RAD,build_route
from probe_terrain import FloatPdsImage
R_MOON=1737400.;R_MARS=3396190.
GALE_DEM='https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/Mars/MSL/MSL_Gale_DEM_Mosaic_1m_v3.tif'
MSL_CSV='https://planetarydata.jpl.nasa.gov/img/data/msl/msl_places/data_localizations/localized_interp.csv'

def apollo(number,object_id):
 source=ROOT/'sources'/f'apollo{number}-traverse.json'
 data=json.loads(source.read_text())
 if data.get('exceededTransferLimit'):raise ValueError('Incomplete ArcGIS response')
 feature=next(f for f in data['features'] if f['attributes']['OBJECTID']==object_id)
 if len(feature['geometry']['paths'])!=1:raise ValueError('Never join separate source paths')
 raw=feature['geometry']['paths'][0];e0,n0=raw[0];lat0=n0/(R_MOON*RAD);scale=math.cos(lat0*RAD)
 # Source Plate Carree has standard parallel zero. Correct local east scale.
 coords=[((e-e0)*scale,n0-n,n/(R_MOON*RAD),e/(R_MOON*RAD)) for e,n in raw]
 parallel=26 if number==15 else -9
 def terrain(x,z):return (e0+x/scale-R_MOON*RAD*180)*math.cos(parallel*RAD),n0-z
 key=f'apollo{number}-'+('hadley-apennine' if number==15 else 'descartes')
 url=f'https://pds.mcp.nasa.gov/data/store/img/lunar_reconnaissance_orbiter/pds4/lroc/lro-l-lroc-5-rdr/LROLRC_2001/DATA/SDP/NAC_DTM/APOLLO{number}/NAC_DTM_APOLLO{number}.TIF'
 layer=4 if number==15 else 6
 ref={'mission':f'Apollo {number}','route':'PDS Analyst’s Notebook / Phil Stooke reconstructed rover traverse', 'sourceUrl':f'https://anms.rsl.wustl.edu/arcgis/rest/services/Apollo/Apollo{number}_vec/MapServer/{layer}/query?where=1%3D1&outFields=*&returnGeometry=true&f=pjson', 'sourceSnapshot':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceObjectId':object_id,'sourcePath':0,'nativeCrs':data['spatialReference'],'selection':'One complete continuous mapped source feature. No connections invented between features; not a complete EVA.'}
 return build_route('Moon',f'Moon — Apollo {number} '+('Hadley–Apennine' if number==15 else 'Descartes'),key,url,ref,coords,terrain)

def curiosity():
 source=ROOT/'sources/curiosity-section.json.gz';snapshot=json.loads(gzip.decompress(source.read_bytes()));data=snapshot['records']
 e0,n0=data[0]['easting'],data[0]['northing'];scale=math.cos(data[0]['lat']*RAD);coords=[]
 for r in data:
  p=((r['easting']-e0)*scale,n0-r['northing'],r['lat'],r['lon'])
  if not coords or math.dist(coords[-1][:2],p[:2])>=8:coords.append(p)
 def terrain(x,z):return e0+x/scale,n0-z
 ref={'mission':'Curiosity','route':'NASA/JPL PDS MSL PLACES localized_interp','sourceUrl':MSL_CSV,'sourceSnapshot':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'solStart':data[0]['sol'],'solEnd':data[-1]['sol'],'selection':'Continuous sols 400–600 traverse; sub-8 m localization movements omitted. No stitching around science-stop reversals.','terrainCredit':'Calef III and Parker, 2016; NASA/JPL-Caltech/USGS/UArizona, MSL Gale Merged DEM 1m v3; source mosaic includes lower-resolution infill.'}
 return build_route('Mars','Mars — Curiosity Gale Crater','curiosity-gale',GALE_DEM,ref,coords,terrain)

def mer_records(prefix):
 source=ROOT/'sources'/f'{prefix}_TRAVERSE.dbf';data=source.read_bytes();count,header,size=struct.unpack_from('<IHH',data,4);fields=[]
 for offset in range(32,header-1,32):fields.append((data[offset:offset+11].split(b'\0')[0].decode(),data[offset+16]))
 rows=[]
 for i in range(count):
  raw=data[header+i*size:header+(i+1)*size]
  if raw[:1]!=b' ':raise ValueError('Deleted DBF record in rover source')
  row={};offset=1
  for name,width in fields:row[name]=float(raw[offset:offset+width]);offset+=width
  rows.append(row)
 return rows

SPIRIT_DEM='https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_001500_001599/PSP_001513_1655_PSP_001777_1650/DTEEC_001513_1655_001777_1650_U01.IMG'
OPPORTUNITY_DEM='https://hirise-pds.lpl.arizona.edu/PDS/DTM/ESP/ORB_018700_018799/ESP_018701_1775_ESP_018846_1775/DTEEC_018701_1775_018846_1775_U01.IMG'
def mer(mission,prefix,sol_start,sol_end,url,region):
 data=[r for r in mer_records(prefix) if sol_start<=r['START_SOL']<=sol_end];lat0,lon0=data[0]['LAT'],data[0]['LON'];scale=math.cos(lat0*RAD);coords=[]
 for r in data:
  p=(R_MARS*RAD*(r['LON']-lon0)*scale,R_MARS*RAD*(lat0-r['LAT']),r['LAT'],r['LON'])
  if not coords or math.dist(coords[-1][:2],p[:2])>=8:coords.append(p)
 if any(math.dist(a[:2],b[:2])>100 for a,b in zip(coords,coords[1:])):raise ValueError('Rover localization gap exceeds 100 m')
 raster=FloatPdsImage(url)
 def terrain(x,z):return raster.project(lat0-z/(R_MARS*RAD),lon0+x/(R_MARS*RAD*scale))
 file='MERA_traverse' if prefix=='MERA' else 'MERB_traverse_5130';source=ROOT/'sources'/f'{prefix}_TRAVERSE.dbf'
 ref={'mission':mission,'route':'PDS Analyst’s Notebook / Tim Parker corrected rover traverse','sourceUrl':f'https://an.rsl.wustl.edu/mera/AN/meri/MER/traverse/{file}.zip','sourceSnapshot':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'solStart':sol_start,'solEnd':sol_end,'selection':'One continuous sol interval; geographic coordinates from corrected source DBF, sub-8 m movements omitted. Source is interpolated localization, not certified wheel-track odometry.','terrainCredit':'NASA/JPL/UArizona/USGS HiRISE stereo DTM','demProjection':{'radiusM':raster.radius,'standardParallel':raster.parallel,'centralMeridian':raster.meridian}}
 return build_route('Mars',f'Mars — {mission} {region}',mission.lower()+'-'+region.lower().replace(' ','-'),url,ref,coords,terrain)

def fetch_sources():
 from urllib.request import urlopen
 import io,zipfile
 for n,layer in [(15,4),(16,6)]:
  url=f'https://anms.rsl.wustl.edu/arcgis/rest/services/Apollo/Apollo{n}_vec/MapServer/{layer}/query?where=1%3D1&outFields=*&returnGeometry=true&f=pjson'
  target=CACHE/f'apollo{n}-traverse.json'
  if not target.exists():target.write_bytes(urlopen(url,timeout=60).read(5_000_000))
 target=CACHE/'curiosity.csv'
 if not target.exists():
  raw=urlopen(MSL_CSV,timeout=60).read(30_000_001)
  if len(raw)>30_000_000:raise ValueError('Unexpectedly oversized PLACES source')
  target.write_bytes(raw)
 for file in ['MERA_traverse','MERB_traverse_5130']:
  raw=urlopen(f'https://an.rsl.wustl.edu/mera/AN/meri/MER/traverse/{file}.zip',timeout=60).read(5_000_000)
  with zipfile.ZipFile(io.BytesIO(raw)) as archive:
   for info in archive.infolist():
    if info.file_size>5_000_000:raise ValueError('Oversized MER source')
    if Path(info.filename).suffix.lower() in ['.shp','.shx','.dbf','.prj','.xml']:(ROOT/'sources'/Path(info.filename).name).write_bytes(archive.read(info))

def prepare():
 for n in (15,16):
  source=ROOT/'sources'/f'apollo{n}-traverse.json';source.write_bytes((CACHE/f'apollo{n}-traverse.json').read_bytes())
 raw=(CACHE/'curiosity.csv').read_bytes();records=[]
 for r in csv.DictReader(raw.decode().splitlines()):
  if r['frame']!='ROVER' or not 400<=int(r['sol'])<=600:continue
  records.append({'sol':int(r['sol']),'sclk':float(r['sclk']),'easting':float(r['easting']),'northing':float(r['northing']),'lat':float(r['planetocentric_latitude']),'lon':float(r['longitude'])})
 snapshot={'url':MSL_CSV,'originalCsvSha256':hashlib.sha256(raw).hexdigest(),'selection':'ROVER records with 400 <= sol <= 600; source ordering preserved','records':records}
 (ROOT/'sources/curiosity-section.json.gz').write_bytes(gzip.compress(json.dumps(snapshot,separators=(',',':')).encode(),mtime=0))

if __name__=='__main__':
 if '--fetch' in sys.argv:fetch_sources()
 if '--prepare' in sys.argv or '--fetch' in sys.argv:prepare()
 report=json.loads((ROOT/'report.json').read_text())
 jobs={'apollo15':lambda:apollo(15,55),'apollo16':lambda:apollo(16,84),'curiosity':curiosity,'spirit':lambda:mer('Spirit','MERA',50,350,SPIRIT_DEM,'Columbia Hills'),'opportunity':lambda:mer('Opportunity','MERB',3200,3400,OPPORTUNITY_DEM,'Endeavour Rim')}
 selected=[a for a in sys.argv[1:] if a in jobs] or list(jobs)
 for key in selected:
  row=jobs[key]();report=json.loads((ROOT/'report.json').read_text());report=[r for r in report if r['id']!=row['id']]+[row]
  (ROOT/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(row['name'],round(row['lengthM']),flush=True)
