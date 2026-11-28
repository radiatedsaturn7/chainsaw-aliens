"""Four campaign terrain backplates: fixed pixel art with ambient recovery scenes."""
from pathlib import Path
from PIL import Image, ImageDraw
import random

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

def topo(d,r,kind,p,land):
    dark,base,slope,ledge,snow,_,_,_=p
    if kind=='providence':
        # Atlantic-facing, low broken drumlins and rocky coastline.
        strips=[[(0,16),(75,0),(169,23),(231,13),(270,30),(336,27)],
          [(0,62),(55,41),(103,59),(164,52),(204,73),(270,54),(352,59)],
          [(0,190),(65,164),(110,179),(167,167),(219,189),(287,172),(345,187)]]
    elif kind=='mount-washington':
        # Presidential Range: large angular slabs, ice on the ridgeline and northern faces.
        strips=[[(0,85),(45,47),(74,53),(125,18),(147,32),(194,1),(222,21),(244,6),(277,34),(316,18),(383,29)],
          [(0,149),(32,135),(65,103),(101,111),(135,67),(169,64),(199,29),(220,54),(250,25),(293,64),(324,52),(383,66)],
          [(0,232),(41,209),(72,224),(115,184),(145,183),(164,162),(199,178),(219,144),(260,155),(285,128),(335,141),(383,126)]]
    elif kind=='laurel-highlands':
        # Long Allegheny fold-forest fingers; no alpine snow across these greener heights.
        strips=[[(0,61),(49,38),(75,15),(152,0),(235,0),(220,10),(170,29),(120,43),(70,75),(0,94)],
          [(0,137),(48,111),(105,119),(151,86),(233,72),(286,48),(342,39),(383,22)],
          [(0,240),(68,192),(105,192),(154,167),(221,151),(250,127),(313,127),(383,83)],
          [(142,255),(172,225),(222,221),(264,197),(332,178),(383,146)]]
    else:
        # Ohio shore terraces: broad opposing low floodplains instead of mountains.
        strips=[[(0,7),(51,9),(104,17),(170,10),(207,31),(263,23),(323,36),(383,24)],
          [(0,41),(53,54),(112,46),(181,63),(223,51),(282,69),(353,59),(383,67)],
          [(0,198),(57,185),(114,199),(171,181),(238,196),(272,181),(326,190),(383,169)]]
    offsets=(27,42,36,24)
    for index,strip in enumerate(strips):
        facets=strip
        strip=[]
        for (x,y),(a,b) in zip(facets,facets[1:]):
            steps=max(1,(a-x)//7)
            for j in range(steps):
                f=j/steps
                strip.append((round(x+(a-x)*f),round(y+(b-y)*f)+r.choice((-2,-1,0,0,1,2,3))))
        strip.append(facets[-1])
        bottom=[(x,y+offsets[index]+r.randrange(-5,6)) for x,y in strip]
        band(d,strip,bottom,dark); band(d,strip,[(x,y+(by-y)*2//3) for (x,y),(_,by) in zip(strip,bottom)],slope)
        for (x,y),(a,b) in zip(strip,strip[1:]):
            if r.random()<.82:
                d.line([(x,y),(a,b)], fill=r.choice((ledge,ledge,ledge,snow)), width=r.choice((1,1,2)))
        for j in range(0,len(facets)-1,2):
            x,y=facets[j]; a,b=facets[j+1]
            if a<=x:continue
            m=(x+a)//2
            d.polygon([(x,y),(a,b),(m,(y+b)//2+15),(m+7,(y+b)//2+4)],fill=ledge)
            if kind=='mount-washington' and index<2:
                d.polygon([(x,y),(a,b),(m,(y+b)//2+10),(m+3,(y+b)//2+2)],fill=snow)
            if kind in ('providence','mount-washington'):
                d.line([(x+2,y+3),(m,(y+b)//2+3)],fill=snow,width=1)
    # Small discontinuous frost fields are discrete colors over the base polygons.
    for _ in range(140):
        x,y=r.randrange(384),r.randrange(256)
        if name_frost(kind,x,y,r):
            w,h=r.randrange(3,13),r.randrange(2,6)
            d.polygon([(x,y),(x+w-2,y-1),(x+w,y+h-2),(x+2,y+h),(x-1,y+1)],fill=r.choice((base,slope,ledge)))
            if r.random()<.3:d.line((x,y,x+w//2,y-1),fill=snow)
    # Sparse angled terraces and two-color pixel clusters (real discrete pixels, not gradients).
    for _ in range(290):
        x,y=r.randrange(384),r.randrange(256)
        if not land(x,y):continue
        w=r.choice((2,3,4,6,9))
        c=r.choice((dark,base,slope,slope,ledge))
        d.line([(x,y),(x+w,y-r.choice((0,1,2)))],fill=c)
        if w>=6:d.point((x+1,y+1),fill=dark)

def name_frost(kind,x,y,r):
    if kind=='providence':return x>225 or r.random()<.5
    if kind=='mount-washington':return y<172 or r.random()<.6
    if kind=='laurel-highlands':return r.random()<.45
    return r.random()<.7

def water(d,r,kind,p):
    dark,base,slope,ledge,snow,water0,water1,water2=p
    if kind=='providence':
        left=[(300,0),(315,25),(295,38),(300,52),(324,63),(321,77),(299,85),(294,99),(306,112),(280,123),(284,139),(306,151),(300,163),(269,178),(276,190),(300,197),(316,215),(305,226),(325,243),(325,255)]
        right=[(383,y) for _,y in left]
        islands=[[(340,122),(361,118),(375,128),(370,141),(357,150),(342,142)],
                 [(330,195),(350,191),(363,200),(353,211),(335,210)]]
    elif kind=='ohio-river':
        left=[(0,101),(36,93),(67,87),(121,98),(158,110),(192,120),(211,113),(243,86),(264,80),(300,90),(337,107),(383,103)]
        right=[(x,y+34+(x%11)) for x,y in left]; islands=[]
    elif kind=='laurel-highlands':
        left=[(27,0),(42,29),(43,56),(31,83),(44,106),(58,127),(60,145),(47,167),(48,194),(85,255)]
        right=[(x+6+(y%7),y) for x,y in left]; islands=[]
    else:return
    band(d,left,right,water0)
    if kind=='providence':
        d.line(left,fill=water2,width=2)
        d.line([(x+6,y) for x,y in left],fill=water1,width=2)
        for q in islands:d.polygon(q,fill=base,outline=water2)
    else:
        d.line(left,fill=water2,width=2);d.line(right,fill=water2,width=2)
    # Fjordlike broken ice edge and detached, small angular floes.
    if kind in ('providence','ohio-river'):
        for _ in range(110 if kind=='providence' else 35):
            x,y=r.randrange(384),r.randrange(256)
            if d._image.getpixel((x,y))!=tuple(bytes.fromhex(water0[1:])):continue
            a,b=r.randrange(2,9),r.randrange(2,5)
            if x+a>=384 or y+b>=256 or any(d._image.getpixel(t)!=tuple(bytes.fromhex(water0[1:])) for t in ((x+a,y),(x+a,y+b),(x,y+b))):continue
            d.polygon([(x,y+1),(x+2,y),(x+a,y+1),(x+a,y+b-1),(x+a//2,y+b),(x+1,y+b-1)],fill=r.choice((water1,water2,'#7ea4d0')))
            if a>=5:d.line((x+2,y,x+a-2,y),fill='#acd3e7')
    # Stagger short ice and wave pixel seams; no long strokes like tracks.
    for _ in range(220):
        x,y=r.randrange(384),r.randrange(256)
        if d._image.getpixel((x,y))!=tuple(bytes.fromhex(water0[1:])):continue
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
    if open_walls:
        for i in range(x+3,x+w-2,5):d.rectangle((i,y-h+3,i+2,y-2),fill=INK)
        d.line((x+2,y-h+2,x+w-2,y-h+2),AMBER)
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
    topo(d,r,name,p,lambda x,y: True)
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
    placements={'providence':[(23,94),(234,214)],'mount-washington':[(24,216),(304,119)],
                'laurel-highlands':[(70,92),(290,230)],'ohio-river':[(31,69),(291,178)]}
    # Regional industrial settlement silhouettes: mill chimneys at the frozen
    # Atlantic shore, hydro intake in the wooded hills, foundry at the Ohio bend.
    if name=='providence':
        for x,y,w,h in [(265,97,12,29),(281,99,7,40),(245,96,11,18),(258,110,17,19),(274,115,9,11)]:
            building(d,x,y,w,h,'#553c48','#a47d78',True)
    if name=='laurel-highlands':
        for x,y,w,h in [(85,215,9,23),(97,218,14,17),(120,217,9,27)]:
            building(d,x,y,w,h,'#524645','#947f71',True)
    if name=='ohio-river':
        for x,y,w,h in [(268,68,10,32),(280,70,12,27),(296,73,22,17),(322,74,8,24)]:
            building(d,x,y,w,h,'#694748','#b48271',True)
    for i,(x,y) in enumerate(placements[name]):recovery(d,x,y,name,bool(i))
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
