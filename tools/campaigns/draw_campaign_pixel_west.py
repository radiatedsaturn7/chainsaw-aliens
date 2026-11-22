"""Deterministic western SNES-overhead art. No gameplay paths or POI placement."""
from pathlib import Path
from PIL import Image,ImageDraw
import random,math,json,hashlib
import numpy as np
W,H=384,256
def rgb(c):return tuple(bytes.fromhex(c))
def blend(a,b,t):return tuple(round(i+(j-i)*t) for i,j in zip(a,b))
def art(name):
 r=random.Random('west terrain 2994:'+name)
 cfg={
 'moki-dugway':('433443','a15945','bd744d','efe4ce','26253c','22637e'),
 'oak-creek-canyon':('494052','aa5443','bc7256','efccaf','24263d','244e74'),
 'angeles-crest':('26324e','344d80','91b7df','f4f9ff','0f1941','071b48'),
 }
 dirt,face,cap,light,ink,water=(rgb(a) for a in cfg[name])
 im=Image.new('RGB',(W,H),dirt);d=ImageDraw.Draw(im)
 frozen=name=='angeles-crest'
 nr=np.random.default_rng(sum(ord(a) for a in name)*786+99)
 def field(w,h):
  vals=nr.integers(5,252,(h,w),dtype=np.uint8)
  return np.asarray(Image.fromarray(vals).resize((W,H),Image.Resampling.BILINEAR),dtype=np.float32)/255
 n0,n1,n2,n3=[field(x,y) for x,y in [(11,9),(27,23),(71,49),(151,91)]]
 dust=nr.random((H,W))
 terrain=n0*.44+n1*.30+n2*.16+n3*.10
 erosion=n0*.22+n1*.40+n2*.27+n3*.11
 bank=erosion+.14*np.sin((np.arange(H)[:,None]+np.arange(W)[None,:]*.29)/3.9)
 def texture(mask,tones,scalar):
  arr=np.asarray(mask).astype(bool)
  colors=np.asarray(tones,dtype=np.uint8)
  levels=np.digitize(scalar,[.26,.36,.46,.56,.65,.73])
  idx=np.where(arr)
  mixed=np.asarray(im).copy()
  mixed[idx]=colors[levels[idx]]
  im.paste(Image.fromarray(mixed))
 base=Image.new('1',(W,H),1)
 if frozen:tones=[rgb(c) for c in ['101c43','202e55','30416a','43577b','57749b','7993b4','a3bcd5']]
 else:tones=[blend(dirt,c,t) for c,t in [(ink,.70),(ink,.41),(ink,.12),(cap,.11),(cap,.29),(cap,.46),(light,.48)]]
 texture(base,tones,terrain*.89+dust*.11)
 def corrugate(q):
  result=[]
  for (x,y),(u,v) in zip(q,q[1:]+q[:1]):
   sl=math.hypot(u-x,v-y);n=math.ceil(sl/5)
   for j in range(n):
    t=j/n;dist=0 if j==0 else r.choice([-2,-1,0,0,1,1,2,3])
    result.append((round(x+(u-x)*t-(v-y)/sl*dist),round(y+(v-y)*t+(u-x)/sl*dist)))
  return result
 def p(q,c):d.polygon(q,fill=c)
 def L(q,c,w=1):d.line(q,fill=c,width=w)
 def rough(x,y,w,h):
  return [(x+int(w*math.cos(i*math.tau/20)*(1+r.uniform(-.14,.14))),y+int(h*math.sin(i*math.tau/20)*(1+r.uniform(-.18,.18)))) for i in range(20)]
 for i in range(95):
  x=r.randrange(-20,400);y=r.randrange(-12,268)
  p(rough(x,y,r.randrange(5,51),r.randrange(3,17)),blend(dirt,cap if i%3 else ink,r.uniform(.06,.29)))
 for i in range(750):
  x=r.randrange(W);y=r.randrange(H);k=r.randrange(1,5)
  L([(x,y),(x+k,y)],blend(im.getpixel((x,y)),light if i%4 else ink,r.uniform(.13,.30)))
 def ledge(q,h,color=None,snow=False):
  ca=cap if color is None else color
  old=q
  q=corrugate(q)
  p([(x+6,y+h+8) for x,y in q],blend(dirt,ink,.77))
  F=Image.new('1',(W,H));fd=ImageDraw.Draw(F)
  for (x,y),(u,v) in zip(q,q[1:]+q[:1]):
   if u>=x:continue
   poly=((x,y),(u,v),(u-4,v+h),(x-4,y+h));fd.polygon(poly,fill=1)
  if frozen:
   ft=[rgb(x) for x in ['10183b','192855','294475','3b5d8e','517eb3','6e9ed2','a4c9e9']]
  else:ft=[blend(face,x,t) for x,t in [(ink,.82),(ink,.59),(ink,.33),(ink,.12),(ca,.22),(ca,.50),(light,.50)]]
  texture(F,ft,bank*.96+dust*.04)
  # Narrow angled discontinuities and brighter lines at the exposed courses.
  for (x,y),(u,v) in zip(old,old[1:]+old[:1]):
   if u>=x:continue
   for z in range(5,h-1,7):
    pts=[(x-1,y+z),(round(x*.66+u*.34)-1,round(y*.66+v*.34)+z+1),(u-2,v+z)]
    L(pts,blend(face,light,.22 if frozen else .24))
    L([(xx,yy+1) for xx,yy in pts],blend(face,ink,.56))
  P=Image.new('1',(W,H));pd=ImageDraw.Draw(P);pd.polygon(q,fill=1)
  if frozen:
   pt=[rgb(x) for x in ['1c3163','365b94','5a83b9','85abdc','adcced','daebf9','f1f8fa']]
   tex=erosion*.86+dust*.14+.045
  else:
   pt=[blend(ca,x,t) for x,t in [(ink,.57),(ink,.41),(face,.36),(ca,0),(light,.23),(light,.54),(light,.85)]]
   tex=erosion*.90+dust*.10
  texture(P,pt,tex)
  # Eroded ice seams: broken hard diagonal strokes and a two-tone cap rim.
  if frozen:
   rim=rgb('b5def7')
   for i,(pt0,pt1) in enumerate(zip(q,q[1:])):
    if i%5: L([pt0,pt1],rim if pt1[0]>pt0[0] else rgb('6caae2'))
    if i%4==0 and pt0[1]>0:L([pt0,(pt0[0]-1,pt0[1]+r.randrange(2,7))],rim)
  else:
   for i,(pt0,pt1) in enumerate(zip(q,q[1:])):
    if i%5 in (0,1,2) and pt1[0]>=pt0[0]:L([pt0,pt1],blend(cap,light,.58))
 def contour(q,width,wet=True):
  pts=[]
  for (x,y),(u,v) in zip(q,q[1:]):
   count=max(1,round(math.hypot(u-x,v-y)/4))
   for j in range(count):
    t=j/count;n=0 if j==0 else r.choice([-1,0,0,1])
    pts.append((round(x+(u-x)*t)+n,round(y+(v-y)*t)))
  pts.append(q[-1])
  L(pts,blend(ink,dirt,.12),width+15)
  for i,(x,y) in enumerate(pts):
   if i%3: continue
   for dx in (-width//2-5,width//2+4):
    L([(x+dx,y),(x+dx-2,y+3)],blend(face,ink,.28),2)
  L(pts,blend(face,cap,.57),width+7)
  L([(x+1,y) for x,y in pts],water if wet else blend(dirt,cap,.55),width)
  for i,(x,y) in enumerate(pts[1:-1]):
   if i%6==0:L([(x-2,y),(x+2,y-1)],blend(water,light,.55) if wet else blend(cap,light,.3))
   if i%4==0:d.point((x-2,y+1),fill=blend(water,ink,.5))
 def mesa(x,y,s,h):
  q=[(x-s,y-5),(x-s+9,y-20),(x-10,y-28),(x+14,y-23),(x+s-6,y-14),(x+s+2,y-3),(x+s-15,y+7),(x-3,y+11),(x-s+10,y+9)]
  ledge(q,h)
 def pine(x,y,s,ice=False):
  c=ink if ice else rgb('31494b')
  L([(x,y-7*s),(x,y)],rgb('5e4f51'),s)
  p([(x,y-8*s),(x-3*s,y-2*s),(x-4*s,y),(x+4*s,y),(x+3*s,y-2*s)],c)
  L([(x,y-7*s),(x-2*s,y-3*s),(x-3*s,y-1*s)],rgb('91c1e4') if ice else rgb('647c69'))
  if s>1:
   d.point((x+1,y-7*s+3),fill=rgb('dce9f5') if ice else rgb('647d70'))
   L([(x+1,y-2*s),(x-1,y-s)],rgb('6389b1') if ice else rgb('3c6660'))
 def structure(x,y,w,h,roof,damage=False):
  roof=rgb(roof);p([(x-1,y+1),(x+w+8,y-3),(x+w+14,y+1),(x+3,y+5)],ink)
  p([(x,y-h),(x+w,y-h),(x+w,y),(x,y)],blend(roof,ink,.37))
  p([(x+w,y-h),(x+w+6,y-h-4),(x+w+6,y-5),(x+w,y)],blend(roof,ink,.68))
  top=[(x-1,y-h),(x+5,y-h-6),(x+w+6,y-h-5),(x+w,y-h)]
  if damage:top=[(x-1,y-h),(x+5,y-h-6),(x+8,y-h-5),(x+9,y-h-2),(x+14,y-h-6),(x+w+6,y-h-5),(x+w,y-h)]
  p(top,roof);L(top,blend(roof,light,.45))
  if damage:L([(x+w//2,y-h+4),(x+w//2+3,y-4),(x+w//2,y)],ink,2)
  for f in range(3,w-2,6):
   if f%4!=1:L([(x+f,y-6),(x+f+2,y-6)],rgb('efae6d'))
  if damage:
   for f in range(4):
    u=x+w+r.randrange(-2,10);v=y+r.randrange(-2,7)
    d.point((u,v),fill=rgb('ee784c'))
    if f%2==0:d.point((u,v-1),fill=rgb('f5c681'))
 def bots(x,y):
  for j in range(3):
   xx=x+j*7;yy=y+(j%2)*4
   L([(xx-3,yy+3),(xx+4,yy+3)],ink,2)
   d.rectangle((xx-2,yy-3,xx+2,yy+1),fill=rgb('4d5866'))
   L([(xx-1,yy-4),(xx+1,yy-4)],rgb('b7c9c9'))
   d.point((xx+2,yy-2),fill=rgb('90edf0'));d.point((xx-3,yy),fill=rgb('e59869'))
 def crane(x,y):
  L([(x-12,y+9),(x+1,y+9),(x+7,y+5)],ink,3)
  L([(x-5,y+8),(x-5,y-28),(x+22,y-24),(x+22,y-16)],ink,3)
  L([(x-5,y-27),(x+22,y-24)],rgb('b78c72'),1)
  L([(x-5,y-17),(x+4,y-26)],rgb('b78c72'))
  L([(x+21,y-17),(x+21,y-11)],ink);d.point((x+21,y-11),fill=rgb('e8ac62'))
 if name=='moki-dugway':
  ledge([(-20,21),(23,1),(70,3),(106,17),(146,20),(172,38),(180,56),(172,70),(147,79),(114,76),(98,88),(58,93),(31,81),(-20,75)],43)
  ledge([(-15,17),(21,8),(72,13),(100,27),(124,28),(141,44),(130,51),(99,49),(75,58),(37,51),(-13,55)],16,color=blend(cap,light,.14))
  mesa(312,31,53,34);mesa(355,72,29,29)
  mesa(310,184,34,41);mesa(367,156,29,36);mesa(337,167,17,26)
  contour([(-16,201),(24,185),(43,182),(64,186),(76,199),(66,209),(45,217),(45,227),(63,235),(96,234),(127,218),(166,222),(189,244),(197,265)],7)
  for xx,yy in [(81,165),(196,205),(251,133),(227,179),(208,113)]:
   for a in range(13):
    x=xx+r.randrange(-15,16);y=yy+r.randrange(-9,11)
    L([(x,y),(x+2,y-2),(x+4,y)],rgb('9d9c71'))
  structure(209,39,22,12,'8c7f77',True);structure(237,43,16,10,'805c58',True)
  bots(232,56);crane(202,43)
 elif name=='oak-creek-canyon':
  # Rust towers to the west, a deep snowmelt creek in their shadow.
  ledge([(-18,13),(34,5),(63,14),(87,25),(107,48),(99,70),(85,80),(63,92),(23,100),(-14,89)],53)
  mesa(73,59,30,31);mesa(22,42,27,27)
  ledge([(266,-15),(328,-15),(381,2),(408,29),(407,54),(365,80),(330,71),(312,81),(281,63),(255,38)],35)
  contour([(197,-14),(181,9),(186,30),(211,51),(224,74),(215,99),(199,112),(184,136),(180,158),(191,178),(191,196),(157,214),(141,235),(144,269)],9)
  mesa(330,177,54,42);mesa(355,153,35,28)
  ledge([(-16,184),(40,166),(68,171),(93,190),(93,211),(55,226),(12,222),(-20,214)],27)
  for xx,yy,n in [(150,98,29),(235,143,27),(128,192,23),(251,55,20),(110,222,14)]:
   for _ in range(n):
    x=xx+r.randrange(-21,22);y=yy+r.randrange(-16,17)
    pine(x,y,r.choice([1,1,1,2]))
  structure(243,207,21,10,'a87766',True);structure(269,216,14,9,'ae9874')
  crane(241,212);bots(263,230)
 else:
  # Pacific left, layered San Gabriel ridges above a partly buried LA basin.
  coast0=[(-12,77),(16,92),(24,111),(33,125),(39,146),(33,170),(49,196),(43,223),(69,240),(76,264)]
  coast=[(round(a+(c-a)*t)+r.choice([-2,0,0,1]),round(b+(d0-b)*t)) for (a,b),(c,d0) in zip(coast0,coast0[1:]) for t in (0,.17,.34,.51,.68,.85)]+[coast0[-1]]
  p([(-15,66),*coast,(-15,264)],water);L(coast,rgb('216091'),10);L(coast,rgb('36acd5'),6);L(coast,rgb('c8f2f9'),2)
  for i in range(135):
   x=r.randrange(1,61);y=r.randrange(78,254)
   if im.getpixel((x,y))==water:L([(x,y),(x+2,y)],blend(water,light,.35))
  # Offshore jagged segmented floes catch the hard cyan coast bounce.
  for x,y,w,h in [(4,126,7,4),(9,137,9,5),(6,169,7,5),(21,185,11,6),(23,219,13,8),(13,241,10,7),(40,246,12,5),(2,204,8,4)]:
   q=[(x-w,y),(x-3,y-h),(x+3,y-h-1),(x+w,y-1),(x+w//2,y+h),(x-4,y+h)]
   p([(u+1,v+3) for u,v in q],rgb('236693'));p(q,rgb('75b0d4'));L(q[0:4],rgb('daeff9'))
  for q,h,c in [([(90,22),(139,-11),(206,-12),(249,4),(282,16),(287,36),(246,55),(209,57),(177,72),(135,68),(102,59)],22,rgb('7d9aae')), ([(200,50),(233,31),(279,14),(328,22),(361,10),(405,26),(404,77),(365,102),(303,97),(273,113),(230,94),(207,76)],26,rgb('90a9b8')), ([(257,110),(285,86),(316,90),(342,64),(375,68),(411,102),(409,150),(364,156),(335,177),(288,168),(261,147)],30,rgb('8ca7bb'))]:
   ledge(q,h,c,True)
   x,y=q[2];p([(x-13,y+8),(x,y-17),(x+20,y-1),(x+28,y+20),(x+1,y+8)],light)
   p([(x,y-17),(x+20,y-1),(x+28,y+20),(x+2,y+13),(x+4,y+3)],rgb('6488a6'))
  for xx,yy in [(156,95),(263,189),(311,201),(193,121),(340,133)]:
   for _ in range(22):pine(xx+r.randrange(-22,23),yy+r.randrange(-14,15),r.choice([1,1,1,2]),True)
  for x,y,w,h,dam in [(84,172,20,26,True),(105,171,15,39,False),(127,170,23,22,True),(151,181,24,24,True),(93,193,15,13,False),(122,199,20,19,True),(151,200,19,12,False),(78,217,19,13,True),(112,223,25,18,False),(143,223,14,16,True),(177,221,22,13,False)]:
   structure(x,y,w,h,'586685',dam)
  for xx,yy,t in [(67,185,3),(72,195,2),(85,235,3),(106,232,4),(159,219,4),(175,189,3),(175,172,2),(184,202,2),(115,154,3),(151,149,3)]:
   for i in range(t):
    x=xx+i*4-r.randrange(0,3);y=yy+r.randrange(-4,7);h=r.randrange(5,15)
    L([(x,y-h),(x,y)],rgb('182440'),2)
    L([(x+1,y-h+1),(x+1,y-1)],rgb('3b5279'))
    if i%3==0:
     d.point((x,y-4),fill=rgb('f5a255'))
     d.point((x-1,y),fill=rgb('b05e48'))
  for q in range(155):
   xx=r.randrange(64,210);yy=r.randrange(130,245)
   if (xx-126)**2/3800+(yy-192)**2/2300>=1:continue
   c0=im.getpixel((xx,yy)); d.point((xx,yy),fill=blend(c0,rgb('f79f5a'),r.choice([.29,.42,.57,.86])))
   if q%4==0:d.point((xx+1,yy+1),fill=rgb('182242'))
  crane(139,195);crane(176,204);bots(154,233);bots(178,211)
 return im
def build(D):
 D.mkdir(parents=True,exist_ok=True)
 files={}
 for name in ['moki-dugway','oak-creek-canyon','angeles-crest']:
  im=art(name); p=D/(name+'.png');im.save(p,optimize=True)
  files[name]={'path':p.name,'size':im.size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
 (D/'terrain.json').write_text(json.dumps({'regions':files,'routesBaked':False,'pinsBaked':False,'role':'background terrain + 2994 ambient only'},indent=2)+'\n')
 o=Image.new('RGB',(W*3,H))
 for i,name in enumerate(files):o.paste(Image.open(D/files[name]['path']),(i*W,0))
 o.save(D/'contact.png')

if __name__=='__main__':
 import argparse
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--output',required=True,type=Path)
 build(p.parse_args().output)
