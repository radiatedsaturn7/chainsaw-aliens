"""Give incomplete elevation surveys editable terrain fitted to imported road heights.
This is authored terrain, not a replacement claim of surveyed GPS elevation.
Run after import_america.py and before install_america.mjs.
"""
import json
import math
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from race_track_import import fit_terrain_to_road


def finish_terrain(race):
    source=race['source']
    if source.get('terrainMethod')=='authored-road-height-fallback':return race
    if not any('surrounding terrain is flat' in w or 'flat editable track' in w for w in source['warnings']):return race
    road=race['road'];nodes=road['nodes'];tile=road['tileMap']
    xmin=min(p['x'] for p in nodes)-400;xmax=max(p['x'] for p in nodes)+400
    ymin=min(p['y'] for p in nodes)-400;ymax=max(p['y'] for p in nodes)+400
    cell=max(15,math.ceil(max(xmax-xmin,ymax-ymin)/96/5)*5)
    segments=[]
    for a,b in zip(nodes,nodes[1:]):
        dx,dy=b['x']-a['x'],b['y']-a['y']
        segments.append((a['x'],a['y'],dx,dy,max(.001,dx*dx+dy*dy),a['elevation'],b['elevation']-a['elevation']))
    cells={};amplitude=(1+race['campaign']['stage']*.5)/12
    for iy in range(math.floor(ymin/cell),math.ceil(ymax/cell)+1):
        for ix in range(math.floor(xmin/cell),math.ceil(xmax/cell)+1):
            x,y=(ix+.5)*cell,(iy+.5)*cell;nearest=math.inf;height=0
            for ax,ay,dx,dy,d,h,dh in segments:
                t=max(0,min(1,((x-ax)*dx+(y-ay)*dy)/d))
                distance=(x-ax-t*dx)**2+(y-ay-t*dy)**2
                if distance<nearest:nearest=distance;height=h+t*dh
            ripple=math.sin(x/130)*math.cos(y/170)*amplitude*min(1,math.sqrt(nearest)/60)
            cells[f'{ix},{iy}']={'tileId':tile['defaultTileId'],'elevation':height-.4/12+ripple}
    tile.update({'cellSizeM':cell,'cells':cells,'preserveCellSize':True})
    fit_terrain_to_road(road)
    source['terrainMethod']='authored-road-height-fallback'
    source['warnings']=[w.replace('Terrain survey incomplete; surrounding terrain is flat and editable.','Terrain survey incomplete; surrounding terrain is authored from interpolated road heights, not surveyed.') for w in source['warnings']]
    source['warnings'].append('Editable surrounding terrain follows the imported road heights with small authored undulations.')
    return race


if __name__=='__main__':
    folder=Path('artifacts/campaign-import/middle')
    files=sorted(folder.glob('america-*.json'))
    expected=len(json.loads(Path('tools/campaigns/middle_route.json').read_text()))
    if len(files)!=expected:raise SystemExit('Expected every configured Middle Route race before finishing terrain.')
    for path in files:
        race=finish_terrain(json.loads(path.read_text()))
        path.write_text(json.dumps(race,separators=(',',':'))+'\n')
        print(race['name'],race['source'].get('terrainMethod',race['source'].get('elevationProvider','Sampled terrain')),flush=True)
