"""Three original central-world attraction boards; no authored road or UI layer."""
from PIL import Image,ImageDraw,ImageFilter
from pathlib import Path
import json,hashlib,gzip,base64,random,math
R=Path(__file__).resolve().parent
W,H=384,256
def rgb(c):
 if isinstance(c,tuple):return c
 c=c.lstrip('#');return tuple(int(c[i:i+2],16) for i in (0,2,4))
def mix(a,b,t):
 return tuple(max(0,min(255,round(x+(y-x)*t))) for x,y in zip(rgb(a),rgb(b)))
def catmull(points, steps=18):
 p=[points[0],*points,points[-1]]
 return [(round(.5*((2*b[0])+(-a[0]+c[0])*t+(2*a[0]-5*b[0]+4*c[0]-e[0])*t*t+(-a[0]+3*b[0]-3*c[0]+e[0])*t**3)),
          round(.5*((2*b[1])+(-a[1]+c[1])*t+(2*a[1]-5*b[1]+4*c[1]-e[1])*t*t+(-a[1]+3*b[1]-3*c[1]+e[1])*t**3)))
   for a,b,c,e in zip(p,p[1:],p[2:],p[3:]) for j in range(steps) for t in [j/steps]]
class Board:
 def __init__(self,name,dark,mid,warm):
  self.im=Image.new('RGB',(W,H));self.d=ImageDraw.Draw(self.im);self.r=random.Random(name)
  self.dark,self.mid,self.warm=map(rgb,(dark,mid,warm))
  pix=self.im.load()
  for y in range(H):
   for x in range(W):
    n=(math.sin(x*.045+y*.073)+.6*math.sin(x*.112-y*.086)+.33*math.cos(x*.28+y*.23))*.08
    l=(1-math.hypot((x-196)/245,(y-121)/190))*.38
    pix[x,y]=mix(self.dark,self.mid,max(.05,min(.85,.48+n+l+self.r.uniform(-.045,.045))))
  self.solid=Image.new('L',(W,H));self.md=ImageDraw.Draw(self.solid)
 def glow(self,x,y,col,r=10):
  # Soft tiled additive halo, pixels stay in the game's dusk palette.
  pix=self.im.load();col=rgb(col)
  for yy in range(max(0,y-r),min(H,y+r+1)):
   for xx in range(max(0,x-r),min(W,x+r+1)):
    z=((x-xx)/(r+.01))**2+((y-yy)/(r*.78+.01))**2
    if z<1:pix[xx,yy]=mix(pix[xx,yy],col,(1-z)**2*.44)
 def light(self,x,y,col='#ffbb62',r=5,long=2):
  self.glow(x,y,col,r);self.d.line((x,y,x+long,y),fill=rgb(col));self.d.point((x,y),fill=(255,237,171))
 def plate(self,x,y,a,b,height,tops,wall):
  d=self.d;q=[];phase=self.r.random()*6
  for i in range(17):
   t=i/16*math.tau;k=1+.11*math.sin(t*3+phase)+.06*math.sin(t*5+phase)
   q.append((int(x+math.cos(t)*a*k),int(y+math.sin(t)*b*k)))
  d.polygon([(xx+8,yy+height+5) for xx,yy in q],fill=mix(wall,self.dark,.47))
  for k in range(height,0,-1):
   c=mix(wall,self.dark,.2+((k*17)%9)*.036)
   d.polygon([(xx,yy+k) for xx,yy in q],fill=c)
   if k%4==2:d.line([(xx,yy+k) for xx,yy in q[:9]],width=1,fill=mix(c,self.warm,.21))
  d.polygon(q,fill=tops)
  d.line(q[:10],fill=mix(tops,self.warm,.35),width=2)
  d.line(q[8:],fill=mix(tops,self.dark,.40),width=2)
  for i in range(25):
   xx=x+self.r.randint(-a//2,a//2);yy=y+self.r.randint(-max(1,b//2),max(1,b//2))
   if 0<=xx<W and 0<=yy<H:d.line((xx,yy,xx+self.r.randint(1,5),yy),fill=mix(tops,self.warm,self.r.uniform(.14,.4)))
 def river(self,pts,width,water='#123d49',rim='#586355',foam='#5f9f9a'):
  d=self.d;r=self.r;q=catmull(pts)
  d.line(q,fill=mix(rim,self.dark,.53),width=width+19,joint='curve')
  d.line(q,fill=rim,width=width+9,joint='curve')
  d.line(q,fill=water,width=width,joint='curve')
  self.md.line(q,width=width+4,fill=255,joint='curve')
  for x,y in q[::4]:
   off=r.randint(-width//3,width//3)
   if 0<=x+off<W-10 and 0<=y<H and self.solid.getpixel((x+off,y)):
    c=mix(water,foam,r.uniform(.22,.57)); d.line((x+off,y,x+off+r.randint(3,10),y),fill=c)
  return q
 def grove(self,x,y,a,b,num,colors):
  pts=[]
  for i in range(num):
   t=self.r.random()*math.tau;v=math.sqrt(self.r.random())
   xx=round(x+a*v*math.cos(t));yy=round(y+b*v*math.sin(t))
   if not (4<=xx<W-5 and 5<=yy<H-4) or self.solid.getpixel((xx,yy)):continue
   pts.append((yy,xx,self.r.randint(2,6),self.r.choice(colors)))
  for y,x,h,c in sorted(pts):
   d=self.d;d.ellipse((x-1,y-1,x+h+2,y+3),fill=mix(c,self.dark,.7))
   if h<=3:
    d.polygon([(x,y-h*2),(x-h,y-1),(x+h,y)],fill=c)
    d.line((x,y-h*2,x-h+1,y-1),fill=mix(c,self.warm,.31))
   else:
    d.ellipse((x-h,y-h-4,x+h,y+1),fill=mix(c,self.dark,.38))
    d.ellipse((x-h,y-h-6,x+h-2,y-2),fill=c)
    d.ellipse((x-h+1,y-h-5,x-1,y-4),fill=mix(c,self.warm,.18))
   d.point((x,y+1),fill=mix(c,self.warm,.46))
 def xy(self,c,u,v,z=0):return round(c[0]+u-v),round(c[1]+.47*(u+v)-z)
 def block(self,c,u,v,z,w,l,h,top,left,right,edge=None):
  p=lambda X,Y,Z:self.xy(c,X,Y,Z)
  A,B,C,D=(p(u,v,z+h),p(u+w,v,z+h),p(u+w,v+l,z+h),p(u,v+l,z+h))
  a,b,cc,d=(p(u,v,z),p(u+w,v,z),p(u+w,v+l,z),p(u,v+l,z))
  self.d.polygon([d,cc,(cc[0]+8,cc[1]+4),(d[0]+8,d[1]+4)],fill=mix(left,self.dark,.55))
  self.d.polygon([D,C,cc,d],fill=left);self.d.polygon([B,C,cc,b],fill=right);self.d.polygon([A,B,C,D],fill=top)
  if edge:self.d.line([D,A,B],fill=edge);self.d.line([B,C,D],fill=mix(edge,self.dark,.48))
  return A,B,C,D
 def roof(self,c,u,v,z,w,l,h,roof1,roof2,edge):
  p=lambda X,Y,Z:self.xy(c,X,Y,Z)
  a,b,cc,d=[p(X,Y,z) for X,Y in [(u,v),(u+w,v),(u+w,v+l),(u,v+l)]]
  e,f=p(u+w/2,v,z+h),p(u+w/2,v+l,z+h)
  self.d.polygon([a,d,f,e],fill=roof1);self.d.polygon([e,b,cc,f],fill=roof2)
  self.d.line([a,e,f],fill=edge,width=1);self.d.line([d,f,cc],fill=mix(edge,self.dark,.38),width=1)
  for j in range(3,l,4):
   self.d.line([p(u+w/2,v+j,z+h),p(u+w,v+j,z)],fill=mix(roof2,self.dark,.19))
 def cylinder(self,x,y,r,h,top,body,shadow,rim):
  d=self.d;yr=max(2,round(r*.37));d.ellipse((x-r+4,y-yr+2,x+r+11,y+yr+7),fill=mix(shadow,self.dark,.65))
  d.rectangle((x-r,y-h,x+r,y),fill=body);d.ellipse((x-r,y-yr,x+r,y+yr),fill=body)
  for q in range(-r+1,r,2):d.line((x+q,y-h,x+q,y+round(yr*math.sqrt(1-(q/r)**2))),fill=mix(body,top,.14+(.27*(1-q/r)/2)))
  d.rectangle((x+r//2,y-h,x+r,y),fill=shadow);d.ellipse((x-r,y-h-yr,x+r,y-h+yr),fill=top)
  d.arc((x-r,y-h-yr,x+r,y-h+yr),180,360,fill=rim,width=1)
  d.ellipse((x-r//2,y-h-yr//2,x+r//2,y-h+yr//2),outline=mix(rim,body,.33))
 def finish(self):
  d=self.d;r=self.r
  for i in range(570):
   x=r.randrange(2,W-3);y=r.randrange(3,H-3);c=self.im.getpixel((x,y))
   if max(c)<105:d.line((x,y,x+r.choice([0,1,1,2]),y),fill=mix(c,self.warm,.10))
  return self.im

def ozarks():
 b=Board('8575-ozark-broken-frost','#142130','#5b5542','#e2b56d');d=b.d;r=b.r
 for x,y,a,h,t in [(34,30,76,27,16),(61,81,90,22,13),(310,27,85,35,22),(340,55,78,26,18),(346,198,86,31,28),(320,216,105,30,18),(68,211,84,25,12),(87,229,73,17,10)]:
  b.plate(x,y,a,h,t,r.choice(['#445b4f','#4c5148','#506353']),'#71644e')
 b.river([(-8,154),(43,150),(81,122),(122,104),(154,108),(173,129),(167,152),(171,173),(217,192),(257,200),(277,218),(291,258)],22,'#133c4b','#577064','#7baeb0')
 d.ellipse((130,115,183,148),fill='#225e66',outline='#698f84',width=2)
 for i in range(22):
  x=r.randrange(138,174);y=r.randrange(122,141);d.line((x,y,x+r.randrange(2,9),y),fill=r.choice(['#46918f','#2e6f79','#427e7e']))
 for x,y,a,h,n in [(53,42,67,35,200),(71,86,67,30,175),(270,37,89,29,250),(300,74,72,31,150),(330,214,73,42,175),(55,220,72,33,180),(205,226,64,17,90),(264,186,51,26,110)]:
  b.grove(x,y,a,h,n,['#293f3a','#455646','#495e4b','#55583d','#293b36','#696c4c'])
 # The actual turbine-driven Alley Mill, no fantasy waterwheel: tall red walls, pale gables, warm windows.
 c=(183,155)
 b.block(c,-6,-3,0,66,42,6,'#797564','#494c44','#3b3832','#b2a586')
 b.block(c,3,3,6,52,31,38,'#99564d','#854b42','#4d3031','#d88b66')
 b.roof(c,0,1,44,58,36,24,'#aaa18a','#62666a','#efd8af')
 b.block(c,33,4,63,8,8,17,'#80746d','#8e6153','#502e32','#c4a286')
 for k in (18,30,40):
  for u in range(9,54,12):
   x,y=b.xy(c,u,34,k);d.rectangle((x-1,y-4,x+3,y+3),fill='#34262d')
   b.light(x,y-2,'#ffb45f',5,2);d.line((x+1,y-1,x+3,y),fill='#b76e45')
 for v in range(7,29,10):
  for k in (20,32):
   x,y=b.xy(c,55,v,k);d.rectangle((x-1,y-3,x+3,y+2),fill='#352632');b.light(x,y,'#df9a4f',5,2)
 d.line(((147,158),(162,168),(180,160)),fill='#948474',width=5)
 d.line(((147,156),(162,166),(180,158)),fill='#cdada1',width=1)
 for x,y in [(147,157),(161,166),(180,158),(244,175),(234,176)]:b.light(x,y,'#f7b466',7,2)
 # Small lodge and canoe landing are visual attractions, not menu routes.
 for x,y,v in [(224,184,0),(251,167,1),(111,151,2),(98,162,3)]:
  b.block((x,y),0,0,0,12,9,8,'#77694e','#736042','#423a36','#a58a61')
  b.roof((x,y),-1,-1,8,14,11,5,'#8c6d51','#4b4643','#be9d71');b.light(x+3,y-2,'#f6b063',4,1)
 for i in range(30):
  x=r.randrange(310,376);y=r.randrange(42,112);c=b.im.getpixel((x,y));d.line((x,y,x+r.randrange(1,3),y),fill=mix(c,'#93a3a1',.24))
 return b.finish()

def data_center():
 b=Board('8575-great-stacks','#141a35','#62534d','#cc986e');d=b.d;r=b.r
 for x,y,a,h,z in [(43,39,54,20,5),(94,65,85,24,8),(337,46,89,26,9),(292,191,106,39,9),(75,211,90,36,6)]:
  b.plate(x,y,a,h,z,'#585550','#403d46')
 b.river([(340,-15),(322,26),(340,71),(320,127),(336,172),(368,220),(380,260)],15,'#152b45','#4d525a','#587d90')
 c=(144,131)
 b.block(c,-21,-16,0,154,102,5,'#343846','#434253','#212737','#777578')
 b.block(c,-16,-12,5,140,88,10,'#54545e','#434452','#2a304a','#8691a6')
 b.block(c,-5,-4,15,113,62,39,'#263d63','#152743','#1b2344','#3e7998')
 # Six different heights, roof links and cool exhaust highlights.
 ts=[(3,3,26,19,62),(33,4,27,19,85),(63,4,26,20,72),(88,7,23,16,58),(27,32,27,20,58),(64,33,32,20,65)]
 for u,v,w,l,h in sorted(ts,key=lambda a:a[0]+a[1]):
  b.block(c,u,v,49,w,l,h,'#3e6680','#193c62','#0d2142','#72a6b3')
  b.block(c,u+4,v+2,49+h,w-8,l-5,5,'#65a7b2','#365474','#22435f','#bce4d9')
  for k in range(56,48+h,8):
   for j in range(4,w-2,5):
    x,y=b.xy(c,u+j,v+l,k)
    d.line((x-1,y,x+2,y+1),fill=r.choice(['#4596c1','#3883b3','#66c0db','#2679a7']))
    if (j+k)%8==0:d.point((x,y-1),fill='#a4f4ee')
   for j in range(3,l-3,5):
    x,y=b.xy(c,u+w,v+j,k);d.point((x,y),fill='#54a8cd')
  x,y=b.xy(c,u+w//2,v+l//2,54+h)
  if h>68:
   d.line((x,y,x,y-14),fill='#7993a8');b.light(x,y-14,'#ffaf82',7,1)
  else:d.ellipse((x-4,y-2,x+5,y+2),outline='#8fc3d1')
 # Broad iconic luminous intake wall, cooling forest and vapor tanks.
 for x,y,radius,height in [(225,165,12,31),(247,171,14,42),(267,180,12,31),(224,190,11,23),(252,197,12,25)]:
  b.cylinder(x,y,radius,height,'#5696a3','#345773','#19334f','#a0e4e5')
  d.arc((x-radius,y-height+3,x+radius,y-height+13),0,180,fill='#68dfe4',width=2)
  d.arc((x-radius,y-6,x+radius,y+4),0,180,fill='#4faeb9',width=2)
  b.glow(x,y-height,'#50dee0',16)
 for x,y,rr,h in [(283,155,5,59),(296,159,5,66),(310,166,6,77)]:
  b.cylinder(x,y,rr,h,'#827870','#596371','#303b55','#b8aa8c')
  for j in range(16,h-8,13):d.line((x-rr,y-j,x+rr,y-j+2),fill='#b98773',width=2)
  b.light(x,y-h-1,'#ff9c69',7,1)
 for u in range(0,106,10):
  x,y=b.xy(c,u,60,27);b.light(x,y,'#64e3eb',7,3)
 for j in range(18):
  x=96+(j%6)*14;y=190+j//6*10
  b.block((x,y),0,0,0,8,6,7,'#5c7371','#574f55','#262d4c','#89989c')
  if j%2:b.light(x+1,y-3,'#ffb468',4,2)
 for x,y in [(79,181),(91,172),(105,165),(136,192),(160,203),(204,199),(221,215),(286,198),(305,204)]:b.light(x,y,'#ffb966',9,2)
 d.line(((208,173),(231,184),(268,184),(289,174),(315,179)),fill='#1a304b',width=5)
 d.line(((208,171),(231,182),(268,182),(289,172),(315,177)),fill='#53b7ca',width=2)
 return b.finish()

def route66():
 b=Board('8575-route66-exposed-verge','#241d32','#93674d','#eda463');d=b.d;r=b.r
 for x,y,a,h,z in [(44,72,70,28,22),(54,60,65,25,20),(70,51,58,23,28),(318,37,87,24,14),(307,50,70,24,15),(44,209,77,25,20),(58,194,61,21,14),(319,212,85,35,22),(313,198,69,19,14)]:
  b.plate(x,y,a,h,z,r.choice(['#b17d54','#a96c4d','#875748','#975b4e']),'#68454a')
 for x,y,a,h,n in [(77,122,88,28,80),(262,115,75,28,67),(204,228,63,24,70),(357,145,40,40,65)]:
  b.grove(x,y,a,h,n,['#463b39','#615043','#685943','#795945','#463d3d'])
 # Shamrock-inspired Art Deco service station, pylon and low wraparound canopy.
 c=(198,145)
 b.block(c,-24,-14,0,148,68,4,'#796151','#4b3e42','#44323b','#967354')
 b.block(c,7,4,4,91,34,18,'#af8462','#9b6c55','#634c50','#e3ad77')
 b.block(c,2,33,4,117,19,16,'#d5a67c','#986348','#71504b','#f4c584')
 b.block(c,4,34,20,115,24,5,'#efaf7d','#bf7955','#654647','#ffe0a1')
 b.block(c,16,5,22,24,19,21,'#c49a79','#a0795b','#795652','#f7cea0')
 b.block(c,21,8,43,16,12,20,'#dfab79','#9b6c52','#7d514b','#ffe0a1')
 b.block(c,23,11,63,12,7,20,'#e5b47b','#a76f54','#7d4c47','#f8cb92')
 b.block(c,26,12,83,6,5,8,'#e0b480','#9e775d','#63444b','#ffda8d')
 for k in (29,46,65,82):
  x,y=b.xy(c,26,18,k);b.light(x,y,'#fba34f',9,2)
 for j in range(14,112,9):
  x,y=b.xy(c,j,57,19);b.light(x,y,'#ffae73',8,4);d.line((x+2,y+4,x+2,y+13),fill='#482e35')
 for j in range(17,96,13):
  x,y=b.xy(c,j,34,13);d.rectangle((x-2,y-1,x+5,y+4),fill='#4c383c');b.light(x,y,'#f2bf76',5,3)
 for x,y in [(239,169),(260,179),(281,188),(303,185)]:
  d.ellipse((x-8,y-3,x+12,y+4),fill='#633b3c')
  d.rectangle((x,y-6,x+6,y+2),fill='#50363d');b.light(x+2,y-5,'#ffb366',5,3)
 # A diegetic Route 66 shield: no title, menu decoration, or connecting road.
 sx,sy=291,104
 d.line((sx,sy+17,sx,sy+65),fill='#492f32',width=5)
 d.line((sx-1,sy+18,sx-1,sy+65),fill='#bc8863',width=1)
 shield=[(sx-17,sy-11),(sx-10,sy-15),(sx,sy-12),(sx+10,sy-15),(sx+17,sy-11),(sx+15,sy+5),(sx+9,sy+13),(sx,sy+19),(sx-9,sy+13),(sx-15,sy+5)]
 b.glow(sx,sy+4,'#ff8d67',24);d.polygon(shield,fill='#4f3447')
 d.line(shield+[shield[0]],fill='#ffd394',width=2)
 d.text((sx-7,sy-4),'66',fill='#ffe1a4',stroke_width=1,stroke_fill='#a95249')
 # Repeated tiny pony-truss spans over an exposed dry wash, away from map paths.
 wash=catmull([(-14,174),(36,158),(71,149),(103,128),(129,110),(150,90)])
 d.line(wash,fill='#493841',width=13,joint='curve');d.line(wash,fill='#674550',width=5,joint='curve')
 for i in range(5):
  x=84+i*10;y=144-i*4
  d.line([(x,y),(x+3,y-8),(x+10,y-11),(x+11,y-4),(x,y)],fill='#d0a47d',width=1)
  d.line((x+3,y-8,x+7,y-2),fill='#8b6c60',width=1)
 for x,y in [(55,148),(110,194),(162,186),(189,199),(307,166)]:b.light(x,y,'#eda55e',6,2)
 return b.finish()

boards={'ozarks':ozarks,'data-center-city':data_center,'route-66':route66}
def sha(b):return hashlib.sha256(b).hexdigest()
def oid(b):return hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()
record={}
for name,fn in boards.items():
 im=fn(); ref='campaign-map-'+name
 path=Path('assets/campaign-art/maps')/(ref+'.png')
 native=Path('data/server-storage/files/art')/ref/'document.json'
 png=R/'overlay'/path; np=R/'overlay'/native
 png.parent.mkdir(exist_ok=True,parents=True);np.parent.mkdir(exist_ok=True,parents=True)
 im.resize((1536,1024),Image.Resampling.NEAREST).save(png,optimize=True)
 pb=png.read_bytes()
 out={'kind':'actor-state-animation','width':W,'height':H,'fps':1,'frames':[['#%02x%02x%02xff'%c for c in im.getdata()]],'importSource':{'path':path.as_posix(),'sha256':sha(pb),'width':1536,'height':1024,'sampling':'nearest-neighbor','maxEdge':384}}
 compact=json.dumps(out,separators=(',',':')).encode()
 raw=(json.dumps({'__chainsawStorage':'compact-v1','encoding':'json-gzip-base64','data':base64.b64encode(gzip.compress(compact,mtime=0)).decode()},indent=2)+'\n').encode()
 np.write_bytes(raw);im.save(R/f'{name}-native.png')
 record[ref]={'sourcePath':path.as_posix(),'sourceSHA256':sha(pb),'sourceGitBlob':oid(pb),'nativePath':native.as_posix(),'nativeSHA256':sha(raw),'nativeGitBlob':oid(raw),'pngBytes':len(pb),'nativeBytes':len(raw)}
(R/'inventory.json').write_text(json.dumps(record,indent=2)+'\n')
sheet=Image.new('RGB',(1152,278),'#111c2a');d=ImageDraw.Draw(sheet)
for i,k in enumerate(boards):
 sheet.paste(Image.open(R/f'{k}-native.png'),(384*i,0))
 d.text((384*i+12,260),k,fill='#efd3b2')
sheet.save(R/'contact.png')
