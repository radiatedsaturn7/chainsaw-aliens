#!/usr/bin/env python3
"""Deterministic hand-authored pixel landscape compositor, Pillow required."""
from PIL import Image,ImageDraw
from pathlib import Path
import random,math,json,gzip,base64,hashlib
W,H=384,256
ROOT=Path(__file__).resolve().parent
OUT=ROOT/'overlay'
# sky, horizon, distant ridge, mid ridge, near ridge, earth, frost, light, ink
P={
'providence':('#233749','#bd8f7e','#776d83','#4b6170','#375962','#364c52','#b5c9bf','#ead4a5','#233337'),
'mount-washington':('#344c71','#ddbbad','#868eb1','#6b879e','#4c7181','#557986','#d5e5de','#fcf0cf','#2b465a'),
'laurel-highlands':('#536077','#d5ab86','#998696','#7b7d7a','#626e61','#535c52','#c4c2a1','#ecd7aa','#323f3c'),
'ohio-river':('#52687d','#b2b7a9','#777d87','#586f74','#45646b','#415762','#b2cfbd','#e1ddbc','#29394a'),
'ozarks':('#3f4e61','#cfaa8a','#8a7b84','#607271','#476359','#3d5148','#c1c7a1','#edcf9c','#283c35'),
'data-center-city':('#253344','#aa8894','#646078','#515763','#494e58','#313c4a','#b2c9c3','#f1c88e','#202936'),
'route-66':('#526d87','#eeae7d','#af7e7b','#9b6c5f','#916b57','#826956','#c7b79b','#ffe1a1','#503e3c'),
'pikes-peak':('#416d9c','#d9cad2','#8d9cbe','#647a9e','#56748c','#526b78','#e0edf0','#fff2df','#344756'),
'moki-dugway':('#5e6681','#e9ab83','#a47785','#a76b5f','#9a5d51','#85594d','#c9b4aa','#fcd7a5','#563d46'),
'oak-creek-canyon':('#4c6c83','#e3b38d','#ae8185','#aa716c','#965c59','#6f5e55','#cec9ac','#f8ddae','#483d47'),
'angeles-crest':('#3f627f','#efa893','#b78293','#856f83','#5f6578','#525a61','#c8bfb7','#fad7a7','#313d4c'),
}
# Five hand-drawn horizon/land contours per region; y at successive x steps.
L={
'providence':[[106,100,105,92,113,107,99,110,98],[139,125,135,123,148,134,145,123,130],[184,148,160,178,175,182,153,146,171]],
'mount-washington':[[126,112,108,66,32,80,105,92,118],[145,124,136,101,103,120,134,116,137],[171,145,172,186,174,186,178,148,149]],
'laurel-highlands':[[107,98,89,87,97,83,87,104,113],[141,121,108,129,144,132,116,119,134],[168,154,144,169,181,171,150,145,157]],
'ohio-river':[[101,88,91,105,120,115,94,89,102],[129,108,111,125,143,147,123,104,120],[147,127,141,173,190,187,158,134,146]],
'ozarks':[[104,96,107,122,117,104,90,94,110],[134,108,113,138,147,141,113,115,127],[161,144,162,183,196,175,148,138,153]],
'data-center-city':[[109,115,102,110,117,113,104,101,112],[138,133,128,144,135,137,127,130,138],[167,161,157,170,164,157,155,159,166]],
'route-66':[[109,104,106,113,107,106,96,98,113],[138,136,124,132,141,145,128,120,131],[168,168,157,165,170,172,166,162,164]],
'pikes-peak':[[121,96,117,84,41,64,102,91,118],[149,124,143,120,94,127,145,124,127],[175,153,161,171,181,167,160,150,160]],
'moki-dugway':[[99,105,101,94,105,104,91,102,97],[137,111,124,143,150,138,122,113,128],[166,142,158,181,202,188,155,147,156]],
'oak-creek-canyon':[[112,104,99,109,120,100,91,95,108],[147,125,118,144,158,126,115,119,138],[175,153,155,193,214,194,156,144,155]],
'angeles-crest':[[102,93,104,87,82,91,108,89,103],[139,117,130,105,113,128,136,116,127],[164,143,145,164,176,165,144,137,149]],
}
def rgb(c):return tuple(bytes.fromhex(c[1:]))
def mix(a,b,t):return tuple(round(x+(y-x)*t) for x,y in zip(a,b))
def render(name):
 p=list(map(rgb,P[name]));sky,haze,far,mid,near,earth,frost,light,ink=p
 rng=random.Random(name);im=Image.new('RGB',(W,H));d=ImageDraw.Draw(im)
 def poly(q,c):d.polygon(q,fill=c)
 def ln(q,c,w=1):d.line(q,fill=c,width=w)
 def rect(q,c):d.rectangle(q,fill=c)
 def ridge(ys,c,jit=3):
  pts=[(0,ys[0])]
  for i,(a,b) in enumerate(zip(ys,ys[1:])):
   for j in range(1,9):pts.append((i*48+j*6,round(a+(b-a)*j/8)+(rng.randrange(-jit,jit+1) if j<8 else 0)))
  poly([*pts,(W,H),(0,H)],c);return pts
 def snowpeak(cx,cy,w,h):
  q=[(cx-w,cy+h),(cx-w//2,cy+h//2),(cx-19,cy+h//4),(cx,cy),(cx+13,cy+8),(cx+26,cy+27),(cx+w,cy+h)]
  poly(q,mid);poly([(cx-w,cy+h),(cx,cy),(cx+7,cy+31),(cx-16,cy+44),(cx-13,cy+65)],mix(mid,ink,.30))
  poly([(cx-45,cy+50),(cx-19,cy+17),(cx,cy),(cx+13,cy+8),(cx+28,cy+31),(cx+37,cy+46),(cx+8,cy+31),(cx+4,cy+41),(cx-6,cy+28),(cx-19,cy+47),(cx-20,cy+36)],frost)
  poly([(cx,cy),(cx+13,cy+8),(cx+28,cy+31),(cx+5,cy+18),(cx+8,cy+31)],light)
  for k in range(18):
   x=cx+rng.randrange(-w//2,w//2);y=cy+abs(x-cx)//2+rng.randrange(29,h-3)
   if abs(x-cx)<(y-cy)*.8:ln([(x,y),(x-4,y+7)],mix(mid,frost,.28))
 def pine(x,y,s,snow=.5):
  poly([(x-1,y),(x+1,y),(x+1,y+s//5),(x-1,y+s//5)],ink)
  for i in [2,1,0]:
   yy=y-i*s//4;ww=s*(4-i)//10
   poly([(x,yy-s//2),(x-ww,yy+2),(x+ww,yy+1)],mix(ink,near,.18+i*.12))
   if rng.random()<snow:ln([(x,yy-s//2+2),(x-ww+1,yy)],mix(near,frost,.69),1)
 def grove(box,n,small,big,snow=.5):
  x1,y1,x2,y2=box
  plants=sorted([(rng.randrange(x1,x2),rng.randrange(y1,y2),rng.randrange(small,big)) for _ in range(n)],key=lambda q:q[1])
  for x,y,s in plants:pine(x,y,s,snow)
 def cabin(x,y,s=1):
  q=lambda a,b:(x+a*s,y+b*s)
  poly([q(-12,0),q(10,0),q(10,-12),q(-12,-12)],mix(near,ink,.45))
  poly([q(-15,-11),q(-5,-20),q(7,-20),q(14,-11)],ink)
  ln([q(-15,-12),q(-5,-21),q(7,-21),q(13,-13)],frost)
  rect([q(-8,-10),q(-5,-7)],mix(near,light,.62));rect([q(2,-10),q(6,-4)],ink)
 def mesa(x,y,w,h):
  poly([(x-w,y+h),(x-w+13,y+h//2),(x-w+27,y+7),(x-13,y+5),(x-5,y),(x+w-18,y+2),(x+w-14,y+11),(x+w,y+h)],mid)
  poly([(x-w+24,y+12),(x-w+29,y+6),(x-9,y+5),(x-5,y),(x+w-18,y+2),(x+w-19,y+8),(x-6,y+9),(x-18,y+14)],mix(mid,frost,.51))
  for g in range(5):
   k=10+g*h//7;ln([(x-w+18,y+k+3),(x+9,y+k-1),(x+w-13,y+k+1)],mix(mid,light,.14+g*.035),1)
  poly([(x+w-19,y+8),(x+w-14,y+11),(x+w,y+h),(x+w-25,y+h),(x+w-34,y+22)],mix(mid,ink,.32))
 for y in range(H):
  t=min(y/145,1); v=round(t*19)/19
  rect((0,y,W,y),mix(sky,haze,v))
 for i in range(64):
  x=rng.randrange(W); y=rng.randrange(8,116); mx=mix(sky,haze,y/145)
  ln([(x,y),(x+rng.randrange(2,24),y)],mix(mx,light,rng.uniform(.07,.24)))
 sunc=(247,73) if name in ('angeles-crest','route-66','moki-dugway') else (228,62)
 r=15 if name in ('angeles-crest','route-66') else 9
 if name in ('providence','data-center-city'):sunc=(236,47);r=8
 d.ellipse((sunc[0]-r,sunc[1]-r,sunc[0]+r,sunc[1]+r),fill=mix(haze,light,.75))
 if name in ('providence','data-center-city'):
  d.ellipse((sunc[0]-r-3,sunc[1]-r-3,sunc[0]+r-3,sunc[1]+r-3),fill=mix(sky,haze,sunc[1]/145));
 ridge(L[name][0],far)
 if name=='mount-washington':
  snowpeak(189,28,91,113)
  rect((177,44,190,48),ink);ln([(182,44),(182,38),(187,38)],ink)
 if name=='pikes-peak':
  snowpeak(200,34,101,119);snowpeak(278,91,45,61)
 if name=='route-66':mesa(166,104,59,53);mesa(304,108,65,46)
 ridge(L[name][1],mid)
 for i in range(35):
  y=rng.randrange(112,161);x=rng.randrange(W)
  ln([(x,y),(x+rng.randrange(2,18),y-1)],mix(mid,frost,.20))
 ridge(L[name][2],near)
 poly([(0,218),(57,206),(103,208),(162,230),(203,220),(255,207),(322,207),(384,199),(384,256),(0,256)],earth)
 for i in range(235):
  x=rng.randrange(W);y=rng.randrange(190,256);t=rng.choice([.20,.34,.46])
  ln([(x,y),(x+rng.randrange(1,8),y)],mix(im.getpixel((x,y)),frost,t))
 if name=='providence':
  # Downtown cluster beside estuary; bare woods and lab at right.
  poly([(0,189),(87,176),(153,183),(222,163),(251,168),(189,185),(119,201),(61,213),(0,209)],mix(near,far,.35))
  for x,b,w,h in [(125,172,12,25),(137,172,12,35),(150,175,16,52),(166,172,13,29),(182,168,9,22),(193,168,14,39),(211,169,9,19),(225,170,18,26)]:
   rect((x,b-h,x+w,b),ink);rect((x+1,b-h+3,x+3,b),mid)
   for a in range(x+3,x+w,4):
    for z in range(b-h+7,b-3,5):
     if rng.random()<.28:rect((a,z,a+1,z+1),mix(mid,light,.61))
  poly([(149,125),(154,120),(163,120),(166,125)],ink)
  cabin(290,188,1);grove((0,164,98,246),58,8,34);grove((268,152,384,241),64,7,30)
 elif name=='mount-washington':
  for x in range(0,384,17):
   y=194+int(9*math.sin(x/28));poly([(x,y),(x+41,y-18),(x+63,y-11),(x+75,y-13),(x+51,y+2)],mix(near,frost,.39))
  grove((0,148,141,255),112,7,29,.83);grove((255,145,383,252),97,7,27,.9);grove((140,200,263,254),47,6,16,.92)
 elif name=='laurel-highlands':
  for q in [[(84,181),(152,148),(193,167),(142,195)],[(148,198),(200,172),(262,192),(222,214)],[(196,219),(269,198),(321,229),(258,240)]]:
   poly(q,mix(earth,frost,.31))
   for off in range(2,18,3):ln([(q[0][0]+off,q[0][1]+off//4),(q[1][0]+off,q[1][1]+off//3)],mix(earth,light,.38))
  cabin(190,177);cabin(218,194);grove((0,139,86,245),72,5,26);grove((302,150,384,248),60,7,25)
 elif name=='ohio-river':
  q=[(384,142),(319,140),(269,147),(231,172),(204,180),(170,179),(120,172),(78,182),(39,204),(0,220),(0,245),(77,214),(112,194),(156,193),(205,201),(243,196),(279,172),(324,152),(384,154)]
  poly(q,mix(near,far,.27));ln(q[:10],frost,2)
  for i in range(68):
   x=rng.randrange(W); y=rng.randrange(140,245)
   if im.getpixel((x,y))==mix(near,far,.27):ln([(x,y),(x+4,y)],mix(far,frost,.53))
  # Distant skeletal bridge silhouette, no deck drawn through the active route.
  for x in (195,226):
   ln([(x,173),(x,152),(x+2,149),(x+3,171)],ink,2)
  ln([(188,158),(198,156),(208,161),(218,156),(232,158)],ink)
  grove((0,145,128,181),43,7,18);grove((275,187,384,255),67,6,28);cabin(248,206)
 elif name=='ozarks':
  for x,y in [(61,177),(267,176),(296,184),(105,204)]:
   poly([(x-26,y+8),(x-18,y-9),(x+3,y-13),(x+28,y-8),(x+23,y+5)],mix(near,frost,.44))
   ln([(x-21,y-3),(x+2,y-7),(x+20,y-3)],frost)
  poly([(177,168),(188,188),(231,202),(204,222),(155,254),(128,255),(153,235),(196,215),(209,203),(173,190)],(84,112,118))
  ln([(178,171),(188,188),(231,202),(204,222),(155,254)],mix(near,frost,.53))
  cabin(225,181);grove((0,123,135,251),99,5,28);grove((256,125,384,248),96,6,26)
 elif name=='data-center-city':
  for x,y,w,h in [(56,135,53,24),(119,148,57,31),(205,145,84,34),(277,168,70,22),(94,200,66,28),(231,207,89,29),(153,177,74,21)]:
   poly([(x,y),(x+w,y+8),(x+w,y+8-h),(x,y-h)],ink)
   poly([(x,y-h),(x+15,y-h-9),(x+w+13,y-h-1),(x+w,y+8-h)],mid)
   ln([(x+15,y-h-8),(x+w+12,y-h-1)],frost)
   for xx in range(x+5,x+w-10,8):rect((xx,y-h+10+(xx-x)//10,xx+3,y-h+12+(xx-x)//10),mix(mid,light,.44))
  for x,y in [(110,140),(277,132),(281,138),(202,163),(208,164),(213,165)]:
   rect((x,y-14,x+3,y),ink)
  for k in range(14):
   x=24+k*25;y=229+(k%3)*4;rect((x,y-6,x+2,y),ink)
  for x,y in [(107,91),(262,91),(303,83)]:
   ln([(x,y+20),(x+2,y),(x+5,y+20)],ink,2)
 elif name=='route-66':
  for y in [157,178,195,204]:ln([(1,y),(98,y-4),(227,y),(384,y-3)],mix(earth,frost,.35))
  cabin(193,183,1);rect((173,177,211,180),ink);ln([(176,176),(207,176)],frost)
  ln([(233,176),(233,145),(245,145),(245,177)],ink,2);d.ellipse((228,137,250,147),fill=near,outline=ink)
  for i in range(96):
   x=rng.randrange(W);y=rng.randrange(186,255);ln([(x-3,y),(x,y-4),(x+3,y)],mix(earth,ink,.64))
 elif name in ('moki-dugway','oak-creek-canyon'):
  for x,y,w in ([(68,120,85),(309,106,103)] if name=='moki-dugway' else [(45,111,82),(323,100,85)]):
   mesa(x,y,w,81)
   for j in range(3):
    ln([(x-w+14,y+32+j*13),(x+7,y+32+j*13),(x+w-9,y+35+j*13)],mix(mid,ink,.29),2)
  poly([(193,162),(214,180),(194,208),(243,244),(238,256),(196,252),(170,211),(198,181),(186,163)],mix(near,far,.48))
  if name=='oak-creek-canyon':
   grove((115,159,191,250),60,5,22);grove((220,170,285,254),62,5,25);cabin(225,215)
  else:
   for i in range(50):
    x=rng.randrange(W);y=rng.randrange(198,255);ln([(x-3,y),(x,y-3),(x+2,y)],mix(earth,ink,.63))
 elif name=='pikes-peak':
  poly([(0,247),(58,184),(103,176),(142,164),(162,155),(141,188),(94,207),(56,253)],mix(near,frost,.55))
  for x,y in [(123,205),(248,215),(305,182)]:
   poly([(x-25,y),(x-13,y-13),(x+14,y-15),(x+25,y-8),(x+19,y+3)],mix(earth,far,.52))
   ln([(x-16,y-10),(x+14,y-15),(x+26,y-8)],light)
  grove((0,160,142,246),63,8,29,.7);grove((255,157,384,252),72,8,24,.72)
 elif name=='angeles-crest':
  poly([(0,192),(63,193),(110,187),(163,196),(238,213),(188,229),(103,223),(47,237),(0,231)],mix(earth,haze,.38))
  for i in range(93):
   x=rng.randrange(0,177);y=rng.randrange(169,214);h=rng.randrange(2,10)
   rect((x,y-h,x+rng.randrange(2,7),y),mix(ink,far,.22))
   if rng.random()<.46:rect((x+1,y-h+2,x+1,y-h+2),light)
  for x,y in [(179,195),(245,200),(275,184),(331,187)]:
   poly([(x-8,y),(x+5,y-13),(x+29,y-19),(x+36,y-15),(x+25,y-2)],mix(mid,frost,.47))
  grove((227,173,384,256),63,6,26,.20)
 # Cold air, glints, and a subtle pixel vignette keep edges from competing with overlay.
 for i in range(83):
  x=rng.randrange(W);y=rng.randrange(H);c=im.getpixel((x,y));d.point((x,y),fill=mix(c,frost,.29))
 pix=im.load()
 for y in range(H):
  for x in range(W):
   edge=max(abs(x-W/2)/(W/2),abs(y-H/2)/(H/2))
   if edge>.71:pix[x,y]=mix(pix[x,y],ink,(edge-.71)*.63)
 return im
def emit():
 manifests={};renders=[]
 for name in P:
  im=render(name); asset='campaign-map-'+name
  path=Path('assets/campaign-art/maps')/(asset+'.png')
  png=OUT/path;png.parent.mkdir(parents=True,exist_ok=True)
  im.resize((1536,1024),Image.Resampling.NEAREST).save(png,optimize=True)
  sha=lambda b:hashlib.sha256(b).hexdigest()
  doc={'kind':'actor-state-animation','width':W,'height':H,'fps':1,'frames':[['#%02x%02x%02xff'%c for c in im.getdata()]],'importSource':{'path':path.as_posix(),'sha256':sha(png.read_bytes()),'width':1536,'height':1024,'sampling':'nearest-neighbor','maxEdge':384}}
  raw=json.dumps(doc,separators=(',',':')).encode()
  encoded=json.dumps({'__chainsawStorage':'compact-v1','encoding':'json-gzip-base64','data':base64.b64encode(gzip.compress(raw,mtime=0)).decode()},indent=2)+'\n'
  dest=OUT/'data/server-storage/files/art'/asset
  dest.mkdir(parents=True,exist_ok=True)
  (dest/'document.json').write_text(encoded);(dest/'metadata.json').write_text(json.dumps({'name':asset,'folder':'art','savedAt':1795305600000,'version':1},indent=2)+'\n')
  manifests[asset]={'nativePath':f'art/{asset}/document.json','sourcePath':path.as_posix(),'sourceSHA256':sha(png.read_bytes()),'nativeSHA256':sha(encoded.encode()),'aspect':'3:2'}
  renders.append((name,im))
 (ROOT/'inventory.json').write_text(json.dumps(manifests,indent=2)+'\n')
 sheet=Image.new('RGB',(1056,785),'#20222c');draw=ImageDraw.Draw(sheet)
 for i,(n,im) in enumerate(renders):
  x=(i%3)*352+10;y=(i//3)*195+8
  sheet.paste(im.resize((250,167)),(x,y))
  sheet.paste(im.crop((120,0,264,256)).resize((88,156)),(x+252,y))
  draw.text((x,y+173),n,fill='#ebd7ae')
 sheet.save(ROOT/'contact.png')
if __name__=='__main__':emit()
