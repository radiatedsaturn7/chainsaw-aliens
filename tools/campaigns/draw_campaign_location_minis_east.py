"""Adapt exact staging 980a99fa eastern attraction drawing primitives into transparent minis."""
from pathlib import Path
from PIL import Image, ImageDraw
from random import Random
import argparse
import textwrap,json,hashlib
import draw_campaign_2994_east_details as east
import draw_campaign_2994_providence as prov

here=Path(__file__).parent
W,H=192,160
SOURCE_SIZE=(420,280)
REGION={
 'providence':['Tower Hill Road','RI 116','Blue Hills','Pachaug','Putnam Pike','Providence','Thompson','Boston'],
 'mount-washington':['Kancamagus Highway','Team O’Neil','Bear Notch','Hurricane Mountain','Pinkham Notch','Mount Washington','Club Motorsports','Smugglers Notch'],
 'laurel-highlands':['Brandywine Valley','Normalville Champion','Forbes State Forest','Chalk Hill Summit','Seven Springs','Laurel Highlands Scenic Byway','Pitt Race','Philadelphia'],
 'ohio-river':['Barlow','Western Covered Bridge Loop','OH 26 Covered Bridge Scenic Byway','OH 536 Ohio River Hills','Triple Nickel','Ohio River Crossing','Mid-Ohio Sports Car Course','Charleston WV'],
}
SRC=here/'draw_campaign_2994_east_details.py'
MARKERS={
'mount-washington':['# NH 112:', '# Dalton:', "# Bear Notch", "# Hurricane Mountain", "# Pinkham Notch", "# Summit:", "# Tamworth:", "# Vermont 108:"],
'laurel-highlands':['# Montchanin:', '# Normalville/Champion:', '# Forbes Forest', '# Chalk Hill', '# Seven Springs:', '# Laurel boss:', '# Pitt Race:', '# Philadelphia:'],
'ohio-river':['# Barlow:', '# Western Washington', '# The SR 26', '# Monroe County:', "# Triple Nickel", '# Ohio/Muskingum', '# Lexington:', '# Charleston WV'],
}

def snippet(src,start,end):
    a=src.rfind('\n',0,src.index(start))+1
    b=src.rfind('\n',0,src.index(end,a+1))+1
    return textwrap.dedent(src[a:b]).rstrip()

def small_east(name,i):
    im=Image.new('RGBA',SOURCE_SIZE)
    q=east.Painter(im,f'{name}-{i}')
    def xy(_,dx=0,dy=0):return 192+dx,130+dy
    if name=='mount-washington' and i==5:
        # An exposed, sprawling peak rather than a generic mountain cabin.
        # Observatory/Tip Top House silhouette occupies the wind-scoured crown.
        q.p([(157,135),(166,126),(177,121),(184,111),(195,106),(205,105),
             (216,112),(225,117),(239,132),(233,138),(201,146),(177,143)],east.MID)
        q.p([(158,135),(166,128),(177,121),(185,111),(195,106),(205,106),
             (206,113),(196,112),(189,120),(184,118),(174,130)],east.SNOW)
        q.p([(211,115),(224,120),(237,132),(229,133),(222,127),(214,126)],east.DEEP)
        q.l([(177,129),(185,128),(189,125),(194,125)],east.ICE,2)
    marker=MARKERS[name][i]
    stop=MARKERS[name][i+1] if i<7 else {
        'mount-washington':"elif name=='laurel-highlands':",
        'laurel-highlands':"    else:",
        'ohio-river':"    return im",
    }[name]
    src=SRC.read_text()
    exec(snippet(src,marker,stop),{**vars(east),'q':q,'xy':xy})
    return im

def prov_draw(i):
    im=Image.new('RGBA',SOURCE_SIZE)
    src=(here/'draw_campaign_2994_providence.py').read_text()
    base=snippet(src,"d=ImageDraw.Draw(im)","# Boston: frozen Charles")
    if i==5:
        body=snippet(src,"# Providence: dome on Smith Hill","# 2994: half")
    elif i==7:
        body=snippet(src,"# Boston: frozen Charles","# Providence: dome")
    elif i in (1,3):
        q=east.Painter(im,f'reservoir-{i}')
        if i==1:
            # Scituate: a long, branchy reservoir backed by the dam/old intake.
            q.ice(184,129,32,13)
            q.ice(197,117,19,7)
            q.l([(192,133),(204,126),(218,122)],east.DEEP,4)
            q.l([(191,131),(204,124),(218,121)],east.SNOW,2)
            q.prism(204,125,8,14,east.STONE,4)
            q.spruce(166,116,9);q.spruce(159,122,12)
        else:
            # Pachaug Green Falls: small glacial lake, rock ledges and fingers of spruce.
            q.ice(186,128,24,10)
            q.falls(203,129,16)
            for x,y in [(170,113),(164,123),(158,127),(186,117),(196,113),(211,119)]:q.spruce(x,y,10)
            q.ridge(205,135,11,5)
        return im
    else:
        body=snippet(src,"# Landmark vignettes","return im")
    ns={**vars(prov),'im':im,'nodes':[{'id':f'stop-{i}','raceRef':REGION['providence'][i],'x':.50,'y':.50}]}
    exec(base+'\n'+body,ns)
    return im

def final(im,name,node_index):
    bbox=im.getbbox()
    if not bbox: raise ValueError((name,node_index,'blank'))
    cropped=im.crop(bbox)
    # Uniform transparent format, origin near the visual ground contact. Hero
    # silhouettes have slightly greater reach, without running up to atlas edges.
    limit=(140,100) if node_index==5 or (name=='providence' and node_index==7) else (123,82)
    s=min(limit[0]/cropped.width,limit[1]/cropped.height)
    # Nearest neighbour preserves the hand-painted pixel character.
    cropped=cropped.resize((round(cropped.width*s),round(cropped.height*s)),Image.Resampling.NEAREST)
    rgba=Image.new('RGBA',(W,H))
    # Stylized translucent shadow falls behind the ground contact and is never a pin.
    d=ImageDraw.Draw(rgba)
    width=round(cropped.width*.62)
    d.ellipse((96-width//2,108,96+width//2,117),fill=(20,38,56,53))
    d.ellipse((99-width//2,109,97+width//2,115),fill=(13,27,47,61))
    rgba.alpha_composite(cropped,(96-cropped.width//2,112-cropped.height))
    return rgba

def main(menu, output):
    output.mkdir(parents=True,exist_ok=True)
    refs=[]
    sheet=Image.new('RGBA',(8*192,4*176),(143,169,188,255))
    screens=json.loads(menu.read_text())['screens']
    pinned=[{'id':s['id'],'element':e} for s in screens for e in s['elements']
            if e.get('property')=='campaign-path']
    for j,(name,races) in enumerate(REGION.items()):
        region=next(x for x in pinned if x['id']==f'campaign-hub-{j+1}')
        ordered=[n for n in region['element']['nodes'] if n.get('raceRef')]
        assert {n['id'] for n in ordered}=={f'stop-{i}' for i in range(8)}
        p=output/name
        p.mkdir(exist_ok=True)
        for slot,n in enumerate(ordered):
            i=int(n['id'].split('-')[-1])
            race=races[i]
            im=final(prov_draw(i) if j==0 else small_east(name,i),name,i)
            f=p/f'stop-{i}.png'
            im.save(f,optimize=True)
            refs.append(dict(region=name,id=f'stop-{i}',file=str(f.relative_to(output)),sourceCue=race,raceRef=n['raceRef'],savedOrder=slot,anchor=[96,112],size=[W,H],sha256=hashlib.sha256(f.read_bytes()).hexdigest()))
            assert im.mode=='RGBA' and im.size==(W,H) and im.getpixel((0,0))[3]==0 and im.getbbox()
            sheet.alpha_composite(im,(192*slot,176*j))
            ImageDraw.Draw(sheet).text((192*slot+7,176*j+147),f'{j+1}:{i} {race[:19]}',fill='#162a46')
    assert len({r['sha256'] for r in refs})==32
    sheet.convert('RGB').save(output/'contact-east.jpg',quality=88)
    (output/'manifest-east.json').write_text(json.dumps(refs,indent=2)+'\n')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--menu',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    main(args.menu,args.output)
