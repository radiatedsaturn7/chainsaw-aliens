"""Repair reviewed imported circuit loops from their original OSM snapshots.
Retain scenery, terrain, conditions and heights. No geographic downloads needed.
"""
import argparse,base64,gzip,json,math,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
from audit_race_lines import read,write,place,distances
ROOT=Path('data/server-storage/files')
REVIEWED={'side-h01-s05','side-h10-s08','raceway-vir-south','side-h03-s09','side-h05-s09','state-ky'}

def reversals(points,threshold=145):
 out=[]
 for i in range(1,len(points)-1):
  a,b,c=points[i-1:i+2];u=(b['x']-a['x'],b['y']-a['y']);v=(c['x']-b['x'],c['y']-b['y'])
  den=math.hypot(*u)*math.hypot(*v)
  if den and (u[0]*v[0]+u[1]*v[1])/den<math.cos(math.radians(threshold)):out.append(i)
 return out

def project(nodes,p):
 best=None;d=0
 for i,(a,b) in enumerate(zip(nodes,nodes[1:])):
  dx,dy=b['x']-a['x'],b['y']-a['y'];length=math.hypot(dx,dy)
  t=max(0,min(1,((p['x']-a['x'])*dx+(p['y']-a['y'])*dy)/max(1e-8,length*length)))
  error=math.hypot(p['x']-a['x']-t*dx,p['y']-a['y']-t*dy)
  if best is None or error<best[0]:best=(error,i,t,d+t*length)
  d+=length
 return best

def repair(r):
 old=r['road'];nodes=old['nodes'];origin=r['source']['origin'];raw=read(Path(r['source']['sourceSnapshot']))
 ways=raw if isinstance(raw,list) else raw.get('ways',raw.get('elements',[]))
 reviewed=read(Path('tools/campaigns/circuit_route_overrides.json')).get(r.get('source',{}).get('candidateId') or r.get('id'))
 track.apply_reviewed_way_directions(ways,reviewed)
 layouts=track.extract_layouts(ways,(origin['lat'],origin['lon']),max_layouts=256,max_cycles=512)
 length=distances(nodes)[-1]
 candidates=[l for l in layouts if not reversals(l['points'],135) and abs(l['lengthM']-length)<length*.2]
 if not candidates:raise ValueError('No reviewed continuous source loop near the original length')
 if reviewed:
  candidates=[l for l in candidates if l['name']==reviewed['name'] and abs(l['lengthM']-reviewed['lengthM'])<1]
  if not candidates:raise ValueError('Reviewed circuit no longer matches source')
 layout=min(candidates,key=lambda l:abs(l['lengthM']-length))
 fresh=track.build({**layout,'place':origin,'open':False},width=old['width'],use_elevation=False,max_segment_length_m=50,max_control_points=2000)['race']['road']
 for p in fresh['nodes']:
  _,i,t,_=project(nodes,p);p['elevation']=nodes[i].get('elevation',0)*(1-t)+nodes[i+1].get('elevation',0)*t
 for i,s in enumerate(fresh['segments']):
  _,j,_,_=project(nodes,fresh['nodes'][i]);s.update({**old['segments'][j],**{k:s[k] for k in ['length','curve','roadWidthM','surface'] if k in s}})
  s['elevation']=fresh['nodes'][i+1]['elevation']
 # Rotate near the existing grid, then use the standard straight-line audit.
 ring=fresh['nodes'][:-1];index=min(range(len(ring)),key=lambda i:math.hypot(ring[i]['x']-nodes[0]['x'],ring[i]['y']-nodes[0]['y']))
 old['nodes']=ring[index:]+ring[:index]+[dict(ring[index])];old['segments']=fresh['segments'][index:]+fresh['segments'][:index]
 for i,p in enumerate(old['nodes']):
  p.pop('role',None);p.pop('locked',None)
  if i==0:p.update(role='start',locked=True)
  elif i==len(old['nodes'])-1:p['role']='finish'
 r['source'].pop('linePlacement',None)
 place(r)
 new=old['nodes'];newLength=distances(new)[-1]
 # World positions stay authored. Distance-bound props are projected onto the
 # repaired path, rather than shifting every landmark by a length ratio.
 for collection in ['scenery','decals','hazards']:
  for obj in r.get(collection,[]):
   if 'x' not in obj or ('z' not in obj and 'y' not in obj):continue
   d=project(new,{'x':obj['x'],'y':obj.get('z',obj.get('y'))})[3]
   for key in ['trackDistance','distance','at']:
    if isinstance(obj.get(key),(int,float)):obj[key]=d
 if 'codriver' in r:r['codriver']['calls']=[c for c in r['codriver'].get('calls',[]) if not c.get('generated')]
 r['source']['osmWayIds']=sorted({p['tags']['osmWayId'] for p in layout['points'] if 'osmWayId' in p.get('tags',{})})
 r['source']['mappedLengthM']=newLength
 if reviewed:r['source']['reviewedCircuit']=reviewed
 report={'version':1,'method':'continuous-source-loop-without-reverse-spurs','layout':layout['name'],'oldLengthM':length,'lengthM':newLength,'removedReversals':reversals(nodes),'remainingReversals':reversals(new)}
 r['source']['circuitSpurRepair']=report
 return report

def update_catalogs():
 for file in ['side-races/catalog.json','raceways/catalog.json']:
  path=Path('data/campaigns/america')/file;rows=read(path)
  for row in rows:
   if row.get('id','').lower() not in ('h01-s05','h10-s08','raceway-vir-south','h03-s09','h05-s09','state-ky'):continue
   if not row.get('documentPath'):continue
   r=read(ROOT/row['documentPath']).get('race',{})
   if r.get('id') not in REVIEWED:continue
   review=r['source']['circuitSpurRepair'];length=review.get('clearance',{}).get('lengthM',review['lengthM'])
   ratio=length/(row.get('lengthM') or length)
   if isinstance(row.get('estimatedDrivingSeconds'),(int,float)):row['estimatedDrivingSeconds']=round(row['estimatedDrivingSeconds']*ratio)
   row.update(lengthM=length,geometryReview=review,linePlacement=r['source'].get('linePlacement',{}),sceneryCount=len(r.get('scenery',[])))
   p=r['road']['nodes'][0];o=r['source']['origin'];gps={'lat':o['lat']-math.degrees(p['y']/6371008.8),'lon':o['lon']+math.degrees(p['x']/(6371008.8*math.cos(math.radians(o['lat']))))}
   row['startGps']=gps;row['finishGps']=dict(gps)
  path.write_text(json.dumps(rows,indent=2)+'\n')

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');parser.add_argument('--catalogs-only',action='store_true');args=parser.parse_args();rows=[]
 if args.catalogs_only:update_catalogs();return
 for path in ROOT.glob('races/*/document.json'):
  doc=read(path);r=doc.get('race',{});nodes=r.get('road',{}).get('nodes',[])
  row={'name':r.get('name'),'nodes':len(nodes),'reversals':reversals(nodes)}
  if r.get('id') in REVIEWED:
   row['repair']=r.get('source',{}).get('circuitSpurRepair') or repair(r)
   if args.apply:write(path,doc)
  elif row['reversals']:row['review']='Mapped single reversal; retained. No consecutive reverse spur like Pittsburgh. A sharp turn alone is not proof of an import error.'
  rows.append(row)
  print(row['name'],row.get('repair',row['reversals']),flush=True)
 out=Path('artifacts/route-review/catalog-audit.json');out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({'count':len(rows),'applied':args.apply,'races':rows},indent=2)+'\n')
if __name__=='__main__':main()
