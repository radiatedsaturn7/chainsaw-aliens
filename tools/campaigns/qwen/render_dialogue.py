#!/usr/bin/env python3
"""Bake or refresh imported Qwen dialogue from the current cutscene captions."""
import argparse, base64, gzip, hashlib, json, math, os, re, subprocess, sys
from pathlib import Path

DEFAULT_PRESET=Path(__file__).with_name('voice-presets.json')
MODEL_ID='Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign'
LEGACY={'introtowerhill':['rob']*3,'lastongridintro':['cait','cait','rob','rob','cait','rob','cait']}
FILES=['introtowerhill','lastongridintro']
def load(path):
 x=json.loads(path.read_text())
 return (x,json.loads(gzip.decompress(base64.b64decode(x['data'])))) if x.get('__chainsawStorage') else (None,x)
def item_plan(root,selected=None):
 files=sorted(x for x in root.iterdir() if (x.name in selected if selected else x.name in FILES or x.name.startswith('r1-')))
 for folder in files:
  if selected and folder.name not in selected: continue
  if not folder.is_dir() or not (folder/'document.json').exists(): continue
  _,d=load(folder/'document.json')
  clips=sorted((c for c in d['clips'] if c.get('type')=='text' and c.get('text','').strip()),key=lambda c:c['startMs'])
  for i,c in enumerate(clips):
   raw=c['text'].strip(); tag=re.match(r'^(ROB|CAIT):\s*(.+)$',raw,flags=re.S|re.I)
   if tag:speaker,text=tag.group(1).lower(),tag.group(2)
   elif folder.name in LEGACY:speaker,text=LEGACY[folder.name][i],raw
   else:raise ValueError(f'Unattributed caption {folder.name}:{c["id"]}: {raw}')
   spoken=re.sub(r'\bCait\b','Kate',text,flags=re.I)
   spoken=re.sub(r'\bPachaug\b','Puh-chawg',spoken,flags=re.I)
   spoken=spoken.replace("Weather's getter worse","Weather's getting worse")
   spoken=re.sub(r'\s+-$','—',spoken.strip())
   yield dict(scene=folder.name,id=c['id'],speaker=speaker,text=text,spoken=spoken,
              start=int(c['startMs']),duration=int(c['durationMs']),track=f'{folder.name}--{c["id"]}.wav')
def render(rows,model,first_listen,output,batch,preset,direction=None,shard=0,shards=1,from_group=1,to_group=10000):
 import numpy as np, soundfile as sf, torch
 from qwen_tts import Qwen3TTSModel
 torch.set_num_threads(int(os.getenv('QWEN_THREADS','2'))); torch.set_num_interop_threads(1)
 output.mkdir(parents=True,exist_ok=True)
 ok=list(rows)
 approved=['cait-jesus','cait-recordings','cait-question','rob-reply','cait-check','cait-doubt','rob-car','cait-protest','rob-now']
 blue=[x for x in rows if x['scene']=='r1-blue-hills-exit']
 if first_listen and blue:
  assert len(blue)==len(approved)
  for r,key in zip(blue,approved):
   src=first_listen/(key+'.wav')
   if not (output/r['track']).exists():
    (output/r['track']).write_bytes(src.read_bytes())
  ok=[r for r in ok if r['scene']!='r1-blue-hills-exit']
 if not any(not (output/r['track']).exists() for r in ok):return
 ok.sort(key=lambda r:(round(r['duration']/450),r['speaker'], r['scene'],r['start']))
 groups=[ok[i:i+batch] for i in range(0,len(ok),batch)]
 m=Qwen3TTSModel.from_pretrained(str(model.resolve()), device_map='cpu',
    dtype=torch.bfloat16, attn_implementation='sdpa', local_files_only=True)
 def render_group(group,ix):
  limit=min(115,max(32,math.ceil((max(r['duration'] for r in group)/1000+1.3)*12.5)))
  descriptions=[preset['casting'][r['speaker']]+' '+(direction or preset['sceneDirections'].get(r['scene'],'Speak naturally as if reacting to the other person.'))+(
    ' Keep it brisk so it fits in the beat.' if len(r['spoken'].split())>r['duration']/430 else '') for r in group]
  print('Batch',ix+1,'/',len(groups),len(group),'tokens',limit,flush=True)
  gen=dict(preset['generation'])
  torch.manual_seed(int(gen.pop('seed')))
  with torch.inference_mode():
   wavs,sr=m.generate_voice_design(text=[r['spoken'] for r in group],language=['English']*len(group),
      instruct=descriptions,non_streaming_mode=True,max_new_tokens=limit,
      **gen)
  for r,w in zip(group,wavs):
   w=np.asarray(w,dtype=np.float32)
   active=np.flatnonzero(np.abs(w)>max(.007,np.max(np.abs(w))*.022))
   if not len(active) or not np.isfinite(w).all():raise ValueError('Bad Qwen render '+r['track'])
   w=w[max(0,active[0]-round(.034*sr)): min(len(w),active[-1]+round(.06*sr))]
   n=min(100,len(w)//2);w[:n]*=np.linspace(0,1,n);w[-n:]*=np.linspace(1,0,n)
   dest=output/r['track']; temp=dest.with_suffix(f'.{os.getpid()}.tmp'); sf.write(temp,w,sr,format='WAV',subtype='PCM_16');temp.replace(dest)
   print(r['track'],f'{len(w)/sr:.3f}s',flush=True)
 for ix,group in enumerate(groups):
  if ix%shards!=shard or not from_group <= ix+1 <= to_group: continue
  group=[r for r in group if not (output/r['track']).exists()]
  if not group:continue
  # Large padded waveform batches can exhaust CPU memory at decode time.
  # Keep short lines fast and subdivide long lines without losing saved takes.
  micro=4 if max(r['duration'] for r in group)>=4800 else len(group)
  for start in range(0,len(group),micro):
   render_group(group[start:start+micro],ix)


def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('root',type=Path,help='directory containing native cutscene folders')
 p.add_argument('--model',type=Path);p.add_argument('--approved-blue-hills',type=Path)
 p.add_argument('--out',type=Path,required=True);p.add_argument('--scene',action='append')
 p.add_argument('--batch',type=int,default=15)
 p.add_argument('--preset',type=Path,default=DEFAULT_PRESET,help='JSON casting, direction and sampling settings')
 p.add_argument('--direction',help='Override the background acting direction for one selected scene')
 p.add_argument('--seed',type=int,help='Try a new deterministic take without replacing the existing cache')
 p.add_argument('--install-into',type=Path,help='write dialogue tracks/assets to this cutscene tree after rendering')
 p.add_argument('--shard',type=int,default=0); p.add_argument('--shards',type=int,default=1)
 p.add_argument('--from-group',type=int,default=1);p.add_argument('--to-group',type=int,default=10000)
 a=p.parse_args()
 if a.direction and (not a.scene or len(a.scene)!=1):p.error('--direction requires exactly one --scene')
 preset=json.loads(a.preset.read_text())
 if preset.get('model')!=MODEL_ID or set(preset.get('casting',{}))!={'rob','cait'}:p.error('Preset must identify the VoiceDesign model and both characters')
 if a.seed is not None:preset['generation']['seed']=a.seed
 rows=list(item_plan(a.root,a.scene))
 print(len(rows),'lines in',len(set(r['scene'] for r in rows)),'speaking scenes',flush=True)
 if a.model:
  if not rows:p.error('No spoken captions match the scene selection')
  # Use a content-specific cache so an edit to the text or direction never
  # reuses a previous take under the same timeline clip ID.
  plan=json.dumps(dict(preset=preset,direction=a.direction,rows=rows),ensure_ascii=False,sort_keys=True)
  work=a.out/hashlib.sha256(plan.encode()).hexdigest()[:16]
  render(rows,a.model,a.approved_blue_hills,work,a.batch,preset,a.direction,a.shard,a.shards,a.from_group,a.to_group)
  print('Takes:',work,flush=True)
  if a.install_into:
   from install_dialogue import put
   put(a.root,a.install_into,work,a.scene)
 else: print(json.dumps(rows,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
