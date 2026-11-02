"""Name -> OSM raceway layouts -> editable RTG race. Standard library only.
OSM data remains attributed/ODbL; no aerial imagery or track assets are copied.
"""
from __future__ import annotations
import hashlib
import json
import math
import os
import re
from pathlib import Path
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ATTRIBUTION = '© OpenStreetMap contributors — https://www.openstreetmap.org/copyright (ODbL)'
CACHE = Path('data/server-storage/race-import-cache')
_lock = threading.Lock()
_last_geocode = 0.0
_tokens = {}
_import_slot = threading.BoundedSemaphore(1)


def cached_json(url, data=None):
    key=hashlib.sha256((url+str(data)).encode()).hexdigest()
    path=CACHE/(key+'.json')
    try:
        if time.time()-path.stat().st_mtime<30*86400:
            return json.loads(path.read_text())
    except (OSError,ValueError):
        pass
    return None


def request_json(url, data=None, geocode=False):
    global _last_geocode
    key = hashlib.sha256((url + str(data)).encode()).hexdigest()
    path = CACHE / (key + '.json')
    with _lock:
        cached=cached_json(url,data)
        if cached is not None:return cached
        if geocode:
            time.sleep(max(0, 1.05 - (time.monotonic() - _last_geocode)))
            _last_geocode = time.monotonic()
    req = Request(url, data=data, headers={'User-Agent': os.environ.get('RTG_MAP_USER_AGENT', 'LastOnTheGrid-TrackImporter/1.0 (interactive race editor)'), 'Accept': 'application/json', 'X-Client-Id': 'LastOnTheGrid-TrackImporter', 'Content-Type': 'application/json'})
    try:
        with urlopen(req, timeout=12 if 'epqs' in url else 40) as response:
            raw = response.read(12_000_001)
        if len(raw) > 12_000_000:
            raise ValueError('Map response exceeded the import size limit.')
        result = json.loads(raw)
    except Exception as exc:
        raise ValueError('Map/elevation service unavailable. Please try again later: ' + str(exc)) from exc
    CACHE.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.' + uuid.uuid4().hex + '.tmp')
    temp.write_text(json.dumps(result)); temp.replace(path)
    return result


def remember(value):
    with _lock:
        for key, (created, item) in list(_tokens.items()):
            if time.time() - created > (7200 if item.get('kind')=='layout' else 1800):
                del _tokens[key]
        if len(_tokens) >= 512:
            del _tokens[next(iter(_tokens))]
        token = uuid.uuid4().hex
        _tokens[token] = (time.time(), value)
        return token


def recall(token, kind):
    with _lock:
        created, value = _tokens.get(str(token), (0, {}))
    if time.time() - created > (7200 if kind=='layout' else 1800) or value.get('kind') != kind:
        raise ValueError('Search expired. Search for the track again.')
    return value


# Names only: coordinates and circuit geometry still come from the map services.
TRACK_NAME_ALIASES = {
    'seekonk': 'Seekonk Speedway',
    'seekonk speedway': 'Seekonk Speedway',
    'seekonk motor speedway': 'Seekonk Speedway',
    'nh motor speedway': 'New Hampshire Motor Speedway',
    'new hampshire speedway': 'New Hampshire Motor Speedway',
    'new hampshire motor speedway': 'New Hampshire Motor Speedway',
    'laguna seca': 'WeatherTech Raceway Laguna Seca',
    'laguna seca raceway': 'WeatherTech Raceway Laguna Seca',
    'leguna seca': 'WeatherTech Raceway Laguna Seca',
    'weathertech raceway laguna seca': 'WeatherTech Raceway Laguna Seca',
    'mount washington': 'Mount Washington Auto Road',
    'mt. washington': 'Mount Washington Auto Road',
    'mt washington': 'Mount Washington Auto Road',
    'mt. washington auto road': 'Mount Washington Auto Road',
    'mt washington auto road': 'Mount Washington Auto Road',
    'pikes peak': 'Pikes Peak Highway',
    "pike's peak": 'Pikes Peak Highway',
    'lime rock': 'Lime Rock Park',
    'lime rock park': 'Lime Rock Park',
}


def normalize_track_name(name):
    name = re.sub(r'[-_]+', ' ', str(name).strip())
    name = re.sub(r'\bmotor\s*speedway\b', 'motor speedway', name, flags=re.I)
    name = re.sub(r'\blimerock\b', 'lime rock', name, flags=re.I)
    name = re.sub(r'\s+', ' ', name)
    return TRACK_NAME_ALIASES.get(name.lower(), name)


def search(name, fetch=request_json):
    name = str(name).strip()
    if not 3 <= len(name) <= 160:
        raise ValueError('Enter a track name between 3 and 160 characters.')
    query = normalize_track_name(name)
    url = os.environ.get('RTG_NOMINATIM_URL', 'https://nominatim.openstreetmap.org/search')
    def lookup(q):
        return fetch(url + '?' + urlencode({'q': q, 'format': 'jsonv2', 'limit': 5, 'addressdetails': 1}), geocode=True)
    rows = lookup(query)
    # Generic fallback for tracks whose official name omits "Motor".
    if not rows and re.search(r'\bmotor speedway\b', query, re.I):
        query = re.sub(r'\bmotor speedway\b', 'Speedway', query, flags=re.I)
        rows = lookup(query)
    places = []
    for row in rows[:5]:
        place = {'kind': 'place', 'name': row.get('display_name', query), 'lat': float(row['lat']), 'lon': float(row['lon']),
                 'osmType': row.get('osm_type'), 'osmId': row.get('osm_id'), 'country': row.get('address', {}).get('country_code', '')}
        places.append({'id': remember(place), 'name': place['name']})
    if not places:
        raise ValueError(f'No venue found for “{query}”. Try the official track name and state/country, such as Seekonk Speedway, New Hampshire Motor Speedway, Lime Rock Park, or WeatherTech Raceway Laguna Seca.')
    return {'places': places, 'searchedName': query, 'attribution': ATTRIBUTION}


def metric(lat, lon, origin):
    return ((lon-origin[1])*math.pi/180*6371008.8*math.cos(math.radians(origin[0])),
            -(lat-origin[0])*math.pi/180*6371008.8)


def extract_layouts(elements, origin):
    """Find closed circuits through shared OSM node IDs; never join nearby crossings.
    Degree-two chains are collapsed before bounded cycle enumeration. Pit lanes omitted.
    """
    points, graph, tags, allowed = {}, {}, {}, set()
    for way in elements:
        t = way.get('tags', {})
        if way.get('type') != 'way' or t.get('highway') != 'raceway' or t.get('raceway') == 'pit_lane' or t.get('service') == 'pit_lane' or t.get('name','').lower().strip() in ('pit lane','pit road','pitlane'):
            continue
        ids, geometry = way.get('nodes', []), way.get('geometry', [])
        if len(ids) != len(geometry):
            continue
        for n, p in zip(ids, geometry):
            x, y = metric(float(p['lat']), float(p['lon']), origin)
            points[n] = {'x': x, 'y': y, 'lat': float(p['lat']), 'lon': float(p['lon'])}
        for a, b in zip(ids, ids[1:]):
            if a == b: continue
            graph.setdefault(a, set()).add(b); graph.setdefault(b, set()).add(a)
            tags[frozenset((a,b))] = {**t, 'osmWayId': way['id']}
            if t.get('oneway') != '-1': allowed.add((a,b))
            if t.get('oneway') not in ('yes','1','true'): allowed.add((b,a))
    if len(points) > 16000:
        raise ValueError('Too much geometry near this venue; choose a more specific location.')
    # Trim dead-end service spurs.
    pending = [n for n in graph if len(graph[n]) < 2]
    while pending:
        n = pending.pop()
        for other in graph.pop(n, set()):
            graph[other].discard(n)
            if len(graph[other]) < 2: pending.append(other)
    if not graph:
        raise ValueError('No complete connected raceway loop found in OSM. Open routes and gaps need manual drawing.')
    anchors = {n for n in graph if len(graph[n]) != 2}
    seen = set()
    for n in graph:
        if n in seen: continue
        stack, component = [n], set()
        while stack:
            p = stack.pop()
            if p in component: continue
            component.add(p); stack.extend(graph[p] - component)
        seen.update(component)
        if not component & anchors: anchors.add(min(component))
    chains, used, links = [], set(), {}
    for start in sorted(anchors):
        for first in sorted(graph[start]):
            key = frozenset((start,first))
            if key in used: continue
            route = [start, first]; used.add(key)
            while route[-1] not in anchors:
                nxt = next(n for n in graph[route[-1]] if n != route[-2])
                used.add(frozenset((route[-1],nxt))); route.append(nxt)
            i = len(chains); chains.append(route)
            if all((a,b) in allowed for a,b in zip(route,route[1:])):
                links.setdefault(start, []).append((i, route[-1], False))
            if all((b,a) in allowed for a,b in zip(route,route[1:])):
                links.setdefault(route[-1], []).append((i, start, True))
    cycles, keys, budget = [], set(), 50000
    for start in sorted(anchors):
        stack = [(start, [start], [], {start})]
        while stack and budget > 0 and len(cycles) < 64:
            current, route, edges, visited = stack.pop(); budget -= 1
            for edge, end, reverse in links.get(current, []):
                if edge in edges: continue
                part = list(reversed(chains[edge])) if reverse else chains[edge]
                if end == start:
                    key = tuple(sorted(edges + [edge]))
                    if key not in keys:
                        keys.add(key); cycles.append(route + part[1:])
                elif end not in visited and end >= start:
                    stack.append((end,route+part[1:],edges+[edge],visited|{end}))
    # Keep standalone closed ways even if a complicated junction network used the budget.
    cycles.extend(w['nodes'] for w in elements if w.get('type')=='way' and len(w.get('nodes',[]))>3 and w['nodes'][0]==w['nodes'][-1] and all(frozenset((a,b)) in tags for a,b in zip(w['nodes'],w['nodes'][1:])))
    result, geometry_keys = [], set()
    for cycle in cycles:
        geometry_key=frozenset(frozenset((a,b)) for a,b in zip(cycle,cycle[1:]))
        if geometry_key in geometry_keys:continue
        geometry_keys.add(geometry_key)
        if not all((a,b) in allowed for a,b in zip(cycle,cycle[1:])):
            cycle=list(reversed(cycle))
            if not all((a,b) in allowed for a,b in zip(cycle,cycle[1:])): continue
        pts = [{**points[n], 'tags': tags[frozenset((n, cycle[i+1]))] if i < len(cycle)-1 else {}} for i,n in enumerate(cycle)]
        length = sum(math.hypot(b['x']-a['x'],b['y']-a['y']) for a,b in zip(pts,pts[1:]))
        if not 200 <= length <= 30000: continue
        names = sorted({p['tags'].get('name','') for p in pts} - {''})
        result.append({'points': pts, 'lengthM': length, 'name': ' / '.join(names) or 'Mapped circuit'})
    result.sort(key=lambda r:(' / ' in r['name'], -r['lengthM']))
    if not result: raise ValueError('No closed circuit between 200 m and 30 km found. The venue may be incompletely mapped.')
    return result[:24]


def layouts(token, fetch=request_json):
    place = recall(token, 'place')
    query = f'[out:json][timeout:20];way(around:4000,{place["lat"]:.7f},{place["lon"]:.7f})["highway"="raceway"];out geom;'
    url = os.environ.get('RTG_OVERPASS_URL', 'https://overpass-api.de/api/interpreter')
    try:
        data = fetch(url + '?' + urlencode({'data':query}))
    except ValueError:
        # An alternate public Overpass instance, never a silent switch of map data.
        fallback = os.environ.get('RTG_OVERPASS_FALLBACK_URL', 'https://overpass.private.coffee/api/interpreter')
        if not fallback or fallback == url: raise
        data = fetch(fallback + '?' + urlencode({'data':query}))
    if data.get('remark'): raise ValueError('Overpass returned incomplete data: '+data['remark'])
    found = extract_layouts(data.get('elements', []), (place['lat'],place['lon']))
    found = rank_layouts(found, place['name'].split(',')[0])[:24]
    for i, circuit in enumerate(found):
        if circuit['name'] == 'Mapped circuit':
            circuit['name'] = place['name'].split(',')[0] + (f' — Layout {i+1}' if len(found)>1 else '')
    venue = place['name'].split(',')[0]
    main_count = sum(venue.casefold() in [n.strip().casefold() for n in r['name'].split(' / ')] for r in found)
    main_index = 0
    for r in found:
        if venue.casefold() in [n.strip().casefold() for n in r['name'].split(' / ')]:
            main_index += 1
            r['displayName'] = venue + (f' — Layout {main_index}' if main_count>1 else '')
        else:r['displayName'] = r['name']
    return {'layouts':[{'id':remember({'kind':'layout','place':place,**r}), 'name':r['displayName'],
                       'lengthM':r['lengthM'], 'details':r['name'],
                       'points':[{'x':p['x'],'y':p['y']} for p in r['points']]} for r in found], 'attribution':ATTRIBUTION}


def rank_layouts(layouts, venue_name):
    venue = venue_name.casefold().strip()
    def key(layout):
        names = [n.strip().casefold() for n in layout['name'].split(' / ')]
        matches = venue in names
        auxiliary = any(word in layout['name'].casefold() for word in ('autocross', 'skidpad', 'kart', 'proving ground'))
        chicanes = sum('chicane' in n for n in names)
        return (not matches, names != [venue], auxiliary, chicanes if matches else 0, -layout['lengthM'])
    return sorted(layouts, key=key)


def fit_terrain_to_road(road):
    """Excavate a continuous road corridor in imported terrain, including flat fallback.
    Include the bilinear sampling footprint so nearby high cells cannot cover the road.
    Cell heights are at centers, as required by the native editor terrain grid.
    """
    tile = road['tileMap']; cell = tile['cellSizeM']; cells = tile['cells']
    limits = {}
    for i, (a,b) in enumerate(zip(road['nodes'],road['nodes'][1:])):
        dx,dy=b['x']-a['x'],b['y']-a['y']; length=math.hypot(dx,dy)
        if length<.01:continue
        width=road['segments'][i]['roadWidthM']
        footprint=math.sqrt(2)*cell
        radius=width/2+footprint+3
        grade=abs(b['elevation']-a['elevation'])/length
        for iy in range(math.floor((min(a['y'],b['y'])-radius)/cell),math.ceil((max(a['y'],b['y'])+radius)/cell)+1):
            for ix in range(math.floor((min(a['x'],b['x'])-radius)/cell),math.ceil((max(a['x'],b['x'])+radius)/cell)+1):
                x,y=(ix+.5)*cell,(iy+.5)*cell
                t=max(0,min(1,((x-a['x'])*dx+(y-a['y'])*dy)/(length*length)))
                if math.hypot(x-a['x']-t*dx,y-a['y']-t*dy)>radius:continue
                cap=a['elevation']*(1-t)+b['elevation']*t-.2/12-grade*footprint
                key=f'{ix},{iy}';limits[key]=min(limits.get(key,cap),cap)
    for key, cap in limits.items():
        value=cells.get(key,{'tileId':'grass','elevation':0})
        if value['elevation']>cap:cells[key]={**value,'elevation':cap}
    return road


def simplify(points, tolerance=1.5):
    # Iterative RDP avoids recursion failure on large OSM ways.
    keep={0,len(points)-1}; stack=[(0,len(points)-1)]
    while stack:
        a,b=stack.pop(); p,q=points[a],points[b]; dx,dy=q['x']-p['x'],q['y']-p['y']; d=dx*dx+dy*dy
        best,index=0,None
        for i in range(a+1,b):
            r=points[i]; t=max(0,min(1,((r['x']-p['x'])*dx+(r['y']-p['y'])*dy)/d)) if d else 0
            distance=math.hypot(r['x']-p['x']-t*dx,r['y']-p['y']-t*dy)
            if distance>best: best,index=distance,i
        if best>tolerance:
            keep.add(index); stack.extend([(a,index),(index,b)])
    for i in range(1,len(points)-1):
        a,b=points[i-1].get('tags',{}),points[i].get('tags',{})
        if any(a.get(k)!=b.get(k) for k in ('width','surface','name')):keep.add(i)
    return [points[i] for i in sorted(keep)]


def elevation(lat,lon,fetch=request_json):
    url=os.environ.get('RTG_EPQS_URL','https://epqs.nationalmap.gov/v1/json')
    data=fetch(url+'?'+urlencode({'x':f'{lon:.7f}','y':f'{lat:.7f}','units':'Meters','wkid':4326,'includeDate':False}))
    value=float(data['value'])
    if not math.isfinite(value) or value < -500 or value > 9000: raise ValueError('No USGS elevation coverage at this location.')
    return value


def build(layout, width=12, use_elevation=True, reverse=False, fetch=request_json):
    width=float(width)
    if not math.isfinite(width) or not 3<=width<=30: raise ValueError('Road width must be 3–30 metres.')
    is_open=bool(layout.get('open'))
    pts=simplify(layout['points'])
    if reverse:
        pts=[{**p,'tags':pts[i-1].get('tags',{})} for i,p in reversed(list(enumerate(pts)))]
    if len(pts)>600: raise ValueError('This circuit has too many editable points (limit 600).')
    warnings=['Banking is set to 0°; set banking per segment in the editor.', 'Start line and driving direction are provisional; verify against the real circuit.', 'Road width uses OSM width where available, otherwise your default.']
    heights=[0.0]*len(pts); cells={}; base=0
    origin=layout['place']; grid=[]; samples=[]; sampled={}
    if use_elevation and origin['country']=='us':
        # Bounded sampling: 64 road points + a 5x5 surrounding terrain survey.
        last=len(pts)-(1 if is_open else 2)
        indices=sorted({round(i*last/min(63,last)) for i in range(min(63,last)+1)})
        samples=[(pts[i]['lat'],pts[i]['lon']) for i in indices]
        xmin=min(p['x'] for p in pts)-100; xmax=max(p['x'] for p in pts)+100
        ymin=min(p['y'] for p in pts)-100; ymax=max(p['y'] for p in pts)+100
        for gy in range(5):
            for gx in range(5):
                x=xmin+(xmax-xmin)*gx/4; y=ymin+(ymax-ymin)*gy/4
                lat=origin['lat']-y/6371008.8*180/math.pi
                lon=origin['lon']+x/(6371008.8*math.cos(math.radians(origin['lat'])))*180/math.pi
                grid.append((x,y)); samples.append((lat,lon))
        deadline=time.monotonic()+100
        def sample(p):
            if time.monotonic()>deadline:return None
            try:return elevation(*p,fetch=fetch)
            except (ValueError,KeyError,TypeError):return None
        with ThreadPoolExecutor(max_workers=4) as pool: values=list(pool.map(sample,samples))
        valid={i:v for i,v in zip(indices,values) if v is not None}
        if len(valid)>=2:
            # Close loop at identical height; interpolate along distance, never random height.
            base=next(iter(valid.values()))
            valid.setdefault(0,base)
            valid.setdefault(len(pts)-1,valid[max(valid)] if is_open else valid[0])
            distances=[0]
            for a,b in zip(pts,pts[1:]):distances.append(distances[-1]+math.hypot(b['x']-a['x'],b['y']-a['y']))
            keys=sorted(valid)
            for a,b in zip(keys,keys[1:]):
                for i in range(a,b+1):
                    t=(distances[i]-distances[a])/max(.001,distances[b]-distances[a])
                    heights[i]=valid[a]*(1-t)+valid[b]*t-base
            if len(valid)<len(indices):warnings.append('Some road elevations were missing and interpolated between available samples.')
            terrain=values[len(indices):]
            if all(v is not None for v in terrain):
                # Coarse survey interpolated into an editable bounded terrain grid.
                cell=max(10,math.ceil(max(xmax-xmin,ymax-ymin)/160/5)*5)
                for iy in range(math.floor(ymin/cell),math.ceil(ymax/cell)+1):
                    for ix in range(math.floor(xmin/cell),math.ceil(xmax/cell)+1):
                        gx=max(0,min(3.99999,((ix+.5)*cell-xmin)/(xmax-xmin)*4)); gy=max(0,min(3.99999,((iy+.5)*cell-ymin)/(ymax-ymin)*4))
                        a,b=int(gx),int(gy); tx,ty=gx-a,gy-b
                        h=(terrain[b*5+a]*(1-tx)+terrain[b*5+a+1]*tx)*(1-ty)+(terrain[(b+1)*5+a]*(1-tx)+terrain[(b+1)*5+a+1]*tx)*ty
                        cells[f'{ix},{iy}']={'tileId':'grass','elevation':(h-base)/12}
                sampled={'cellSizeM':cell,'cells':cells}
            else:warnings.append('Terrain survey incomplete; surrounding terrain is flat and editable.')
            warnings.append('USGS 3DEP sampled terrain elevations are approximate, not surveyed racing surface or banking. Bridges/tunnels need manual heights.')
        else:warnings.append('USGS elevation unavailable; imported a flat editable track instead.')
    elif use_elevation:warnings.append('USGS 3DEP is US-only; imported flat elevations for this venue.')
    else:warnings.append('Elevation lookup disabled; imported a flat track.')
    nodes=[{'x':p['x'],'y':p['y'],'elevation':heights[i]/12,**({'role':'start','locked':True} if i==0 else {'role':'finish'} if i==len(pts)-1 else {})} for i,p in enumerate(pts)]
    segments=[]
    for i,(a,b) in enumerate(zip(nodes,nodes[1:])):
        tags=pts[i].get('tags',{}); mapped_width=tags.get('width','')
        try:w=float(mapped_width)
        except (TypeError,ValueError):w=width
        if not math.isfinite(w) or not 3<=w<=30:w=width
        surface={'unpaved':'dirt','ground':'dirt','compacted':'gravel','concrete':'asphalt'}.get(tags.get('surface'),tags.get('surface','asphalt'))
        if surface not in ['asphalt','dirt','gravel','mud','snow']:surface='asphalt'
        yaw=math.atan2(b['x']-a['x'],b['y']-a['y'])
        previous=nodes[i-1] if i else (nodes[-2] if not is_open else {'x':a['x']-(b['x']-a['x']),'y':a['y']-(b['y']-a['y'])})
        prior_yaw=math.atan2(a['x']-previous['x'],a['y']-previous['y'])
        curve=max(-1,min(1,math.atan2(math.sin(yaw-prior_yaw),math.cos(yaw-prior_yaw))/.78))
        segments.append({'length':math.hypot(b['x']-a['x'],b['y']-a['y']),'curve':curve,'elevation':b['elevation'],'surface':surface,'roadWidthM':w,'banking':0,'bumpiness':0,'hazardIds':[]})
    road={'width':width,'elevationRange':{'min':-1000,'max':1000},'nodes':nodes,'segments':segments,'selectedGroundTileId':'grass','groundTiles':[], 'tileMap':{'preserveCellSize':True,'cellSizeM':10,'defaultTileId':'grass','minElevation':-1000,'maxElevation':1000,'cells':{},**sampled}}
    fit_terrain_to_road(road)
    race={'id':'osm-'+uuid.uuid4().hex[:12],'name':layout.get('displayName',layout['name'])[:100],'type':'destination' if is_open else 'circuit','laps':1 if is_open else 3,'weather':'clear','timeOfDay':'day', 'groundRenderer':'webgl-track',
          'finishBehavior':{'type':'menu','menuScreen':'world-map'},'road':road,'competition':{'mode':'solo','aiDrivers':[],'trafficEnabled':False},'hazards':[],'scenery':[],'decals':[],'triggers':[],'codriver':{'enabled':False,'calls':[]},
          'source':{'importVersion':3,'elevationSmoothingRadiusM':20,'routeReference':layout.get('routeReference'),'reversed':reverse,'mappedLengthM':layout.get('lengthM'),'provider':'OpenStreetMap / USGS 3DEP','attribution':ATTRIBUTION,'license':'ODbL-1.0','origin':origin,'osmWayIds':sorted({p.get('tags',{}).get('osmWayId') for p in pts if p.get('tags',{}).get('osmWayId')}),'elevationDatumM':base,'warnings':warnings}}
    return {'race':race,'warnings':warnings,'attribution':ATTRIBUTION}


def _handle_request(body):
    action=body.get('action')
    if action in ('network','route'):
        from race_route_import import network, route
        if action=='network':return network(recall(body.get('placeId'),'place'),body.get('radius',10000))
        return route(recall(body.get('networkId'),'network'),body.get('waypoints'),body.get('routing','auto'))
    if action=='search':return search(body.get('name',''))
    if action=='layouts':return layouts(body.get('placeId'))
    if action=='build':return build(recall(body.get('layoutId'),'layout'),body.get('width',12),body.get('elevation',True) is True,body.get('reverse',False) is True)
    raise ValueError('Unknown track import action.')


def handle_request(body):
    if not _import_slot.acquire(blocking=False):
        raise ValueError('Another track import is still working. Please wait and try again.')
    try:
        return _handle_request(body)
    finally:
        _import_slot.release()
