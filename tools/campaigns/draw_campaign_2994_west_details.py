"""Western 2994 campaign art, not routing. Exact menu/source pins and reference
notes live alongside the local integration receipt. Site layouts and 2994 ruins
are interpretive. The render is pixel-art, no text, roads, pins, or UI baked in.
"""
import math
from PIL import ImageDraw

W,H=384,256
INK='#262b3c'
RUST='#9e593d'
GLOW='#f5bd64'
ICE='#a8d2de'

def decorate(name,im,nodes):
    if name not in ('moki-dugway','oak-creek-canyon','angeles-crest'): return im
    assert im.size==(W,H)
    d=ImageDraw.Draw(im)
    refs={n['raceRef']:(round(W*n['x']),round(H*n['y'])) for n in nodes if n.get('raceRef')}
    def at(fragment,dx,dy):
        xy=next((v for k,v in refs.items() if fragment.lower() in k.lower()),None)
        if xy is None: raise ValueError(f'Missing west landmark race {fragment!r}')
        return xy[0]+dx,xy[1]+dy
    def p(pts,color): d.polygon(pts,fill=color)
    def L(pts,color,w=1): d.line(pts,fill=color,width=w)
    def rock(x,y,w,h,cols,pin=False):
        # Low stepped bench or tall freestanding mesa. Screen light from NW.
        a,b,c,hi=cols
        l=int(w*.49);r=w-l;z=max(4,int(w*.16))
        cap=[(x-l+4,y-h+z),(x-l+z,y-h+2),(x+2,y-h-1),
             (x+r-5,y-h+4),(x+r,y-h+z),(x+9,y-h+z+4),
             (x-8,y-h+z+3)]
        foot=[(x-l-4,y),(x-l-1,y-h+z),(x-l+4,y-h+z),(x-8,y-h+z+3),
              (x+9,y-h+z+4),(x+r,y-h+z),(x+r+4,y-1),(x+12,y+6),(x-7,y+7)]
        p([(u+4,v+3) for u,v in foot],INK);p(foot,a)
        p([cap[-2],cap[-3],(x+r+4,y-1),(x+12,y+6)],c)
        p(cap,b);L(cap[:5],hi)
        for k in range(1,max(2,h//7)):
            yy=y-k*6
            if yy<y-h+z+2: continue
            LL=[(x-l-2+k//2,yy-1),(x-8,yy+1),(x+8,yy+2),(x+r+1-k//2,yy-2)]
            L(LL,c);L(LL[:2],hi if k%2==0 else a)
        if pin:
            L([(x-l//2,y-h+z+1),(x-l//2,y-h-4)],INK)
            d.point((x-l//2,y-h-5),fill=GLOW)
    def narrow(x,y,w,h,cols):
        rock(x,y,w,h,cols)
        rock(x+(1 if w%2 else -1),y-h+8,max(8,w*2//3),max(7,h//4),cols)
    def tree(x,y,s=1,pine=True,oxide=False):
        if pine:
            d.line((x,y-8*s,x,y),fill='#494b47',width=s)
            p([(x,y-12*s),(x-3*s,y-5*s),(x-4*s,y-2*s),(x+4*s,y-2*s),
               (x+3*s,y-5*s)], '#294247' if not oxide else '#5a4748')
            L([(x,y-10*s),(x-2*s,y-6*s),(x-3*s,y-4*s)], '#96aaa0')
        else:
            L([(x,y-4*s),(x,y)],'#674735',s)
            d.ellipse((x-3*s,y-9*s,x+3*s,y-3*s),fill='#4f6a56' if not oxide else '#99654b')
            d.point((x-s,y-8*s),fill='#cbb78e')
    def cabin(x,y,w=15,h=9):
        p([(x-3,y+1),(x+w,y+1),(x+w+8,y+4),(x,y+5)],'#333944')
        p([(x,y-h),(x+w,y-h),(x+w,y),(x,y)],'#925e4a')
        p([(x+w,y-h),(x+w+5,y-h-4),(x+w+5,y-5),(x+w,y)],'#524447')
        p([(x-2,y-h),(x+5,y-h-8),(x+w+7,y-h-6),(x+w+1,y-h+1)],'#584a54')
        L([(x+5,y-h-8),(x+w+7,y-h-6)],'#d4ab89')
        d.rectangle((x+3,y-6,x+6,y-4),fill=GLOW)
        d.rectangle((x+w-4,y-6,x+w-3,y),fill='#493c46')
    def relay(x,y,h=21):
        L([(x-5,y),(x,y-h),(x+5,y),(x-3,y-7),(x+3,y-7),(x-2,y-13),(x+2,y-13)],INK)
        L([(x,y-h),(x,y+1)],'#aaa8a1')
        d.rectangle((x-1,y-h-2,x+1,y-h),fill='#ec855e')
    def fuel(x,y):
        cabin(x,y,13,8)
        L([(x-5,y-4),(x+14,y-4)],'#b38367',2)
        L([(x-4,y-4),(x-4,y+2)],INK)
        d.point((x+9,y-4),fill=GLOW)
    def struts(x,y,w=22,gone=False):
        L([(x-w//2,y+1),(x+w//2,y-5)],'#292e43',3)
        for q in (-7,0,7):
            if gone and q==0:continue
            L([(x+q,y-2),(x+q,y+6),(x+q+3,y+8)],'#313443',2)
        L([(x-w//2,y),(x+w//2,y-6)],'#e6bd89')
    def site_clock(x,y):
        d.arc((x-10,y-4,x+10,y+4),193,338,fill='#bcaf9d')
        for f in (2.95,3.5,4,4.8,5.45):
            u=x+round(11*math.cos(f));v=y+round(6*math.sin(f))
            d.rectangle((u,v-2,u+1,v),fill='#936f5d')
    if name=='moki-dugway':
        mesa=('#ac6345','#de9962','#6c4144','#eec18b')
        red=('#925450','#c77b60','#5e3b48','#e9ae84')
        dark=('#874d44','#b86e52','#573b4b','#d79870')
        # The broad Cedar Mesa table visibly dominates the dugway; farther
        # buttes sit as detached masses, not as copies of the same plateau.
        x,y=at('Moki Dugway',-23,-9);rock(x,y,55,31,mesa,True)
        rock(x-19,y-11,38,17,mesa);rock(x-7,y-19,30,12,mesa)
        x,y=at('Valley of the Gods',32,20);narrow(x-2,y,27,34,red)
        narrow(x+19,y+7,18,20,mesa);narrow(x+36,y+2,13,29,dark)
        x,y=at('Goosenecks',12,23)
        bow=[(x-36,y-2),(x-25,y-7),(x-12,y-6),(x-6,y-1),(x-13,y+4),(x-28,y+5),
             (x-37,y+9),(x-28,y+13),(x-7,y+12),(x+3,y+7),(x+16,y+6),(x+24,y+11)]
        L(bow,'#654442',12);L(bow,'#98705b',8);L(bow,'#637378',4);L(bow[-4:],ICE)
        x,y=at('Mexican Hat',-23,7);rock(x,y,13,25,dark);rock(x,y-21,20,5,mesa)
        x,y=at('Muley Point',-37,7);rock(x,y,28,15,mesa);site_clock(x,y-13)
        x,y=at('Comb Ridge',-23,-23)
        for i in range(5):rock(x-i*9,y+i*6,21+i,23-i,red)
        x,y=at('Burr Trail',18,7);rock(x,y,34,28,red);L([(x-9,y-20),(x-4,y-11),(x-7,y)],'#4a383e')
        x,y=at('Shafer Trail',-39,18);rock(x,y,33,19,dark)
        relay(x-12,y-12,18);cabin(x,y+4)
    elif name=='oak-creek-canyon':
        sedona=('#963f3f','#d9674e','#58353d','#f2ab83')
        sandstone=('#a64e3e','#e58a61','#623b45','#f6be90')
        cold=('#75576c','#9a8290','#453a58','#cfc1c0')
        x,y=at('Oak Creek Canyon',-28,2)
        for ox,oy,w,h in [(23,-22,38,26),(32,-7,22,13),(-3,-13,40,27),(-14,0,33,17)]:
            rock(x+ox,y+oy,w,h,sandstone)
        q=[(x-19,y-32),(x-22,y-18),(x-13,y-10),(x-9,y-1),(x-12,y+9),(x-31,y+13),(x-33,y+21)]
        L(q,'#513c42',10);L(q,'#b18276',7);L(q,'#548087',4)
        L(q[2:5],ICE);struts(x-15,y+2,16,True)
        for ox,oy,s in [(-27,-6,1),(6,2,1),(-21,16,1),(-41,18,1),(-17,-25,1)]:
            tree(x+ox,y+oy,s)
        x,y=at('SR 179',-27,-22)
        rock(x-9,y,37,21,sedona);narrow(x-16,y-11,24,22,sandstone);narrow(x+9,y-3,17,25,sedona)
        x,y=at('Red Rock Loop',-15,17);rock(x,y,35,17,sedona)
        for u,v in [(-13,4),(-7,7),(0,7),(5,11),(9,12)]:tree(x+u,y+v,1,False)
        cabin(x+12,y+8,11)
        x,y=at('Boynton Pass',-18,0);rock(x,y,23,18,sandstone);rock(x+8,y-12,14,16,sedona)
        x,y=at('Schnebly Hill',-18,22);rock(x,y,29,17,sandstone)
        x,y=at('Mingus',-23,-2);rock(x,y,34,28,cold)
        cabin(x-11,y-8,12);fuel(x+1,y-2)
        x,y=at('Diamond Creek',29,19)
        for i in range(3):rock(x+i*9,y+i*8,41-i*7,22-i*3,sedona)
        x,y=at('Attesa',-26,-8);fuel(x,y);relay(x-5,y-2,23)
    else:
        granite=('#706870','#aca9a0','#4b4d60','#dbd2ba')
        frost=('#617c94','#a5bfd2','#3b4d68','#e0eced')
        x,y=at('Angeles Crest Highway',19,-24)
        rock(x,y,66,31,frost);rock(x-13,y-15,47,24,granite);rock(x+18,y-10,30,21,granite)
        # Mount Wilson is a nearby Route 2 spur, not a new race node. Dome
        # over cylindrical base, slitted roof, small separate survey telescope.
        def dome(xx,yy,s):
            d.ellipse((xx-s-3,yy-3,xx+s+7,yy+4),fill=INK)
            d.rectangle((xx-s,yy-7,xx+s,yy),fill='#b1a99e')
            d.rectangle((xx+2,yy-7,xx+s,yy),fill='#797c89')
            d.pieslice((xx-s,yy-7-2*s,xx+s,yy-7+2*s),180,360,fill='#e6dbbf')
            d.line((xx+1,yy-6-2*s,xx+3,yy-7),fill='#626174',width=2)
            d.point((xx-4,yy-3),fill=GLOW)
        dome(x+5,y-24,10);dome(x-14,y-21,5);relay(x+22,y-16,19)
        x,y=at('Los Angeles, CA',-26,-9)
        # City Hall's tapered spire plus discrete basin silhouettes. Small,
        # not the centerpiece of the mountain board.
        for dx,dy,w,h in [(-23,-5,8,15),(-13,4,10,12),(-7,-5,7,17),(3,-1,10,11),(18,2,10,14),(25,-2,8,18),(36,3,7,9)]:
            u=x+dx;v=y+dy
            d.rectangle((u,v-h,u+w,v),fill='#776d82')
            p([(u,v-h),(u+4,v-h-3),(u+w+4,v-h-3),(u+w,v-h)],'#a49dab')
            L([(u+w,v-h),(u+w,v)],INK,2)
            for k in range(v-h+3,v,4):L([(u+1,k),(u+w-2,k)],'#cc9f73')
        for w,h,dy in [(10,16,0),(7,8,-16),(5,5,-24),(2,3,-29)]:
            d.rectangle((x+8-w//2,y+dy-h,x+8+w//2,y+dy),fill='#b8a990')
        x,y=at('Glendora Ridge',-15,-19);rock(x,y,37,27,granite)
        for dx,dy in [(-10,-5),(-5,2),(8,0),(18,5),(24,11)]:tree(x+dx,y+dy)
        x,y=at('Glendora Mountain',-24,15);rock(x,y,33,20,granite);fuel(x+16,y+2)
        x,y=at('Big Tujunga',-22,-10);rock(x,y,39,23,granite);struts(x-6,y)
        x,y=at('Little Tujunga',15,8);rock(x,y,28,19,granite);tree(x+9,y+3)
        x,y=at('Horse Thief Mile',-24,10);fuel(x,y);relay(x-4,y-1,18)
        x,y=at('Streets of Willow',9,13)
        for j in range(3):cabin(x+j*9,y-j*4,8,5)
    return im

