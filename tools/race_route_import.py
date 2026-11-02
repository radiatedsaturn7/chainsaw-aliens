"""Ordered open-road imports. Routing is optional; source geometry is always OSM."""
import heapq
import json
import math
import os
import re
import time
from urllib.parse import urlencode
import race_track_import as track


def overpass(query, fetch):
    urls=[os.environ.get('RTG_OVERPASS_URL','https://overpass-api.de/api/interpreter'),os.environ.get('RTG_OVERPASS_FALLBACK_URL','https://overpass.private.coffee/api/interpreter')]
    # A cached mirror response should not wait behind a failing primary server.
    if fetch is track.request_json:
        for url in filter(None,urls):
            cached=track.cached_json(url+'?'+urlencode({'data':query}))
            if isinstance(cached,dict) and not cached.get('remark') and isinstance(cached.get('elements'),list):
                return cached['elements']
    error=None
    for url in filter(None,urls):
        try:
            result=fetch(url+'?'+urlencode({'data':query}))
            if result.get('remark'):raise ValueError('Incomplete OSM response: '+result['remark'])
            return result['elements']
        except (ValueError,KeyError) as exc:error=exc
    raise ValueError(str(error))


def network(place, radius=10000, fetch=track.request_json):
    radius=float(radius)
    if not math.isfinite(radius) or not 500<=radius<=20000:raise ValueError('Map radius must be 500–20000 metres.')
    # OSM's spatial index handles bounding boxes more cheaply than testing every
    # road geometry against a radius. Quantize outward for reusable nearby searches.
    lat_delta=math.degrees(radius/6371008.8)
    lon_delta=lat_delta/max(.01,math.cos(math.radians(place['lat'])))
    bounds=(math.floor((place['lat']-lat_delta)*100)/100,
            math.floor((place['lon']-lon_delta)*100)/100,
            math.ceil((place['lat']+lat_delta)*100)/100,
            math.ceil((place['lon']+lon_delta)*100)/100)
    bbox=','.join(f'{v:.2f}' for v in bounds)
    name=place['name'].split(',')[0].strip()
    focused=bool(re.search(r'\b(road|highway|drive|boulevard|street|avenue)\b',name,re.I))
    elements=[]
    # Named mountain roads need their connected segments, not every road within
    # 300 square kilometres. Keep the scope explicit in the preview.
    if focused:
        elements=overpass(f'[out:json][timeout:15];way["name"={json.dumps(name)}]({bbox});out geom;',fetch)
    if not elements:
        focused=False
        elements=overpass(f'[out:json][timeout:15];way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|service|track|raceway|.*_link)$"]({bbox});out geom;',fetch)
    ways=[w for w in elements if w.get('type')=='way' and len(w.get('geometry',[]))==len(w.get('nodes',[])) and len(w.get('nodes',[]))>1]
    if not ways:raise ValueError('No mapped roads found. Try another location or a larger radius.')
    if sum(len(w['nodes']) for w in ways)>80000:raise ValueError('Too many roads in this area. Reduce the map radius.')
    token=track.remember({'kind':'network','place':place,'ways':ways})
    return {'networkId':token,'roads':[{'id':w['id'],'name':w.get('tags',{}).get('name','Unnamed road'),'points':[dict(zip(('x','y'),track.metric(p['lat'],p['lon'],(place['lat'],place['lon'])))) for p in w['geometry']]} for w in ways],'attribution':track.ATTRIBUTION,'scope':f'Named road: {name}' if focused else 'Roads in the selected area'}


def graph(ways, origin):
    points={}; edges=[]
    for w in ways:
        tags={**w.get('tags',{}),'osmWayId':w['id']}
        for n,p in zip(w['nodes'],w['geometry']):
            x,y=track.metric(p['lat'],p['lon'],origin);points[n]={**p,'x':x,'y':y}
        for a,b in zip(w['nodes'],w['nodes'][1:]):
            if a!=b:edges.append((a,b,tags))
    return points,edges


def trace(ways, origin, waypoints, max_snap=150):
    """Snap to edge interiors, split them, then Dijkstra each ordered waypoint leg.
    Topology is OSM node IDs: crossing bridges never become junctions by proximity.
    """
    points,edges=graph(ways,origin)
    if not edges:raise ValueError('No connected road geometry.')
    splits={}; targets=[]
    for j,p in enumerate(waypoints):
        x,y=p['x'],p['y'];best=None
        for i,(a,b,tags) in enumerate(edges):
            u,v=points[a],points[b];dx=v['x']-u['x'];dy=v['y']-u['y'];d=dx*dx+dy*dy
            t=max(0,min(1,((x-u['x'])*dx+(y-u['y'])*dy)/d)) if d else 0
            distance=math.hypot(x-u['x']-t*dx,y-u['y']-t*dy)
            if best is None or distance<best[0]:best=(distance,i,t)
        distance,i,t=best
        if distance>max_snap:raise ValueError(f'A waypoint is more than {max_snap} m from a mapped road. Tap closer to the road.')
        a,b,_=edges[i]
        if t<1e-8:n=a
        elif t>1-1e-8:n=b
        else:
            n=f'waypoint-{j}';points[n]={k:points[a][k]*(1-t)+points[b][k]*t for k in ('x','y','lat','lon')}
            splits.setdefault(i,[]).append((t,n))
        targets.append(n)
    adjacency={}
    for i,(a,b,tags) in enumerate(edges):
        chain=[a]+[n for _,n in sorted(splits.get(i,[]))]+[b]
        one=str(tags.get('oneway','yes' if tags.get('junction')=='roundabout' else '')).lower()
        for u,v in zip(chain,chain[1:]):
            d=math.hypot(points[u]['x']-points[v]['x'],points[u]['y']-points[v]['y'])
            if one!='-1':adjacency.setdefault(u,[]).append((v,d,tags))
            if one not in ('yes','1','true'):adjacency.setdefault(v,[]).append((u,d,tags))
    result=[]; counter=0
    for start,finish in zip(targets,targets[1:]):
        queue=[(0,0,start)];dist={start:0};parents={}
        while queue:
            cost,_,u=heapq.heappop(queue)
            if cost!=dist[u]:continue
            if u==finish:break
            for v,d,tags in adjacency.get(u,[]):
                if cost+d<dist.get(v,math.inf):
                    dist[v]=cost+d;parents[v]=(u,tags);counter+=1;heapq.heappush(queue,(cost+d,counter,v))
        if finish not in dist:raise ValueError('These waypoints are not connected in the selected road network/direction. Add roads, move the points, or expand the map. No gap was joined.')
        leg=[];v=finish
        while v!=start:
            u,tags=parents[v];leg.append({**points[u],'tags':tags});v=u
        result.extend(reversed(leg))
    result.append({**points[targets[-1]],'tags':result[-1]['tags'] if result else {}})
    return result


def decode_polyline(encoded):
    result=[];lat=lon=index=0
    while index<len(encoded):
        pair=[]
        for _ in range(2):
            value=shift=0
            while True:
                if index>=len(encoded) or shift>35:raise ValueError('Invalid routing geometry.')
                byte=ord(encoded[index])-63;index+=1;value|=(byte&31)<<shift;shift+=5
                if byte<32:break
            pair.append(~(value>>1) if value&1 else value>>1)
        lat+=pair[0];lon+=pair[1];result.append({'lat':lat/1e6,'lon':lon/1e6})
    return result


def valhalla(waypoints, origin, fetch):
    deadline=time.monotonic()+85
    original_fetch=fetch
    def fetch(url, **kwargs):
        if time.monotonic()>deadline:raise ValueError('Routing time limit reached.')
        return original_fetch(url,**kwargs)
    base=os.environ.get('RTG_VALHALLA_URL','https://valhalla1.openstreetmap.de').rstrip('/')
    def call(service,payload):
        encoded=json.dumps(payload,separators=(',',':'),sort_keys=True)
        if service=='trace_attributes':return fetch(base+'/'+service,data=encoded.encode())
        return fetch(base+'/'+service+'?'+urlencode({'json':encoded}))
    locations=[{'lat':origin[0]-p['y']/6371008.8*180/math.pi,'lon':origin[1]+p['x']/(6371008.8*math.cos(math.radians(origin[0])))*180/math.pi,'type':'break'} for p in waypoints]
    route=call('route',{'locations':locations,'costing':'auto','units':'kilometers'})
    legs=route.get('trip',{}).get('legs',[])
    if not legs:raise ValueError('Valhalla could not route these waypoints.')
    matched=[];traces=[]
    for leg in legs:
        traced=call('trace_attributes',{'encoded_polyline':leg['shape'],'costing':'auto','shape_match':'edge_walk','filters':{'action':'include','attributes':['shape','edge.way_id','edge.begin_shape_index','edge.end_shape_index']}})
        shape=decode_polyline(traced['shape']);edges=traced.get('edges',[])
        if not edges:raise ValueError('Valhalla did not return source OSM way IDs.')
        traces.append((shape,edges))
    ids=sorted({int(e['way_id']) for _,es in traces for e in es})
    ways=overpass('[out:json][timeout:25];way(id:'+','.join(map(str,ids))+');out geom;',fetch)
    by_id={w['id']:w for w in ways}
    for shape,edges in traces:
        for edge in edges:
            w=by_id.get(int(edge['way_id']))
            if w is None:raise ValueError('A routed OSM way is no longer available.')
            start,end=edge['begin_shape_index'],edge['end_shape_index']
            if not 0<=start<end<len(shape):raise ValueError('Invalid matched route shape indices.')
            indices=sorted({start,end,*[round(start+(end-start)*i/8) for i in range(1,8)]})
            anchors=[dict(zip(('x','y'),track.metric(shape[i]['lat'],shape[i]['lon'],origin))) for i in indices]
            section=trace([w],origin,anchors,max_snap=10)
            if matched and math.hypot(matched[-1]['x']-section[0]['x'],matched[-1]['y']-section[0]['y'])>3:raise ValueError('Routed OSM geometry contains a gap; try direct OSM tracing.')
            if matched:matched.pop()
            matched.extend(section)
    return matched,{'provider':'Valhalla','route':route,'locations':locations,'matchedEdges':[e for _,edges in traces for e in edges]}


def route(network_data, waypoints, mode='auto', fetch=track.request_json):
    if not isinstance(waypoints,list) or not 2<=len(waypoints)<=16:raise ValueError('Choose a start, finish and at most 14 intermediate points.')
    for p in waypoints:
        if not isinstance(p,dict) or any(not isinstance(p.get(k),(int,float)) or not math.isfinite(p[k]) or abs(p[k])>50000 for k in ('x','y')):raise ValueError('Invalid route waypoint.')
    if mode not in ('auto','direct'):raise ValueError('Unknown routing mode.')
    place=network_data['place'];origin=(place['lat'],place['lon']);warning=None
    if mode=='auto':
        try:points,reference=valhalla(waypoints,origin,fetch)
        except (ValueError,KeyError,TypeError,IndexError) as exc:
            warning='Valhalla unavailable or could not match source roads; used connected OSM tracing: '+str(exc)
            points=trace(network_data['ways'],origin,waypoints);reference={'provider':'OSM connected-road fallback'}
    else:points=trace(network_data['ways'],origin,waypoints);reference={'provider':'OSM connected-road tracing'}
    length=sum(math.hypot(b['x']-a['x'],b['y']-a['y']) for a,b in zip(points,points[1:]))
    if not 100<=length<=100000:raise ValueError('Route length must be between 100 m and 100 km.')
    reference.update({'waypoints':waypoints,'originalGeometry':[{'lat':p['lat'],'lon':p['lon'],'osmWayId':p.get('tags',{}).get('osmWayId')} for p in points],'warning':warning})
    layout={'kind':'layout','place':place,'name':place['name'].split(',')[0]+' — point-to-point','points':points,'lengthM':length,'open':True,'routeReference':reference}
    return {'layouts':[{'id':track.remember(layout),'name':layout['name'],'lengthM':length,'points':[{'x':p['x'],'y':p['y']} for p in points]}],'warning':warning,'attribution':track.ATTRIBUTION}
