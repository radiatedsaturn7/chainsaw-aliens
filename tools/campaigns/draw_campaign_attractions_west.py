#!/usr/bin/env python3
"""New authored pixel dioramas, native 384x256; drawn to the palette of the shipped world map Art 8575."""
from pathlib import Path
from PIL import Image,ImageDraw
import math,random,json,base64,gzip,hashlib
W,H=384,256
ROOT=Path(__file__).resolve().parent; OUT=ROOT/'overlay'
COLORS={
'pikes-peak':dict(earth='#4b5f77',plain='#60748c',hi='#d7eaff',ink='#152847',snow='#eef3fa',ice='#6697d4',deep='#294879',accent='#ecb977'),
'moki-dugway':dict(earth='#714639',plain='#986549',hi='#e4aa71',ink='#2b2637',snow='#dfd6d5',ice='#427299',deep='#3b3549',accent='#f4c87b'),
'oak-creek-canyon':dict(earth='#624b47',plain='#825740',hi='#d89563',ink='#27322e',snow='#dfd6d5',ice='#3e7895',deep='#34493e',accent='#fac081'),
'angeles-crest':dict(earth='#55566c',plain='#6a686b',hi='#f4b273',ink='#15233d',snow='#d7e7f6',ice='#4889bb',deep='#2a4261',accent='#f4aa56'),
}
def rgb(s):return tuple(bytes.fromhex(s.lstrip('#'))) if isinstance(s,str) else s
def mix(a,b,t):
 a,b=rgb(a),rgb(b);return tuple(round(x+(y-x)*t) for x,y in zip(a,b))
def render(name):
 c=COLORS[name]; g=lambda k:rgb(c[k]); rng=random.Random(name+'world-8575-v4')
 im=Image.new('RGB',(W,H),g('earth'));d=ImageDraw.Draw(im)
 def p(q,col):d.polygon(q,fill=rgb(col))
 def l(q,col,w=1):d.line(q,fill=rgb(col),width=w)
 def spline(q):
  q=[q[0],*q,q[-1]]
  return [tuple(round(.5*(2*b[k]+(-a[k]+c[k])*t+(2*a[k]-5*b[k]+4*c[k]-e[k])*t*t+(-a[k]+3*b[k]-3*c[k]+e[k])*t*t*t)) for k in (0,1))
          for a,b,c,e in zip(q,q[1:],q[2:],q[3:]) for j in range(14) for t in [j/14]]
 def river(q,wide,bank,liquid):
  pts=spline(q)
  for index,(x,y) in enumerate(pts):
   w=wide*(.85+.24*math.sin(index*.21)+.10*math.sin(index*.61))
   d.ellipse((x-w-2,y-w-1,x+w+2,y+w+1),fill=bank)
  for index,(x,y) in enumerate(pts):
   w=wide*(.85+.24*math.sin(index*.21)+.10*math.sin(index*.61))
   d.ellipse((x-w,y-w,x+w,y+w),fill=liquid)
   if index%7==1:l([(x-2,y),(x+2,y)],mix(liquid,g('snow'),.36))
 def cube(x,y,w,z,dep,roof,front,side):
  p([(x-4,y+1),(x+w+dep+6,y+4),(x+w+dep+5,y+9),(x-6,y+7)],mix(front,g('ink'),.66))
  p([(x,y-z),(x+w,y-z),(x+w+dep,y-z+dep//2),(x+dep,y-z+dep//2)],roof)
  p([(x+dep,y-z+dep//2),(x+w+dep,y-z+dep//2),(x+w+dep,y+dep//2),(x+dep,y+dep//2)],front)
  p([(x,y-z),(x+dep,y-z+dep//2),(x+dep,y+dep//2),(x,y)],side)
  l([(x,y-z),(x+w,y-z),(x+w+dep,y-z+dep//2)],mix(roof,g('snow'),.30))
  for i in range(x+dep+4,x+w+dep-2,5):
   for j in range(y-z+dep//2+4,y,7):
    if rng.random()<.38:d.rectangle((i,j,i+1,j+2),fill=g('accent'))
 def pine(x,y,z,col):
  p([(x-2,y),(x+z+3,y+3),(x+2,y+5),(x-z//2,y+2)],mix(col,g('ink'),.59))
  p([(x,y-z),(x-z//2,y-1),(x+z//2,y)],col)
  p([(x,y-z),(x-1,y),(x-z//2,y-1)],mix(col,g('snow'),.20))
  d.point((x,y-z),fill=mix(col,g('snow'),.40))
 def grove(cx,cy,rx,ry,count,col,small=3,large=10):
  pts=sorted([(int(cx+rx*math.sqrt(rng.random())*math.cos(t)),int(cy+ry*math.sqrt(rng.random())*math.sin(t))) for t in [rng.random()*math.tau for _ in range(count)]],key=lambda p:p[1])
  for x,y in pts:
   if 1<x<W-1 and 1<y<H-1:pine(x,y,rng.randrange(small,large),mix(col,g('ink'),rng.uniform(0,.50)))
 def mountain(cx,cy,wx,h,depth,snow=False):
  ridge=[(cx-wx,cy),(cx-wx*.62,cy-h*.31),(cx-wx*.29,cy-h*.54),(cx,cy-h),(cx+wx*.24,cy-h*.58),(cx+wx*.53,cy-h*.32),(cx+wx,cy)]
  toe=(cx+wx*.19,cy+depth*.62)
  p([(cx-wx,cy),(cx+wx,cy),(cx+wx*.63,cy+depth*.75),(cx+wx*.19,cy+depth),(cx-wx*.51,cy+depth*.74)],mix(g('deep'),g('ink'),.43))
  p([*ridge,toe],g('deep'))
  p([ridge[0],ridge[1],ridge[2],ridge[3],toe,(cx-wx*.36,cy+depth*.38)],mix(g('deep'),g('ice'),.43 if snow else .19))
  p([ridge[3],ridge[4],(cx+wx*.49,cy+depth*.23),toe],mix(g('ink'),g('deep'),.50))
  p([ridge[4],ridge[5],ridge[6],(cx+wx*.49,cy+depth*.23)],mix(g('deep'),g('earth'),.49))
  p([ridge[1],ridge[2],ridge[3],(cx+wx*.03,cy-h*.3),(cx-wx*.13,cy-h*.17),(cx-wx*.36,cy-h*.31)],g('snow') if snow else mix(g('ice'),g('plain'),.57))
  p([ridge[3],ridge[4],(cx+wx*.29,cy-h*.25),(cx+wx*.03,cy-h*.3)],g('ice') if snow else g('plain'))
  l(ridge[:4],mix(g('ice'),g('snow'),.70 if snow else .25))
  for f in [.25,.39,.54,.70,.83]:
   i=int(cx+(toe[0]-cx)*f);j=int(cy-h+(toe[1]-cy+h)*f)
   l([(i-4,int(j+6)),(i-13,int(j+11)),(i-25,int(j+15))],mix(g('ice'),g('snow'),.3 if snow else 0))
 def mesa(cx,cy,r,depth,height,phase):
  angles=[0,.58,1.16,1.73,2.29,2.85,3.40,4.00,4.55,5.10,5.73]
  poly=[(round(cx+(r+r*.13*math.sin(j*2.2+phase))*math.cos(t)),round(cy+(depth+depth*.19*math.sin(j*1.7+phase))*math.sin(t))) for j,t in enumerate(angles)]
  p([(x+6,y+height+5) for x,y in poly],mix(g('ink'),g('earth'),.44))
  for j,((ax,ay),(bx,by)) in enumerate(zip(poly,poly[1:]+poly[:1])):
   if min(ay,by)>=cy-1 or abs(ax-cx)>r*.82:
    ss=[.18,.30,.38,.28,.44][j%5]
    face=mix(g('hi'),g('ink'),ss)
    p([(ax,ay),(bx,by),(bx,by+height),(ax,ay+height)],face)
    for k,col in [(3,g('hi')),(height//3,mix(face,g('hi'),.30)),(height//2,mix(g('ink'),face,.49)),(height//2+3,mix(g('ink'),face,.64)),(height-4,mix(g('ink'),face,.60))]:
     l([(ax,ay+k),(bx,by+k)],col)
  p(poly,g('plain'));l(poly+[poly[0]],g('hi'))
  p([(cx+(x-cx)*.74,cy+(y-cy)*.70-4) for x,y in poly],mix(g('plain'),g('hi'),.32))
  l(poly[5:9],mix(g('hi'),g('snow'),.25))
 def cluster(x,y,rx,ry,n):
  ps=sorted([(round(x+rng.uniform(-rx,rx)),round(y+rng.uniform(-ry,ry))) for _ in range(n)],key=lambda p:p[1])
  for x,y in ps:
   w=rng.randrange(3,9);h=rng.randrange(4,14);dep=rng.randrange(2,5)
   cube(x,y,w,h,dep,mix(g('ice'),g('snow'),rng.uniform(.05,.36)),mix(g('ink'),g('ice'),.48),mix(g('ink'),g('plain'),.27))
 # Pixel speckle flats for backdrop, not fog/smooth gradients.
 for k in range(105):
  x=rng.randrange(W);y=rng.randrange(H); r=rng.randrange(7,31); q=rng.randrange(4,15)
  p([(x-r,y+2),(x-r//2,y-q),(x+r//4,y-q-1),(x+r,y-2),(x+r//2,y+q),(x-r//3,y+q+2)],mix(g('earth'),g('plain'),rng.uniform(.05,.83)))
 if name=='pikes-peak':
  mountain(289,100,112,85,42,True);mountain(191,105,96,86,50,True)
  grove(266,164,96,51,105,g('deep'),4,10)
  mountain(103,157,95,108,62,True)
  grove(67,223,69,29,71,g('deep'),3,10);grove(225,222,57,25,84,g('deep'),3,9)
  # Broad east-facing sweep and summit visitor deck, small weather observatory.
  p([(49,137),(77,113),(104,107),(144,118),(148,126),(113,135),(73,145)],mix(g('ice'),g('snow'),.47))
  cube(91,127,23,12,12,g('snow'),g('deep'),g('ink'));cube(118,130,11,23,7,g('snow'),g('deep'),g('ink'))
  l([(123,103),(123,89)],g('ink'),2);l([(119,97),(129,97)],g('accent'))
  p([(271,221),(307,197),(327,195),(351,202),(367,226),(338,240),(300,244)],g('ink'))
  p([(269,219),(306,200),(329,198),(353,210),(359,224),(334,234),(295,238)],g('ice'))
  l([(274,218),(305,200),(330,198),(343,202)],g('snow'),2)
  cluster(334,126,22,13,13)
 elif name=='moki-dugway':
  # Colorado Plateau shelves, two Monument Valley-inspired mittens and sandstone spires.
  p([(-5,219),(26,210),(78,179),(101,181),(119,158),(160,153),(204,131),(257,134),(302,99),(384,87),(400,252),(-5,267)],mix(g('earth'),g('ink'),.24))
  mesa(75,62,72,23,29,2);mesa(78,52,59,20,20,0)
  mesa(308,73,91,34,52,2.72);mesa(338,60,57,23,28,1)
  mesa(298,66,25,12,27,3);mesa(318,41,9,6,37,2)
  mesa(107,103,26,12,47,0);mesa(135,77,9,5,40,2)
  mesa(192,112,19,9,40,1);mesa(211,93,7,5,37,3)
  mesa(45,192,37,16,42,3.12);mesa(16,188,23,12,28,2)
  mesa(335,168,55,17,29,1.7);mesa(333,151,43,18,22,0.2)
  # Isolated gooseneck blue-black water ribbon in the far southwest, not a road.
  q=[(-8,244),(29,241),(68,218),(91,218),(123,239),(161,242),(176,222),(164,209),(148,200)]
  river(q,4,g('ink'),mix(g('deep'),g('ice'),.61))
  for k in range(32):
   x=rng.randrange(116,300);y=rng.randrange(163,250);zz=rng.randrange(1,5);l([(x-zz,y),(x,y-zz),(x+zz,y)],mix(g('earth'),g('ink'),.32))
 elif name=='oak-creek-canyon':
  # High red walls fork beneath an elevated wooded plateau; deep north-south creek.
  q=[(198,-10),(198,32),(224,57),(211,91),(193,113),(180,151),(213,169),(221,185),(185,215),(194,260)]
  l(spline(q),mix(g('earth'),g('ink'),.64),63)
  l(spline(q),g('deep'),44);river(q,6,g('deep'),g('ice'))
  mesa(78,70,95,37,50,1);mesa(82,58,66,26,31,3);mesa(58,29,47,26,30,1)
  mesa(307,100,84,40,54,2);mesa(308,82,62,30,39,.1);mesa(336,53,42,24,38,2)
  mesa(66,167,58,26,34,3);mesa(62,149,39,21,21,1)
  mesa(307,199,81,27,45,3);mesa(330,183,42,18,28,2)
  grove(160,162,31,79,72,g('deep'),4,10);grove(226,198,20,44,38,g('deep'),4,10)
  grove(315,56,51,21,36,g('deep'),4,8);grove(90,59,64,19,43,g('deep'),4,9)
  cube(147,220,14,11,7,g('accent'),mix(g('earth'),g('hi'),.24),g('deep'))
  cube(156,232,8,7,4,g('accent'),g('earth'),g('ink'))
 elif name=='angeles-crest':
  # Pacific and foothills. Coast keeps left; towers over the coastal basin, rocky
  # San Gabriel range behind, several snow patches rather than all-white ground.
  coast=[(0,73),(19,105),(32,115),(35,134),(57,155),(68,162),(59,190),(79,215),(106,239),(131,256),(0,256)]
  p(coast,g('ink'));l(coast[:-2],g('ice'),12);l(coast[:-2],mix(g('ice'),g('snow'),.59),3)
  for i in range(154):
   x=rng.randint(2,80);y=rng.randint(99,251)
   if im.getpixel((x,y))==g('ink'):
    l([(x,y),(x+rng.randint(1,5),y)],mix(g('ink'),g('ice'),rng.uniform(.2,.53)))
  mountain(281,105,100,91,46,True); mountain(338,139,91,81,39,True);mountain(211,101,89,69,46,False)
  grove(291,184,99,48,110,g('deep'),3,9)
  cluster(106,166,36,31,38);cluster(146,209,50,30,55);cluster(185,159,39,22,33)
  for x,y,w,h,dep,col in [(88,177,14,31,8,'ice'),(105,165,14,48,8,'plain'),(125,169,13,40,9,'ice'),(142,173,18,57,7,'ice'),(152,185,16,36,8,'plain'),(173,184,12,43,7,'ice')]:
   cube(x,y,w,h,dep,mix(g('ice'),g('snow'),.44),mix(g('ink'),g(col),.45),g('ink'))
  for x0,y0 in [(112,117),(151,116),(181,141)]:l([(x0,y0),(x0,y0-9)],g('accent'))
  # Pier silhouettes and the warm port lights, with untouched coastline.
  p([(62,205),(82,210),(81,215),(63,211)],mix(g('ink'),g('plain'),.50));l([(64,206),(81,211)],g('accent'))
  cube(104,213,22,8,7,g('ice'),g('plain'),g('ink'))
 # Clustered colored highlights, no paths/icons/artifact labels.
 for i in range(2030):
  x=rng.randrange(W-3);y=rng.randrange(H-1);base=im.getpixel((x,y))
  if rng.random()<.5: l([(x,y),(x+rng.choice([0,0,1,1,2]),y)],mix(base,g('snow'),rng.uniform(.09,.28)))
  else:d.point((x,y),fill=mix(base,g('ink'),.14))
 return im
def write():
 sha=lambda b:hashlib.sha256(b).hexdigest()
 receipt={}; thumbs=[]
 for i,name in enumerate(COLORS,8):
  im=render(name);asset='campaign-map-'+name;png=Path('assets/campaign-art/maps')/(asset+'.png');dest=OUT/png;dest.parent.mkdir(parents=True,exist_ok=True)
  im.resize((1536,1024),Image.Resampling.NEAREST).save(dest,optimize=True)
  doc={'kind':'actor-state-animation','width':W,'height':H,'fps':1,'frames':[['#%02x%02x%02xff'%c for c in im.getdata()]],'importSource':{'path':png.as_posix(),'sha256':sha(dest.read_bytes()),'width':1536,'height':1024,'sampling':'nearest-neighbor','maxEdge':384}}
  raw=json.dumps(doc,separators=(',',':')).encode()
  encoded=json.dumps({'__chainsawStorage':'compact-v1','encoding':'json-gzip-base64','data':base64.b64encode(gzip.compress(raw,mtime=0)).decode()},indent=2)+'\n'
  ar=Path('data/server-storage/files/art')/asset;dd=OUT/ar;dd.mkdir(parents=True,exist_ok=True)
  (dd/'document.json').write_text(encoded)
  (dd/'metadata.json').write_text(json.dumps({'name':asset,'folder':'art','savedAt':1795319520000,'version':1},indent=2)+'\n')
  paths=[png,ar/'document.json',ar/'metadata.json']
  receipt[str(i)]={str(p):{'sha256':sha((OUT/p).read_bytes()),'bytes':(OUT/p).stat().st_size} for p in paths}
  thumbs.append((name,im))
 s=Image.new('RGB',(800,565),'#1f242d');d=ImageDraw.Draw(s)
 for i,(n,im) in enumerate(thumbs):
  x=(i%2)*400+7;y=(i//2)*282+5;s.paste(im,(x,y));d.text((x+8,y+258),n,fill='white')
 s.save(ROOT/'art-contact.png');(ROOT/'generated-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
if __name__=='__main__':write()
