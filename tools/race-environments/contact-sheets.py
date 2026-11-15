"""Compact review sheets from retained native captures; never changes source art.
Usage: python tools/race-environments/contact-sheets.py CAPTURE_DIR OUTPUT_PREFIX
Native sky projection only: these sheets are not production-driving acceptance.
"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(sys.argv[1]);prefix=Path(sys.argv[2]);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
rows=[]
for f in sorted(root.rglob('*-state.json')):
 d=json.loads(f.read_text());d['_file']=f;d['_stem']=f.name[:-len('-state.json')];rows.append(d)
assert rows,'No native reports'
for device in ['desktop','handheld']:
 own=[r for r in rows if device in str(r['_file'].parent)]
 for start in range(0,len(own),5):
  batch=own[start:start+5]
  for mode in ['exposure','edges']:
   out=Image.new('RGB',(960,len(batch)*210),'#151515');draw=ImageDraw.Draw(out)
   for i,r in enumerate(batch):
    draw.text((4,i*210+2),r['race']+' / '+device,fill='white',font=font)
    suffixes=['sky100-raw-no-fog','authored-composite'] if mode=='exposure' else ['pitch-0.35-yaw--0.01','pitch-0.8-yaw-0.01']
    for j,suffix in enumerate(suffixes):
     p=r['_file'].parent/(r['_stem']+'-'+suffix+'.'+r.get('imageFormat','png'));im=Image.open(p);im.thumbnail((480,180));out.paste(im,(j*480,i*210+22))
   dest=Path(str(prefix)+f'-{device}-{mode}-{start//5}.jpg');dest.parent.mkdir(parents=True,exist_ok=True);out.save(dest,quality=82);print(dest)
