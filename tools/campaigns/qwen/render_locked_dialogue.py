#!/usr/bin/env python3
"""Bake existing scene captions against two fixed Qwen speaker references."""
import argparse, hashlib, json, math, os, sys, time
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
import onnxruntime as ort
ort.disable_telemetry_events()  # Keep offline dialogue rendering local.
from qwen_tts import Qwen3TTSModel

HERE=Path(__file__).resolve().parent
from render_dialogue import item_plan
from install_dialogue import put, stamp_reference_cast

def groups(rows):
    rows=sorted(rows,key=lambda r:(r['duration'],r['scene'],r['start']))
    while rows:
        count=8 if rows[0]['duration']<=2100 else 5 if rows[0]['duration']<=3900 else 3
        yield rows[:count]; rows=rows[count:]

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('root',type=Path)
    p.add_argument('model',type=Path)
    p.add_argument('out',type=Path)
    p.add_argument('--references',type=Path,default=HERE/'cast.json')
    p.add_argument('--scene',action='append',help='Only this named scene (repeatable)')
    p.add_argument('--install-into',type=Path,help='Install baked dialogue after successful generation')
    p.add_argument('--only',type=Path,help='File with one WAV basename per line for selected retakes')
    p.add_argument('--shards',type=int,default=1)
    p.add_argument('--shard',type=int,default=0)
    p.add_argument('--seed',type=int,default=772)
    p.add_argument('--max-batch',type=int,default=4,help='Bound decoder memory on CPU (default: 4)')
    a=p.parse_args()
    cfg=json.loads(a.references.read_text())
    torch.set_num_threads(int(os.getenv('QWEN_THREADS','2')))
    torch.set_num_interop_threads(1)
    rows=list(item_plan(a.root,a.scene))
    if a.only:
        selected=set(a.only.read_text().splitlines())
        rows=[r for r in rows if r['track'] in selected]
        if len(rows)!=len(selected): raise ValueError('Some requested takes are unknown')
    roles={'rob','cait'}
    if not rows or set(cfg.get('speakers',{}))!=roles:
        p.error('No spoken lines or invalid cast preset.')
    if a.install_into and (a.shards!=1 or a.only):
        p.error('Install only after one complete render. For shards, run the installer separately.')
    if a.max_batch<1:p.error('Invalid maximum batch size.')
    if not 0<=a.shard<a.shards:
        p.error('Invalid shard index.')
    # Text or reference changes require a new cache. Sorted row grouping makes
    # independent shards deterministic regardless of their progress.
    cache=json.dumps({'preset':cfg,'seed':a.seed,'rows':rows,'renderer':2,'maxBatch':a.max_batch},sort_keys=True).encode()
    a.out=a.out/hashlib.sha256(cache).hexdigest()[:16]
    a.out.mkdir(parents=True,exist_ok=True)
    print('Take cache:',a.out,flush=True)
    bundles=list(groups(rows))
    m=Qwen3TTSModel.from_pretrained(str(a.model.resolve()),device_map='cpu',
        dtype=torch.bfloat16,attn_implementation='sdpa',local_files_only=True)
    cast=['rob','cait']
    refs=[]
    for speaker in cast:
        meta=cfg['speakers'][speaker]
        ref=a.references.resolve().parent/meta['file']
        if hashlib.sha256(ref.read_bytes()).hexdigest()!=meta['sha256']: raise ValueError('Reference changed: '+speaker)
        refs.append(str(ref))
    with torch.inference_mode():
        prompts=m.create_voice_clone_prompt(ref_audio=refs,ref_text=[cfg['speakers'][s]['text'] for s in cast],x_vector_only_mode=False)
    print(f'{len(rows)} planned; shard {a.shard+1}/{a.shards}; {len(bundles)} groups',flush=True)
    def run_group(g,i,j):
        t=time.monotonic();torch.manual_seed(a.seed+i+j)
        cap=min(150,max(45,math.ceil((max(x['duration'] for x in g)/1000+2.6)*12.5)))
        spoken=[r['spoken'].rstrip('—').rstrip() + ('.' if r['spoken'].endswith('—') else '') for r in g]
        with torch.inference_mode():
            wavs,sr=m.generate_voice_clone(text=spoken,language=['English']*len(g),voice_clone_prompt=[prompts[cast.index(r['speaker'])] for r in g],
                non_streaming_mode=True,max_new_tokens=cap,top_k=25,top_p=.94,temperature=.74,subtalker_temperature=.75)
        assert sr==24000
        for r,w in zip(g,wavs):
            w=np.asarray(w,dtype=np.float32)
            active=np.flatnonzero(np.abs(w)>max(.006,np.max(np.abs(w))*.02))
            if not np.isfinite(w).all() or not len(active):raise ValueError(r)
            w=w[max(0,active[0]-768):min(len(w),active[-1]+1439)]
            n=min(120,len(w)//2); w[:n]*=np.linspace(0,1,n);w[-n:]*=np.linspace(1,0,n)
            dst=a.out/r['track'];tmp=dst.with_suffix(f'.{os.getpid()}.tmp')
            sf.write(tmp,w,sr,format='WAV',subtype='PCM_16');tmp.replace(dst)
            print(r['track'],round(len(w)/sr,3),flush=True)
        print(f'Group {i+1}/{len(bundles)}: {len(g)} takes in {time.monotonic()-t:.1f}s',flush=True)
    for i,g in enumerate(bundles):
        if i%a.shards!=a.shard:continue
        g=[r for r in g if not (a.out/r['track']).exists()]
        if not g:continue
        for j in range(0,len(g),a.max_batch):
            run_group(g[j:j+a.max_batch],i,j)
    if a.install_into:
        put(a.root,a.install_into,a.out,a.scene)
        stamp_reference_cast(a.install_into,{r['scene'] for r in rows},a.references)


if __name__=='__main__':main()
