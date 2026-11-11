"""Fit replacement sprites inside their existing visual bounds; retain collision rules."""
import sys,json,gzip,base64,time
from pathlib import Path
root=Path('data/server-storage/files')
def read(p):
 d=json.loads(p.read_text());return json.loads(gzip.decompress(base64.b64decode(d['data']))) if '__chainsawStorage' in d else d
def write(p,d):
 raw=json.dumps(d,separators=(',',':')).encode();p.write_text(json.dumps({'__chainsawStorage':'compact-v1','encoding':'json-gzip-base64','data':base64.b64encode(gzip.compress(raw,mtime=0)).decode()})+'\n')
 stamp=int(time.time()*1000);m=p.with_name('metadata.json');meta=read(m);meta['savedAt']=stamp;m.write_text(json.dumps(meta,indent=2)+'\n')
def fit(obj,art):
 # Native fence dimensions define contiguous geometry, not billboard bounds.
 if obj.get('isFence') or obj.get('fenceId'):
  if obj.get('campaignArtBounds'):obj.update(obj['campaignArtBounds'])
  return
 bounds=obj.setdefault('campaignArtBounds',{'widthM':obj['widthM'],'heightM':obj['heightM']})
 scale=min(bounds['widthM']/art['width'],bounds['heightM']/art['height'])
 obj.update(widthM=art['width']*scale,heightM=art['height']*scale)
manifest=read(root/'manifest.json');imports=read(Path('data/campaigns/america/art-imports.json'))
original={};wanted=set(sys.argv[1:])
for name in wanted:
 if name not in manifest['folders']['doodads']:continue
 p=root/manifest['folders']['doodads'][name];d=read(p);original[name]=json.loads(json.dumps(d['doodad']));fit(d['doodad'],imports[name]);write(p,d)
for entry in read(Path('data/campaigns/america/catalog.json')):
 p=root/entry['documentPath'];doc=read(p);count=0
 for prop in doc['race']['scenery']:
  name=prop.get('artRef')
  if name not in original:continue
  prop.setdefault('previewDoodad',json.loads(json.dumps(original[name])))
  fit(prop,imports[name]);prop['previewDoodad'].update(widthM=prop['widthM'],heightM=prop['heightM']);count+=1
 for decal in doc['race'].get('decals',[]):
  if decal.get('artRef') in wanted:fit(decal,imports[decal['artRef']]);count+=1
 if count:write(p,doc);print(entry['name'],count,'sprite bounds refreshed')
