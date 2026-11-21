"""Bounded OSM API fallback when Overpass is unavailable. Keeps native way IDs.
The API map response is converted to the existing importer's Overpass shape;
no road geometry is invented. Source snapshots retain ODbL attribution.
"""
import argparse,json,math,sys,xml.etree.ElementTree as ET
from urllib.error import HTTPError
from pathlib import Path
from urllib.request import Request,urlopen
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
from inspect_raceways import candidate_layouts,ROOT

def parse_map(raw, public_alt_name=None, public_way_ids=()):
 root=ET.fromstring(raw);nodes={int(n.attrib['id']):dict(lat=float(n.attrib['lat']),lon=float(n.attrib['lon'])) for n in root.findall('node')};ways=[]
 for w in root.findall('way'):
  tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}
  if int(w.attrib['id']) in public_way_ids or (public_alt_name and tags.get('alt_name')==public_alt_name and tags.get('highway') in ('residential','tertiary','secondary','unclassified')):
   tags={**tags,'source:highway':tags['highway'],'highway':'raceway'}
  if tags.get('highway')!='raceway':continue
  ids=[int(n.attrib['ref']) for n in w.findall('nd')]
  if any(i not in nodes for i in ids):raise ValueError('Incomplete source way')
  ways.append(dict(type='way',id=int(w.attrib['id']),tags=tags,nodes=ids,geometry=[nodes[i] for i in ids]))
 return ways

def merge_relation(spec,ways,download):
 if not spec.get('raceRelationId'):return
 raw=download(f"https://api.openstreetmap.org/api/0.6/relation/{spec['raceRelationId']}/full")
 ids=set(spec['raceRelationWayIds'])
 for w in parse_map(raw,public_way_ids=ids):
  if w['id'] in ids:ways[w['id']]=w
 if not ids.issubset(ways):raise ValueError('Incomplete mapped race relation')

def fetch(spec):
 path=ROOT/'sources'/f"{spec['key']}.json"
 if path.exists():return
 if spec['key']=='silverstone' and Path('artifacts/silverstone-osm.xml').exists():raw=Path('artifacts/silverstone-osm.xml').read_bytes()
 else:
  lat,lon=spec['lat'],spec['lon'];dy=spec.get('mapHalfHeightDeg',.021);dx=dy/math.cos(math.radians(lat))
  url=f'https://api.openstreetmap.org/api/0.6/map?bbox={lon-dx},{lat-dy},{lon+dx},{lat+dy}'
  def download(url):
   with urlopen(Request(url,headers={'User-Agent':'LastOnTheGrid-TrackImporter/1.0'}),timeout=40) as response:return response.read(30_000_001)
  try:raw=download(url)
  except HTTPError as error:
   if error.code!=400:raise
   # Recursively bound dense city requests; retain full native ways across tiles.
   def bounded(x0,y0,x1,y1,depth=0):
    try:return parse_map(download(f'https://api.openstreetmap.org/api/0.6/map?bbox={x0},{y0},{x1},{y1}'),spec.get('publicCircuitAltName'))
    except HTTPError as exc:
     if exc.code!=400 or depth>=4:raise
     xm,ym=(x0+x1)/2,(y0+y1)/2
     return [w for box in [(x0,y0,xm,ym),(xm,y0,x1,ym),(x0,ym,xm,y1),(xm,ym,x1,y1)] for w in bounded(*box,depth+1)]
   ways={w['id']:w for w in bounded(lon-dx,lat-dy,lon+dx,lat+dy)}
   if not ways:raise ValueError('No mapped raceways in bounding box')
   merge_relation(spec,ways,download)
   path.write_text(json.dumps(list(ways.values()),separators=(',',':'))+'\n');return
  Path(f'artifacts/{spec["key"]}-osm.xml').write_bytes(raw)
  if len(raw)>30_000_000:raise ValueError('Circuit map area too large')
 ways=parse_map(raw,spec.get('publicCircuitAltName'))
 if not ways:raise ValueError('No mapped raceways in bounding box')
 ways={w['id']:w for w in ways}
 if spec.get('raceRelationId'):merge_relation(spec,ways,download)
 path.write_text(json.dumps(list(ways.values()),separators=(',',':'))+'\n')

if __name__=='__main__':
 keys=sys.argv[1:]
 for spec in json.loads(Path('tools/campaigns/raceway_sources.json').read_text()):
  if spec['key'] not in keys:continue
  try:
   fetch(spec);layouts=candidate_layouts(spec)
   (ROOT/f"{spec['key']}-layouts.json").write_text(json.dumps(layouts,separators=(',',':'))+'\n')
   print(spec['key'],len(layouts),'candidates; inspect saved layout report',flush=True)
  except Exception as e:print(spec['key'],'ERROR',str(e),flush=True)
