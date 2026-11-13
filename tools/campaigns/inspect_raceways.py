"""Inspect editor importer layout candidates from reproducible OSM snapshots."""
import sys,json,re
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import race_track_import as track
import race_route_import as route
import import_side_races as side
ROOT=Path('data/campaigns/america/raceways')
def candidate_layouts(spec):
 ways=json.loads((ROOT/'sources'/f"{spec['key']}.json").read_text())
 ways=[w for w in ways if w.get('tags',{}).get('area')!='yes' and not re.search(r'\bpit\b|pitlane|kart',str(w.get('tags',{})),re.I)]
 return track.extract_layouts(ways,(spec['lat'],spec['lon']),max_layouts=256,max_cycles=512)

if __name__=='__main__':
 for spec in json.loads(Path('tools/campaigns/raceway_sources.json').read_text()):
  if len(sys.argv)>1 and spec['key'] not in sys.argv[1:]:continue
  path=ROOT/'sources'/f"{spec['key']}.json"
  try:
   if path.exists():ways=json.loads(path.read_text())
   else:
    ways=side.snapshot([spec['lat'],spec['lon'],'circuit',0]) if spec.get('country','us')=='us' else route.overpass(f'[out:json][timeout:25];way(around:{spec.get("radius",3000)},{spec["lat"]},{spec["lon"]})["highway"="raceway"];out geom;',track.request_json)
    path.write_text(json.dumps(ways,separators=(',',':'))+'\n')
   layouts=candidate_layouts(spec)
   (ROOT/f"{spec['key']}-layouts.json").write_text(json.dumps(layouts,separators=(',',':'))+'\n')
   print(spec['key'],[(i,round(l['lengthM']),l['name']) for i,l in enumerate(layouts)],flush=True)
  except Exception as e:print(spec['key'],'ERROR',str(e),flush=True)
