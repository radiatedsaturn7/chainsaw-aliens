"""Rebuild reviewed real circuits with the existing editor importer and DEM adapter.
Selections refer to frozen OSM snapshots, never nearest-length guesses at runtime.
"""
import sys,json,math,hashlib,argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
import terrain_tiles
from audit_race_lines import place
from inspect_raceways import candidate_layouts
ROOT=Path('data/campaigns/america/raceways')
OUT=Path('artifacts/campaign-import/raceways')

def apply_banking(race, spec, points, selection):
    if spec['key'] not in ('daytona','homestead','indianapolis'):return
    nodes=race['road']['nodes'];segments=race['road']['segments']
    sampled=track.densify(track.simplify(points),50)
    # Curvature is measured over a 120 m chord to avoid amplifying OSM vertex noise.
    def radius_at(i):
        def neighbor(step):
            j=i;length=0
            while length<60:
                k=(j+step)%(len(nodes)-1)
                length+=math.hypot(nodes[k]['x']-nodes[j]['x'],nodes[k]['y']-nodes[j]['y']);j=k
                if j==i:break
            return nodes[j]
        a,b,c=neighbor(-1),nodes[i],neighbor(1)
        ab=math.hypot(b['x']-a['x'],b['y']-a['y']);bc=math.hypot(c['x']-b['x'],c['y']-b['y']);ac=math.hypot(c['x']-a['x'],c['y']-a['y'])
        cross=(b['x']-a['x'])*(c['y']-a['y'])-(b['y']-a['y'])*(c['x']-a['x'])
        return ab*bc*ac/max(.001,2*abs(cross)),cross
    for i,(segment,point) in enumerate(zip(segments,sampled)):
        tags=point.get('tags',{});name=tags.get('name','');radius,cross=radius_at(i)
        angle=0
        if spec['key']=='indianapolis':
            angle=9.2 if 'Indianapolis Motor Speedway - Turn' in name else 0
        elif spec['key']=='daytona' and name=='Speedway':
            angle=31 if radius<400 else 18 if radius<1500 else 3
        elif spec['key']=='homestead' and selection['key']=='oval':
            angle=19 if radius<600 else 4
        elif spec['key']=='homestead' and tags.get('osmWayId') in spec.get('ovalWayIds',[]):
            angle=19 if radius<600 else 4
        segment['banking']=angle
        if angle and abs(cross)>0.001:
            # yaw uses atan2(dx,dy), opposite the planar cross-product sign.
            segment['curve']=(-1 if cross>0 else 1)*max(.001,abs(segment['curve']))
    race['source']['warnings']=[w for w in race['source']['warnings'] if not w.startswith('Banking is set')]
    race['source']['bankingMethod']='Published nominal oval banking; OSM corner tags at Indianapolis, smoothed-plan curvature at Daytona/Homestead. Transition positions and progressive banking are approximate, not surveyed.'


def build(spec,selection):
 layouts=candidate_layouts(spec)
 layout=layouts[selection['index']]
 if abs(layout['lengthM']-selection['mappedLengthM'])>2:raise ValueError('Snapshot/layout changed; review selection again')
 points=layout['points']
 way_ids=sorted({p.get('tags',{}).get('osmWayId') for p in points if p.get('tags',{}).get('osmWayId')})
 name=selection.get('raceRef',spec['name']+' — '+selection['label'])
 layout={**layout,'displayName':name,'place':{k:spec[k] for k in ['name','lat','lon']},'open':False}
 layout['place']['country']=spec.get('country','us')
 # The adapter is global DEM data, unlike the importer's default USGS endpoint.
 # Sample it explicitly outside the US without mislabelling the venue country.
 fetch_country=layout['place']['country'];layout['place']['country']='us'
 result=track.build(layout,width=selection.get('widthM',12),fetch=terrain_tiles.importer_fetch,max_segment_length_m=80 if spec['key']=='nordschleife' else 50)
 race=result['race'];race['source']['origin']['country']=fetch_country
 if 'unavailable' in ' '.join(result['warnings']) or 'flat editable' in ' '.join(result['warnings']):raise ValueError('Elevation lookup failed; do not install a flat replacement')
 key=f"raceway-{spec['key']}-{selection['key']}";race['id']=selection.get('legacyId',key)
 race['source'].update(provider='OpenStreetMap / Mapzen Terrain Tiles',elevationProvider='Mapzen / Tilezen Terrarium DEM zoom 12',osmWayIds=way_ids,sourceSnapshot=str(ROOT/'sources'/f"{spec['key']}.json"),layoutName=selection['label'],layoutReference=selection.get('reference',spec.get('reference')),layoutGeometrySha256=hashlib.sha256(json.dumps(points,sort_keys=True).encode()).hexdigest(),elevationSmoothingRadiusM=20)
 race['source']['warnings']=[w.replace('USGS 3DEP','Mapzen DEM').replace('USGS','DEM') for w in result['warnings']]
 race['road']['autoExtend']=False
 for s in race['road']['segments']:s['bumpiness']=.018 if spec['key']=='sebring' else .008
 apply_banking(race,spec,points,selection)
 race['source']['linePlacement']=place(race)
 race['laps']=selection.get('laps',3)
 race['campaign']={'optional':True,'eventType':'Circuit race','hubStage':spec.get('hubStage'),'sideEventId':key}
 race['description']=f"{spec['name']} / {selection['label']}. Mapped road geometry with sampled terrain elevations; see source notes for survey limitations."
 OUT.mkdir(parents=True,exist_ok=True);file=OUT/f'{key}.json';file.write_text(json.dumps(race,separators=(',',':'))+'\n')
 return {'id':key,'status':'imported','name':name,'raceRef':name,'displayName':name,'venueKey':spec['key'],'venueName':spec['name'],'layoutLabel':selection['label'],'hubStage':spec.get('hubStage'),'import_kind':'circuit','event_type':'Circuit race','surface':['asphalt'],'lengthM':layout['lengthM'],'laps':race['laps'],'generatedPath':str(file),'replaceRaceRef':selection.get('raceRef'),'existingSideId':selection.get('existingSideId'),'warnings':race['source']['warnings']}

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--only',nargs='*');args=parser.parse_args()
 report_path=ROOT/'report.json';report={e['id']:e for e in json.loads(report_path.read_text())} if report_path.exists() else {}
 for spec in json.loads(Path('tools/campaigns/raceway_sources.json').read_text()):
  if args.only and spec['key'] not in args.only:continue
  for selection in spec.get('layouts',[]):
   key=f"raceway-{spec['key']}-{selection['key']}"
   try:
    row=build(spec,selection);report[key]=row;print(key,round(row['lengthM']),flush=True)
   except Exception as exc:report[key]={'id':key,'status':'blocked','error':str(exc)};print(key,'FAILED',str(exc),flush=True)
   report_path.write_text(json.dumps(list(report.values()),indent=2)+'\n')
