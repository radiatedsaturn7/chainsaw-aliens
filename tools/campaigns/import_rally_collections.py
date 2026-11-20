"""Selected rally stages from organizer coordinate traces, using the shared importer.

Only the named competitive LineString is selected: liaison/access roads are never
joined to pad a stage. Historical variants are separate only when geometry differs.
"""
import argparse, io, json, math, re, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from probe_rally_collections import fetch
from import_famous_rally import build, ROOT

PORTUGAL='https://rallydeportugal.pt/ResourcesUser/Imagens/Espectadores/OndeVer2026/MAPAS/'
GREECE='https://drive.google.com/uc?export=download&id='
SOURCES=[
 dict(key='portugal-arganil-2026',collection='portugal',collectionName='Rally Portugal',stageName='Arganil',year=2026,country='pt',width=5.5,artHubStage=5,url=PORTUGAL+'ARGANIL.html',selector='SS05-07 ARGANIL',format='gpsvisualizer',bumpiness=.055),
 dict(key='portugal-gois-2026',collection='portugal',collectionName='Rally Portugal',stageName='Góis',year=2026,country='pt',width=5.5,artHubStage=5,url=PORTUGAL+'GOIS.html',selector='SS8 GÓIS',format='gpsvisualizer',bumpiness=.045),
 dict(key='portugal-lousa-2026',collection='portugal',collectionName='Rally Portugal',stageName='Lousã',year=2026,country='pt',width=5.5,artHubStage=5,url=PORTUGAL+'LOUSA.html',selector='SS06-09 LOUSÃ',format='gpsvisualizer',bumpiness=.05),
 dict(key='acropolis-pavliani-2024',collection='acropolis',collectionName='Acropolis Rally',stageName='Ano Pavliani',year=2024,country='gr',width=5.5,artHubStage=9,url=GREECE+'10zJtsW5P0kg-iLtu_RHrJLB1cg5SuZ2I',selector='02_SS1/4_AnoPavliani',format='kml',bumpiness=.07),
 dict(key='acropolis-dafni-2024',collection='acropolis',collectionName='Acropolis Rally',stageName='Dafni',year=2024,country='gr',width=5.5,artHubStage=9,url=GREECE+'10zJtsW5P0kg-iLtu_RHrJLB1cg5SuZ2I',selector='04_SS2/4_Dafni',format='kml',bumpiness=.065),
 dict(key='acropolis-tarzan-2024',collection='acropolis',collectionName='Acropolis Rally',stageName='Tarzan',year=2024,country='gr',width=5.5,artHubStage=9,url=GREECE+'10zJtsW5P0kg-iLtu_RHrJLB1cg5SuZ2I',selector='06_SS/3/6_Tarzan',format='kml',bumpiness=.075),
 dict(key='acropolis-bauxites-2021',collection='acropolis',collectionName='Acropolis Rally',stageName='Bauxites',year=2021,country='gr',width=5.5,artHubStage=9,url=GREECE+'1zS4_b2hfKJ-p--alv_dUpD4bsSMG8KLn',selector='Bauxites',format='kml',bumpiness=.075),
 dict(key='acropolis-tarzan-2021',collection='acropolis',collectionName='Acropolis Rally',stageName='Tarzan Power Stage',year=2021,country='gr',width=5.5,artHubStage=9,url=GREECE+'1zF8A1tCkUaNxqftsc86o_VSXr7cACy7_',selector='SS_Tarzan_New',format='kml',bumpiness=.075),
]
NEFR_REFERENCE='https://www.americanrallyassociation.org/post/new-england-forest-rally-stage-guide'
for key,stage,road,width in [('concord','Concord Pond','Concord Pond Road',5.5),('morton','Morton Cutoff','Morton Cutoff',6),('north','North Road','North Road',6)]:
 SOURCES.append(dict(key='nefr-'+key,collection='new-england',collectionName='New England Forest Rally',stageName=stage+' — Road Section',year=None,country='us',stateCode='ME',width=width,artHubStage=3,format='osm',roadName=road,url=NEFR_REFERENCE,bumpiness=.045 if key=='morton' else .06))

SWEDEN_REFERENCE='https://rallysweden.com/wp-content/uploads/2018/11/gps-positioner.pdf'
SNODRIFT_REFERENCE='https://app-cdn.sportity.com/d9b48fd6-b0d9-47f2-b17e-028aa5508b2a/777bf55a-2837-4d2c-b6d2-7737b16efcdb_2025%20SnoDrift%20Safety%20Plan%20Final.pdf'
for key,stage,waypoints in [
 ('vargasen','Vargåsen',[[60.0574541,13.4314996],[60.0518844,13.3509258],[60.0189256,13.3016538],[59.9958872,13.2872321]]),
 ('torsby','Torsby',[[60.1844,12.9144],[60.1740833333333,12.9651166666667],[60.14945,12.9903333333333]]),
 ('likenas','Likenäs',[[60.5230339,13.144927],[60.5487213,13.1745219],[60.5817015,13.1607497],[60.6201016,13.1057726],[60.6267496,13.0623037]])]:
 SOURCES.append(dict(key='sweden-'+key,collection='sweden',collectionName='Rally Sweden',stageName=stage+' — Road Recreation',year=None,country='se',width=5.5,artHubStage=2,format='mapped-snow',waypoints=waypoints,url=SWEDEN_REFERENCE,bumpiness=.035,method='Current mapped roads through the organizer 2019 start, radio and finish locations. Checkpoints snapped to nearby road nodes (within 60 m) to avoid radio access spurs. Geographic winter recreation, not a surveyed historical stage. Snow over gravel; DEM cannot resolve exact crests or engineered jumps.'))
for key,stage,waypoints in [
 ('agren','Agren',[[44.927341,-84.292769],[44.93644,-84.256455]]),
 ('shoreline','Shoreline',[[44.941012,-84.18893],[44.918457,-84.197999]]),
 ('old-state','Old State',[[45.006544,-84.369967],[45.005892,-84.254749]])]:
 SOURCES.append(dict(key='snodrift-'+key,collection='sno-drift',collectionName='Sno*Drift Rally',stageName=stage+' — Road Section',year=None,country='us',stateCode='MI',width=6,artHubStage=2,format='mapped-snow',waypoints=waypoints,url=SNODRIFT_REFERENCE,bumpiness=.04,method='Continuous mapped portion of a road identified in the organizer 2025 stage maps. Partial geographic recreation, not the full competition stage or its exact timing controls. Snow over unpaved road; no invented connections to missing stage roads.'))

for key,stage,waypoints in [
 ('whaanga','Whaanga Coast', [[-37.9040084,174.7845997],[-37.8242537,174.804021]]),
 ('te-hutewai','Te Hutewai', [[-37.8333867,174.8539004],[-37.8748072,174.8683419]]),
 ('te-akau-south','Te Akau South', [[-37.7571229,174.8610377],[-37.682177,174.8468532]])]:
 SOURCES.append(dict(key='nz-'+key,collection='new-zealand',collectionName='Rally New Zealand',stageName=stage+' — Road Section',year=None,country='nz',width=5.5,artHubStage=5,format='mapped-road',waypoints=waypoints,url='https://www.hella.co.nz/assets/Raglan_Rally_of_the_Coast_-_Spectator_Guide_Map_and_Itinerary.pdf',bumpiness=.045,method='Current mapped named road in the organizer Raglan rally guide. Partial geographic road recreation, not the complete WRC competition stage. Whaanga uses Whaanga Road without the Ruapuke approach; Te Hutewai and Te Akau South use their gravel sections. Existing mapped paved crossings retained. DEM does not resolve surveyed camber or jumps.'))

for key,stage in [('valenciana','Valenciana'),('mineral-pozos','Mineral de Pozos'),('mesa-borregos','Mesa de Borregos')]:
 SOURCES.append(dict(key='mexico-'+key+'-2025',collection='mexico',collectionName='Rally Mexico — Rally of Nations',stageName=stage,year=2025,country='mx',width=5.5,artHubStage=9,format='kml',url='https://rally.calymedia.com/files/2025/RoN2025_v2.11.kmz',selector=stage,provider='Rally of Nations Mexico organizer',identicalPasses=True,bumpiness=.065))

for key,stage,waypoints in [
 ('hof-finnskog','Hof-Finnskog',[[60.6036103,12.3109464],[60.5813402,12.3020511],[60.5765512,12.259003],[60.6027003,12.2624936],[60.613373,12.1960967],[60.5851521,12.1512705],[60.5871471,12.0992638]]),
 ('svullrya','Svullrya',[[60.3586415,12.3642567],[60.3319215,12.4113608],[60.3169995,12.463308],[60.3375793,12.4511153],[60.3685703,12.4361743],[60.4087486,12.3931963]])]:
 SOURCES.append(dict(key='norway-'+key,collection='norway',collectionName='Norway — Finnskog Rally Roads',stageName=stage+' — Road Recreation',year=None,country='no',width=5.5,artHubStage=2,format='mapped-snow',waypoints=waypoints,url=SWEDEN_REFERENCE,bumpiness=.04,method='Current Norwegian roads traced through published Rally Sweden 2019 cross-border stage controls. Nearby through-road nodes replace off-road radio/control points; the Hof start omits the short control approach. Winter geographic recreation, not the exact historic Rally Norway WRC itinerary or surveyed stage.'))

SOURCES.append({'key': 'chile-conuco', 'collection': 'chile', 'collectionName': 'Rally Chile', 'stageName': 'Conuco — Forest Road Recreation', 'year': None, 'country': 'cl', 'width': 5.5, 'artHubStage': 5, 'format': 'mapped-road', 'waypoints': [[-36.6373699, -72.7700847], [-36.6450833, -72.7719569], [-36.6496213, -72.7745372], [-36.6541193, -72.7676493], [-36.6579992, -72.7675464], [-36.6597507, -72.7574653], [-36.6419068, -72.7593425]], 'url': 'https://www.biobiochile.cl/especial/rally/rutas.shtml', 'bumpiness': 0.055, 'method': 'Current OSM forest-road loop visually matched to the public 2024 Conuco shakedown map and organizer start-area coordinates. Geographic road recreation, not the exact 6.79 km competitive stage: mapped southern forest-road alignments and game timing boundaries differ. No invented connections or repeated road edges. Widths and surface roughness estimated; DEM does not survey ruts or jumps.'})

SOURCES.append({'key': 'kenya-hells-gate', 'collection': 'safari-kenya', 'collectionName': 'Safari Rally Kenya', 'stageName': 'Hell’s Gate — Road Recreation', 'year': None, 'country': 'ke', 'width': 4.5, 'artHubStage': 9, 'format': 'mapped-road', 'waypoints': [[-0.8972833333333334, 36.3494], [-0.8958499999999999, 36.359766666666665], [-0.8879333333333334, 36.371716666666664], [-0.8797333333333334, 36.375683333333335], [-0.8735999999999999, 36.36408333333333], [-0.8650312, 36.37078], [-0.85815, 36.36363333333333]], 'url': 'https://www.scribd.com/document/1053966482/WRC-Safari-Rally-2021-Safety-Book', 'bumpiness': 0.065, 'reviewedLayoutIssues': ['Abrupt 131-degree reversal at point 190; verify junction continuity'], 'method': "Current OSM roads reconstructed through the organizer 2021 Safety Book Hell's Gate start, radio controls and finish (public mirror). The 9.18 km control snaps 6.3 m to its mapped junction to avoid a false spur. The sharp Buffalo Circuit/Gorge Road junction is real connected topology (OSM ways 35283035/35283037), not an overlapping road reversal. Geographic recreation, not a surveyed historic stage; widths, small bridges and roughness are approximate."})

SOURCES.append({'key': 'japan-bisan', 'collection': 'japan-hokkaido', 'collectionName': 'Rally Japan — Hokkaido', 'stageName': 'Bisan — Road Recreation', 'year': None, 'country': 'jp', 'width': 5.5, 'artHubStage': 5, 'format': 'mapped-road', 'waypoints': [[43.30663333333333, 141.88293333333334], [43.29388333333333, 141.90915], [43.2999, 141.9199]], 'url': 'https://www.rallyjapan.jp/e/pdf/10RJ_RG2_ENG08.11_SSMaps3.pdf', 'bumpiness': 0.05, 'method': 'Current OSM forest roads matched to the organizer 2010 Rally Guide 2 stage map and start/radio/finish coordinates. Geographic gravel-road recreation, not a surveyed 2010 stage; current road alignments and game timing lines differ. Naekawa radio controls are snapped up to 33 m to adjacent mapped junctions, avoiding off-road safety positions. Its sharp R3 junction is genuine connected topology (OSM ways 226201402/226201413). Road widths and roughness estimated.'})
SOURCES.append({'key': 'japan-naekawa', 'collection': 'japan-hokkaido', 'collectionName': 'Rally Japan — Hokkaido', 'stageName': 'Naekawa — Road Recreation', 'year': None, 'country': 'jp', 'width': 5.5, 'artHubStage': 5, 'format': 'mapped-road', 'waypoints': [[43.41535, 141.92575], [43.3914, 141.95816666666667], [43.393624, 141.985795], [43.404221, 141.988323], [43.409745, 141.977191], [43.42565, 141.98486666666668], [43.446016666666665, 141.98035]], 'url': 'https://www.rallyjapan.jp/e/pdf/10RJ_RG2_ENG08.11_SSMaps3.pdf', 'bumpiness': 0.05, 'method': 'Current OSM forest roads matched to the organizer 2010 Rally Guide 2 stage map and start/radio/finish coordinates. Geographic gravel-road recreation, not a surveyed 2010 stage; current road alignments and game timing lines differ. Naekawa radio controls are snapped up to 33 m to adjacent mapped junctions, avoiding off-road safety positions. Its sharp R3 junction is genuine connected topology (OSM ways 226201402/226201413). Road widths and roughness estimated.', 'reviewedLayoutIssues': ['Abrupt 152-degree reversal at point 302; verify junction continuity']})
SOURCES.append({'key': 'turkey-ula-2019', 'collection': 'turkey', 'collectionName': 'Rally Turkey', 'stageName': 'Ula', 'year': 2019, 'country': 'tr', 'width': 5.5, 'artHubStage': 9, 'format': 'kml', 'url': 'https://www.google.com/maps/d/kml?mid=1fii0U2rDVwfqwYPumAlA9H-P7p-wEYUQ&forcekml=1', 'selector': 'DAY 2 |\xa0SS 4/7 ULA', 'provider': 'Marmaris Info linked public Rally Turkey 2019 stage map', 'bumpiness': 0.065, 'method': 'Competitive-stage coordinate trace from the public 2019 Rally Turkey map linked by Marmaris Info (https://www.marmarisinfo.com/wrc-rally-turkey). Spectator access roads and repeat passes excluded. Predominantly gravel; exact widths, small paved crossings and surveyed roughness unresolved. Game timing lines differ from official controls.'})
SOURCES.append({'key': 'turkey-cicekli-2019', 'collection': 'turkey', 'collectionName': 'Rally Turkey', 'stageName': 'Çiçekli', 'year': 2019, 'country': 'tr', 'width': 5.5, 'artHubStage': 9, 'format': 'kml', 'url': 'https://www.google.com/maps/d/kml?mid=1fii0U2rDVwfqwYPumAlA9H-P7p-wEYUQ&forcekml=1', 'selector': 'DAY 4 | SS 16 ÇİÇEKLİ', 'provider': 'Marmaris Info linked public Rally Turkey 2019 stage map', 'bumpiness': 0.065, 'method': 'Competitive-stage coordinate trace from the public 2019 Rally Turkey map linked by Marmaris Info (https://www.marmarisinfo.com/wrc-rally-turkey). Spectator access roads and repeat passes excluded. Predominantly gravel; exact widths, small paved crossings and surveyed roughness unresolved. Game timing lines differ from official controls.'})
SOURCES.append({'key': 'turkey-icmeler-2019', 'collection': 'turkey', 'collectionName': 'Rally Turkey', 'stageName': 'İçmeler', 'year': 2019, 'country': 'tr', 'width': 5.5, 'artHubStage': 9, 'format': 'kml', 'url': 'https://www.google.com/maps/d/kml?mid=1fii0U2rDVwfqwYPumAlA9H-P7p-wEYUQ&forcekml=1', 'selector': 'DAY 2 | SS 2/5 İÇMELER', 'provider': 'Marmaris Info linked public Rally Turkey 2019 stage map', 'bumpiness': 0.065, 'method': 'Competitive-stage coordinate trace from the public 2019 Rally Turkey map linked by Marmaris Info (https://www.marmarisinfo.com/wrc-rally-turkey). Spectator access roads and repeat passes excluded. Predominantly gravel; exact widths, small paved crossings and surveyed roughness unresolved. Game timing lines differ from official controls.'})

# Reviewed additional road sections share the same import and installation path.
SOURCES.extend(json.loads((ROOT/'rally-additions.json').read_text()))

def coordinates(raw,fmt,selector, identical_passes=False):
 if fmt=='gpsvisualizer':
  matches=[]
  for block in raw.decode().split('GV_Draw_Track(t);'):
   if re.search(r"info.name\s*=\s*'"+re.escape(selector)+r"'",block):
    matches.append(json.JSONDecoder().raw_decode(block.split('points:')[-1].lstrip())[0])
 else:
  if raw[:2]==b'PK':
   with zipfile.ZipFile(io.BytesIO(raw)) as archive:
    names=[n for n in archive.namelist() if n.endswith('.kml')]
    if len(names)!=1 or archive.getinfo(names[0]).file_size>30_000_000:raise ValueError('Unexpected KMZ contents')
    raw=archive.read(names[0])
  ns={'k':'http://www.opengis.net/kml/2.2'};root=ET.fromstring(raw);matches=[]
  for p in root.findall('.//k:Placemark',ns):
   if p.findtext('k:name',namespaces=ns)==selector:
    for line in p.findall('.//k:LineString/k:coordinates',ns):
     matches.append([[float(v) for v in c.split(',')[:2]][::-1] for c in line.text.split()])
 if identical_passes and matches and all(m==matches[0] for m in matches):matches=matches[:1]
 if len(matches)!=1:raise ValueError(f'Expected exactly one continuous stage: {selector}, found {len(matches)}')
 points=[]
 for p in matches[0]:
  if len(p)!=2 or not all(math.isfinite(x) for x in p) or abs(p[0])>90 or abs(p[1])>180:raise ValueError('Invalid coordinate')
  if not points or p!=points[-1]:points.append(p)
 if len(points)<20:raise ValueError('Insufficient stage geometry')
 return points

def prepare(spec):
 spec={**spec};source=ROOT/'sources'/(spec['key']+'.json')
 if spec['format'] in ('mapped-snow','mapped-road'):
  if not source.exists():
   from fetch_famous_rally import mapped_roads
   origin=json.loads((ROOT/'rally-road-sources.json').read_text())[spec['key']]
   if origin.get('snapshot'):
    raise ValueError(f"Missing reviewed edge snapshot {origin['snapshot']}; restore it before rebuilding, rather than importing unreviewed whole ways.")
   def selected(tags):
    return (not origin.get('roadName') or tags.get('name')==origin['roadName']) and (not origin.get('highways') or tags.get('highway') in origin['highways']) and tags.get('highway') not in origin.get('excludeHighways',[])
   ways={}
   for bbox in origin.get('bboxes',[origin.get('bbox')]):
    raw,_=fetch('https://api.openstreetmap.org/api/0.6/map?bbox='+bbox)
    for way in mapped_roads(raw.read_bytes(),selected):
     if not origin.get('reviewedWayIds') or way['id'] in origin['reviewedWayIds']:ways[way['id']]=way
   if not ways:raise ValueError('Reviewed source roads are no longer available; recheck the map.')
   source.write_text(json.dumps(list(ways.values()),separators=(',',':'))+'\n')
  spec.update(source=source.name,lat=spec['waypoints'][0][0],lon=spec['waypoints'][0][1],surface='snow' if spec['format']=='mapped-snow' else spec.get('surface','gravel'),terrainCellSizeM=80,reference=spec['url'],name=f"{spec['collectionName']} — {spec['stageName']}")
  return spec
 if spec['format']=='osm':
  import import_america as america
  import race_track_import as track
  import race_route_import as route
  if spec['key']=='nefr-concord':
   source=ROOT/'sources'/'concord-network.json'
   ways=json.loads(source.read_text());origin=(44.4747441,-70.6326028)
   waypoints=[list(origin),[44.4424571,-70.5764514],[44.46086,-70.533635]]
  else:
   ways=[w for w in json.loads((ROOT/'sources'/'nefr-roads.json').read_text()) if w.get('tags',{}).get('name')==spec['roadName'] and w.get('tags',{}).get('surface')=='gravel']
   source.write_text(json.dumps(ways,separators=(',',':'))+'\n')
   origin=(ways[0]['geometry'][0]['lat'],ways[0]['geometry'][0]['lon'])
   points=america.longest_connected_trace(ways,origin)
   waypoints=[[p['lat'],p['lon']] for p in [points[0],points[-1]]]
  spec.update(lat=origin[0],lon=origin[1],waypoints=waypoints,source=source.name,surface='gravel',name=f"NEFR — {spec['stageName']}",reference=NEFR_REFERENCE,terrainCellSizeM=80)
  spec['method']='Current OpenStreetMap road geometry in a rally area documented by the ARA 2021 stage guide; not a reconstruction of the exact 2021 competition boundaries. Game timing lines and estimated widths. Morton Cutoff is a partial mapped section; no invented extension. Missing surface tags use gravel as the rally-road assumption.'
  return spec
 if not source.exists():
  path,_=fetch(spec['url']);coords=coordinates(path.read_bytes(),spec['format'],spec['selector'],spec.get('identicalPasses',False))
  provider=spec.get('provider') or ('Automóvel Club de Portugal' if spec['country']=='pt' else 'Acropolis Rally organizer')
  source.write_text(json.dumps(dict(provider=provider,url=spec['url'],stage=spec['selector'],year=spec['year'],coordinateOrder='latitude,longitude',coordinates=coords),separators=(',',':'))+'\n')
 data=json.loads(source.read_text());spec.update(lat=data['coordinates'][0][0],lon=data['coordinates'][0][1],source=source.name,surface=spec.get('surface','gravel'),name=f"{spec['collectionName']} — {spec['stageName']} {spec['year']}",reference=spec['url'],terrainCellSizeM=80)
 spec['method']=spec.get('method') or f"Organizer {spec['year']} coordinate trace for {spec['selector']}; selected stage, not a full rally itinerary. Predominantly gravel; short paved crossings and exact surveyed widths/jumps are not resolved. Timing lines adjusted for gameplay."
 if spec['key']=='acropolis-bauxites-2021':
  spec['trimSourcePoints']=2
  spec['method']+=' Two leading GPS points form a 16 m out-and-back artifact and are omitted; the continuous stage trace starts at source point 3.'
 return spec

# Additional documented GT/FM/WRC coverage uses the same source adapters.
SOURCES.extend(json.loads(Path(__file__).with_name('gt_wrc_rally_sources.json').read_text()))

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--only',nargs='*');parser.add_argument('--sources-only',action='store_true');args=parser.parse_args()
 for spec in SOURCES:
  if not args.only or spec['key'] in args.only:
   ready=prepare(spec)
   if not args.sources_only:build(ready)
   else:print(ready['key'],flush=True)
