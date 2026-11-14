"""Audit/move campaign timing lines onto existing straights; never reshape roads.
Run without --apply to inspect. Story opener is intentionally preserved. Trimmed
road remains explicit untimed continuation; closed circuits only rotate their seam.
"""
import argparse,base64,json,math,zlib,hashlib,time
from pathlib import Path
ROOT=Path('data/server-storage/files')
def read(p):
 d=json.loads(p.read_text());return json.loads(zlib.decompress(base64.b64decode(d['data']),31)) if '__chainsawStorage' in d else d

def write(p,d):
 old=json.loads(p.read_text())
 if 'race' in d:
  stamp=int(time.time()*1000);d['savedAt']=stamp
  meta=p.with_name('metadata.json')
  if meta.exists():
   m=json.loads(meta.read_text());m['savedAt']=stamp;meta.write_text(json.dumps(m,indent=2)+'\n')
 if '__chainsawStorage' in old:
  import gzip
  d={'__chainsawStorage':'compact-v1','encoding':'json-gzip-base64','data':base64.b64encode(gzip.compress(json.dumps(d,separators=(',',':')).encode(),mtime=0)).decode()}
 p.write_text(json.dumps(d,indent=2)+'\n')

def distances(nodes):
 out=[0]
 for a,b in zip(nodes,nodes[1:]):out.append(out[-1]+math.hypot(b['x']-a['x'],b['y']-a['y']))
 return out

def bend(nodes,reach=80):
 headings=[];length=0
 for a,b in zip(nodes,nodes[1:]):
  d=math.hypot(b['x']-a['x'],b['y']-a['y'])
  if d<.01:continue
  headings.append(math.atan2(b['y']-a['y'],b['x']-a['x']));length+=d
  if length>=reach:break
 return sum(abs(math.atan2(math.sin(b-a),math.cos(b-a))) for a,b in zip(headings,headings[1:]))*180/math.pi

def line_corridor(road,nodes,d,index,side,window=80):
 # Check both sides: a straight timed segment alone can hide a junction at
 # the grid or finish. Clip to exact distances rather than whole long edges.
 length=d[-1];center=d[index]
 low,high=(center-35,center+window) if side==0 else (center-window,center+40)
 points=[(p['offset'],{'x':p['x'],'y':p['z']}) for p in road.get('continuations',{}).get('start',[]) if p['offset']<0]
 points+=list(zip(d,nodes))
 points += [(length+p['offset'],{'x':p['x'],'y':p['z']}) for p in road.get('continuations',{}).get('finish',[]) if p['offset']>0]
 points.sort(key=lambda p:p[0])
 if not points or points[0][0]>low+.01 or points[-1][0]<high-.01:return float('inf')
 clipped=[]
 for (da,a),(db,b) in zip(points,points[1:]):
  if db<=da or db<low or da>high:continue
  for t in [max(0,(low-da)/(db-da)),min(1,(high-da)/(db-da))]:
   point={'x':a['x']+(b['x']-a['x'])*t,'y':a['y']+(b['y']-a['y'])*t}
   if not clipped or math.hypot(point['x']-clipped[-1]['x'],point['y']-clipped[-1]['y'])>.001:clipped.append(point)
 return bend(clipped,high-low+1)

def shift_calls(r,start,length,circuit=False):
 # Coordinates stay in place. Only distance-based annotations move with the line.
 for landmark in r.get('source',{}).get('landmarks',[]):
  if isinstance(landmark.get('routeDistanceM'),(int,float)):
   # Projection on untimed road may be signed. Keep that reference separately;
   # routeDistanceM/routeMiles describe only the bounded timed route annotation.
   raw=landmark.get('signedRouteDistanceM',landmark['routeDistanceM'])-start
   if circuit:
    landmark['routeDistanceM']=round(raw%length)
    landmark.pop('signedRouteDistanceM',None)
   else:
    raw=round(raw)
    if raw<0 or raw>length or 'signedRouteDistanceM' in landmark:
     landmark['signedRouteDistanceM']=raw
    landmark['routeDistanceM']=min(length,max(0,raw))
   landmark['routeMiles']=round(landmark['routeDistanceM']/1609.344,2)
 for collection in ['scenery','decals','hazards']:
  for obj in r.get(collection,[]):
   for key in ['trackDistance','distance','at']:
    if isinstance(obj.get(key),(int,float)):obj[key]=(obj[key]-start)%length if circuit else obj[key]-start
 calls=[]
 for c in r.get('codriver',{}).get('calls',[]):
  if c.get('generated'):continue # regenerated from the actual road on preparation
  c=dict(c)
  for k in ['at','endAt','apexAt','linkedAt']:
   if isinstance(c.get(k),(int,float)):c[k]=(c[k]-start)%length if circuit else c[k]-start
  if 0<=c.get('at',-1)<=length:calls.append(c)
 if 'codriver' in r:r['codriver']['calls']=calls

def continuations(road,oldnodes,d,start,end):
 old=road.get('continuations',{});new=dict(old)
 for side,boundary in [('start',start),('finish',end)]:
  entries=[]
  for p in old.get(side,[]):
   q=dict(p);q['offset']=p['offset']+(0 if side=='start' else d[-1])-boundary
   if (q['offset']<0 if side=='start' else q['offset']>0) and abs(q['offset'])<=400:entries.append(q)
  for i,p in enumerate(oldnodes):
   offset=d[i]-boundary
   if (offset<0 if side=='start' else offset>0) and abs(offset)<=400:
    a,b=oldnodes[max(0,i-1)],oldnodes[min(len(oldnodes)-1,i+1)]
    entries.append({'offset':offset,'x':p['x'],'z':p['y'],'elevation':p.get('elevation',0),'yaw':math.atan2(b['x']-a['x'],b['y']-a['y'])})
  new[side]=sorted(entries,key=lambda p:p['offset'])
 new['version']=1;new['linePlacement']='Excluded mapped timing-section geometry retained as untimed road.'
 road['continuations']=new

def signature(nodes):return hashlib.sha256(json.dumps(nodes,sort_keys=True).encode()).hexdigest()

def place(r):
 road=r.get('road',{});nodes=road.get('nodes',[]);segments=road.get('segments',[])
 if len(nodes)<4:return {'status':'too-short'}
 prior=r.get('source',{}).get('linePlacement',{})
 if prior.get('method')=='existing-road-straight-v2' and prior.get('geometrySignature')==signature(nodes) and not prior.get('remainingReview'):
  return {**prior,'status':'already-reviewed'}
 old=nodes[:];d=distances(nodes);length=d[-1];circuit=r.get('type')=='circuit'
 before=[round(bend(nodes),2),round(bend(nodes[::-1]),2)]
 result={'beforeDegrees':before,'lengthBeforeM':round(length,2)}
 if r.get('name') in ('Tower Hill Road','Mount Washington Auto Road — point-to-point'):return {**result,'status':'preserved-authored-stage','reason':'Keep the authored cold-open staging or existing mountain summit finish.'}
 if circuit:
  if math.hypot(nodes[-1]['x']-nodes[0]['x'],nodes[-1]['y']-nodes[0]['y'])>1:return {**result,'status':'manual-review','reason':'Circuit endpoints are not coincident; do not invent closure.'}
  ring=nodes[:-1];n=len(ring)
  candidates=[]
  for i in range(n):
   seq=ring[i:]+ring[:i]+[ring[i]]
   a,b=bend(seq,40),bend(seq[::-1],40)
   # Include the heading across the seam, not just each side independently.
   prior,next=seq[-2],seq[1];p=seq[0]
   u=math.atan2(p['y']-prior['y'],p['x']-prior['x']);v=math.atan2(next['y']-p['y'],next['x']-p['x'])
   total=a+b+abs(math.atan2(math.sin(v-u),math.cos(v-u)))*180/math.pi
   candidates.append((total,min(d[i],length-d[i]),i))
  window=80
  if min(candidates)[0]>10:
   window=40;candidates=[]
   for i in range(n):
    seq=ring[i:]+ring[:i]+[ring[i]];p=seq[0];prior,next=seq[-2],seq[1]
    u=math.atan2(p['y']-prior['y'],p['x']-prior['x']);v=math.atan2(next['y']-p['y'],next['x']-p['x'])
    total=bend(seq,20)+bend(seq[::-1],20)+abs(math.atan2(math.sin(v-u),math.cos(v-u)))*180/math.pi
    candidates.append((total,min(d[i],length-d[i]),i))
  result['gridWindowM']=window
  current=candidates[0][0]
  if current<=10:return {**result,'status':'already-straight','seamDegrees':round(current,2)}
  score,_,i=min(candidates)
  if score>10:return {**result,'status':'manual-review','reason':'No verified 80 m straight grid window in saved geometry.','bestSeamDegrees':round(score,2)}
  road['nodes']=ring[i:]+ring[:i]+[dict(ring[i])];road['segments']=segments[i:]+segments[:i]
  start=d[i];end=length;shift_calls(r,start,length,True)
  result.update(rotatedM=round(start,2),seamDegrees=round(score,2))
 else:
  cap=min(500,length*.08);a=0;b=len(nodes)-1;windows=[80,80]
  for side in [0,1]:
   original=0 if side==0 else len(nodes)-1
   if line_corridor(road,nodes,d,original,side)<=10:continue
   for window,limit in [(80,cap),(40,cap),(40,min(1000,length*.2))]:
    candidates=range(len(nodes)-3) if side==0 else range(len(nodes)-1,2,-1)
    choices=[i for i in candidates if (d[i] if side==0 else length-d[i])<=limit and line_corridor(road,nodes,d,i,side,window)<=10]
    if choices:
     if side==0:a=choices[0]
     else:b=choices[0]
     windows[side]=window;break
  result['lineWindowsM']=windows
  quality=[line_corridor(road,nodes,d,a,0,windows[0]),line_corridor(road,nodes,d,b,1,windows[1])]
  result['corridorDegrees']=[round(q,2) if math.isfinite(q) else None for q in quality]
  if a>=b or max(quality)>10:
   return {**result,'status':'manual-review','reason':'No nearby straight with 35 m grid approach and 40 m finish runout; original geography retained.'}
  if a==0 and b==len(nodes)-1:return {**result,'status':'already-straight'}
  road['nodes']=nodes[a:b+1];road['segments']=segments[a:b]
  start,end=d[a],d[b];continuations(road,old,d,start,end);shift_calls(r,start,end-start)
  result.update(trimStartM=round(start,2),trimFinishM=round(length-end,2))
 for i,node in enumerate(road['nodes']):
  if node.get('role') in ('start','finish'):node.pop('role')
  if i==0:node.update(role='start',locked=True)
  elif i==len(road['nodes'])-1:node['role']='finish'
 # Segment lengths and elevations retain their original source; only first
 # curve has no preceding timed segment after a trim.
 if not circuit:road['segments'][0]['curve']=0
 source=r.setdefault('source',{});source['linePlacement']={**result,'method':'existing-road-straight-v2','surveyedStartLine':False}
 source['mappedLengthM']=distances(road['nodes'])[-1]
 result.update(status='adjusted',afterDegrees=[round(bend(road['nodes'],window/2 if circuit else windows[0]),2),round(bend(road['nodes'][::-1],window/2 if circuit else windows[1]),2)],lengthAfterM=round(source['mappedLengthM'],2))
 if not circuit and max(result['afterDegrees'])>10:result['remainingReview']='One endpoint has no nearby straight even with a 40 m window.'
 source['linePlacement']={**result,'method':'existing-road-straight-v2','surveyedStartLine':False,'geometrySignature':signature(road['nodes'])}
 return result

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
 manifest=read(ROOT/'manifest.json');main=read(Path('data/campaigns/america/catalog.json'));side=read(Path('data/campaigns/america/side-races/catalog.json'))
 extra=read(Path('data/campaigns/america/raceways/catalog.json'))
 names=set(manifest['folders']['races']);rows=[]
 for name in sorted(names):
  p=ROOT/manifest['folders']['races'][name];doc=read(p);r=doc['race'];result=place(r);rows.append({'name':name,**result})
  if args.apply and result['status']=='adjusted':
   write(p,doc)
   notes=r.get('source',{}).get('landmarkNotesPath')
   if notes and Path(notes).is_file():
    data=read(Path(notes));data['landmarks']=r['source']['landmarks'];data['routeLengthM']=r['source']['mappedLengthM'];write(Path(notes),data)
   for entry in main+side+extra:
    if entry.get('name')!=name and entry.get('raceRef')!=name:continue
    oldLength=entry.get('lengthM',result['lengthBeforeM']);entry['lengthM']=r['source']['mappedLengthM']
    if entry.get('estimatedDrivingSeconds'):entry['estimatedDrivingSeconds']=round(entry['estimatedDrivingSeconds']*entry['lengthM']/oldLength)
    origin=r['source'].get('origin',{})
    if 'lat' in origin and 'lon' in origin:
     for k,node in [('startGps',r['road']['nodes'][0]),('finishGps',r['road']['nodes'][-1])]:
      entry[k]={'lat':origin['lat']-math.degrees(node['y']/6371008.8),'lon':origin['lon']+math.degrees(node['x']/(6371008.8*math.cos(math.radians(origin['lat']))))}
    entry['linePlacement']=r['source']['linePlacement']
 if args.apply:
  Path('data/campaigns/america/raceways/catalog.json').write_text(json.dumps(extra,indent=2)+'\n')
  Path('data/campaigns/america/catalog.json').write_text(json.dumps(main,indent=2)+'\n')
  Path('data/campaigns/america/side-races/catalog.json').write_text(json.dumps(side,indent=2)+'\n')
 report=Path('data/campaigns/america/line-placement-audit.json');report.write_text(json.dumps({'applied':args.apply,'windowM':80,'thresholdDegrees':10,'races':rows},indent=2)+'\n')
 from collections import Counter
 print(Counter(r['status'] for r in rows))
 for r in rows:
  if r['status']=='manual-review':print(r)
if __name__=='__main__':main()
