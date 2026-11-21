"""Small range-read feasibility probe for the published float GeoTIFF and HiRISE PDS DEMs.
Supports uncompressed / LZW strips; rejects tiled, predictor and non-float imagery.
"""
import json,math,struct
from pathlib import Path
from probe_apollo import RemoteZip
def decode_lzw(data,expected):
 """TIFF MSB-first LZW (early change), bounded to one declared raster strip."""
 table=[bytes([i]) for i in range(256)]+[b'',b''];bits=9;pos=0;previous=None;out=bytearray()
 while pos+bits<=len(data)*8:
  start=pos//8;shift=pos%8;size=(shift+bits+7)//8
  code=(int.from_bytes(data[start:start+size],'big')>>(size*8-shift-bits))&((1<<bits)-1);pos+=bits
  if code==256:
   table=table[:258];bits=9;previous=None;continue
  if code==257:break
  if code<len(table):entry=table[code]
  elif code==len(table) and previous:entry=previous+previous[:1]
  else:raise ValueError('Invalid TIFF LZW code')
  out.extend(entry)
  if len(out)>expected:raise ValueError('Oversized TIFF strip')
  if previous is not None and len(table)<4096:
   table.append(previous+entry[:1])
   if len(table)==(1<<bits)-1 and bits<12:bits+=1
  previous=entry
 if len(out)!=expected:raise ValueError('Incomplete TIFF strip')
 return bytes(out)

class FloatStripTiff:
 def __init__(self,url):
  self.file=RemoteZip(url);h=self.read(0,8);self.endian='<' if h[:2]==b'II' else '>'
  version,offset=struct.unpack(self.endian+'HI',h[2:])
  if version!=42:raise ValueError('Expected classic TIFF')
  n=struct.unpack(self.endian+'H',self.read(offset,2))[0];entries=self.read(offset+2,n*12);self.tags={}
  formats={2:'s',3:'H',4:'I',12:'d'}
  for i in range(n):
   tag,kind,count,value=struct.unpack_from(self.endian+'HHII',entries,i*12)
   if kind not in formats:continue
   fmt=formats[kind];size=1 if kind==2 else struct.calcsize(fmt);length=count*size
   raw=entries[i*12+8:i*12+8+length] if length<=4 else self.read(value,length)
   self.tags[tag]=raw.decode(errors='replace') if kind==2 else struct.unpack(self.endian+fmt*count,raw)
  for tag,expected in [(258,(32,)),(277,(1,)),(339,(3,))]:
   if self.tags.get(tag)!=expected:raise ValueError('Unsupported TIFF encoding')
  if self.tags.get(259) not in [(1,),(5,)] or self.tags.get(317,(1,))!=(1,):raise ValueError('Unsupported TIFF compression/predictor')
  if 273 not in self.tags or 278 not in self.tags:raise ValueError('Expected strip storage')
  self.width=self.tags[256][0];self.height=self.tags[257][0]
 def read(self,offset,n):return self.file.read_at(offset,n)
 def row_values(self,y,x0,x1):
  stride=self.tags[278][0];strip=y//stride
  if self.tags.get(259,(1,))==(1,):
   return self.read(self.tags[273][strip]+((y%stride)*self.width+x0)*4,(x1-x0+1)*4)
  expected=min(stride,self.height-strip*stride)*self.width*4
  raw=decode_lzw(self.read(self.tags[273][strip],self.tags[279][strip]),expected)
  offset=((y%stride)*self.width+x0)*4
  return raw[offset:offset+(x1-x0+1)*4]
 def sample(self,easting,northing):
  sx,sy,_=self.tags[33550];px,py,_,east,north,_=self.tags[33922]
  x=math.floor(px+(easting-east)/sx);y=math.floor(py+(north-northing)/sy)
  if not (0<=x<self.width and 0<=y<self.height):raise ValueError('Outside DEM coverage')
  v=struct.unpack(self.endian+'f',self.row_values(y,x,x))[0]
  nodata=float(self.tags.get(42113,'nan').strip('\0'))
  if not math.isfinite(v) or abs(v)>1e7 or v==nodata:raise ValueError('No terrain data at probe')
  return v
if __name__=='__main__':
 url='https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/HiRISE/JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40.tif'
 raster=FloatStripTiff(url)
 # Published raster's geographic radius/standard parallel checked from GeoKeys.
 keys=raster.tags[34735];doubles=raster.tags[34736];resolved={}
 for i in range(keys[3]):
  k,loc,n,v=keys[4+i*4:8+i*4];resolved[k]=list(doubles[v:v+n]) if loc==34736 else v
 print(json.dumps({'width':raster.width,'height':raster.height,'scale':raster.tags[33550],'tiepoint':raster.tags[33922],'geoKeys':resolved,'citation':raster.tags.get(34737)},indent=2))
 Path('artifacts/planetary/jezero-geotiff-metadata.json').write_text(json.dumps({'url':url,'width':raster.width,'height':raster.height,'tags':raster.tags},indent=2)+'\n')

class FloatPdsImage(FloatStripTiff):
 """HiRISE attached PDS3 uncompressed PC_REAL DEM, with validated map metadata."""
 def __init__(self,url):
  import re
  self.file=RemoteZip(url);self.endian='<'
  label=self.read(0,16384).split(b'\x00',1)[0].decode('ascii')
  def value(key):
   match=re.search(r'^\s*'+re.escape(key)+r'\s*=\s*([^\r\n]+)',label,re.M)
   if not match:raise ValueError('Missing PDS '+key)
   return match[1].strip().strip('"').split(' <')[0]
  if value('SAMPLE_TYPE')!='PC_REAL' or value('SAMPLE_BITS')!='32' or value('BANDS')!='1' or value('MAP_PROJECTION_TYPE')!='EQUIRECTANGULAR':raise ValueError('Unsupported PDS DEM')
  if float(value('SCALING_FACTOR'))!=1 or float(value('OFFSET'))!=0 or float(value('MAP_PROJECTION_ROTATION'))!=0:raise ValueError('Unsupported PDS scaling/rotation')
  self.width=int(value('LINE_SAMPLES'));self.height=int(value('LINES'));record=int(value('RECORD_BYTES'));base=(int(value('^IMAGE'))-1)*record
  if record!=self.width*4:raise ValueError('Unsupported PDS record padding')
  scale=float(value('MAP_SCALE'));so=float(value('SAMPLE_PROJECTION_OFFSET'));lo=float(value('LINE_PROJECTION_OFFSET'))
  # PDS pixel centers are 1-based: sample = x/scale + offset + 1.
  self.tags={33550:(scale,scale,0),33922:(0,0,0,(-so-.5)*scale,(lo+.5)*scale,0),278:(1,),273:tuple(base+y*record for y in range(self.height)),259:(1,),42113:'nan'}
  self.radius=float(value('A_AXIS_RADIUS'))*1000;self.parallel=float(value('CENTER_LATITUDE'));self.meridian=float(value('CENTER_LONGITUDE'));self.label=label
 def project(self,lat,lon):
  lon=(lon-self.meridian+180)%360-180
  return self.radius*math.radians(lon)*math.cos(math.radians(self.parallel)),self.radius*math.radians(lat)
