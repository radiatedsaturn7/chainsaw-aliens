"""Make 24 clip-free sprites by isolating authored west decorations.
Adapts the authored western motifs. Run into a separate output directory.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import argparse
import hashlib,json,random,re,math
D=Path(__file__).parent
SRC=D/'draw_campaign_2994_west_details.py'
source=SRC.read_text()
source=source.replace('from PIL import ImageDraw','from PIL import ImageDraw as NativeDraw\nfrom PIL import Image')
source=source.replace('def decorate(name,im,nodes):','def decorate(name,im,nodes,selected):')
source=source.replace('    d=ImageDraw.Draw(im)',"""    real=NativeDraw.Draw(im)
    active=False
    matches=[]
    class Filter:
        def __getattr__(self,name):
            return lambda *a,**kw: getattr(real,name)(*a,**kw) if active else None
    d=Filter()""")
source=source.replace('    def at(fragment,dx,dy):','    def at(fragment,dx,dy):\n        nonlocal active\n        active=fragment.lower() in selected.lower()\n        if active: matches.append(fragment)')
source=source.replace('return xy[0]+dx,xy[1]+dy','return 192+dx,128+dy')
source=source.replace('    return im\n','    assert len(matches)==1,(selected,matches)\n    return im\n')
g={};exec(compile(source,'western_exact_decorations','exec'),g)
def generate(menu_path, output):
    output.mkdir(parents=True,exist_ok=True)
    menu=json.loads(menu_path.read_bytes())
    regions=['moki-dugway','oak-creek-canyon','angeles-crest']
    palette=[
     ('#4e343d','#875040','#b6724e','#e2a26d'),
     ('#513743','#833e41','#b45b4c','#df865d'),
     ('#2a354b','#49576d','#778598','#afbcc1')]
    sheet=Image.new('RGB',(8*192,3*168),'#2a3c4d'); info={}
    for j,slug in enumerate(regions):
     screen=next(x for x in menu['screens'] if x['id']==f'campaign-hub-{9+j}')
     nodes=next(x for x in screen['elements'] if x['id']=='regional-path')['nodes']
     target=output/slug;target.mkdir(exist_ok=True)
     out=[]
     for i,node in enumerate(nodes):
      race=node['raceRef']
      raw=g['decorate'](slug,Image.new('RGBA',(384,256)),nodes,race)
      sprite=raw.crop(raw.getbbox())
      w,h=sprite.size
      maxW,maxH=(144,104) if i==5 else (134,94)
      factor=min(maxW/w,maxH/h)
      sprite=sprite.resize((round(w*factor),round(h*factor)),Image.Resampling.NEAREST)
      w,h=sprite.size; a=Image.new('RGBA',(192,160));d=ImageDraw.Draw(a)
      shade,shale,rock,light=palette[j]
      rng=random.Random(slug+race)
      x=96-w//2;y=112-h
      # Shallow broken rock apron under the existing miniature, distinct per
      # location. No flat rectangle or auto-crop spill onto the atlas boundaries.
      t=min(61,max(26,w//2+6)); bx=96
      l=bx-t;r=bx+t
      apex=[(l-6,111),(l+rng.randrange(7,17),106),(bx-17,103),(bx+4,106),
           (r-rng.randrange(7,17),104),(r+6,112),(r-6,116),(bx+14,119),
           (bx-15,118),(l+4,116)]
      d.polygon([(u+1,v+3) for u,v in apex],fill=shade)
      d.polygon(apex,fill=shale)
      d.line(apex[:6],fill=rock)
      for k in range(9):
       xx=rng.randrange(l+3,r-2); yy=rng.randrange(112,117)
       d.line((xx,yy,xx+rng.randrange(1,5),yy),fill=rock if k%3 else light)
      # Original art is isolated unchanged before pixel-nearest enlargement.
      a.alpha_composite(sprite,(x,y))
      if any(t in race for t in ['Goosenecks','Valley of the Gods','Diamond Creek','Crest Highway']):
       d.point((l+1,108),fill=light);d.point((r-1,107),fill=light)
      bbox=a.getbbox(); assert 0<bbox[0]<bbox[2]<192 and 0<bbox[1]<bbox[3]<160
      path=target/(node['id']+'.png');a.save(path,optimize=True)
      out.append({'index':i,'nodeId':node['id'],'raceRef':race,'source':f'{slug}/{path.name}','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'size':[192,160],'anchor':[96,112],'alphaBounds':bbox})
      sheet.paste(a,(i*192,j*168),a)
      ImageDraw.Draw(sheet).text((i*192+5,j*168+145),node['id']+' '+race[:19],fill='white')
     assert len(out)==8 and len({p['sha256'] for p in out})==8;info[slug]=out
    sheet.save(output/'contact-west.png')
    (output/'manifest-west.json').write_text(json.dumps({'regions':info},indent=2)+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--menu',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    generate(args.menu,args.output)
