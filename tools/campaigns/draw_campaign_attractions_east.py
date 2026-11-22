"""Eastern theme-park landmarks, referencing the shipped world map Art 8575."""
from draw_overhead_campaign_map_art import overhead,W,H,P,math,random,mix,rgb
import draw_regional_map_art as prior
from PIL import ImageDraw,Image
import collections
names=['providence','mount-washington','laurel-highlands','ohio-river']
W,H=384,256
ink='#121938'; blue='#234080'; sun='#ffe5a0'; hot='#ffad54'
def render(n):
 im=overhead(n);d=ImageDraw.Draw(im); rng=random.Random(n+'attraction')
 # Rich blue overprints and clustered off-white snow with each attraction's
 # own accent; maintain subdued, low-detail spaces for the separate route.
 grade={'providence':(84,134,207),'mount-washington':(85,137,221),'laurel-highlands':(187,168,130),'ohio-river':(95,150,194)}[n]
 for k in range(2250):
  xx,yy=rng.randrange(2,W-3),rng.randrange(2,H-3);c=im.getpixel((xx,yy)); r,g,b=c
  if r>105 and b>130:
   f=(math.sin(xx/15+yy/12)+math.cos(yy/7-xx/13))*.13+.29
   dest=(227,240,250) if rng.random()<f else grade
   v=mix(c,dest,rng.choice([.20,.28,.38,.53]))
   d.line([(xx,yy),(xx+rng.choice([0,1,2,4]),yy+rng.choice([0,0,1]))],fill=v)
 def p(q,c):d.polygon(q,fill=c)
 def line(q,c,w=1):d.line(q,fill=c,width=w)
 def rec(q,c):d.rectangle(q,fill=c)
 def light(x,y,s=12):
  for r,a in [(s,.12),(s*3//4,.15),(s//2,.19)]:
   for yy in range(max(0,y-r),min(H,y+r)):
    for xx in range(max(0,x-r),min(W,x+r)):
     if abs(xx-x)*.8+abs(yy-y)<r:im.putpixel((xx,yy),mix(im.getpixel((xx,yy)),(255,156,71),a))
 def tower(x,y,w,h,depth=5,color='#2e3c76',lamp=True):
  light(x+3,y,9) if lamp else None
  p([(x-3,y),(x+w,y-depth),(x+w+depth+13,y+4),(x+depth+7,y+8)],'#5476ab')
  p([(x,y-h),(x+w,y-h+1),(x+w,y),(x,y+1)],color)
  p([(x+w,y-h+1),(x+w+depth,y-h-depth),(x+w+depth,y-depth),(x+w,y)],ink)
  p([(x,y-h),(x+depth,y-h-depth),(x+w+depth,y-h-depth),(x+w,y-h+1)],'#a9c9eb')
  line([(x,y-h),(x+w-1,y-h+1)],'#dbedfa')
  if lamp:
   for u in range(x+2,x+w-1,3):
    for v in range(y-h+3,y-1,4):
     if rng.random()<.63:rec((u,v,u+1,v+1),rng.choice([hot,sun,'#df692f']))
 def cabin(x,y,w=19,h=10):
  light(x+4,y,15)
  p([(x,y),(x+w,y),(x+w+8,y+6),(x+10,y+8)],'#60779f')
  rec((x,y-h,x+w,y),'#74504d')
  p([(x+w,y-h),(x+w+7,y-h-5),(x+w+7,y-5),(x+w,y)],'#322d47')
  p([(x-2,y-h),(x+5,y-h-10),(x+w+5,y-h-10),(x+w+2,y-h)],'#f3e8cb')
  p([(x+5,y-h-10),(x+10,y-h-14),(x+w+11,y-h-15),(x+w+5,y-h-10)],'#a8c4e5')
  rec((x+3,y-h+3,x+6,y-h+6),sun);rec((x+w-5,y-h+3,x+w-2,y-h+6),hot)
  rec((x+w//2,y-h+4,x+w//2+3,y),ink)
 def crag(x,y,s,flat=1):
  # narrow alpine rock crown descends into a broad layered snow fan
  def p(q,c):d.polygon([(a,y+(b-y)*flat) for a,b in q],fill=c)
  q=[(x-52*s,y+22*s),(x-36*s,y+2*s),(x-19*s,y-10*s),(x-10*s,y-29*s),(x,y-42*s),(x+11*s,y-39*s),(x+19*s,y-23*s),(x+35*s,y-6*s),(x+52*s,y+18*s),(x+34*s,y+31*s),(x+18*s,y+26*s),(x+4*s,y+32*s),(x-18*s,y+27*s),(x-39*s,y+33*s)]
  p([(a+8,b+9) for a,b in q],'#6486bd');p(q,'#557db6')
  p([(x-52*s,y+22*s),(x-17*s,y-13*s),(x,y-42*s),(x+10*s,y-15*s),(x-3*s,y+4*s),(x-12*s,y-7*s),(x-19*s,y+16*s),(x-31*s,y+11*s)],'#bad9f5')
  p([(x-13*s,y-23*s),(x,y-42*s),(x+11*s,y-39*s),(x+19*s,y-23*s),(x+8*s,y-29*s),(x+2*s,y-17*s),(x-4*s,y-25*s)],'#effaff')
  p([(x+2*s,y-20*s),(x+11*s,y-35*s),(x+21*s,y-12*s),(x+33*s,y-2*s),(x+44*s,y+21*s),(x+25*s,y+19*s),(x+13*s,y+4*s)],blue)
  for k in range(87):
   dx,dy=rng.randrange(-42,42)*s,rng.randrange(-25,24)*s*flat
   xx,yy=int(x+dx),int(y+dy)
   if 0<xx<W and 0<yy<H and im.getpixel((xx,yy)) in [rgb(c) for c in ['#bad9f5',blue,'#effaff','#557db6']]:
    line([(xx,yy),(xx+rng.randrange(1,5),yy+rng.randrange(-3,2))],rng.choice(['#c2dfff','#4873af','#779dcd']))
 if n=='providence':
  # Providence brick power houses on west bank; Boston's taller cyan and
  # amber waterfront is deliberately different, with separate tidal basin.
  for x,y,w,h in [(198,183,12,20),(211,176,10,24),(226,173,12,27),(237,190,14,23),(203,205,12,16),(217,205,13,18),(238,214,13,28),(249,200,9,17),(216,223,12,19),(254,180,8,14),(195,218,9,12)]:
   tower(x,y,w,h,4,'#594054')
  tower(231,203,10,45,6,'#283574');line([(236,154),(236,148)],sun,2);line([(233,169),(234,197)],hot,2)
  for x,y,w,h in [(306,36,9,21),(316,26,10,18),(330,28,10,22),(342,32,8,27),(355,33,7,20),(311,49,10,19),(325,48,10,18),(338,52,10,32),(352,44,8,25),(360,55,6,12),(338,63,10,16),(323,62,10,11)]:
   tower(x,y,w,h,4,'#26336d')
   line([(x+w,y-h+2),(x+w,y-2)],'#65c7de',1)
  for q in [((362,38),(376,38)),((364,47),(379,46)),((355,56),(371,59))]:
   line(q,'#5786b5',3);line(q,'#d6edf7')
 elif n=='mount-washington':
  crag(263,72,1.50);crag(339,187,.63);crag(61,111,.77)
  cabin(248,61,21,13);tower(273,50,4,17,2)
  line([(275,36),(275,27),(280,27)],sun,1)
  cabin(71,184,17);cabin(294,188,16)
 elif n=='laurel-highlands':
  # Oblique blue ridge cliffs behind a warm working valley.
  for x,y,s in [(50,113,.78),(113,67,.57),(272,46,.9),(337,116,.68),(289,215,.62)]:crag(x,y,s,.45)
  for x,y,l in [(92,161,57),(145,210,67),(207,165,77),(155,236,81)]:
   p([(x,y),(x+l,y-9),(x+l+13,y+4),(x+10,y+13)],'#9a7b66')
   for j in range(2,13,3):line([(x+j,y+j),(x+l+j,y+j-10)],rng.choice(['#d6cdb4','#e3e0ca','#ac9274']))
  cabin(110,164,25,13);cabin(160,189,18);cabin(219,151,24,13)
  for x,y in [(94,185),(197,219),(261,177)]:tower(x,y,5,10,2,'#705956')
 elif n=='ohio-river':
  crag(44,133,.65,.53);crag(291,217,.83,.36)
  # A raised steel span, no painted approach or playable road.
  x1,y1,x2,y2=221,115,269,147
  line([(x1+8,y1+12),(x2+8,y2+12)],'#253d76',7)
  line([(x1,y1),(x2,y2)],ink,8);line([(x1,y1-2),(x2,y2-2)],'#e0c2a2',4)
  for k in range(8):
   x=x1+(x2-x1)*k/7;y=y1+(y2-y1)*k/7
   line([(x,y),(x+4,y-10),(x+9,y+5)],'#514566',2)
   d.point((int(x+4),int(y-10)),fill=sun)
  for x,y in [(220,117),(269,147)]:
   line([(x,y+11),(x,y-15)],'#293659',5);line([(x,y-14),(x+3,y-11)],sun,2)
  for x,y,w,h in [(274,153,10,13),(287,146,8,20),(297,155,12,14),(212,124,9,8),(182,178,11,12)]:
   tower(x,y,w,h,4,'#554259')
  cabin(96,209,21)
 return im
if __name__=='__main__':
 prior.P={k:P[k] for k in names}
 prior.render=render
 prior.emit()
