"""Repeatable, fail-closed imports for the 99 researched side-event candidates.
Run from repo root. Map snapshots and failures are recorded per event; no fallback
road, invented circuit or boss clone is installed when a candidate cannot import.
"""
import json, math, re, sys, argparse, time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
import import_america as america
import terrain_tiles
import race_route_import as route

IMPORT_VERSION=3
TARGET_SECONDS=210
PACE_SETTINGS={"looseCapMps":32,"looseLateralMps2":3.5,"pavedLateralMps2":7.0,"visibilityFactor":1,"accelerationMps2":3.2,"brakingMps2":6}
PACE_CAP_MPS=65
ROOT=Path('data/campaigns/america/side-races')
OUT=Path('artifacts/campaign-import/side-races')
SPECS=json.loads(Path('tools/campaigns/side_race_sources.json').read_text())
RESEARCH=json.loads(Path('AI/last-on-the-grid/last_on_the_grid_99_side_races.json').read_text())

def mapped_road_width(tags, default=7):
    # Bad OSM width tags must not discard the independently mapped lane count.
    try: width=float(tags.get('width',''))
    except (TypeError,ValueError): width=0
    if math.isfinite(width) and 3<=width<=30:return width
    lanes=str(tags.get('lanes',''))
    if lanes.isdigit() and 1<=int(lanes)<=8:
        lane_width=3.6576 if tags.get('highway') in ('motorway','motorway_link','trunk','trunk_link') else 3.2
        return max(3,min(30,int(lanes)*lane_width+.6))
    return default


def snapshot(spec, key=None, bounds=None, max_depth=2, request_interval=8, accept=None):
    lat,lon,kind,pattern=spec[:4]
    # Small API map extracts rather than routing across unrelated roads.
    radius=.008 if key in ('H06-S04','H06-S05','H07-S03','H08-S07') else .018
    ways={};accepted=False
    def box(s,w,n,e,depth=0):
        nonlocal accepted
        if accepted:return
        url=f'https://api.openstreetmap.org/api/0.6/map.json?bbox={w:.5f},{s:.5f},{e:.5f},{n:.5f}'
        try:
            if track.cached_json(url) is None:time.sleep(request_interval)
            data=track.request_json(url)
        except ValueError as exc:
            if depth>=max_depth or not any(x in str(exc) for x in ('400','size limit')):raise
            a,b=(s+n)/2,(w+e)/2
            for bounds in [(s,w,a,b),(s,b,a,e),(a,w,n,b),(a,b,n,e)]:box(*bounds,depth+1)
            return
        nodes={x['id']:x for x in data['elements'] if x['type']=='node'}
        for way in data['elements']:
            tags=way.get('tags',{})
            if way['type']!='way' or tags.get('highway') not in ('motorway','motorway_link','trunk','trunk_link','primary','secondary','tertiary','unclassified','residential','service','track','raceway'):continue
            if tags.get('access') in ('no','private') and kind not in ('circuit','drag'):continue
            if tags.get('motor_vehicle',tags.get('motorcar')) in ('no','private'):continue
            if kind in ('circuit','drag'):
                if tags.get('highway')!='raceway' or tags.get('raceway')=='pit_lane':continue
            elif not re.search(pattern,(tags.get('name','')+' '+tags.get('ref','')) if kind=='nameOrRef' else tags.get(kind,''),re.I):continue
            if not all(i in nodes for i in way.get('nodes',[])):continue
            ways[way['id']]={**way,'geometry':[{k:nodes[i][k] for k in ('lat','lon')} for i in way['nodes']]}
        if accept is not None and ways:accepted=bool(accept(list(ways.values())))
    box(*(bounds or (lat-radius,lon-radius,lat+radius,lon+radius)))
    for bounds in (spec[4] if len(spec)>4 else []):box(*bounds)
    if not ways:raise ValueError('No matching motorable mapped geometry in candidate search area; needs source review')
    return list(ways.values())

def build(candidate,hub):
    key=candidate['id'];spec=SPECS[key];lat,lon,kind,pattern=spec[:4]
    source=ROOT/'sources'/f'{key}.json';source.parent.mkdir(parents=True,exist_ok=True)
    authored_path=ROOT/'authored'/f'{key}.json'
    authored=json.loads(authored_path.read_text()) if authored_path.exists() else None
    if authored:ways=[]
    elif source.exists():ways=json.loads(source.read_text())
    else:
        ways=snapshot(spec,key);source.write_text(json.dumps(ways,separators=(',',':'))+'\n')
    ways=json.loads(json.dumps(ways))
    for way in ways:
        tags=way.get('tags',{})
        if tags.get('surface') in ('rock','pebblestone','fine_gravel'):tags['surface']='gravel'
        tags['width']=str(mapped_road_width(tags,12 if kind=='drag' else 10 if kind=='circuit' else 4.5 if candidate['import_kind']=='forest_check' else 7))
    origin={'name':candidate['name'],'lat':lat,'lon':lon,'country':'us'}
    if authored:
        lat,lon=authored['origin']['lat'],authored['origin']['lon']
        origin.update(lat=lat,lon=lon)
        points=[{'x':x,'y':y,'lat':lat-math.degrees(y/6371008.8),'lon':lon+math.degrees(x/(6371008.8*math.cos(math.radians(lat)))),'tags':{'surface':authored['surface'],'width':str(authored['widthM'])}} for x,y in authored['pointsM']]
        layout={'name':authored['name'],'points':points,'lengthM':america.profile(points)[0][-1],'place':origin,'open':True}
    elif kind=='circuit':
        layouts=track.extract_layouts(ways,(lat,lon))
        if key=='H06-S08':
            layouts=[l for l in layouts if 'Kartplex' in l['name']]
            if not layouts:raise ValueError('Named Gateway Kartplex layout missing')
            layout=max(layouts,key=lambda l:l['lengthM'])
        else:layout=min(layouts,key=lambda l:abs(l['lengthM']-pattern))
        if key not in ('H06-S08','H04-S08') and abs(layout['lengthM']-pattern)>pattern*.2:raise ValueError('Mapped circuit lengths do not match intended venue configuration within 20%; review required')
        layout={**layout,'place':origin,'open':False}
    else:
        override=json.loads(Path('tools/campaigns/side_route_overrides.json').read_text()).get(key)
        if kind=='drag':
            ways=[w for w in ways if (key=='H03-S08' and w['id']==1568814841) or w.get('tags',{}).get('sport')=='drag_racing' or re.search('drag',w.get('tags',{}).get('name',''),re.I)]
            if not ways:raise ValueError('No explicitly mapped drag strip; do not substitute an oval or access road')
        if override:
            selected=[w for w in ways if w.get('tags',{}).get('highway')==override['requiredHighway'] and override['requiredRef'] in w.get('tags',{}).get('ref','').split(';')]
            targets=[dict(zip(('x','y'),track.metric(p['lat'],p['lon'],(lat,lon)))) for p in override['waypoints']]
            points=route.trace(selected,(lat,lon),targets,max_snap=5)
        else:points=america.longest_connected_trace(ways,(lat,lon))
        if kind=='drag':
            # Keep a real contiguous quarter mile; the remaining source is runoff.
            distances,_,_=america.profile(points)
            if distances[-1]<402.336:raise ValueError('Mapped drag strip shorter than quarter mile')
            end=next(i for i,d in enumerate(distances) if d>=402.336)
            a,b=points[end-1],points[end];t=(402.336-distances[end-1])/(distances[end]-distances[end-1])
            p={**a,**{k:a[k]+t*(b[k]-a[k]) for k in ('x','y','lat','lon')}}
            points=points[:end]+[p]
        elif not override:
            america.TARGET_SECONDS=TARGET_SECONDS
            points=america.select_section(points,{'lat':lat,'lon':lon,'paceCapMps':PACE_CAP_MPS,'paceSettings':PACE_SETTINGS})
        distances,_,_=america.profile(points)
        layout={'name':candidate['name'],'points':points,'lengthM':distances[-1],'place':origin,'open':True}
    if key=='H06-S08':
        # Explicit fictional 2994 enlargement, allowed by the source handoff.
        layout['points']=[{**p,'x':p['x']*2,'y':p['y']*2} for p in layout['points']]
        layout['lengthM']*=2
    layout['displayName']=authored['name'] if authored else candidate['name']
    result=track.build(layout,width=12 if kind=='drag' else 10 if kind=='circuit' else 4.5 if candidate['import_kind']=='forest_check' else 7,use_elevation=True,fetch=terrain_tiles.importer_fetch,max_segment_length_m=50)
    race=result['race'];race['id']='side-'+key.lower()
    # Simplification can discard all vertices of a short way; retain every
    # traversed source ID, not just tags left on the simplified control points.
    race['source']['osmWayIds']=sorted({p.get('tags',{}).get('osmWayId') for p in layout['points'] if p.get('tags',{}).get('osmWayId') is not None})
    race['source'].update(provider='OpenStreetMap / Mapzen Terrain Tiles',elevationProvider='Mapzen / Tilezen Terrarium DEM, zoom 12',candidateId=key,sourceSnapshot=str(source),selectionGuidance=candidate['selection_guidance'])
    if kind not in ('circuit','drag') and not authored and override:race['source']['routeSelection']=override
    if authored:race['source'].update(provider='Original fictional course / Mapzen Terrain Tiles',geometryMethod=authored['geometryMethod'],geometryAdaptation=authored['description'],license=authored['license'],attribution=authored['license'],sourceSnapshot=str(authored_path))
    points=track.densify(track.simplify(layout['points']),50)
    # DEM describes the ground/water below a bridge, not its deck. Join the
    # mapped bridge's approach elevations rather than dropping into the river.
    i=0;bridges=0
    while i<len(points)-1:
        if points[i].get('tags',{}).get('bridge') not in ('yes','viaduct'):
            i+=1;continue
        first=i
        while i<len(points)-1 and points[i].get('tags',{}).get('bridge') in ('yes','viaduct'):i+=1
        a,b=max(0,first-1),min(len(points)-1,i+1)
        chain=race['road']['nodes'][a:b+1];distances=[0]
        for p,q in zip(chain,chain[1:]):distances.append(distances[-1]+math.hypot(q['x']-p['x'],q['y']-p['y']))
        lo,hi=chain[0]['elevation'],chain[-1]['elevation']
        for node,d in zip(chain,distances):node['elevation']=lo+(hi-lo)*d/max(.001,distances[-1])
        bridges+=1
    for node,segment in zip(race['road']['nodes'][1:],race['road']['segments']):segment['elevation']=node['elevation']
    race['source']['bridgeDeckApproximations']=bridges
    race['source']['surfaceMapping']='OSM rock, pebblestone and fine_gravel use the game gravel contact model; unpaved/ground use dirt. Explicit paved surfaces are retained.'
    for segment,point in zip(race['road']['segments'],points):
        tags=point.get('tags',{})
        segment['bumpiness']=.16 if tags.get('smoothness') in ('horrible','very_horrible') else .07 if segment['surface'] in ('dirt','gravel') else .015

    if bridges:track.fit_terrain_to_road(race['road'])
    _,times,_=america.profile(points,PACE_CAP_MPS,PACE_SETTINGS)
    laps=max(1,math.ceil(TARGET_SECONDS/max(1,times[-1]))) if kind=='circuit' else 1
    race['laps']=laps
    if key=='H06-S08':race['source']['geometryAdaptation']='Fictional 2994 Kartplex enlargement: mapped plan scaled 2x about the venue; GPS references are the unscaled historical source.'
    race['campaign']={'hubStage':hub['sequence'],'hubBoss':hub['boss'],'sideEventId':key,'optional':True,'priority':candidate['priority'],'eventType':candidate['event_type']}
    # Never inherit the mandatory opener's timeout, fuel, or cutscene triggers.
    race['description']=candidate['selection_guidance']
    if kind=='drag':race['description']+=' Quarter-mile solo timed acceleration run; not a 2–4 minute continuous stage.'
    race['source']['warnings']=[w.replace('USGS 3DEP','Mapzen DEM').replace('USGS elevation','DEM elevation') for w in race['source']['warnings']]
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/f'{key}.json').write_text(json.dumps(race,separators=(',',':'))+'\n')
    return {'status':'imported','targetSeconds':TARGET_SECONDS,'durationLimitedBySource':kind not in ('drag','circuit') and times[-1]<TARGET_SECONDS*.9,'roadWidthRangeM':[min(s['roadWidthM'] for s in race['road']['segments']),max(s['roadWidthM'] for s in race['road']['segments'])],'lengthM':layout['lengthM'],'laps':laps,'estimatedDrivingSeconds':None if kind=='drag' else round(times[-1]*laps),'durationMethod':'Fast-build planning estimate: up to 145 mph paved / 72 mph loose, curvature-limited, 3.2 m/s² acceleration, 6 m/s² braking; not a measured gameplay run' if kind!='drag' else 'Quarter-mile elapsed-time challenge; vehicle dependent', 'startGps':{k:points[0][k] for k in ('lat','lon')},'finishGps':{k:points[-1][k] for k in ('lat','lon')},'surface':sorted(set(s['surface'] for s in race['road']['segments'])),'warnings':race['source']['warnings'],'geometryMethod':authored['geometryMethod'] if authored else 'osm','confidence':'Hand-authored fictional reconstruction; not a surveyed course' if authored else 'Mapped geometry; width/banking and gameplay runtime require review','generatedPath':str(OUT/f'{key}.json')}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--only',nargs='*');parser.add_argument('--rebuild',action='store_true');args=parser.parse_args()
    ROOT.mkdir(parents=True,exist_ok=True);report=ROOT/'report.json'
    old={r['id']:r for r in json.loads(report.read_text())} if report.exists() else {}
    for hub in RESEARCH['hubs']:
        for candidate in hub['races']:
            key=candidate['id']
            if args.only and key not in args.only:continue
            if not args.rebuild and old.get(key,{}).get('importVersion')==IMPORT_VERSION and old.get(key,{}).get('status')=='imported' and (OUT/f'{key}.json').exists():continue
            row={**candidate,'importVersion':IMPORT_VERSION,'hubStage':hub['sequence'],'hubBoss':hub['boss'],'status':'pending'}
            try:row.update(build(candidate,hub))
            except Exception as exc:row.update(status='blocked',error=str(exc))
            old[key]=row
            report.write_text(json.dumps(list(old.values()),indent=2)+'\n')
            print(key,row['status'],row.get('lengthM',row.get('error')),flush=True)
            if '429' in row.get('error',''):
                print('Rate limited: stopped requests; rerun after service cooldown.',flush=True);return
if __name__=='__main__':main()
