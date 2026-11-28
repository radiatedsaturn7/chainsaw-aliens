"""Install reviewed game sections from the existing real-world imported roads.
Run before regenerating route_previews. Full parent roads are never overwritten.
"""
import copy,gzip,base64,json,time,hashlib,argparse
from pathlib import Path
from urllib.parse import quote
from audit_race_lines import read,distances,place
from rally_sections import partition,section,MIN_SECTION_M
ROOT=Path('data/server-storage/files')

def write(p,d):
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def run(only=None):
 manifest=read(ROOT/'manifest.json');collections=read(Path('data/campaigns/america/raceways/rally-collections.json'))['collections'];report=[]
 for group in collections:
  if only and group['id'] not in only:
   old=read(Path('data/campaigns/america/raceways/rally-sections.json'))
   report.extend(c for c in old['collections'] if c['id']==group['id']);continue
  print(group['id'],flush=True)
  parents=[]
  for entry in group['stages']:
   doc=read(ROOT/manifest['folders']['races'][entry['raceRef']]);r=doc['race']
   if r['source'].get('rallySection'):continue
   # This is a historical shortened version of the same Tarzan corridor, not a new road.
   if group['id']=='acropolis' and 'Tarzan' in entry['raceRef'] and entry.get('year')==2021:continue
   if r['road'].get('network'):continue
   length=distances(r['road']['nodes'])[-1]
   parents.append(dict(doc=doc,ref=entry['raceRef'],length=length,count=1,capacity=int(length//MIN_SECTION_M)))
  for p in parents:
   while p['capacity']>1:
    try:partition(p['doc']['race'],p['capacity']);break
    except ValueError:p['capacity']-=1
  parents=[p for p in parents if p['capacity']]
  target=min(6,sum(p['capacity'] for p in parents))
  if target<4:
   report.append(dict(id=group['id'],name=group['name'],status='needs-additional-roads',reason='Fewer than four substantial sections, or explicit tunnel network needs authored slicing.',sections=[]));continue
  while sum(p['count'] for p in parents)<target:
   choices=[p for p in parents if p['count']<p['capacity']]
   max(choices,key=lambda p:p['length']/(p['count']+1))['count']+=1
  sections=[];number=0
  for p in parents:
   for first,last in partition(p['doc']['race'],p['count']):
    number+=1;ref=f"{group['name']} — Stage {number}";race_id=f"rally-section-{group['id']}-{number}"
    r=section(p['doc']['race'],first,last,name=ref,race_id=race_id,number=number)
    if any(v is None or v>10 for v in r['source']['linePlacement']['corridorDegrees']):
     result=place(r)
     if result.get('status')!='adjusted':r['source']['linePlacement']['remainingReview']=result.get('reason','Mapped bend retained; no straight timing corridor found.')
     if result.get('status')=='adjusted':
      nodes=p['doc']['race']['road']['nodes'];ds=distances(nodes)
      a=next(i for i,n in enumerate(nodes) if n['x']==r['road']['nodes'][0]['x'] and n['y']==r['road']['nodes'][0]['y'])
      b=next(i for i,n in enumerate(nodes) if n['x']==r['road']['nodes'][-1]['x'] and n['y']==r['road']['nodes'][-1]['y'])
      r['source']['rallySection'].update(firstNode=a,lastNode=b,startDistanceM=ds[a],endDistanceM=ds[b])
    if r['source']['mappedLengthM']<1200:raise ValueError('Straight timing-line placement left less than 1.2 km; needs another road.')
    r['description']=f"{group['name']}: distinct section {number} of {p['ref']}. Forward direction. Game timing lines; not an official WRC itinerary."
    doc=copy.deepcopy(p['doc']);doc.update(race=r,selectedRaceId=race_id,savedAt=int(time.time()*1000))
    path=f"races/{quote(ref,safe='-_.() ')}/document.json"
    write(ROOT/path,dict(__chainsawStorage='compact-v1',encoding='json-gzip-base64',data=base64.b64encode(gzip.compress(json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode(),compresslevel=6,mtime=0)).decode()))
    write((ROOT/path).with_name('metadata.json'),dict(name=ref,folder='races',savedAt=doc['savedAt'],version=1))
    manifest['folders']['races'][ref]=path
    sections.append(dict(ref=ref,id=race_id,lengthM=r['source']['mappedLengthM'],**r['source']['rallySection'],linePlacement=r['source']['linePlacement']))
  report.append(dict(id=group['id'],name=group['name'],status='installed',sections=sections,formats=[4,12] if len(sections)>=6 else [4]))
 write(ROOT/'manifest.json',manifest)
 write(Path('data/campaigns/america/raceways/rally-sections.json'),dict(minimumSectionM=MIN_SECTION_M,minimumTimedSectionM=1200,policy='Four distinct sections for short; six distinct sections repeated twice for full. No reverse padding. Original full roads remain in Index.',collections=report))
 print('\n'.join(f"{r['id']}: {len(r['sections'])} sections {r.get('formats',[])}" for r in report))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--only',nargs='*');args=parser.parse_args();run(args.only)
