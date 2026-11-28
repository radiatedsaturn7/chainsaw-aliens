"""Research-driven silhouettes for the Providence/Boston campaign board.

References: Rhode Island Secretary of State (State House), GoProvidence
(Industrial Trust), Providence Parks (Waterplace); Boston National Historical
Park (Old North), Massachusetts Legislature (State House), Boston Public Works
(North Washington Street Bridge public-hearing photos). Fictional 2994 layers
are based on the frozen skyline, Tower Hill lab, signal lamps and buried
infrastructure motifs of the game, not represented as existing landmarks.
"""
from PIL import ImageDraw
from random import Random

INK='#172640'
SNOW='#e0edf1'
ICE='#9bbecb'
GLASS='#4c879a'
SHADOW='#374b60'
GLOW='#ffd589'
BRICK='#815b5a'
MASON='#a5a9ae'

def decorate(name, im, nodes):
    d=ImageDraw.Draw(im)
    rng=Random('providence-2994')
    def p(points,col): d.polygon(points,fill=col)
    def line(q,c,w=1): d.line(q,fill=c,width=w)
    def rect(a,c): d.rectangle(a,fill=c)
    def oval(a,c): d.ellipse(a,fill=c)
    def wall(x,y,w,h,dep=5,stone=MASON,roof=ICE):
        p([(x-4,y),(x+w,y-dep),(x+w+dep+8,y+3),(x+dep+2,y+7)],'#526e84')
        p([(x,y-h),(x+w,y-h),(x+w,y),(x,y+1)],stone)
        p([(x+w,y-h),(x+w+dep,y-h-dep),(x+w+dep,y-dep),(x+w,y)],SHADOW)
        p([(x,y-h),(x+dep,y-h-dep),(x+w+dep,y-h-dep),(x+w,y-h)],roof)
        line([(x,y-h),(x+w-1,y-h)],SNOW)
    def windows(x,y,w,h,col='#435870'):
        for xx in range(x+2,x+w-1,4):
            for yy in range(y-h+3,y-1,4):
                rect((xx,yy,xx+1,yy+1), GLOW if rng.randrange(17)==0 else col)
    def broken(x,y,w,h,dep=6):
        wall(x,y,w,h,dep,'#48596f','#778fa5')
        windows(x,y,w,h,'#243c54')
        p([(x+w*.62,y-h),(x+w*.87,y-h-4),(x+w*.87,y-h+12),(x+w*.72,y-h+9)],INK)
        for j in range(0,max(1,w-4),3):
            if rng.random()<.35: line([(x+j,y-h-1),(x+j,y-h-5-rng.randrange(3))],'#a8bcc1')
        line([(x+w-1,y-1),(x+w-1,y-h+3)],GLASS)
    def dome(x,y,scale=1,gold=False):
        # x is center of the roof, y the ground.
        def q(a,b,c,e):return tuple(round(t) for t in (x+a*scale,y+b*scale,x+c*scale,y+e*scale))
        edge='#66594f' if gold else '#667e91'
        light='#e8be6e' if gold else '#d0e4eb'
        wall(round(x-17*scale),y,round(34*scale),round(9*scale),5,BRICK if gold else '#b2bec4')
        rect(q(-10,-13,10,-9),edge)
        oval(q(-10,-23,10,-10),light)
        d.arc(q(-8,-23,7,-11),183,325,fill=SNOW if not gold else '#ffdb91')
        rect(q(-2,-25,2,-22),light);line([(x,y-round(25*scale)),(x,y-round(30*scale))],edge)
        if not gold: line([(x+1,y-round(28*scale)),(x+2,y-round(33*scale))],GLOW)
        for u in [-13,-8,-3,3,8,13]:
            line([(round(x+u*scale),y-round(7*scale)),(round(x+u*scale),y-2)],SNOW)
    def church(x,y,w=11,h=10):
        wall(x,y,w,h,4,BRICK,SNOW)
        rect((x+2,y-h-13,x+8,y-h+1),'#bbcbd3')
        rect((x+3,y-h-18,x+7,y-h-12),SNOW)
        p([(x+2,y-h-18),(x+5,y-h-27),(x+8,y-h-18)],'#618190')
        rect((x+3,y-h-16,x+4,y-h-14),GLOW)
        rect((x+6,y-h-16,x+7,y-h-14),GLOW)
    def roof(x,y,w=12,wall_col=BRICK):
        wall(x,y,w,7,3,wall_col,SNOW)
        p([(x-1,y-7),(x+4,y-12),(x+w+3,y-12),(x+w,y-7)],'#c9d8dc')
        rect((x+3,y-5,x+4,y-3),'#2f4057')
    def icepond(corners,streaks):
        p(corners,'#34516d');line(corners+[corners[0]],'#bed9e1',2)
        for x,y,w in streaks:
            line([(x,y),(x+w//2,y+1),(x+w,y-1)],'#709cae')
            line([(x+1,y-1),(x+w//2,y)],ICE)
    def signal(x,y,lit=True):
        rect((x-2,y-1,x+2,y),SHADOW);line([(x,y),(x,y-11)],'#527689')
        p([(x-2,y-8),(x+2,y-11),(x+3,y-7)],'#648e9f')
        if lit:rect((x,y-11,x+1,y-10),GLOW)
    # Boston: frozen Charles meets the harbor, then the visible Zakim
    # cable-stays, historic towers and compact red-brick North End.
    icepond([(280,40),(305,37),(323,47),(347,42),(372,28),(383,35),(383,70),(365,80),(343,65),(320,60),(300,57),(280,54)],
            [(290,49,11),(308,52,10),(328,55,11),(352,58,10),(359,67,12),(369,42,9),(375,62,7)])
    for x,y,w,h in [(309,39,9,23),(322,36,11,29),(335,38,8,22),(356,37,11,30),(371,51,8,26)]:
        broken(x,y,w,h)
    # Zakim's twin inverted-Y towers and asymmetric cable fan.
    line([(290,55),(306,54),(327,46)],INK,4);line([(290,54),(306,53),(327,45)],'#bfcddd',1)
    for x,y in [(299,53),(318,49)]:
        line([(x-4,y+3),(x,y-10),(x,y-17)],SNOW,2)
        line([(x+4,y+2),(x,y-10)],'#839faf',1)
        for u in (-9,-5,5,9):
            line([(x,y-15),(x+u,y-int(u*.4))],'#a2b7c8')
    for x,y in [(314,67),(325,66),(339,70),(348,63),(355,62),(368,63)]: roof(x,y,9)
    # Custom House Tower: pale tapering crown/spire and clock over square shaft.
    wall(335,53,11,23,4,'#a8b8be',ICE)
    rect((337,25,344,30),'#bacbd0');p([(336,25),(340,18),(345,25)],'#839ea8')
    line([(340,21),(340,16)],SNOW);oval((338,29,342,33),INK);rect((340,30,340,31),GLOW)
    windows(335,53,11,19,'#506076')
    church(348,59)
    dome(311,76,.64,True)
    for x,y in [(365,59),(373,54),(376,64)]:
        line([(x,y),(x+12,y+2)],'#6b8ea8',3);line([(x,y-1),(x+11,y+1)],SNOW)
    # Providence: dome on Smith Hill, recognizable art-deco stepped
    # Superman Building beside Waterplace Basin and old riverfront blocks.
    icepond([(178,180),(198,172),(213,176),(225,188),(245,195),(266,187),(278,197),(265,224),(254,244),(239,234),(244,219),(233,209),(216,207),(205,198),(185,196)],
            [(185,187,15),(201,184,9),(212,195,9),(228,198,15),(251,211,7),(253,226,7),(260,198,7)])
    for x,y,w,h in [(201,177,10,15),(216,177,12,18),(239,186,9,18),(254,188,13,13),(259,175,10,16),(213,218,13,19),(222,227,10,24),(234,230,11,14)]:
        broken(x,y,w,h,5)
    for x,y in [(185,203),(199,206),(210,211),(218,218),(224,222),(195,185),(177,195)]: roof(x,y,11)
    dome(196,186,1.18)
    wall(223,215,18,28,6,'#8c909b','#8babb3')
    wall(226,186,13,10,5,'#a0a9ae','#bdd3d6')
    wall(229,176,8,7,4,'#b0b7b7','#c7d6d5')
    wall(231,169,4,6,2,'#79a49f','#c6e0d1')
    line([(233,162),(233,154)],SNOW);rect((233,154,234,155),'#85ddd2')
    windows(223,215,18,27,'#566782')
    for x,y in [(182,185),(209,192),(248,204),(257,207),(218,228),(274,192)]: signal(x,y,rng.randrange(5)!=0)
    # 2994: half the harbor's quay has broken away into the ice;
    # cold solar collectors and a surviving perimeter transponder are
    # contrasted against dark/damaged blocks, not a functioning modern city.
    for x,y in [(272,213),(365,71)]:
        p([(x-12,y),(x+4,y+2),(x+13,y+11),(x+3,y+7),(x-1,y+9),(x-7,y+4)],'#23354b')
        line([(x-12,y),(x-3,y+1),(x-1,y+4),(x+6,y+5),(x+7,y+8)],'#b4ccd7')
        for j in range(5):
            xx=x-6+j*3; yy=y+5+j%3
            rect((xx,yy,xx+1,yy+1),'#637c8c')
    for x,y in [(251,221),(285,73)]:
        for j in range(3):
            a=x+j*6
            p([(a,y),(a+5,y-3),(a+8,y),(a+3,y+3)],'#384f60')
            line([(a+1,y),(a+6,y-2)],'#628694')
        signal(x+21,y-1)
    # Landmark vignettes for the smaller authored stops, without any line that
    # could be confused with the editable race routes or their directional exits.
    for row in nodes:
        title=' '.join(str(row.get(k,'')) for k in ('label','raceRef','displayName','id')).lower()
        if not any(key in title for key in ('tower hill','blue hill','pachaug','scituate','chepachet','putnam pike','thompson','cumberland')): continue
        x=max(24,min(361,round(float(row.get('x',.5))*384)-12))
        y=max(38,min(236,round(float(row.get('y',.5))*256)-13))
        if 'tower hill' in title or 'cumberland' in title:
            wall(x-13,y,26,8,5,'#566778',SNOW)
            roof(x-3,y-6,14,'#4f6479');rect((x+6,y-6,x+9,y-4),'#8ef0e1')
            signal(x+17,y-1)
        elif 'blue hill' in title:
            p([(x-18,y),(x-9,y-10),(x,y-13),(x+13,y-9),(x+20,y)],'#6987a2')
            wall(x-5,y-8,8,11,3,'#aeb9b5',SNOW)
            for j in [-5,-2,1]:rect((x+j,y-22,x+j+1,y-19),'#d1dde0')
        elif 'pachaug' in title or 'scituate' in title:
            icepond([(x-16,y-7),(x-2,y-13),(x+15,y-8),(x+22,y-3),(x+8,y+2),(x-13,y)],[(x-8,y-6,13),(x+5,y-3,11)])
        elif 'chepachet' in title or 'putnam pike' in title:
            for j in [-12,-2,8]: roof(x+j,y-abs(j)//4,9)
            rect((x-14,y-11,x-11,y-2),'#788b9d')
        elif 'thompson' in title:
            d.ellipse((x-15,y-12,x+16,y+4),fill='#566c86',outline=ICE,width=2)
            d.ellipse((x-9,y-8,x+10,y),fill='#b2cedb')
            for j in range(-8,9,4):rect((x+j,y-14,x+j+2,y-12),'#6a879c')
    return im
