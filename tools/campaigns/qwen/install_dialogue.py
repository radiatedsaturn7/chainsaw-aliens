#!/usr/bin/env python3
"""Mix Qwen takes into a scene-local dialogue track without editing the score."""
import argparse, gzip,base64,hashlib,json,os,subprocess
from pathlib import Path
from itertools import groupby
import numpy as np, soundfile as sf
from render_dialogue import item_plan,load,MODEL_ID
SR=24000
ASSET='qwen-dialogue'
def fit(x,n):
 if len(x)<=n:return x,1
 hop=240
 quiet=np.max(np.abs(x[:len(x)//hop*hop].reshape(-1,hop)),axis=1)<.011
 gaps=[]
 for b,group in groupby(enumerate(quiet),lambda a:a[1]):
  indices=[i for i,_ in group]
  if b and len(indices)>19 and indices[0]>6 and indices[-1]<len(quiet)-6:
   gaps.append(((indices[0]+6)*hop,(indices[-1]-6)*hop))
 for a,b in sorted(gaps,reverse=True):
  b=min(b,a+max(0,len(x)-n))
  if b>a:
   # Both splice points are at least 60ms into a quiet interval.
   fade=min(48,a,len(x)-b)
   join=x[a-fade:a]*np.linspace(1,0,fade)+x[b:b+fade]*np.linspace(0,1,fade)
   x=np.r_[x[:a-fade],join,x[b+fade:]]
 if len(x)<=n:return x,1
 rate=len(x)/n*1.025
 if rate>1.42:raise ValueError(f'take is {rate:.2f}x too long, needs a faster take')
 raw=subprocess.check_output(['ffmpeg','-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-af',f'atempo={rate:.6f}','-f','f32le','-'],input=x.astype('<f4').tobytes())
 y=np.frombuffer(raw,dtype='<f4').astype(float)
 if len(y)>n:raise ValueError(f'pace edit did not fit {len(y)/SR:.2f}s vs {n/SR:.2f}s')
 return y,rate
def put(root,output,takes,selected,preserve_blue=None):
 rows=list(item_plan(root,selected)); scenes=sorted(set(r['scene'] for r in rows))
 for scene in scenes:
  group=[r for r in rows if r['scene']==scene]
  raw,doc=load(root/scene/'document.json')
  size=round(doc['durationMs']*SR/1000)
  if scene=='r1-blue-hills-exit' and preserve_blue:
   wave,sr=sf.read(preserve_blue)
   assert sr==SR and len(wave)==size
   wave=np.asarray(wave)*1.28
  else:
   wave=np.zeros(size,dtype=float)
   ordered=sorted(group,key=lambda r:r['start'])
   for i,r in enumerate(ordered):
    x,sr=sf.read(takes/r['track'])
    assert sr==SR and x.ndim==1
    end=min(doc['durationMs'],r['start']+r['duration'],ordered[i+1]['start'] if i+1<len(ordered) else doc['durationMs'])
    offset=round((r['start']+38)*SR/1000)
    n=round((end-42)*SR/1000)-offset
    try:x,rate=fit(x,n)
    except ValueError as e:raise ValueError(f"{r['track']}: {e} ({r['text']})") from e
    if rate>1.12:print('PACE',r['track'],round(rate,2),flush=True)
    good=x[np.abs(x)>.013]
    if not len(good):raise ValueError('Missing audio '+r['track'])
    x*=min((.16 if r['speaker']=='rob' else .148)/np.sqrt(np.mean(good**2)),.83/max(abs(x)))
    if scene=='introtowerhill':
     y=subprocess.check_output(['ffmpeg','-v','error','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-af','highpass=f=260,lowpass=f=2850,volume=1.12','-f','f32le','-'],input=x.astype('<f4').tobytes())
     x=np.frombuffer(y,dtype='<f4')
    wave[offset:offset+len(x)]+=x
  dst=output/scene
  dst.mkdir(parents=True,exist_ok=True); (dst/'assets').mkdir(exist_ok=True)
  mp3=dst/'assets'/'qwen-dialogue.mp3'
  subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-',
                  '-codec:a','libmp3lame','-q:a','3','-map_metadata','-1',str(mp3)],
                  input=np.clip(wave,-.92,.92).astype('<f4').tobytes(),check=True)
  doc['assets']=[a for a in doc.get('assets',[]) if a.get('id')!=ASSET]
  doc['assets'].append(dict(id=ASSET,type='voice',name='Rob & Cait (Qwen)',ref='',
                            dataUrl=dict(__chainsawAssetRef='assets/qwen-dialogue.mp3',mime='audio/mpeg')))
  if not any(x['id']=='audio' for x in doc['layers']):
   doc['layers'].append(dict(id='audio',name='Audio',type='audio',visible=True,locked=False))
  doc['tracks']=[a for a in doc.get('tracks',[]) if a.get('id')!=ASSET]
  doc['tracks'].append(dict(id=ASSET,name='Dialogue (Qwen)'))
  doc['clips']=[a for a in doc['clips'] if a.get('id')!=ASSET]
  doc['clips'].append(dict(id=ASSET,type='music',layerId='audio',trackId=ASSET,assetId=ASSET,
                           startMs=0,durationMs=doc['durationMs'],loop=False,volume=1,fadeMs=0))
  proof=[{k:r[k] for k in ['id','speaker','text','start','duration']} for r in group]
  doc['voiceover']={'model':MODEL_ID,'trackId':ASSET,'captionSha256':hashlib.sha256(json.dumps(proof,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()}
  exported=doc if not raw else {**raw,'data':base64.b64encode(gzip.compress(json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode()}
  (dst/'document.json').write_text(json.dumps(exported,indent=2,ensure_ascii=False)+'\n')
  print('WIRED',scene,len(group),'lines',mp3.stat().st_size,'bytes',flush=True)
def stamp_reference_cast(root,scenes,reference_file):
 cfg=json.loads(reference_file.read_text())
 for scene in scenes:
  path=root/scene/'document.json'; packed,doc=load(path)
  doc['voiceover'].update(model=cfg['model'],modelRevision=cfg['modelRevision'],mode='fixed-reference',
                          castSha256={name:ref['sha256'] for name,ref in cfg['speakers'].items()})
  result=doc if not packed else {**packed,'data':base64.b64encode(gzip.compress(json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode(),mtime=0)).decode()}
  path.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('root',type=Path);p.add_argument('--out',type=Path,required=True)
 p.add_argument('--takes',type=Path,required=True);p.add_argument('--scene',action='append')
 p.add_argument('--approved-blue-hills-stem',type=Path)
 p.add_argument('--cast',type=Path,help='Record fixed reference model and fingerprints in the installed scene')
 a=p.parse_args();put(a.root,a.out,a.takes,a.scene,a.approved_blue_hills_stem)
 if a.cast:stamp_reference_cast(a.out,{r['scene'] for r in item_plan(a.root,a.scene)},a.cast)
