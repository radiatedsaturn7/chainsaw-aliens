"""Make independently playable sections of saved imported roads, without reimporting
or interpolating geometry. Original full roads remain available. No reversal,
fictional connecting road, elevation changes, or overlapping timed intervals.
"""
import copy
import math
import bisect
from audit_race_lines import distances, continuations, shift_calls, line_corridor, signature

MIN_SECTION_M = 1500

def partition(race, count, minimum=MIN_SECTION_M):
    road = race['road']
    if road.get('network'):
        raise ValueError('Explicit road networks require authored section boundaries')
    nodes = road['nodes']; d = distances(nodes)
    if count < 1 or d[-1] < count * minimum:
        raise ValueError('Not enough mapped road for substantial distinct sections')
    latest=[len(nodes)-1]
    for _ in range(count-1):
        latest.append(bisect.bisect_right(d,d[latest[-1]]-minimum)-1)
    cuts = [0]
    for part in range(1, count):
        target = d[-1] * part / count
        candidates = [i for i in range(cuts[-1]+2, len(nodes)-2)
                      if d[i]-d[cuts[-1]] >= minimum and i <= latest[count-part]
                      and abs(d[i]-target) <= max(500, d[-1]/count*.25)]
        if not candidates:
            raise ValueError('No valid section boundary')
        # Prefer a straight grid/runout corridor over exact equal lengths.
        def score(i):
            quality = max(line_corridor(road,nodes,d,i,0,40), line_corridor(road,nodes,d,i,1,40))
            return (quality > 10, quality if quality > 10 else 0, abs(d[i]-target))
        cuts.append(min(candidates,key=score))
    return list(zip(cuts,cuts[1:]+[len(nodes)-1]))

def section(race, first, last, *, name, race_id, number):
    r=copy.deepcopy(race); road=r['road']; old=copy.deepcopy(road['nodes']); d=distances(old)
    if road.get('network'):raise ValueError('Cannot silently discard network/tunnel structure')
    if r.get('triggers'):raise ValueError('Authored triggers require a section-specific review')
    if not (0 <= first < last < len(old)):raise ValueError('Invalid section interval')
    start,end=d[first],d[last]
    if end-start < MIN_SECTION_M:raise ValueError('Section shorter than minimum')
    road['nodes']=road['nodes'][first:last+1];road['segments']=road['segments'][first:last]
    continuations(road,old,d,start,end);shift_calls(r,start,end-start)
    road['autoExtend']=False
    for i,n in enumerate(road['nodes']):
        n.pop('role',None)
        if i==0:n.update(role='start',locked=True)
        if i==len(road['nodes'])-1:n.update(role='finish',locked=True)
    road['segments'][0]['curve']=0
    r.update(id=race_id,name=name,type='sprint',laps=1)
    source=r.setdefault('source',{})
    source['rallySection']={'parentRef':race['name'],'firstNode':first,'lastNode':last,
        'startDistanceM':start,'endDistanceM':end,'direction':'forward','version':1,
        'parentGeometrySignature':signature(old)}
    source['mappedLengthM']=end-start
    source['rallyCollection'].update(section=number,stage=name,coverage='game-sections',
        timing='Distinct subsection of an imported road; game timing lines, not official stage controls.')
    source['layoutName']=name
    source['linePlacement']={'method':'mapped-section-boundary-v1','surveyedStartLine':False,
        'corridorDegrees':[line_corridor(race['road'],old,d,first,0,40),line_corridor(race['road'],old,d,last,1,40)]}
    source['linePlacement']['corridorDegrees']=[v if math.isfinite(v) else None for v in source['linePlacement']['corridorDegrees']]
    # Clip distant scenery/DEM to a generous envelope, preserving a full kilometre
    # beyond section geometry. Never change any retained terrain elevation.
    xs=[n['x'] for n in road['nodes']];zs=[n['y'] for n in road['nodes']]
    xmin,xmax,zmin,zmax=min(xs)-1000,max(xs)+1000,min(zs)-1000,max(zs)+1000
    for key in ['scenery','decals','hazards']:
        r[key]=[o for o in r.get(key,[]) if not ('x' in o and 'z' in o) or xmin<=o['x']<=xmax and zmin<=o['z']<=zmax]
    tile=road.get('tileMap',{});size=tile.get('cellSizeM',40)
    if isinstance(tile.get('cells'),dict):
        tile['cells']={k:v for k,v in tile['cells'].items() if xmin-size<=int(k.split(',')[0])*size<=xmax+size and zmin-size<=int(k.split(',')[1])*size<=zmax+size}
    return r
