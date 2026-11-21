import sys,json,math
from pathlib import Path
sys.path.insert(0,'tools/campaigns');from repair_circuit_spurs import read,reversals,distances
out=[]
for f in Path('data/server-storage/files/races').glob('*/document.json'):
 r=read(f).get('race',{});n=r.get('road',{}).get('nodes',[])
 if len(n)<3:continue
 ds=distances(n);turns=reversals(n,120);snap=r.get('source',{}).get('sourceSnapshot');names=[]
 if snap and Path(snap).exists():
  raw=read(Path(snap));ways=raw if isinstance(raw,list) else raw.get('elements',raw.get('ways',[]));ids=r.get('source',{}).get('osmWayIds',[])
  names=sorted({w.get('tags',{}).get('name','') for w in ways if w.get('id') in ids})
 suspect=[s for s in names if any(w in s.lower() for w in ['drift','short course','pit lane','paddock'])]
 if turns or suspect:
  row={'name':r.get('name'),'id':r.get('id'),'type':r.get('type'),'turns':[(i,round(ds[i])) for i in turns],'sourceNames':names,'path':str(f)};out.append(row);print(row['name'],row['type'],row['turns'],suspect,flush=True)
Path('artifacts/route-review').mkdir(exist_ok=True,parents=True);Path('data/campaigns/america/circuit-junction-review.json').write_text(json.dumps({'method':'All saved centerlines: turns exceeding 120 degrees and mixed circuit source names. Flags require map review, not automatic corner removal.','unresolvedCircuits':['World Wide Technology Raceway — road course: source contains two abrupt joins; no continuous replacement loop matching the road course exists in this snapshot. Needs corrected source geometry.'],'races':out},indent=2)+'\n')
