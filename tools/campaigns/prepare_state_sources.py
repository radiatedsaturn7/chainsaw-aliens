"""Cache real map/elevation source discovery for the 50-state expansion.
Uses the editor's geocoder and existing bounded OSM map snapshot importer.
"""
import sys,json,math,re,argparse,difflib,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
import race_route_import as route
from import_side_races import snapshot
ROOT=Path('data/campaigns/america/state-expansion')

def geocode(name,origin,maximum=15000):
 found=track.search(name)['places']
 places=[track.recall(p['id'],'place') for p in found]
 places=[p for p in places if p['country']=='us' and math.hypot(*track.metric(p['lat'],p['lon'],origin))<maximum]
 if not places:raise ValueError('No nearby US result for '+name)
 score=lambda p:difflib.SequenceMatcher(None,name.split(',')[0].lower(),p['name'].split(',')[0].lower()).ratio()
 best=max(places,key=score)
 if score(best)<.65:raise ValueError('Ambiguous landmark result; verify its mapped building/address before import: '+best['name'])
 return best

def prepare(row):
 path=ROOT/'sources'/f"{row['id']}.json"
 if path.exists():return
 spec=[row['lat'],row['lon'],'circuit' if row['kind']=='circuit' else 'nameOrRef',row.get('selection','.*')]
 if row['kind']=='city':
  gps=[(p['lat'],p['lon']) for p in row['landmarks']]
  if len(gps)<4:raise ValueError('Four verified landmarks required')
  # Include an ordinary street perimeter for routing; never use motorways.
  bounds=(min(p[0] for p in gps)-.008,min(p[1] for p in gps)-.010,max(p[0] for p in gps)+.008,max(p[1] for p in gps)+.010)
 elif row['kind']=='road':bounds=row.get('bounds') or (row['lat']-.035,row['lon']-.045,row['lat']+.035,row['lon']+.045)
 else:bounds=None
 def enough_city_roads(ways):
  if row['kind']!='city':return False
  public=[w for w in ways if w['tags'].get('highway') in ('primary','secondary','tertiary','unclassified','residential')]
  gps=[p for w in public for p in w.get('geometry',[])]
  if not gps:return False
  for mark in row['landmarks']:
   if min(math.hypot(*track.metric(p['lat'],p['lon'],(mark['lat'],mark['lon']))) for p in gps)>250:return False
  # Stop downloading unrelated building/parcel detail once the native router
  # can produce a complete, non-repeating local course past all four landmarks.
  from import_state_expansion import city_route
  try:city_route(row,public);return True
  except ValueError:return False
 if row['kind']=='city' and row.get('roadOnlySnapshot'):
  query='[out:json][timeout:25];way["highway"~"^(primary|secondary|tertiary|unclassified|residential)$"]('+','.join(f'{v:.5f}' for v in bounds)+');out geom;'
  time.sleep(20)
  try:ways=route.overpass(query,track.request_json)
  except ValueError:ways=snapshot(spec,bounds=bounds,max_depth=4,request_interval=20,accept=enough_city_roads)
 else:ways=snapshot(spec,bounds=bounds,max_depth=3 if row['kind']=='city' else 2,request_interval=20,accept=enough_city_roads if row['kind']=='city' else None)
 if row['kind']=='city':
  ways=[w for w in ways if w['tags'].get('highway') in ('primary','secondary','tertiary','unclassified','residential') and w['tags'].get('access') not in ('no','private') and w['tags'].get('motor_vehicle',w['tags'].get('motorcar')) not in ('no','private')]
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(ways,separators=(',',':'))+'\n')
 print(row['id'],'snapshot',len(ways),'ways',flush=True)

if __name__=='__main__':
 ap=argparse.ArgumentParser();ap.add_argument('--sources');ap.add_argument('--output-root');ap.add_argument('--cities',action='store_true');ap.add_argument('--only',nargs='*');ap.add_argument('--geocode-only',action='store_true');ap.add_argument('--snapshots-only',action='store_true');args=ap.parse_args()
 if args.output_root:ROOT=Path(args.output_root)
 path=Path(args.sources or ('tools/campaigns/city_run_sources.json' if args.cities else 'tools/campaigns/state_gap_sources.json'));rows=json.loads(path.read_text())
 for row in rows:
  if args.only and row['id'] not in args.only:continue
  try:
   if row['kind']=='city' and not args.snapshots_only:
    for mark in row['landmarks']:
     if 'lat' in mark:continue
     place=geocode(f"{mark.get('query',mark['name'])}, {row['city']}, {row['state']}",(row['lat'],row['lon']))
     mark.update({k:place[k] for k in ('lat','lon','osmType','osmId')});mark['mappedName']=place['name'];mark['coordinateSource']=f"https://www.openstreetmap.org/{place['osmType']}/{place['osmId']}"
     path.write_text(json.dumps(rows,indent=2)+'\n');print(row['id'],mark['name'],'located',flush=True)
   if not args.geocode_only:prepare(row)
  except Exception as exc:print(row['id'],'NEEDS REVIEW',str(exc),flush=True)
