"""Four campaign terrain backplates: fixed pixel art with ambient recovery scenes."""
from pathlib import Path
from PIL import Image, ImageDraw
import random
import math

SIZE=(384,256)
NAMES=('providence','mount-washington','laurel-highlands','ohio-river')
INK='#131c30'; AMBER='#f8b873'; CYAN='#78d6db'
# Lower contrast at middle keeps independently drawn roads/pins legible.
COLORS={
 'providence':('#0b1733','#314d78','#537aad','#75a4d2','#d7f2f9','#071b37','#224c76','#51a5da'),
 'mount-washington':('#10244e','#385389','#5479b4','#86b5e9','#e5f8fa','#0e2449','#355e98','#5793cb'),
 'laurel-highlands':('#142846','#324b5e','#49646b','#709b9c','#ccdfe5','#0c2642','#305e84','#53a2c4'),
 'ohio-river':('#142543','#3e526c','#596c83','#83a2b2','#dae7ec','#102342','#2c6092','#6cadd4'),
}

def band(d, top, bottom, color):
    d.polygon(top+bottom[::-1],fill=color)

def facet(d,points,colors,r):
    base,mid,high=colors
    d.polygon(points,base)
    x,y=points[0]
    p,q=points[1]
    a,b=points[-1]
    d.polygon([(x,y),(p,q),((x+p+a)//3+4,(y+q+b)//3),(a,b)],mid)
    d.line([points[-1],points[0],points[1]],fill=high,width=1)

# Tailored escarpments in world coordinates: bone ridge axes, not geometry in the road layer.
RELIEF={
 'providence':[(32,36,74,0,18,15),(121,70,176,3,16,24),(18,189,87,131,14,23),(194,244,274,148,17,29),(232,133,285,100,15,24)],
 'mount-washington':[(1,148,131,2,34,82),(43,123,234,12,33,100),(51,238,208,68,35,100),(164,177,336,-17,34,101),(212,254,374,100,37,82),(303,228,422,117,24,73)],
 'laurel-highlands':[(4,110,103,13,18,41),(38,238,229,32,24,50),(121,229,286,47,22,57),(164,288,345,107,28,54),(259,261,425,92,27,45)],
 'ohio-river':[(3,78,88,-4,20,31),(114,92,217,0,17,23),(230,89,326,11,17,24),(21,256,148,165,19,32),(176,256,279,181,18,27),(274,228,416,161,14,28)],
}

def rgb(c):return tuple(bytes.fromhex(c.lstrip('#')))

def terrain(im,r,name):
    dark,base,slope,ledge,snow,*_=COLORS[name]
    palette_by_region={
       'providence':(dark,'#1c355a','#2c4f7d',slope,'#7097bf','#abcfe6',snow),
       'mount-washington':(dark,'#1e3a71','#345890',slope,ledge,'#b0dbf6',snow),
       'laurel-highlands':(dark,'#243e53','#3a5961',slope,'#729293','#9abaad',snow),
       'ohio-river':(dark,'#273954','#3d526d',slope,'#7d98aa','#acc3c7',snow),
    }
    palettes=tuple(map(rgb,palette_by_region[name]))
    w,h=im.size
    noise=[]
    for i in (5,10,24,42,74,134):
       g=Image.new('L',(i,max(3,round(i*h/w))))
       g.putdata([r.randrange(256) for _ in range(g.width*g.height)])
       noise.append(g.resize(im.size,Image.Resampling.BILINEAR).load())
    T=[]
    for y in range(h):
       row=[]
       for x in range(w):
          land=0; wob=(noise[2][x,y]-128)*.13+(noise[3][x,y]-128)*.075
          for x1,y1,x2,y2,width,height in RELIEF[name]:
             dx,dy=x2-x1,y2-y1
             t=((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)
             t=max(0,min(1,t))
             dist=math.hypot(x-x1-t*dx,y-y1-t*dy)
             # Glacial triangular ridge on the main axis with shorter spur chipping.
             taper=.46+.54*math.sin(math.pi*(t*.86+.07))
             reach=max(0,1-(dist+wob)/width)
             land=max(land,height*taper*reach)
          row.append(land+noise[0][x,y]*.10+noise[1][x,y]*.055+noise[2][x,y]*.035+noise[3][x,y]*.035)
       T.append(row)
    p=im.load()
    for y in range(h):
       for x in range(w):
          q=T[y][x]
          sx=T[y][max(0,x-2)]-T[y][min(w-1,x+2)]
          sy=T[max(0,y-2)][x]-T[min(h-1,y+2)][x]
          lighting=-sx*.99-sy*.80
          crust=(noise[4][x,y]-128)*.010+(noise[5][x,y]-128)*.009
          value=2.45+(q-25)*.035+max(-2.35,min(2.45,lighting*.38))+crust
          if name=='mount-washington':value+=max(0,q-42)*.024
          if name in ('providence','ohio-river'):value-=.13
          k=max(0,min(6,math.floor(value+.10*((x+y)&1))))
          p[x,y]=palettes[k]
    d=ImageDraw.Draw(im)
    for _ in range(1200):
       x,y=r.randrange(2,w-6),r.randrange(2,h-4)
       c=p[x,y]; k=palettes.index(c)
       if k<2 or r.random()<.25:continue
       ox,oy=x+r.choice((1,2,3)),y+r.choice((-1,-1,0,1))
       # Crystalline broken snow grains, mostly in two-color groups.
       f=1+int(r.random()<.15)
       d.line((x,y,ox,oy),fill=palettes[min(6,k+f)])
       if (x+y)%3==1:d.point((x,y+1),fill=palettes[max(0,k-1)])

def water(d,r,kind,p):
    dark,base,slope,ledge,snow,water0,water1,water2=p
    if kind=='providence':
        left=[(300,0),(315,25),(295,38),(300,52),(324,63),(321,77),(299,85),(294,99),(306,112),(280,123),(284,139),(306,151),(300,163),(269,178),(276,190),(300,197),(316,215),(305,226),(325,243),(325,255)]
        right=[(383,y) for _,y in left]
        islands=[]
    elif kind=='ohio-river':
        left=[(0,101),(36,93),(67,87),(121,98),(158,110),(192,120),(211,113),(243,86),(264,80),(300,90),(337,107),(383,103)]
        right=[(x,y+34+(x%11)) for x,y in left]; islands=[]
    elif kind=='laurel-highlands':
        left=[(27,0),(42,29),(43,56),(31,83),(44,106),(58,127),(60,145),(47,167),(48,194),(85,255)]
        right=[(x+6+(y%7),y) for x,y in left]; islands=[]
    else:return
    band(d,left,right,water0)
    # Stepped submerged bands. Tiny directional surfaces look like moving water,
    # not a second route: no band holds a luminous edge for its entire length.
    opaque=rgb(water0)
    for _ in range(1900 if kind!='laurel-highlands' else 400):
        x,y=r.randrange(2,378),r.randrange(2,254)
        if d._image.getpixel((x,y))!=opaque:continue
        m=r.randrange(1,6)
        for k in range(m):
            x1,y1=x+k,y-r.choice((0,0,1))
            if d._image.getpixel((x1,y1))==opaque:
                d.point((x1,y1),r.choice(('#102d4e','#133655','#194365')) if k==0 else '#102b4d')
    for bank in (left,) if kind=='providence' else (left,right):
        for (x,y),(a,b) in zip(bank,bank[1:]):
            steps=max(abs(a-x),abs(b-y))
            for i in range(0,steps,r.choice((2,3,4))):
                t=i/steps
                u,v=round(x+(a-x)*t),round(y+(b-y)*t)
                for _ in range(r.randrange(1,4)):
                    ox,oy=r.randrange(-4,5),r.randrange(-3,4)
                    d.point((u+ox,v+oy),r.choice((water1,water2,'#94c9e6','#daeaf2')))
    if kind=='providence':
        d.line(left,fill=water2,width=2)
        d.line([(x+6,y) for x,y in left],fill=water1,width=2)
        for x,y,a,b in [(344,12,25,18),(375,32,20,16),(346,65,22,15),(371,82,15,15),(330,99,19,14),(358,110,30,19),(378,137,20,16),(355,210,22,16),(374,238,24,18),(350,242,15,10)]:
            q=[(x,y-b//2),(x+7,y-b),(x+a-3,y-b+2),(x+a,y-3),(x+a-4,y+2),(x+3,y)]
            d.polygon([(a,b+5) for a,b in q],fill='#234e7d')
            d.polygon(q,fill='#7ba8d5',outline='#b3d8ed')
            d.line([q[1],q[2],q[3]],fill='#d2ebf5')
            d.line([q[0],q[-1],q[-2]],fill='#477fb4')
            for _ in range(a):
                xx,yy=x+r.randrange(5,max(6,a-4)),y-r.randrange(2,max(3,b-4))
                if d._image.getpixel((min(383,xx),yy))==rgb('#7ba8d5'):
                    d.point((xx,yy),r.choice(('#92bde0','#acceea','#6fa0ce')))
        for (x,y),(a,b) in zip(left,left[1:]):
            for j in range(0,5):
                f=j/5
                u,v=round(x+(a-x)*f),round(y+(b-y)*f)
                d.point((u+r.randrange(-1,5),v),r.choice((water2,'#90d9ed','#d9f4f9')))
                if r.random()<.65:d.point((u+r.randrange(4,11),v+1),water1)
    else:
        d.line(left,fill=water2,width=2);d.line(right,fill=water2,width=2)
    # Fjordlike broken ice edge and detached, small angular floes.
    if kind in ('providence','ohio-river'):
        for _ in range(110 if kind=='providence' else 35):
            x,y=r.randrange(384),r.randrange(256)
            if d._image.getpixel((x,y))!=opaque:continue
            a,b=r.randrange(2,9),r.randrange(2,5)
            if x+a>=384 or y+b>=256 or any(d._image.getpixel(t)!=tuple(bytes.fromhex(water0[1:])) for t in ((x+a,y),(x+a,y+b),(x,y+b))):continue
            d.polygon([(x,y+1),(x+2,y),(x+a,y+1),(x+a,y+b-1),(x+a//2,y+b),(x+1,y+b-1)],fill=r.choice((water1,water2,'#7ea4d0')))
            if a>=5:d.line((x+2,y,x+a-2,y),fill='#acd3e7')
    # Stagger short ice and wave pixel seams; no long strokes like tracks.
    for _ in range(220):
        x,y=r.randrange(384),r.randrange(256)
        if d._image.getpixel((x,y))!=opaque:continue
        size=r.randrange(2,11)
        for m in range(size):
            if x+m<384 and d._image.getpixel((x+m,y))==tuple(bytes.fromhex(water0[1:])):
                d.point((x+m,y),fill=water1 if m else water2)

def pine(d,x,y,k):
    grays=('#1e312f','#344842','#536457') if not k else ('#213a44','#3e565d','#9cb1ac')
    d.polygon([(x,y-7),(x-3,y-2),(x-2,y-2),(x-5,y+3),(x+5,y+3),(x+2,y-2),(x+3,y-2)],grays[0])
    d.line([(x,y-5),(x-2,y),(x+1,y-1)],grays[1]);d.point((x-2,y+1),grays[2])
    d.line((x,y+3,x,y+5),INK)

def building(d,x,y,w,h,body,top,open_walls=False):
    d.polygon([(x,y),(x+w+4,y),(x+w+12,y+5),(x+w+8,y+7),(x+8,y+7)],INK)
    d.rectangle((x,y-h,x+w,y),fill=body,outline=INK)
    d.polygon([(x+w,y-h),(x+w+6,y-h-4),(x+w+6,y-5),(x+w,y)],'#202a3b')
    d.polygon([(x,y-h),(x+6,y-h-4),(x+w+6,y-h-4),(x+w,y-h)],top)
    for xx in range(x+2,x+w-1):
        for yy in range(y-h+1,y):
            if (xx*13+yy*33)%29<3:d.point((xx,yy),'#ae8d85')
    d.line((x+1,y-2,x+w-2,y-2),'#3f394c')
    if open_walls:
        for i in range(x+3,x+w-2,5):d.rectangle((i,y-h+3,i+2,y-2),fill=INK)
        for i in range(x+2,x+w-3,4):
            d.point((i,y-h+2),AMBER)
            if i%3:d.point((i,y-3),'#d27c5c')
    else:
        for i in range(x+3,x+w-2,6):
            d.line((i,y-h+4,i+2,y-h+4),CYAN if i%4<2 else '#7b8890')

def worker(d,x,y,towards=1):
    # Little visible machine: rear treads, pale hard shell, eye, torque arm and spark.
    d.rectangle((x-4,y+2,x+4,y+4),INK)
    d.rectangle((x-3,y+2,x+3,y+3),'#526777')
    d.rectangle((x-3,y-3,x+2,y+1),'#4c6875',INK)
    d.line((x-1,y-3,x+2,y-3),'#b0d2cd')
    d.point((x+1,y-1),CYAN)
    d.line([(x+towards*2,y),(x+towards*5,y-4),(x+towards*8,y-3)],AMBER,1)
    d.point((x+towards*9,y-3),'#fff2b9')
    d.point((x+towards*8,y-5),AMBER)

def recovery(d,x,y,kind,mini=False):
    hues={
      'providence':('#705752','#bd8571'),
      'mount-washington':('#566978','#9ab4be'),
      'laurel-highlands':('#685548','#a0795b'),
      'ohio-river':('#78584a','#b48d68'),
    }
    body,top=hues[kind]
    building(d,x,y,24 if not mini else 19,16 if not mini else 11,body,top,True)
    building(d,x+28,y+6,17,10,body,top)
    if not mini:
        d.line([(x+13,y-20),(x+13,y-34),(x+38,y-34),(x+14,y-19)],fill=INK,width=3)
        d.line([(x+13,y-20),(x+13,y-34),(x+38,y-34)],fill='#aa866f')
        d.line((x+33,y-34,x+33,y-16),fill='#cfaa75')
        d.rectangle((x+30,y-16,x+36,y-13),'#6e7882')
    for ox,oy,side in [(-9,4,1),(20,10,-1),(53,4,-1)]:
        worker(d,x+ox,y+oy,side)

def render(name):
    p=COLORS[name];r=random.Random('2994-eastern-mapstyle-2:'+name)
    im=Image.new('RGB',SIZE,p[1]);d=ImageDraw.Draw(im)
    terrain(im,r,name)
    water(d,r,name,p)
    pine_centers={
      'providence':[(18,66,28),(98,218,37),(242,20,20)],
      'mount-washington':[(17,219,29),(338,199,42),(41,129,27),(374,87,14)],
      'laurel-highlands':[(14,49,38),(89,44,48),(154,20,37),(314,57,37),(295,211,51),(103,206,45),(204,239,31)],
      'ohio-river':[(32,37,26),(317,49,30),(66,224,28),(351,215,24)],
    }
    for cx,cy,spr in pine_centers[name]:
        pts=[]
        for _ in range(spr):
            x=round(r.gauss(cx,15)); y=round(r.gauss(cy,8))
            if 5<x<379 and 8<y<250 and not any((x-a)**2+(y-b)**2<26 for a,b in pts):pts.append((x,y))
        for x,y in sorted(pts,key=lambda q:q[1]):pine(d,x,y,name=='mount-washington')
    # Pockets from sampled authored road splines across portrait and wide projections.
    # Building coordinates are top-of-origin shadows outside the driving corridor.
    placements={
      'providence':[(121,49),(308,203)],
      'mount-washington':[(25,160),(306,53)],
      'laurel-highlands':[(300,52),(7,126)],
      'ohio-river':[(24,201),(294,201)],
    }
    if name=='providence':
        # Tide-eaten repair piers supporting the remaining shoreline installations.
        for x,y,a,b in [(304,187,355,205),(320,146,370,177)]:
            d.polygon([(x,y),(a,y),(a+6,b-3),(x+7,b)],fill='#263850',outline='#517389')
            for j in range(x+3,a,8):
                d.line((j,b-2,j,b+3),fill='#a28b7f')
            for j in range(y+1,b-2,4):
                d.line((x+5,j,a-2,j-1),fill='#34516a')
    for i,(x,y) in enumerate(placements[name]):recovery(d,x,y,name,bool(i))
    # Distinct regional remains farther outside the corridor than the repaired sites.
    extra={
      'providence':[(325,166,9,27),(336,169,12,24),(350,173,10,36),(328,183,19,15)],
      'mount-washington':[(8,205,12,15),(23,207,7,20),(33,210,16,11)],
      'laurel-highlands':[(319,88,10,29),(331,89,10,29),(343,93,20,17)],
      'ohio-river':[(38,230,10,31),(51,232,13,23),(66,234,14,18)],
    }
    for x,y,w,h in extra[name]:
       building(d,x,y,w,h,'#594554','#a58382',True)
       d.point((x+1,y-h+1),'#ffdfa1')
    return im

def main(output):
    output.mkdir(parents=True,exist_ok=True)
    sheet=Image.new('RGB',(768,512))
    for i,name in enumerate(NAMES):
        im=render(name)
        im.save(output/f'campaign-map-{name}.png',optimize=True)
        sheet.paste(im,(i%2*384,i//2*256))
    sheet.save(output/'east-contact.png',optimize=True)

if __name__=='__main__':
    import sys
    main(Path(sys.argv[1]))
