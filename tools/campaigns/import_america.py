"""Import the nine new Middle Route stages through the existing OSM importer.
OSM snapshots are committed in middle-sources; selection is repeatable offline.
Run this, then node tools/campaigns/install_america.mjs. Existing opening races
are catalogued by the installer without rewriting their saved implementations.
"""
import json, math, sys, heapq
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import race_track_import as track
import race_route_import as route
import terrain_tiles

ROOT = Path('data/campaigns/america')
OUTPUT = Path('artifacts/campaign-import/middle')
SPECS = json.loads(Path('tools/campaigns/middle_route.json').read_text())
TARGET_SECONDS = 660


def download_sources():
    import re
    folder=ROOT/'middle-sources';folder.mkdir(parents=True,exist_ok=True)
    for spec in SPECS:
        file=folder/(spec['key']+'.json')
        if file.exists():continue
        key,pattern=next(iter(spec['osmSelector'].items()))
        ways={}
        if spec.get('includeArchivedRef'):
            for way in json.loads((ROOT/'osm-ways.json').read_text()):
                if spec['includeArchivedRef'] in way.get('tags',{}).get('ref','').split(';'):ways[way['id']]=way
        print('Downloading '+spec['name'],flush=True)
        def fetch_box(bounds,depth=0):
            south,west,north,east=bounds
            bbox=f'{west},{south},{east},{north}'
            try:data=track.request_json('https://api.openstreetmap.org/api/0.6/map.json?bbox='+bbox)
            except ValueError as error:
                # Dense urban/forest areas exceed OSM's node cap, even in a
                # small box. Split the query, never synthesize missing roads.
                if '400' not in str(error) or depth>=3:raise
                midlat,midlon=(south+north)/2,(west+east)/2
                for box in [(south,west,midlat,midlon),(south,midlon,midlat,east),
                            (midlat,west,north,midlon),(midlat,midlon,north,east)]:fetch_box(box,depth+1)
                return
            nodes={n['id']:n for n in data['elements'] if n['type']=='node'}
            for way in data['elements']:
                if (way['type']=='way' and way.get('tags',{}).get('highway')
                    and re.search(pattern,way.get('tags',{}).get(key,'')) and all(n in nodes for n in way['nodes'])):
                    ways[way['id']]={**way,'geometry':[{k:nodes[n][k] for k in ('lat','lon')} for n in way['nodes']]}
        for box in spec.get('mapBoxes',[spec['bbox']]):fetch_box(box)
        if not ways:raise ValueError('No road data for '+spec['name'])
        file.write_text(json.dumps({'bbox':spec['bbox'],'boxes':spec.get('mapBoxes'),
            'selector':spec['osmSelector'],'ways':list(ways.values())},separators=(',',':'))+'\n')
        print(f'  {len(ways)} ways',flush=True)


def longest_connected_trace(ways, origin, minimum_progress=.3):
    points, edges = route.graph(ways, origin)
    adj = {}
    for a,b,tags in edges:
        if tags.get('highway') in ('footway','path','cycleway','steps','construction','proposed'): continue
        d=math.hypot(points[b]['x']-points[a]['x'],points[b]['y']-points[a]['y'])
        one=str(tags.get('oneway','yes' if tags.get('junction')=='roundabout' else '')).lower()
        if one!='-1': adj.setdefault(a,[]).append((b,d))
        if one not in ('yes','1','true'): adj.setdefault(b,[]).append((a,d))
    ordered=sorted(points,key=lambda n:points[n]['lon'])
    starts=list(dict.fromkeys([n for n in ordered if len(adj.get(n,[]))==1]+ordered[::max(1,len(ordered)//40)]))
    best=None
    for start in starts:
        dist={start:0};q=[(0,start)]
        while q:
            cost,u=heapq.heappop(q)
            if cost!=dist[u]:continue
            for v,d in adj.get(u,[]):
                if cost+d<dist.get(v,math.inf):dist[v]=cost+d;heapq.heappush(q,(cost+d,v))
        separated=[n for n in dist if math.hypot(points[n]['x']-points[start]['x'],points[n]['y']-points[start]['y'])>=max(500,dist[n]*minimum_progress)]
        if not separated:continue
        finish=max(separated,key=dist.get)
        if best is None or dist[finish]>best[0]:best=(dist[finish],start,finish)
    if not best or best[0]<500:raise ValueError('No continuous drivable source section')
    a,b=best[1:]
    # Trace using importer topology and direction rules, never proximity joins.
    return route.trace(ways,origin,[{k:points[n][k] for k in ('x','y')} for n in (a,b)])


def profile(points, pace_cap=28, settings=None):
    """Planning estimate: curvature-limited winter pace, with accel/brake passes.
    Not a measured AI lap. No speed limit or artificial delay is imposed in-game.
    """
    settings=settings or {}
    dist=[0.0]
    for a,b in zip(points,points[1:]):dist.append(dist[-1]+math.hypot(b['x']-a['x'],b['y']-a['y']))
    speeds=[];turns=[]
    for i,p in enumerate(points):
        a=points[max(0,i-1)];b=points[min(len(points)-1,i+1)]
        u=(p['x']-a['x'],p['y']-a['y']);v=(b['x']-p['x'],b['y']-p['y'])
        angle=abs(math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]))
        chord=math.hypot(b['x']-a['x'],b['y']-a['y'])
        curvature=2*math.sin(angle)/max(1,chord)
        loose=p.get('tags',{}).get('surface') in ('gravel','unpaved','compacted','dirt','ground')
        lateral=settings.get('looseLateralMps2',2.3) if loose else settings.get('pavedLateralMps2',3.2)
        speed=min(min(settings.get('looseCapMps',22),pace_cap) if loose else pace_cap, math.sqrt(lateral/max(.00001,curvature)))
        # Winter visibility/patchy snow reduces sustainable pace, not geometry.
        speeds.append(max(4,speed*settings.get('visibilityFactor',.85)));turns.append(angle)
    speeds[0]=min(speeds[0],5)
    for i in range(1,len(points)):speeds[i]=min(speeds[i],math.sqrt(speeds[i-1]**2+2*settings.get('accelerationMps2',1.7)*(dist[i]-dist[i-1])))
    for i in range(len(points)-2,-1,-1):speeds[i]=min(speeds[i],math.sqrt(speeds[i+1]**2+2*settings.get('brakingMps2',3)*(dist[i+1]-dist[i])))
    times=[0.0]
    for i in range(1,len(points)):times.append(times[-1]+2*(dist[i]-dist[i-1])/(speeds[i]+speeds[i-1]))
    return dist,times,turns


def select_section(points,spec):
    points=track.densify(track.simplify(points),80)
    dist,times,turns=profile(points,spec.get('paceCapMps',28),spec.get('paceSettings'))
    if times[-1]<=TARGET_SECONDS:return points
    # Score contiguous ~11-minute windows by technical turns, DEM relief and
    # inclusion of a named landmark. Do not default to the first road endpoint.
    focus=track.metric(*spec['focus'],(spec['lat'],spec['lon'])) if spec.get('focus') else None
    best=None;j=1
    for i in range(0,len(points)-3):
        j=max(j,i+2)
        while j<len(points)-1 and times[j]-times[i]<TARGET_SECONDS:j+=1
        duration=times[j]-times[i]
        if duration<TARGET_SECONDS*.92:break
        section=points[i:j+1]
        near=min(math.hypot(p['x']-focus[0],p['y']-focus[1]) for p in section) if focus else 0
        elevations=[]
        for p in section[::max(1,len(section)//8)]:
            try:elevations.append(terrain_tiles.elevation(p['lat'],p['lon']))
            except (OSError,ValueError):pass
        relief=max(elevations)-min(elevations) if elevations else 0
        score=sum(turns[i:j+1])*2 + relief*.015 - abs(duration-TARGET_SECONDS)*.5 - min(near,10000)*.03
        if best is None or score>best[0]:best=(score,i,j)
    return points[best[1]:best[2]+1]


def build_stage(spec,index):
    archive=json.loads((ROOT/'middle-sources'/f'{spec["key"]}.json').read_text())
    ways=archive['ways']
    refs={'laurel':'PA 381','ohio':'SR 26','ozark':'MO 19','angeles':'CA 2'}
    if spec['key'] in refs:ways=[w for w in ways if refs[spec['key']] in w.get('tags',{}).get('ref','').split(';')]
    if not ways:raise ValueError('Empty OSM snapshot: '+spec['key'])
    ways=json.loads(json.dumps(ways))
    for way in ways:
        tags=way.get('tags',{})
        if not tags.get('width') and str(tags.get('lanes','')).isdigit():
            tags['width']=str(max(3,min(30,int(tags['lanes'])*3.2+.6)))
            tags['campaignWidthEstimate']='OSM lane count × 3.2 m + 0.6 m edge allowance'

    points=longest_connected_trace(ways,(spec['lat'],spec['lon']),.75 if spec['key']=='route66' else .65 if spec['key']=='city' else .3)
    points=select_section(points,spec)
    origin={'name':spec['name'],'lat':spec['lat'],'lon':spec['lon'],'country':'us'}
    # Make the selected path an importer layout. It came from route.trace above;
    # archive every original OSM vertex within the selected endpoints as evidence.
    endpoints=[{k:p[k] for k in ('x','y')} for p in (points[0],points[-1])]
    result=route.route({'place':origin,'ways':ways},endpoints,'direct')
    layout=track.recall(result['layouts'][0]['id'],'layout')
    layout['displayName']=spec['name']
    race=track.build(layout,width=spec['width'],use_elevation=True,fetch=terrain_tiles.importer_fetch,max_segment_length_m=80)['race']
    race['id']='america-middle-'+spec['key']
    race['source'].update(provider='OpenStreetMap / Mapzen Terrain Tiles',elevationProvider='Mapzen / Tilezen Terrarium DEM, zoom 12',elevationSourceUrl='https://registry.opendata.aws/terrain-tiles/',elevationAttribution='Mapzen/Tilezen; USGS 3DEP, GMTED2010 and SRTM',elevationLicenseUrl='https://github.com/tilezen/joerd/blob/master/docs/attribution.md')
    race['source']['warnings']=[w.replace('USGS 3DEP','Mapzen DEM').replace('USGS elevation','DEM elevation') for w in race['source']['warnings']]
    # Reuse the cached DEM to refine every editable road node rather than only
    # the importer's default 64 samples. Missing samples retain importer values.
    simplified=track.densify(track.simplify(layout['points']),80);base=race['source']['elevationDatumM'];missing=0
    for node,p in zip(race['road']['nodes'],simplified):
        try:node['elevation']=(terrain_tiles.elevation(p['lat'],p['lon'])-base)/12
        except (OSError,ValueError):missing+=1
    # DEM reports ground/water under bridges. Approximate decks between the
    # two approach heights instead of creating a dip into the river.
    i=0;bridges=0
    while i<len(simplified)-1:
        if simplified[i].get('tags',{}).get('bridge') not in ('yes','viaduct'):
            i+=1;continue
        first=i
        while i<len(simplified)-1 and simplified[i].get('tags',{}).get('bridge') in ('yes','viaduct'):i+=1
        a,b=max(0,first-1),min(len(simplified)-1,i+1)
        chain=race['road']['nodes'][a:b+1];ds=[0]
        for p,q in zip(chain,chain[1:]):ds.append(ds[-1]+math.hypot(q['x']-p['x'],q['y']-p['y']))
        ha,hb=chain[0]['elevation'],chain[-1]['elevation']
        for node,distance in zip(chain,ds):node['elevation']=ha+(hb-ha)*distance/max(.001,ds[-1])
        bridges+=1
    race['source']['bridgeDeckApproximations']=bridges
    for node,segment in zip(race['road']['nodes'][1:],race['road']['segments']):segment['elevation']=node['elevation']
    race['source']['elevationMissingNodeCount']=missing
    race['source']['roadSurveySpacingM']=80
    track.fit_terrain_to_road(race['road'])
    race['source']['campaignConditions']='Fictional frozen post-apocalyptic weather, snow patches, scenery and roughness. Road plan from OSM; widths from OSM where tagged, otherwise estimated from mapped lane count or the road-specific two-lane default. DEM is ground elevation, not surveyed bridge decks or banking.'
    race['weather']='snow';race['weatherIntensity']=min(.8,.16+index*.06);race['weatherTemperatureC']=-8-index
    race['weatherVisibilityM']=max(350,1600-index*120);race['timeOfDay']='night' if spec['key']=='city' else 'day'
    race['road']['tileMap']['defaultTileId']='snow'
    for cell in race['road']['tileMap']['cells'].values():cell['tileId']='snow'
    elapsed=0
    for segment in race['road']['segments']:
        # Keep most of each surveyed base surface; short authored snow patches
        # give the frozen setting real traction variation without random bumps.
        if int(elapsed/450)%7==3:segment['surface']='snow'
        elapsed+=segment['length']
    dist,times,_=profile(simplified,spec.get('paceCapMps',28))
    stage={'id':race['id'],'branch':'middle','stage':index,'difficulty':index,'name':race['name'],'location':{'place':spec['place'],**{k:layout['points'][len(layout['points'])//2][k] for k in ('lat','lon')}},'lengthM':layout['lengthM'],'estimatedDrivingSeconds':round(times[-1]),'durationRangeSeconds':[round(times[-1]*.8),round(times[-1]*1.3)],'paceCapMps':spec.get('paceCapMps',28),'durationMethod':'Curvature-limited winter pace (0.23–0.33 g), 85% visibility factor, 1.7 m/s² acceleration and 3 m/s² braking; estimate, not a measured gameplay lap.','segmentDescription':spec['description'],'startGps':{k:layout['points'][0][k] for k in ('lat','lon')},'finishGps':{k:layout['points'][-1][k] for k in ('lat','lon')},'weather':race['weather'],'surface':'mixed winter '+spec['scenery'],'timeOfDay':race['timeOfDay'],'sceneryTheme':spec['scenery'],'sourceKey':spec['key'],'preserveExisting':False}
    race['campaign']=stage;race['description']=spec['description']
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT/(race['id']+'.json')).write_text(json.dumps(race,separators=(',',':'))+'\n')
    print(f'{index}. {race["name"]}: {layout["lengthM"]/1000:.2f} km, estimated {times[-1]/60:.1f} min, {len(race["road"]["nodes"])} nodes, {missing} missing elevations',flush=True)
    return stage


def main():
    entries=[build_stage(s,i) for i,s in enumerate(SPECS,3)]
    (ROOT/'imported-middle.json').write_text(json.dumps(entries,indent=2)+'\n')

if __name__=='__main__':
    if '--download' in sys.argv:download_sources()
    else:main()
