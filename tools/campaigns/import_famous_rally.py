"""Public-source rally roads through the existing track importer and DEM adapter.
Official event traces and geographic road recreations are labelled separately.
No invented connectors, repeated loops, or extrapolated timing-line claims.
"""
import argparse,hashlib,json,math,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
import race_route_import as route
import terrain_tiles
from rebuild_legacy_stages import sample_terrain_grid
from audit_race_lines import place
from resample_import_terrain import resample_import_terrain
ROOT=Path('data/campaigns/america/raceways')
OUT=Path('artifacts/campaign-import/raceways')
SPECS=[
 dict(key='ruuhimaki',name='Ruuhimäki — Gravel Road',country='fi',lat=62.2093242,lon=26.1654249,width=6,surface='gravel',artHubStage=5,reference='https://sectorallyfinland.fi/wp-content/uploads/2021/07/Vetomies_Tiekirja-2024_web.pdf',source='ruuhimaki.json',waypoints=[[62.2093242,26.1654249],[62.2438198,26.13685]],method='Continuous Ruuhimäentie gravel road section within the famous rally area. Not the full 7.76 km stage: arena loop, approach and exact timing lines are omitted. DEM cannot reproduce surveyed jump profiles.'),
 dict(key='fafe',name='Fafe — Rally Portugal',country='pt',lat=41.4582537392542,lon=-8.12019561570453,width=5.5,surface='gravel',artHubStage=5,reference='https://www.rallydeportugal.pt/content.aspx?idioma=2&menuid=5534',source='fafe-official.json',method='Official ACP 2026 SS21/23 stage coordinate trace. DEM approximates terrain; jump profiles are not surveyed.'),
 dict(key='condor',name='El Cóndor — Copina',country='ar',lat=-31.611197,lon=-64.768293,width=5,surface='gravel',artHubStage=9,reference='https://cordobaturismo.gov.ar/experiencias/circuito-condor-copina/',source='condor-official.json',reverse=True,method='Córdoba Turismo GPS route for the historic RP14 rally road, reversed downhill from El Cóndor to Copina. Geographic recreation, not exact WRC timing lines; suspension bridge deck details are approximate.'),
 dict(key='sisteron',name='Sisteron — Authon',country='fr',lat=44.2065,lon=5.9481,width=5.5,surface='asphalt',artHubStage=2,reference='https://acm.mc/wp-content/uploads/2024/11/4.-RAMCH-2025-ITINERAIRE-DETAILLE-ETAPE-COMMUNE-2-VERSION-2-06.01.2025.pdf',source='sisteron.json',waypoints=[[44.2065,5.9481],[44.2448,6.052],[44.2417374,6.0714281]],method='Western section of the Sisteron-Thoard rally corridor: mapped D3 via Saint-Geniez to Authon. Split from the eastern Col de Fontbelle section to keep mobile terrain baking bounded. Game timing lines, not an exact WRC edition.'),
 dict(key='fontbelle',name='Col de Fontbelle — Authon to Thoard',country='fr',lat=44.2417374,lon=6.0714281,width=5.5,surface='asphalt',artHubStage=2,reference='https://acm.mc/wp-content/uploads/2024/11/4.-RAMCH-2025-ITINERAIRE-DETAILLE-ETAPE-COMMUNE-2-VERSION-2-06.01.2025.pdf',source='sisteron.json',waypoints=[[44.2417374,6.0714281],[44.1974,6.1352],[44.14516,6.13822]],method='Eastern section of the Sisteron-Thoard rally corridor: mapped D3 from Authon over Col de Fontbelle to Thoard. Separate playable section to bound mobile terrain baking. Game timing lines, not an exact WRC edition.')
]

def source_points(spec):
 source=ROOT/'sources'/spec['source'];data=json.loads(source.read_text());origin=(spec['lat'],spec['lon'])
 if 'coordinates' in data:
  coords=data['coordinates'][::-1] if spec.get('reverse') else data['coordinates']
  coords=coords[spec.get('trimSourcePoints',0):]
  points=[dict(lat=lat,lon=lon,**dict(zip(('x','y'),track.metric(lat,lon,origin))),tags={'surface':spec['surface'],'highway':'unclassified'}) for lat,lon in coords]
 else:
  targets=[dict(zip(('x','y'),track.metric(*p,origin))) for p in spec['waypoints']]
  points=route.trace(data,origin,targets,max_snap=100,avoid_repeated_edges=True)
  for p in points:
   p['tags']={'surface':spec['surface'],**p.get('tags',{})}
   if spec['surface']=='snow':p['tags']['surface']='snow'
 # Official Fafe trace supplies geometry; nearby OSM surface tags identify its
 # short tarmac crossings without replacing the event's gravel path geometry.
 if spec['key']=='fafe':
  path=ROOT/'sources/fafe-surfaces.json'
  if path.exists():
   ways=json.loads(path.read_text());edges=[]
   for w in ways:
    tags=w['tags'];surf=tags.get('surface')
    if surf not in ('asphalt','concrete','paved','gravel','unpaved','dirt','ground','compacted'):continue
    for a,b in zip(w['geometry'],w['geometry'][1:]):edges.append((track.metric(a['lat'],a['lon'],origin),track.metric(b['lat'],b['lon'],origin),tags))
   for p in points:
    best=(float('inf'),None)
    for a,b,tags in edges:
     dx,dy=b[0]-a[0],b[1]-a[1];t=max(0,min(1,((p['x']-a[0])*dx+(p['y']-a[1])*dy)/max(.001,dx*dx+dy*dy)));d=math.hypot(p['x']-a[0]-t*dx,p['y']-a[1]-t*dy)
     if d<best[0]:best=(d,tags)
    if best[0]<8:p['tags']={**p['tags'],**best[1]}
 return points,source

def build(spec):
 points,source=source_points(spec)
 length=sum(math.hypot(b['x']-a['x'],b['y']-a['y']) for a,b in zip(points,points[1:]))
 layout=dict(name=spec['name'],displayName=spec['name'],points=points,lengthM=length,open=True,place=dict(name=spec['name'],lat=spec['lat'],lon=spec['lon'],country='us'))
 issues=track.layout_review_issues(layout)
 unreviewed=[issue for issue in issues if issue not in spec.get('reviewedLayoutIssues',[])]
 if unreviewed:raise ValueError('; '.join(unreviewed))
 if spec.get('reviewedLayoutIssues') and set(issues)!=set(spec['reviewedLayoutIssues']):raise ValueError('Reviewed layout changed; recheck the documented junction.')
 result=track.build(layout,width=spec['width'],fetch=terrain_tiles.importer_fetch,max_segment_length_m=60,max_control_points=2000)
 race=result['race']
 if length>15000:race['renderSurfaceStepM']=5
 if any('unavailable' in w or 'flat editable' in w or 'incomplete' in w for w in result['warnings']):raise ValueError('Incomplete DEM: '+str(result['warnings']))
 sampled=track.densify(track.simplify(points),60);datum=race['source']['elevationDatumM']
 assert len(sampled)==len(race['road']['nodes'])
 for n,p in zip(race['road']['nodes'],sampled):n['elevation']=(terrain_tiles.elevation(p['lat'],p['lon'])-datum)/12
 for s,n in zip(race['road']['segments'],race['road']['nodes'][1:]):
  s['elevation']=n['elevation'];s['bumpiness']=.016 if s['surface']=='asphalt' else spec.get('bumpiness',.07 if spec['key']=='condor' else .045)
 race['source']['mappedRoadMaterials']=sorted({p.get('tags',{}).get('surface',spec['surface']) for p in points})
 sample_terrain_grid(race['road'],(spec['lat'],spec['lon']),datum)
 race['id']='rally-'+spec['key'];race['laps']=1;race['road']['autoExtend']=False
 race['source']['origin']['country']=spec['country']
 if spec.get('collection'):
  race['source']['rallyCollection']=dict(id=spec['collection'],name=spec['collectionName'],stage=spec['stageName'],year=spec.get('year'),coverage='selected-stages',timing='Game timing lines adjusted to suitable straights; not official timing controls.')
  race['source']['layoutName']=spec['stageName']+(f" ({spec['year']})" if spec.get('year') else '')
 if spec.get('stateCode'):race['source']['stateCode']=spec['stateCode']
 race['source'].update(provider=('OpenStreetMap' if spec.get('waypoints') else json.loads(source.read_text())['provider'])+' / Mapzen Terrain Tiles',sourceSnapshot=str(source),sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),elevationProvider='Mapzen / Tilezen Terrarium DEM zoom 12',elevationSmoothingRadiusM=20,terrainSampling='DEM at every road control point and terrain grid cell; orbital DEM cannot resolve exact crests, ruts or engineered jumps.',layoutReference=spec['reference'],geometryMethod=spec['method'],reviewedLayoutIssues=spec.get('reviewedLayoutIssues',[]))
 if not spec.get('waypoints'):
  race['source']['attribution']=json.loads(source.read_text())['provider']+' (route coordinates); Mapzen/Tilezen terrain; OSM contributors for available surface tags.'
  race['source']['license']='See original source attribution and terms; no blanket OSM license claim for organizer/tourism route coordinates.'
 race['source']['warnings']=[w.replace('USGS 3DEP','Mapzen DEM') for w in result['warnings']]+[spec['method'],'Road widths are estimates, not a surveyed stage. Scenery and conditions are fictional post-apocalyptic adaptations.']
 race['source']['linePlacement']=place(race,max_search_m=spec.get('timingSearchDistanceM'))
 if spec.get('tunnelDecks'):
  from rally_structures import apply_tunnel_decks
  # Timing-line trimming must precede the explicit network, so its endpoints
  # and the legacy/editor route cannot disagree about the timed distance.
  by_position={(p['x'],p['y']):p for p in sampled}
  race['source']['tunnelDecks']=apply_tunnel_decks(race,[by_position[(n['x'],n['y'])] for n in race['road']['nodes']])
 if spec.get('terrainCellSizeM'):resample_import_terrain(race,spec['terrainCellSizeM'])
 race['description']=spec['method'];OUT.mkdir(parents=True,exist_ok=True);out=OUT/(race['id']+'.json');out.write_text(json.dumps(race,separators=(',',':'))+'\n')
 report_path=ROOT/'report.json';rows=json.loads(report_path.read_text());rows=[r for r in rows if r['id']!=race['id']]
 rows.append(dict(id=race['id'],status='imported',name=spec['name'],raceRef=spec['name'],venueKey=spec.get('collection',spec['key']),venueName=spec.get('collectionName',spec['name']),layoutLabel=race['source'].get('layoutName','Rally stage'),hubStage=None,artHubStage=spec['artHubStage'],import_kind='road',event_type='Snow rally stage' if spec['surface']=='snow' else 'Rally stage',surface=sorted({s['surface'] for s in race['road']['segments']}),lengthM=length,laps=1,generatedPath=str(out),warnings=race['source']['warnings']))
 report_path.write_text(json.dumps(rows,indent=2)+'\n')
 print(spec['key'],round(length),len(sampled),'road points',len(race['road']['tileMap']['cells']),'terrain cells',flush=True)
 return race
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--only',nargs='*');args=parser.parse_args()
 for spec in SPECS:
  if not args.only or spec['key'] in args.only:build(spec)
