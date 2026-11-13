"""Import reviewed campaign PNGs into saved art. Requires pip install pypng.

Source PNGs are untouched. Runtime copies use nearest-neighbor sampling to a
512-pixel maximum edge (1024 for reviewed skyboxes), preserving alpha.
Only reviewed paths below are eligible; unknown incoming art is never auto-wired.
"""
import hashlib,json,gzip,base64,time,os
from pathlib import Path
import png
ROOT=Path('data/server-storage/files')
SOURCES=Path('assets/campaign-art')
REVIEWED={
 **{f'decals/{n}.png':f'decal-{n}' for n in ['cracks-repair-patches','dirt-drag','fallen-leaves-needles','gravel-spill','puddle','road-edge-debris','snow-patch','tire-skid-marks']},
 **{f'rocks/{n}.png':n for n in ['alpine-rock-outcrop-01','alpine-rock-outcrop-02','gray-boulder-01','gray-boulder-02','gray-boulder-03','red-sandstone-boulder-01','red-sandstone-boulder-02','red-sandstone-boulder-03']},
 **{f'vegetation/{n}.png':n for n in ['dead-broken-tree-01','dead-broken-tree-02','dry-scrub-bush-01','dry-scrub-bush-02','dry-scrub-bush-03','fallen-log-01','mostly-bare-pine-01','mostly-bare-pine-02','stump-01']},
 **{f'ground/shoulder-{n}.png':f'shoulder-{n}' for n in ['asphalt-gravel','dirt-grass','snowbank-edge']},
 **{f'vegetation/snow-covered-pine-{i:02}.png':f'snow-covered-pine-{i:02}' for i in range(1,4)},
 **{f'ground/ground-{n}-v2.png':f'ground-{n}-v2' for n in ['alpine-rock','brown-dirt','canyon-rock','clean-snow','desert-scrub','dirty-snow','gray-gravel','industrial-concrete','industrial-rubble','red-gravel']},
 **{f'roadside/{n}.png':f'roadside-{n}' for n in ['abandoned-car-01','abandoned-car-02','abandoned-car-03','chevron-left','chevron-right','concrete-barrier-clean','concrete-barrier-damaged','drainage-culvert-entrance','hairpin-warning-sign','metal-guardrail-damaged','metal-guardrail-intact','reflector-post','road-closed-barricade','rockfall-warning-sign','rubble-pile','snow-depth-marker-pole','snowbank-mound','steep-grade-warning-sign','streetlight','traffic-cone','wooden-fence-broken','wooden-fence-intact','wooden-utility-pole']},
 **{f'roads/road-{n}.png':f'road-{n}' for n in ['slush','snow-packed','snow-patchy']},
 **{f'regions/{region}/{n}.png':f'{region}-{n}' for region,names in {
 'data-center-city':['cooling-units','loading-dock','security-fencing','server-building','shipping-container','transformer'],
 'ozarks':['barn','creekside-brush','exposed-limestone','farm-gate','timber-shed'],
 'route-66':['abandoned-gas-station','billboard','diner','motel-sign','rusted-pickup','water-tower'],
 'pikes-peak':['alpine-vegetation','granite-outcrop','snow-fence','summit-sign'],
 'moki-dugway':['desert-scrub','mesa-silhouette','sandstone-outcrop','warning-sign'],
 'oak-creek':['canyon-cabin','creekside-tree','red-rock-formation','stone-wall'],
 'angeles-crest':['chaparral','dry-mountain-pine','mountain-silhouette','pale-rock-cut','turnout-sign'],
 'tower-hill':['small-shed','mailbox','short-stone-wall'],
 'mount-washington':['summit-building-silhouette','weather-instruments'],
 'ohio-river-crossing':['distant-bridge-silhouette','flood-marker','riverbank-vegetation','riverside-building']}.items() for n in names},
 **{f'roads/road-{n}.png':f'road-{n}' for n in ['dirt-loose','dirt-packed','gravel-gray','gravel-red','gravel-rutted']},
 'roads/road-asphalt-patched.png':'road-asphalt-patched',
 **{f'roads/road-asphalt-{n}.png':f'road-asphalt-{n}' for n in ['industrial','wet','worn','faded66']},
 **{f'vegetation/frozen-bush-{i:02}.png':f'frozen-bush-{i:02}' for i in range(1,4)},
 **{f'rocks/gray-rock-{i:02}.png':f'gray-rock-{i:02}' for i in range(1,4)},
 'ground/ground-frozen-forest.png':'ground-frozen-forest',
 'ground/ground-snow-dead-grass.png':'ground-snow-dead-grass',
 **{f'vegetation/leafless-tree-{i:02}.png':f'leafless-tree-{i:02}' for i in range(1,4)},
 **{f'regions/laurel-highlands/{n}.png':f'laurel-{n}' for n in ['forest-cabin','park-sign','stone-retaining-wall']},
}
EXPANDED=Path('data/campaigns/america/expanded-art.json')
if EXPANDED.exists():
 REVIEWED.update({a['source']:a['name'] for a in json.loads(EXPANDED.read_text())['assets']})
def digest(raw):return hashlib.sha256(raw).hexdigest()
def save(path,value):
 path.parent.mkdir(parents=True,exist_ok=True)
 temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,indent=2)+'\n');os.replace(temp,path)
def encode(doc):return {'__chainsawStorage':'compact-v1','encoding':'json-gzip-base64','data':base64.b64encode(gzip.compress(json.dumps(doc,separators=(',',':')).encode(),mtime=0)).decode()}
def main():
 index=Path('data/campaigns/america/art-imports.json')
 previous=json.loads(index.read_text()) if index.exists() else {}
 invalid={};decoded={}
 manifest=json.loads((ROOT/'manifest.json').read_text())
 # Check every existing target before writing any output. An edited saved
 # sprite must never be silently replaced by a later generator commit.
 for relative,name in REVIEWED.items():
  target=ROOT/'art'/name/'document.json'
  if (SOURCES/relative).exists() and target.exists() and digest(target.read_bytes())!=previous.get(name,{}).get('documentSha256'):
   raise RuntimeError(f'Preserve local artwork edits: {target}')
 # Decode changed sources before publishing anything; retain known-good runtime
 # art for malformed generator uploads and report their exact source hashes.
 for relative,name in REVIEWED.items():
  source=SOURCES/relative
  if not source.exists():continue
  raw=source.read_bytes()
  if digest(raw)==previous.get(name,{}).get('sourceSha256'):continue
  try:
   w,h,rows,info=png.Reader(bytes=raw).asRGBA8();decoded[name]=(w,h,list(rows))
  except Exception as error:
   invalid[name]={'source':source.as_posix(),'sourceSha256':digest(raw),'error':str(error)}
   print(f'Skipped invalid PNG {name}: {error}')
 for relative,name in REVIEWED.items():
  source=SOURCES/relative
  if not source.exists():continue
  raw=source.read_bytes();sha=digest(raw);target=ROOT/'art'/name/'document.json';old=previous.get(name,{})
  if target.exists():
   if digest(target.read_bytes())!=old.get('documentSha256'):raise RuntimeError(f'Preserve local artwork edits: {target}')
   if sha==old.get('sourceSha256'):continue
  if name in invalid:continue
  w,h,rows=decoded.pop(name)
  max_edge=next((a.get('maxEdge',512) for a in json.loads(EXPANDED.read_text())['assets'] if a['name']==name),512) if EXPANDED.exists() else 512
  scale=min(1,max_edge/max(w,h));width=max(1,round(w*scale));height=max(1,round(h*scale))
  frame=[]
  for y in range(height):
   row=rows[min(h-1,int((y+.5)*h/height))]
   for x in range(width):
    i=min(w-1,int((x+.5)*w/width))*4;r,g,b,a=row[i:i+4]
    frame.append(f'#{r:02x}{g:02x}{b:02x}{a:02x}' if a else None)
  doc={'kind':'actor-state-animation','width':width,'height':height,'fps':1,'frames':[frame],
   'importSource':{'path':source.as_posix(),'sha256':sha,'width':w,'height':h,'sampling':'nearest-neighbor','maxEdge':max_edge}}
  save(target,encode(doc));stamp=int(time.time()*1000)
  save(target.with_name('metadata.json'),{'name':name,'folder':'art','savedAt':stamp,'version':1})
  manifest['folders']['art'][name]=f'art/{name}/document.json'
  previous[name]={'source':source.as_posix(),'sourceSha256':sha,'documentSha256':digest(target.read_bytes()),'width':width,'height':height}
  print(f'Imported {name}: {width}x{height}')
 save(ROOT/'manifest.json',manifest);save(index,previous)
 save(Path('data/campaigns/america/art-import-pending.json'),{'invalidSources':invalid})
if __name__=='__main__':main()
