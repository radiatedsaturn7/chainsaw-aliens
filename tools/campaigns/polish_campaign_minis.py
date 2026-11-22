#!/usr/bin/env python3
"""Repaint priority landmarks and texture all 88 existing 192x160 campaign cells.

Usage: python polish_campaign_minis.py STAGED_ASSETS/CAMPAIGN_MAP_LANDMARKS OUTPUT
Use OUTPUT as --overrides in pack_campaign_map_layers.py; do not shade twice.
"""
from pathlib import Path
import argparse
import random
import re
from PIL import Image, ImageDraw

TILE=(192,160)
ICE={'providence','mount-washington','laurel-highlands','ohio-river','pikes-peak','angeles-crest'}
DRY={'route-66','moki-dugway','oak-creek-canyon'}
# Ground contacts use (96,112), identical to the existing atlas format.

class Pixel:
    def __init__(self):
        self.im=Image.new('RGBA',(96,80))
        self.d=ImageDraw.Draw(self.im)
    def plane(self, pts,c): self.d.polygon(pts,c)
    def rect(self, box,c): self.d.rectangle(box,c)
    def line(self,pts,c,w=1): self.d.line(pts,c,w)
    def dot(self,x,y,c): self.d.point((x,y),c)
    def ellipse(self,box,c): self.d.ellipse(box,c)
    def pine(self,x,y,h):
        self.plane([(x,y-h),(x-2,y-h+4),(x-1,y-h+4),(x-4,y-1),(x+3,y-1),(x+1,y-h+4),(x+2,y-h+4)],'#142e49')
        self.line([(x,y-h),(x-2,y-h+4),(x,y-h+3),(x-3,y-1)],'#93bfce')
        self.dot(x+1,y-2,'#36829c')
    def building(self,x,y,w,h,d,front='#859cac',side='#384d68',roof='#abc9d5'):
        self.plane([(x,y-h),(x+d,y-h-d),(x+w+d,y-h-d),(x+w,y-h)],roof)
        self.plane([(x+w,y-h),(x+w+d,y-h-d),(x+w+d,y-d),(x+w,y)],side)
        self.rect((x,y-h,x+w-1,y),front)
        self.line([(x,y-h),(x+w,y-h)],'#bfe0e9')
        self.line([(x,y-h+1),(x,y)],'#9fbacc')
        for yy in range(y-h+4,y-1,4):
            self.line([(x+1,yy),(x+w-1,yy)],'#69849b')
            for xx in range(x+2,x+w-1,4):
                self.rect((xx,yy,xx+1,yy+1), '#f5ab61' if (x+yy+xx)%9<2 else '#304866')
    def base(self):
        self.ellipse((10,47,85,65),(10,28,61,70))
        self.plane([(13,52),(18,47),(44,42),(71,44),(84,50),(83,55),(74,59),(48,62),(31,61),(20,58)],'#1f3a59')
        self.plane([(13,52),(18,47),(44,42),(71,44),(84,50),(76,56),(60,57),(44,59),(30,57),(20,56)],'#658ba9')
        self.line([(14,52),(31,55),(42,56),(53,55),(60,56),(75,53),(82,50)],'#a9d0e6')
    def done(self): return self.im.resize(TILE,Image.Resampling.NEAREST)

def boston():
    p=Pixel();p.base()
    p.plane([(13,52),(20,48),(53,45),(71,43),(84,50),(76,57),(56,59),(44,57),(32,56),(26,58)],'#264c74')
    for x,y,w in [(17,52,9),(23,55,8),(32,52,13),(45,56,9),(58,55,9),(68,52,9),(70,57,4)]:
        p.line([(x,y),(x+w,y-2)],'#85bccf')
        p.line([(x+1,y+1),(x+w-3,y)],'#477f9d')
    for x,y,w,h,d in [(26,44,9,14,3),(37,45,9,21,4),(49,46,9,24,3),(60,43,8,19,3),(72,46,7,14,3)]:
        p.building(x,y,w,h,d,'#4e6e89','#283d5c','#a1bed2')
    # Custom House tower; keep the clock conspicuously above the node.
    p.building(41,49,14,30,4,'#9db1bc','#455e73','#cce2e7')
    p.rect((40,13,55,23),'#c7d1c8')
    p.plane([(55,13),(59,11),(59,20),(55,23)],'#627a82')
    p.ellipse((43,13,53,23),'#303e52')
    p.ellipse((44,14,52,22),'#fff2bd')
    p.line([(48,15),(48,18),(50,20)],'#24344c')
    p.plane([(39,13),(45,5),(46,3),(51,3),(55,8),(57,13)],'#85bcc9')
    p.plane([(49,3),(55,13),(59,11),(52,3)],'#4c7892')
    p.line([(40,12),(46,3),(50,3)],'#def0ef')
    p.dot(48,2,'#ffc275')
    # Move the Zakim right and up, with contrasting cables over deep-blue water.
    deck=[(55,43),(64,40),(75,36),(85,33)]
    p.line(deck,'#20334f',5)
    p.line([(x,y-1) for x,y in deck],'#f2e6c5',2)
    for x,y,h in [(65,40,16),(77,36,18)]:
        p.line([(x-3,y+1),(x,y-7),(x,y-h)],'#e0ece9',2)
        p.line([(x+3,y+2),(x,y-7)],'#83adc2')
        for k in (-8,-5,5,8):
            p.line([(x,y-h+3),(x+k,y-round(k*.32)-1)],'#b6d3d9')
        p.dot(x,y-h-1,'#ffc47a')
    # Gold Massachusetts dome contrasts with Providence's white marble.
    p.building(31,51,10,6,2,'#998272','#544e67','#c6b3a7')
    p.ellipse((31,40,40,46),'#f1a04d')
    p.line([(32,42),(35,40),(38,40),(40,42)],'#ffdb8e')
    p.dot(36,39,'#fff0bf')
    return p.done()

def blue_hills():
    p=Pixel();p.ellipse((13,44,83,62),(8,23,54,63))
    p.plane([(17,54),(23,46),(32,41),(36,34),(43,31),(53,33),(63,41),(68,42),(78,52),(77,56),(65,59),(40,61),(25,58)],'#284763')
    p.plane([(17,54),(24,45),(33,42),(38,34),(44,32),(53,33),(50,38),(49,44),(41,45),(36,50),(33,49),(26,55)],'#83acbc')
    p.plane([(41,59),(46,52),(57,50),(63,44),(69,44),(68,48),(76,51),(72,56),(66,58),(56,60)],'#4e728c')
    p.line([(20,53),(26,48),(35,47),(41,44),(49,43),(52,42)],'#c6deea')
    for x,y,h in [(26,50,10),(32,54,8),(39,54,9),(46,58,7),(56,53,8),(61,48,9),(69,52,8),(75,55,6),(49,44,6),(30,44,4)]:
        p.pine(x,y,h)
    # Eliot Tower's local granite, flared foundation and squat lookout.
    p.plane([(36,40),(52,40),(55,37),(55,39),(49,43),(36,42)],'#293e56')
    p.building(39,39,12,15,4,'#8ba5b7','#415c75','#cfdee3')
    p.plane([(37,25),(41,20),(55,20),(57,23),(53,27),(37,27)],'#688496')
    p.line([(37,25),(41,20),(55,20)],'#d9e7e8')
    p.rect((38,24,52,26),'#b9d0df')
    for x in (39,45,51):
        p.rect((x,22,x+1,24),'#dee6e6')
    p.rect((44,30,46,33),'#334d60')
    p.dot(45,33,'#fac785')
    return p.done()

def ozark():
    p=Pixel()
    p.ellipse((13,51,83,70),(7,17,42,75))
    p.plane([(15,57),(22,53),(28,47),(32,34),(37,24),(48,19),(57,23),(65,28),(73,42),(78,53),(84,58),(76,66),(30,69)],'#334b65')
    p.plane([(15,57),(22,51),(29,49),(33,35),(38,25),(44,21),(49,20),(46,26),(40,33),(36,45),(34,56),(29,64)],'#ad9579')
    p.plane([(48,21),(57,23),(64,29),(71,42),(77,51),(69,55),(64,43),(60,35),(55,28),(48,27)],'#8092a0')
    p.plane([(30,60),(33,48),(37,39),(42,30),(48,27),(55,29),(61,36),(66,45),(69,56),(75,60),(68,65),(51,68),(40,65)],'#0a1836')
    p.line([(30,59),(33,47),(36,39),(42,29),(48,26),(55,27),(62,34),(67,44),(70,55)],'#ddd9bf',2)
    p.line([(36,45),(39,37),(46,32),(51,32),(60,37),(64,45),(66,54)],'#42698a')
    p.line([(40,42),(43,38),(46,36),(53,35),(58,38),(61,42)],'#244562')
    # Broken bedding planes, colder drainage and old mine survey beacons.
    for pts in [[(19,55),(24,55),(28,52)],[(23,59),(28,57),(31,58)],[(29,46),(32,46)],
                [(31,39),(36,37)],[(34,33),(37,32)],[(37,28),(43,26)],[(52,22),(56,24)],
                [(61,29),(66,34)],[(69,40),(71,42)],[(72,48),(76,51)],[(76,58),(81,58)]]:
        p.line(pts,'#f1b881' if pts[0][0]<37 else '#abc4ce')
    for x,y in [(31,56),(69,53)]:
        p.rect((x,y-2,x+1,y+2),'#2a4260');p.dot(x,y-2,'#ffc177')
    p.line([(40,62),(48,60),(56,61),(63,58),(74,61)],'#367699')
    p.line([(45,62),(53,62),(63,59),(69,60)],'#8cc2d2')
    for x,y,h in [(21,52,12),(24,55,7),(73,49,10),(80,57,13),(83,59,6),(16,57,8)]:
        p.pine(x,y,h)
    return p.done()

BESPOKE={('providence',2):blue_hills,('providence',7):boston,('ozarks',5):ozark}

def alley_spring():
    p=Pixel()
    p.ellipse((13,45,80,71),(7,22,55,68))
    p.plane([(13,53),(23,46),(38,45),(62,49),(78,53),(78,61),(67,67),(40,68),(26,62),(13,60)],'#2d687d')
    p.plane([(14,56),(21,51),(37,53),(43,62),(36,67),(25,62),(15,62)],'#347b92')
    for x,y,w in [(15,58,9),(25,64,11),(52,66,8),(66,61,10)]:
        p.line([(x,y),(x+w,y-2)],'#8abee0')
    p.plane([(23,53),(42,49),(68,52),(77,59),(59,64),(37,62),(29,59)],'#8298a3')
    p.building(39,56,22,20,10,'#9c5053','#613b50','#afa69e')
    # The landmark's bright red siding, pale windows and small waterwheel.
    for y in range(39,55,3):
        p.line([(39,y),(60,y)],'#aa655b')
        p.line([(61,y),(70,y-9)],'#754350')
    p.plane([(36,37),(49,25),(64,31),(63,39),(39,37)],'#83929a')
    p.plane([(49,25),(63,17),(75,26),(64,31)],'#a7b5b7')
    p.plane([(64,31),(75,26),(71,33),(63,39)],'#40526a')
    p.line([(36,37),(49,25),(63,17),(75,26)],'#dbe3dd',2)
    p.line([(49,25),(64,31),(63,39)],'#aebcc2')
    for x in (43,50,56):
        p.rect((x,41,x+2,45),'#d4cdb4');p.dot(x+1,44,'#e8b377')
    p.rect((48,49,53,56),'#37283f');p.line([(47,55),(48,48),(53,48)],'#dab497')
    p.ellipse((29,43,44,59),'#584459')
    p.ellipse((29,44,43,59),'#e9a771')
    p.ellipse((31,46,41,57),'#64495d')
    p.line([(30,51),(42,51)],'#ebb67d')
    p.line([(36,45),(36,58)],'#ebb67d')
    p.line([(32,47),(40,55)],'#aa785f')
    p.line([(33,55),(40,47)],'#aa785f')
    p.dot(36,51,'#fff1ac')
    for x,y,h in [(22,54,10),(70,55,9),(73,59,12)]: p.pine(x,y,h)
    return p.done()

BESPOKE[('ozarks',1)]=alley_spring

def clamp(v): return max(0,min(255,round(v)))

def finish(im,region,index,redrawn=False):
    """Local top-light and stable clustered pixels, never a global hue swap.

    Snow remains region-specific. Preserve transparent contact aprons without
    fading long bridges, terrain icons or the base of opaque architecture.
    """
    src=im.load()
    out=Image.new('RGBA',TILE)
    dst=out.load()
    rng=random.Random(region+str(index)+':detail')
    seeds=[[(rng.randrange(100),rng.randrange(100)) for _ in range(96)] for _ in range(80)]
    # Bigger broad-surface strata in addition to the two-pixel texture.
    strat=[rng.randrange(13) for _ in range(131)]
    icy=region in ICE
    dry=region in DRY
    for y in range(1,159):
        for x in range(1,191):
            r,g,b,a=src[x,y]
            if a<180:
                dst[x,y]=(r,g,b,a)
                continue
            n,m=seeds[y//2][x//2]
            l=.24*r+.61*g+.15*b
            rim=y>=2 and src[x,y-2][3]<100 and src[min(191,x+2),y][3]>180
            warmth=r>g+28 and r>b+24
            # Preserve deep architectural cavities and graded blue shadow.
            delta= (min(8,(l-54)*.14) if l>=54 else -min(5,(54-l)*.09))
            if not redrawn and 64<l<205:
                delta += (9 if n>84 else -8 if n<15 else 2 if n>75 else 0)
                # Short angled plate/facet seams break up otherwise flat expanses.
                k=(x//2+2*(y//2))//4
                if (y//2+x//15+strat[k])%13==0 and m>53:
                    delta += 12 if n>35 else -13
            if rim and l>57 and not warmth and m>23:
                delta += max(9,min(29,(163-l)*.26))
            if warmth:
                value=(r+delta+4,g+delta,b+delta-2)
            elif icy:
                value=(r+delta-1,g+delta+3,b+delta+6)
            elif dry:
                value=(r+delta+3,g+delta+2,b+delta+3)
            else:
                value=(r+delta,g+delta+2,b+delta+5)
            dst[x,y]=tuple(clamp(c) for c in value)+(a,)
    return out

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('atlases',type=Path);ap.add_argument('output',type=Path)
    args=ap.parse_args()
    sig=set()
    for atlas in sorted(args.atlases.glob('campaign-map-*.png')):
        region=re.sub(r'^campaign-map-','',atlas.stem)
        board=Image.open(atlas).convert('RGBA')
        assert board.size==(768,320), atlas
        for i in range(8):
            x,y=i%4*192,i//4*160
            path=args.output/region/f'stop-{i}.png'
            path.parent.mkdir(parents=True,exist_ok=True)
            painter=BESPOKE.get((region,i))
            tile=painter() if painter else board.crop((x,y,x+192,y+160))
            out=finish(tile,region,i,bool(painter))
            assert out.mode=='RGBA' and out.size==TILE
            l,t,r,b=out.getchannel('A').getbbox()
            assert 0<l<r<TILE[0] and 0<t<b<TILE[1]
            assert out.tobytes() not in sig
            sig.add(out.tobytes())
            out.save(path,optimize=True)
    assert len(sig)==88, len(sig)

if __name__=='__main__':
    main()
