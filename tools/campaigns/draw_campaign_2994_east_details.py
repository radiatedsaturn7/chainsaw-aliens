"""Race-specific, geographically anchored attraction art for the three eastern maps.

Present-day silhouette = reference; abandoned hardware, ice, and amber life
support lamps = Last on the Grid, 2994. These do not paint route lines or UI.
"""
from PIL import ImageDraw
import random

NAVY='#222f54'
INK='#222942'
DEEP='#344467'
MID='#547196'
LIGHT='#88a8cd'
SNOW='#d9e7f1'
WHITE='#f3f6f4'
ICE='#75bacb'
CYAN='#9ee4ed'
BRICK='#7d515d'
RUST='#ac7771'
STONE='#7a829e'
GOLD='#f4bb70'
LAMP='#ffe1a1'


class Painter:
    def __init__(self, im, name):
        self.draw=ImageDraw.Draw(im)
        self.rng=random.Random(name+'2994-landmarks-v1')

    def p(self, points, color):
        self.draw.polygon(points,fill=color)

    def l(self, points, color, width=1):
        self.draw.line(points,fill=color,width=width)

    def r(self, box, color):
        self.draw.rectangle(box,fill=color)

    def e(self, box, color):
        self.draw.ellipse(box,fill=color)

    def ice(self,x,y,a,b):
        self.p([(x-a,y+1),(x-a+5,y-b+4),(x-a//2,y-b),(x+a//2+1,y-b+1),
                (x+a-2,y-b//2),(x+a,y+3),(x+a//2+1,y+b),(x-a//2,y+b-1)],MID)
        self.l([(x-a+3,y),(x-a//2,y+b-2),(x+a//2+2,y+b-1),(x+a-1,y+3)],LIGHT,2)
        for i in range(5):
            dx=self.rng.randrange(-a+5,a-2)
            yy=y+self.rng.randrange(-max(2,b//2),max(2,b//2))
            self.l([(x+dx,yy),(x+dx+2,yy-1),(x+dx+4,yy)],ICE)

    def drift(self,x,y,a,b):
        self.p([(x-a,y+1),(x-a+4,y-b+3),(x-a//3,y-b),(x+a//2,y-b+1),
                (x+a,y-2),(x+a-2,y+4),(x+a//3,y+b),(x-a//3,y+b)],MID)
        self.p([(x-a+2,y),(x-a+7,y-b+2),(x-a//3,y-b+1),(x+a//2,y-b+2),
                (x+a-1,y-2),(x+a//2,y+3),(x-a//3,y+b-2)],LIGHT)
        self.l([(x-a+8,y-b+2),(x-a//3,y-b),(x+a//2,y-b+1)],SNOW,2)

    def prism(self,x,y,w,h,face=BRICK,depth=5,amber=True):
        self.p([(x-2,y+1),(x+w+depth,y-2),(x+w+depth+6,y+3),(x+5,y+6)],MID)
        self.p([(x+w,y-h),(x+w+depth,y-h-depth),(x+w+depth,y-depth),(x+w,y)],INK)
        self.r((x,y-h,x+w,y),face)
        self.p([(x,y-h),(x+depth,y-h-depth),(x+w+depth,y-h-depth),(x+w,y-h)],SNOW)
        self.l([(x,y-h),(x+w,y-h)],WHITE)
        for yy in range(y-h+4,y-2,5):
            for xx in range(x+2,x+w-1,4):
                if amber and self.rng.random()>.55:
                    self.r((xx,yy,xx+1,yy+1),GOLD)
                else:
                    self.r((xx,yy,xx+1,yy+1),DEEP)

    def cabin(self,x,y,w=17,h=9,face=BRICK,amber=True):
        self.p([(x-3,y+1),(x+w,y+1),(x+w+7,y+4),(x+5,y+7)],MID)
        self.r((x,y-h,x+w,y),face)
        self.p([(x+w,y-h),(x+w+6,y-h-5),(x+w+6,y-4),(x+w,y)],INK)
        self.p([(x-2,y-h),(x+4,y-h-7),(x+w+3,y-h-7),(x+w+1,y-h+1)],SNOW)
        self.p([(x+4,y-h-7),(x+9,y-h-12),(x+w+9,y-h-12),(x+w+3,y-h-7)],LIGHT)
        self.l([(x-1,y-h),(x+4,y-h-7),(x+w+3,y-h-7)],WHITE,1)
        self.r((x+w//2,y-5,x+w//2+3,y),INK)
        for u in (x+2,x+w-4):
            self.r((u,y-h+3,u+2,y-h+5),LAMP if amber else DEEP)

    def spruce(self,x,y,s=7):
        self.l([(x,y),(x+5,y+2)],MID,2)
        self.p([(x,y-s),(x-4,y-2),(x-2,y-2),(x-5,y+2),(x+4,y+2),(x+3,y-1),(x+5,y-1)],DEEP)
        self.l([(x,y-s),(x-3,y-2),(x,y-2),(x-4,y+1)],SNOW)

    def ridge(self,x,y,w=23,h=14):
        self.p([(x-w,y),(x-w+5,y-h//2),(x-w//3,y-h+1),(x+1,y-h),(x+w//3,y-h+3),
                (x+w-4,y-h//2),(x+w,y+1),(x+w//3,y+8),(x-w//2,y+6)],DEEP)
        self.p([(x-w+1,y),(x-w+6,y-h//2),(x-w//3,y-h+1),(x+1,y-h),(x+w//4,y-h+2),
                (x-2,y-h//2),(x+2,y-3),(x-w//3,y-2),(x-w//2,y+3)],LIGHT)
        self.l([(x-w+6,y-h//2),(x-w//3,y-h),(x+1,y-h),(x+w//4,y-h+2)],SNOW,2)
        self.l([(x+w//4,y-h+3),(x+4,y-4),(x+w//4,y)],STONE)

    def tower(self,x,y,h=19):
        self.l([(x,y),(x+3,y-h),(x+5,y-h),(x+8,y)],DEEP,2)
        self.l([(x+2,y-6),(x+6,y-11),(x+3,y-13),(x+5,y-h+3)],LIGHT)
        self.l([(x+4,y-h+3),(x+4,y-h-4)],SNOW)
        self.l([(x,y-h),(x+8,y-h)],LIGHT)
        self.r((x+3,y-h-5,x+5,y-h-4),GOLD)

    def bridge(self,x,y,w=24,open_truss=False):
        self.ice(x+w//2,y+3,w//2+7,8)
        self.l([(x,y),(x+w,y-2)],DEEP,5)
        if open_truss:
            for j in range(0,w-3,5):
                self.l([(x+j,y-1),(x+j+3,y-8),(x+j+6,y-1)],RUST,2)
            self.l([(x,y-1),(x+3,y-8),(x+w-3,y-9),(x+w,y-3)],LIGHT)
            self.l([(x+3,y-8),(x+w-3,y-9)],SNOW)
            for j in (3,w-4):
                self.l([(x+j,y),(x+j,y+4)],STONE,2)
        else:
            self.p([(x,y-8),(x+4,y-12),(x+w+2,y-13),(x+w+3,y-10),(x+w,y-7),(x,y-5)],SNOW)
            self.p([(x,y-5),(x+w,y-7),(x+w,y-2),(x,y)],BRICK)
            self.r((x,y-4,x+3,y-1),DEEP)
            self.l([(x,y-6),(x+w,y-8)],WHITE)
            self.l([(x+5,y-3),(x+w-3,y-4)],RUST)

    def grandstand(self,x,y,w=22):
        self.drift(x+w//2,y+3,w//2+7,5)
        self.p([(x,y),(x+4,y-6),(x+w,y-8),(x+w+4,y-3),(x+w,y+2),(x,y+3)],DEEP)
        for j in range(2,7,2):
            self.l([(x+j,y-j+2),(x+w,y-j)],LIGHT)
        for j in range(4,w-1,5):
            self.l([(x+j,y+2),(x+j+1,y-5)],SNOW)
        self.p([(x+3,y-6),(x+5,y-10),(x+w+2,y-12),(x+w+4,y-8)],WHITE)
        self.r((x+w-4,y-5,x+w-2,y-4),LAMP)

    def falls(self,x,y,w=20):
        self.ice(x,y+4,w//2+6,8)
        for j in range(3):
            shift=j*3
            self.l([(x-w//2+2+shift,y-8+j*2),(x-4+shift,y-6+j*2),
                    (x+4+shift,y+1+j*2),(x+w//2+shift,y+2+j*2)],DEEP,3)
            self.l([(x-w//2+2+shift,y-9+j*2),(x-4+shift,y-7+j*2),
                    (x+4+shift,y+j*2),(x+w//2+shift,y+1+j*2)],ICE,2)
        self.l([(x-3,y-7),(x+1,y-2),(x+3,y+2)],WHITE,2)

    def dome(self,x,y,w=20,gold=False):
        self.prism(x-w//2,y,w,8,STONE,4)
        m=w//2
        self.p([(x-m+2,y-9),(x-m+2,y-12),(x-4,y-14),(x+5,y-14),(x+m-2,y-11),(x+m-2,y-9)],MID)
        self.e((x-5,y-23,x+5,y-11),GOLD if gold else SNOW)
        self.l([(x-2,y-22),(x+2,y-22)],LAMP if gold else WHITE)
        self.l([(x,y-24),(x,y-27)],LIGHT)
        self.r((x-1,y-16,x+1,y-12),RUST if gold else LIGHT)
        for j in (-6,-3,3,6):
            self.l([(x+j,y-7),(x+j,y-1)],SNOW)


def decorate(name, im, nodes):
    """Draw each anchor relative to its exact exported map node (384 × 256)."""
    if name not in {'mount-washington','laurel-highlands','ohio-river'}:
        return im
    anchors={n['id']:(round(n['x']*384),round(n['y']*256)) for n in nodes if n.get('raceRef')}
    if not all(f'stop-{i}' in anchors for i in range(8)):
        raise ValueError(f'{name}: expected eight unchanged race identities')
    q=Painter(im,name)
    def xy(i,dx=0,dy=0):
        x,y=anchors[f'stop-{i}'];return x+dx,y+dy

    if name=='mount-washington':
        # NH 112: Albany's surviving covered timber span across the icy Swift River.
        q.bridge(*xy(0,-28,10));q.spruce(*xy(0,-30,4),8)
        # Dalton: low, elongated rally-school gravel garage, snow piles and one beacon.
        q.drift(*xy(1,18,-5),17,7);q.cabin(*xy(1,8,-5),23,9,STONE)
        q.r((*xy(1,11,-11),*xy(1,16,-5)),DEEP);q.l([xy(1,12,-8),xy(1,15,-8)],ICE)
        q.r((*xy(1,19,-11),*xy(1,24,-6)),DEEP);q.tower(*xy(1,28,1),12)
        # Bear Notch's forested lookout, no invented lodge.
        q.ridge(*xy(2,-16,11),18,8)
        for dx,dy in [(-25,6),(-20,8),(-13,10),(-9,12)]:q.spruce(*xy(2,dx,dy))
        # Hurricane Mountain roadside trailhead and exposed Black Cap granite.
        q.ridge(*xy(3,14,-10),15,10);q.spruce(*xy(3,11,-8),6);q.spruce(*xy(3,20,-6),8)
        q.tower(*xy(3,24,-9),10)
        # Pinkham Notch: Joe Dodge Lodge below Tuckerman Ravine's snowy bowl.
        q.ridge(*xy(4,-24,-13),21,8)
        q.cabin(*xy(4,-29,-7),18,10);q.cabin(*xy(4,-17,-3),11,7,STONE)
        # Summit: low stone Tip Top House, Sherman Adams block, weather mast and ice.
        q.drift(*xy(5,13,-13),21,10)
        q.prism(*xy(5,10,-12),16,9,STONE,4)
        q.cabin(*xy(5,0,-6),15,7,STONE,False)
        q.tower(*xy(5,25,-13),24)
        for dx,dy in [(4,-3),(29,-6),(22,-6)]:
            q.l([xy(5,dx,dy),xy(5,dx+3,dy-1)],ICE,2)
        # Tamworth: hillside pit building and spectator levels.
        q.grandstand(*xy(6,3,-9),25);q.prism(*xy(6,24,-9),8,8,STONE,3)
        # Vermont 108: ice-cut slot between two large Smugglers' Notch boulders.
        q.ridge(*xy(7,-17,-3),12,12);q.ridge(*xy(7,-9,11),11,10)
        q.spruce(*xy(7,-28,13),8);q.spruce(*xy(7,-22,16),7)
    elif name=='laurel-highlands':
        # Montchanin: Brandywine powder-mill stonework, intact waterwheel silhouette.
        q.ice(*xy(0,15,-10),20,8)
        q.cabin(*xy(0,4,-19),20,9,STONE)
        x,y=xy(0,24,-13);q.e((x-5,y-5,x+5,y+5),DEEP);q.e((x-3,y-3,x+3,y+3),RUST)
        q.l([(x-4,y),(x+4,y)],SNOW);q.l([(x,y-4),(x,y+4)],LIGHT)
        # Normalville/Champion: Indian Creek farm valley and frost-laden farm bins.
        q.cabin(*xy(1,-25,1),20,12,BRICK)
        q.prism(*xy(1,-7,0),5,11,STONE,2)
        for j in range(3):q.l([xy(1,-31,9+j*2),xy(1,-16,8+j*2)],LIGHT)
        # Forbes Forest high rock outcrop, evergreen crown and survey/mast remnant.
        q.ridge(*xy(2,15,-10),20,12);q.tower(*xy(2,18,-14),10)
        for dx,dy in [(1,3),(12,2),(26,0),(29,-3)]:q.spruce(*xy(2,dx,dy),7)
        # Chalk Hill/US 40: stone National Road inn and white portico.
        q.prism(*xy(3,-24,12),18,11,STONE,3)
        q.p([xy(3,-24,4),xy(3,-14,-4),xy(3,-4,4)],SNOW)
        for j in (-21,-16,-11,-6):q.l([xy(3,j,4),xy(3,j,11)],WHITE)
        # Seven Springs: snowfield, lift pylons/carriages and timber base lodge.
        q.drift(*xy(4,18,-4),17,8)
        q.l([xy(4,1,-9),xy(4,26,-23)],DEEP,1)
        for j,dy in [(4,-11),(17,-19),(25,-22)]:
            q.l([xy(4,j,dy+8),xy(4,j,dy)],STONE,2)
            q.l([xy(4,j-2,dy),xy(4,j+2,dy)],SNOW)
        q.r((*xy(4,10,-14),*xy(4,13,-12)),GOLD)
        q.cabin(*xy(4,10,11),16,8,BRICK)
        # Laurel boss: ice-turquoise Ohiopyle falls across shallow flat ledges.
        q.falls(*xy(5,15,8),23);q.ridge(*xy(5,21,4),13,8)
        q.l([xy(5,5,0),xy(5,18,3),xy(5,24,10)],CYAN,2)
        # Pitt Race: low pit board and herringbone grandstand, not a track overlay.
        q.grandstand(*xy(6,10,5),23);q.prism(*xy(6,27,2),7,10,STONE,3)
        # Philadelphia: red-brick wings beneath the white Independence Hall steeple.
        q.prism(*xy(7,-35,-5),22,10,BRICK,4)
        q.prism(*xy(7,-27,-10),6,13,SNOW,2)
        q.p([xy(7,-28,-24),xy(7,-24,-29),xy(7,-20,-24)],LIGHT)
        q.l([xy(7,-24,-29),xy(7,-24,-32)],LAMP)
        q.r((*xy(7,-25,-21),*xy(7,-23,-19)),DEEP)
    else:
        # Barlow: ruined fair pavilion: wide barns and corrugated show-ring roof.
        q.cabin(*xy(0,-31,13),23,10,BRICK)
        q.prism(*xy(0,-8,10),9,8,STONE,3)
        # Western Washington County route: timber-covered span and maple woods.
        q.bridge(*xy(1,-28,-1),20);q.spruce(*xy(1,-17,-8),6)
        # The SR 26 byway has multiple covered spans (Hune, Rinard, Hildreth).
        q.bridge(*xy(2,4,9),24);q.bridge(*xy(2,14,17),17)
        # Monroe County: Appalachia's river-edge ridges and an abandoned relay.
        q.ridge(*xy(3,-22,-12),17,11);q.ridge(*xy(3,-10,-4),15,9)
        q.tower(*xy(3,-18,-14),15)
        # Triple Nickel's rolling agricultural ridgelines/road-cut, not a trace.
        q.ridge(*xy(4,-19,12),20,8);q.ridge(*xy(4,-8,15),18,8)
        q.cabin(*xy(4,-16,20),12,6,BRICK,False)
        # Ohio/Muskingum river confluence: Marietta riverfront, raised steel span.
        q.ice(*xy(5,11,7),24,12);q.bridge(*xy(5,-15,10),35,True)
        q.prism(*xy(5,15,-1),14,13,BRICK,4);q.prism(*xy(5,29,3),9,9,STONE,3)
        # Lexington: Mid-Ohio paddock and timing building, not the drivable Keyhole.
        q.grandstand(*xy(6,7,6));q.prism(*xy(6,24,5),9,12,STONE,3)
        # Charleston WV (not SC): gold Capitol dome on the Kanawha riverbank.
        q.ice(*xy(7,7,13),27,8);q.dome(*xy(7,15,0),24,True)
        q.prism(*xy(7,-19,2),11,7,BRICK,3)
    return im
