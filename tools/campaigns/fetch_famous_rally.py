"""Cache public rally geometry without importing browser code or imagery.
Existing snapshots are preserved. Run from the repository root before the importer.
"""
import json,sys,xml.etree.ElementTree as ET
from pathlib import Path
from urllib.request import Request,urlopen
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_route_import as route
import race_track_import as track
ROOT=Path('data/campaigns/america/raceways/sources')
FAFE='https://www.rallydeportugal.pt/ResourcesUser/Imagens/Espectadores/OndeVer2026/MAPAS/Mapas-2/FAFE.html'
CONDOR='https://www.google.com/maps/d/kml?mid=1lw2I2hWCh8CxIE0fXRoT8-PUC9yBVw-k&forcekml=1'
def download(url):
 with urlopen(Request(url,headers={'User-Agent':'LastOnTheGrid-TrackImporter/1.0'}),timeout=40) as r:
  data=r.read(30_000_001)
  if len(data)>30_000_000:raise ValueError('Map response exceeds size limit')
  return data

def save(name,data):
 (ROOT/name).write_text(json.dumps(data,separators=(',',':'))+'\n')

def mapped_roads(raw,predicate):
 root=ET.fromstring(raw);nodes={int(n.attrib['id']):dict(lat=float(n.attrib['lat']),lon=float(n.attrib['lon'])) for n in root.findall('node')};ways=[]
 for w in root.findall('way'):
  tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')};ids=[int(n.attrib['ref']) for n in w.findall('nd')]
  if not tags.get('highway') or not predicate(tags) or any(i not in nodes for i in ids):continue
  ways.append(dict(type='way',id=int(w.attrib['id']),tags=tags,nodes=ids,geometry=[nodes[i] for i in ids]))
 if not ways:raise ValueError('No mapped roads returned')
 return ways

if __name__=='__main__':
 ROOT.mkdir(parents=True,exist_ok=True)
 if not (ROOT/'fafe-official.json').exists():
  block=download(FAFE).decode().split('// Track #1')[1].split('GV_Draw_Track(t);')[0]
  if "'SS21-23 FAFE'" not in block:raise ValueError('Official stage changed; review before importing')
  coords=json.JSONDecoder().raw_decode(block.split('points:')[1].lstrip())[0]
  save('fafe-official.json',dict(provider='Automóvel Club de Portugal / Vodafone Rally de Portugal',url=FAFE,stage='SS21-23 FAFE',coordinateOrder='latitude,longitude',coordinates=coords))
 if not (ROOT/'condor-official.json').exists():
  root=ET.fromstring(download(CONDOR));ns={'k':'http://www.opengis.net/kml/2.2'};lines=root.findall('.//k:LineString/k:coordinates',ns)
  if len(lines)!=1:raise ValueError('Tourism route changed; review before importing')
  coords=[[float(v) for v in s.split(',')[:2]][::-1] for s in lines[0].text.split()]
  save('condor-official.json',dict(provider='Córdoba Turismo',url='https://cordobaturismo.gov.ar/experiencias/circuito-condor-copina/',download=CONDOR,coordinateOrder='latitude,longitude',coordinates=coords))
 if not (ROOT/'sisteron.json').exists():save('sisteron.json',route.overpass('[out:json][timeout:25];way["highway"]["ref"="D 3"](44.12,5.93,44.25,6.22);out geom;',track.request_json))
 if not (ROOT/'fafe-surfaces.json').exists():save('fafe-surfaces.json',mapped_roads(download('https://api.openstreetmap.org/api/0.6/map?bbox=-8.125,41.45,-8.05,41.515'),lambda tags:True))
 if not (ROOT/'ruuhimaki.json').exists():save('ruuhimaki.json',mapped_roads(download('https://api.openstreetmap.org/api/0.6/map?bbox=26.00,62.23,26.22,62.33'),lambda tags:tags.get('name')=='Ruuhimäentie'))
 print('Rally source snapshots ready')
