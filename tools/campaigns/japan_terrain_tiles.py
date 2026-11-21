"""GSI Japan terrain tiles adapter for the existing editor road importer.
Source/attribution: Geospatial Information Authority of Japan (GSI),
https://maps.gsi.go.jp/development/ichiran.html#dem
5 m DEM5A/DEM5B (zoom 15), then 10 m DEM10B (zoom 14). No synthetic elevations.
"""
import math,threading
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse,parse_qs
CACHE=Path('data/server-storage/race-import-cache/gsi-tiles')
_tiles={};_lock=threading.Lock()
used_layers=set()
def decode_text(raw):
 rows=[[None if v.strip()=='e' else float(v) for v in line.split(',')] for line in raw.decode('ascii').strip().splitlines()]
 if len(rows)!=256 or any(len(r)!=256 for r in rows):raise ValueError('Invalid GSI tile dimensions')
 if any(v is not None and (not math.isfinite(v) or not -500<=v<=9000) for r in rows for v in r):raise ValueError('Invalid GSI elevation')
 return rows
def tile(layer,z,x,y):
 key=(layer,z,x,y)
 with _lock:
  if key in _tiles:return _tiles[key]
  file=CACHE/f'{layer}-{z}-{x}-{y}.txt'
  try:
   if file.exists():raw=file.read_bytes()
   else:
    url=f'https://cyberjapandata.gsi.go.jp/xyz/{layer}/{z}/{x}/{y}.txt'
    with urlopen(Request(url,headers={'User-Agent':'LastOnTheGrid-TrackImporter/1.0'}),timeout=15) as response:raw=response.read(1000001)
    if len(raw)>1000000:raise ValueError('Oversized GSI tile')
   rows=decode_text(raw)
   if not file.exists():CACHE.mkdir(parents=True,exist_ok=True);file.write_bytes(raw)
  except HTTPError as e:
   if e.code!=404:raise
   rows=None
  _tiles[key]=rows
  return rows
def elevation(lat,lon):
 for layer,z in [('dem5a',15),('dem5b',15),('dem',14)]:
  scale=256*2**z
  px=(lon+180)/360*scale-.5
  py=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*scale-.5
  x,y=math.floor(px),math.floor(py);tx,ty=px-x,py-y
  def pixel(x,y):
   rows=tile(layer,z,x//256,y//256)
   return rows[y%256][x%256] if rows else None
  values=[pixel(x,y),pixel(x+1,y),pixel(x,y+1),pixel(x+1,y+1)]
  if all(v is not None for v in values):
   used_layers.add(layer)
   a,b,c,d=values
   return (a*(1-tx)+b*tx)*(1-ty)+(c*(1-tx)+d*tx)*ty
 raise ValueError('GSI DEM unavailable at road/terrain sample')
def importer_fetch(url,**kwargs):
 q=parse_qs(urlparse(url).query)
 try:return {'value':elevation(float(q['y'][0]),float(q['x'][0]))}
 except (OSError,KeyError,ValueError) as e:raise ValueError('GSI elevation unavailable: '+str(e)) from e
