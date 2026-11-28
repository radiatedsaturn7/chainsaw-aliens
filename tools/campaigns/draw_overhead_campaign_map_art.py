"""Draw all eleven frozen regional campaign landscapes and native Art files."""
from draw_regional_map_art import W,H,P,Image,ImageDraw,math,random,mix,rgb
import draw_regional_map_art as prior
import json
# Hand-positioned massif/woodland/cliff polygons at common source coordinates;
# every listed system is individually composed rather than swapping palettes.
G={
'providence':dict(water=[(-30,139),(60,131),(107,104),(174,115),(228,132),(255,155),(270,184),(282,221),(300,275)],wood=[(67,66,96,59),(309,75,80,85),(86,213,77,51)],town=[(239,181,32),(216,159,10),(225,202,13)],peaks=[(258,65,83,66)],tone='#324f51'),
'mount-washington':dict(wood=[(62,98,79,98),(307,166,89,103),(139,230,127,42)],peaks=[(190,99,109,99),(261,63,64,65),(137,53,62,62)],ice=1,tone='#44677a'),
'laurel-highlands':dict(wood=[(45,55,72,83),(277,46,116,62),(331,219,69,61)],peaks=[(81,71,118,67),(250,93,117,65),(324,209,124,54)],fields=[(129,161),(179,184),(240,155),(193,118)],tone='#526255'),
'ohio-river':dict(water=[(-40,70),(38,83),(96,96),(139,138),(187,154),(249,124),(292,124),(332,154),(420,153)],wide=15,wood=[(62,183,104,62),(220,76,103,74),(328,214,74,65)],peaks=[(95,211,112,62),(251,51,113,64)],town=[(196,178,9),(232,86,6)],bridge=(193,148,12),tone='#435d5c'),
'ozarks':dict(water=[(47,-20),(69,38),(143,68),(153,110),(204,135),(219,186),(180,220),(185,278)],wide=4,wood=[(81,127,104,97),(314,66,97,83),(302,210,77,70)],peaks=[(72,110,101,81),(241,80,109,79),(300,209,98,58)],fields=[(229,173)],tone='#3c5347'),
'data-center-city':dict(water=[(315,-25),(305,35),(327,75),(310,124),(332,167),(343,215),(420,251)],wide=20,town=[(116,104,28),(181,115,41),(239,147,29),(128,192,20)],industrial=1,wood=[(23,47,69,60),(39,210,53,65)],tone='#444955'),
'route-66':dict(peaks=[(64,34,73,38),(263,52,116,48),(328,219,81,62)],cliffs=1,fields=[(129,187),(179,203)],town=[(183,139,7)],wood=[(79,127,97,77),(291,147,106,76)],scrub=1,tone='#8b6956'),
'pikes-peak':dict(peaks=[(119,154,124,96),(89,66,71,58),(251,124,100,85)],ice=1,wood=[(39,177,67,75),(327,78,75,75),(311,220,89,56)],tone='#4d6679'),
'moki-dugway':dict(peaks=[(84,68,122,69),(293,137,113,72),(79,222,100,66)],water=[(160,-15),(152,44),(182,82),(206,137),(166,186),(207,271)],wide=7,cliffs=1,wood=[(45,139,62,77),(309,48,76,80)],scrub=1,tone='#936352'),
'oak-creek-canyon':dict(peaks=[(107,79,117,84),(286,97,102,89),(81,210,104,69),(305,229,100,67)],water=[(222,-20),(210,31),(192,71),(218,116),(211,155),(181,194),(220,278)],wide=6,cliffs=1,wood=[(203,119,45,114),(133,159,69,58),(276,177,55,80)],tone='#865f52'),
'angeles-crest':dict(peaks=[(256,83,122,92),(316,128,112,92),(254,197,104,73)],town=[(94,167,49),(139,203,25),(89,91,17)],wood=[(291,46,68,54),(305,195,79,69)],tone='#675f68'),
}
def overhead(name):
 cfg=G[name]; rng=random.Random(name+'overhead2')
 _,_,far,mid,near,earth,frost,light,ink=map(rgb,P[name]); original=rgb(cfg['tone'])
 dry=bool(cfg.get('cliffs') or cfg.get('scrub'))
 urban=bool(cfg.get('industrial'))
 ground=mix((170,197,220) if not dry else (161,179,203),original,.12 if not dry else .26)
 if urban:ground=(143,166,194)
 frost=(224,240,249);light=(239,246,250);ink=(33,48,85)
 near=mix((77,107,160),near,.2 if not dry else .35);mid=mix((107,135,177),mid,.2 if not dry else .34)
 far=(81,105,154);earth=mix((95,110,149),earth,.3 if dry else .10)
 im=Image.new('RGB',(W,H),ground);d=ImageDraw.Draw(im)
 def mix2(c,t):return mix(c,light if t>=0 else ink,abs(t))
 def oval(cx,cy,a,b,profile,phase):
  return [(int(cx+a*math.cos(t)*f),int(cy+b*math.sin(t)*f)) for i in range(36) for t in [i*math.tau/36] for f in [1+profile*(math.sin(3*t+phase)+.5*math.sin(7*t+phase))]]
 terrain=Image.new('L',(W,H),0); td=ImageDraw.Draw(terrain)
 for j in range(65):
  x=rng.randrange(W);y=rng.randrange(H)
  q=oval(x,y,rng.randrange(8,49),rng.randrange(5,25),.10,rng.random()*3)
  d.polygon(q,fill=mix2(ground,rng.uniform(-.12,.31)))
 for peakno,(x,y,a,b) in enumerate(cfg.get('peaks',[])):
  phase=rng.random()*6
  for level,f in enumerate([1,.84,.67,.50,.35,.22]):
   cx=x-(1-f)*12;cy=y-(1-f)*9
   change=.05+.052*level
   c=mix(ground, frost if cfg.get('ice') else light, change*(1.65 if cfg.get('ice') else 1))
   q=oval(cx,cy,a*f,b*f,.16 if not cfg.get('cliffs') else .075,phase)
   if cfg.get('cliffs'):
    q=[(xx//4*4,yy//3*3) for xx,yy in q]
    d.polygon([(xx+3,yy+5) for xx,yy in q],fill=mix2(c,-.33))
   else:d.polygon([(xx+2,yy+3) for xx,yy in q],fill=mix2(c,-.24))
   d.polygon(q,fill=c);td.polygon(q,fill=min(255,40+level*32))
   d.line(q[-10:]+q[:6],fill=mix2(c,.18 if cfg.get('cliffs') else .13),width=2)
   d.line(q[9:21],fill=mix2(c,-.19),width=1)
   if cfg.get('ice') and level>=3:
    for k in range(8):
     r=rng.randrange(len(q)); xx,yy=q[r]
     d.line([(xx,yy),(int(xx*.83+cx*.17),int(yy*.82+cy*.18))],fill=mix(c,frost,.65),width=1)
  if cfg.get('ice'):
   q=oval(x-8,y-7,a*.20,b*.19,.22,phase)
   d.polygon(q,fill=mix(mid,frost,.68));d.line(q[11:26],fill=frost,width=2)
   if name=='mount-washington' and peakno==0:
    d.rectangle((x-12,y-12,x-4,y-7),fill=ink);d.line((x-12,y-12,x-5,y-12),fill=frost)
 def spline(points):
  p=[points[0],*points,points[-1]]
  return [(round(.5*((2*b[0])+(-a[0]+c[0])*t+(2*a[0]-5*b[0]+4*c[0]-e[0])*t*t+(-a[0]+3*b[0]-3*c[0]+e[0])*t**3)),
   round(.5*((2*b[1])+(-a[1]+c[1])*t+(2*a[1]-5*b[1]+4*c[1]-e[1])*t*t+(-a[1]+3*b[1]-3*c[1]+e[1])*t**3)))
   for a,b,c,e in zip(p,p[1:],p[2:],p[3:]) for j in range(17) for t in [j/16]]
 mask=Image.new('L',(W,H),0);md=ImageDraw.Draw(mask)
 if cfg.get('water'):
  q=spline(cfg['water']);width=cfg.get('wide',19)
  water=(39,70,137)
  if name=='moki-dugway':water=(87,80,85)
  if name=='providence':
   shore=[(268,175),(265,188),(269,201),(262,215),(251,231),(225,254),(223,271),(384,271),(384,193),(369,194),(352,207),(338,211),(315,199),(304,201),(291,190),(281,185),(277,173)]
   d.polygon(shore,fill=water);d.line(shore[:-1],fill=mix(near,frost,.64),width=2);md.polygon(shore,fill=255)
   for k in range(110):
    wx=rng.randrange(162,384);wy=rng.randrange(161,256)
    if mask.getpixel((wx,wy)):d.line((wx,wy,wx+rng.randrange(1,8),wy),fill=mix(water,frost,.25))
   q=[(qx,qy) for qx,qy in q if qy<182]
  if name=='moki-dugway':
   widths=[12+7*math.sin(j*.097)+3*math.sin(j*.57) for j in range(len(q))]
   dry=[(int(x-w),y) for (x,y),w in zip(q,widths)]+[(int(x+w*.63),y) for (x,y),w in zip(reversed(q),reversed(widths))]
   d.polygon(dry,fill=mix(ground,ink,.40));md.polygon(dry,fill=255)
   d.line(dry[:len(q)],fill=mix(ground,light,.18),width=2)
   q=[]
  if q:
   d.line(q,fill=mix(earth,ink,.6),width=width+12)
   d.line(q,fill=(210,235,246),width=width+6)
   d.line(q,fill=water,width=width,joint='curve')
  if q:md.line(q,fill=255,width=width+5)
  for x,y in q[::6]:
   if 0<=x<W-2 and 0<=y<H and mask.getpixel((x,y)):d.line((x-2,y,x+2,y),fill=mix(water,frost,.45))
 if name=='providence':
  # Massachusetts Bay bites into the upper/east edge beside the Boston stop;
  # place the node on the Boston peninsula, not in the harbor.
  shore=[(371,-8),(372,5),(366,11),(370,18),(359,28),(361,35),(352,43),(361,50),(356,61),(376,70),(390,85),(399,-8)]
  d.polygon(shore,fill=(31,63,132));d.line(shore[:-1],fill=(218,238,249),width=2);md.polygon(shore,fill=255)
 # Cracked plates, ice seams and chipped floes only inside broad frozen water.
 for i in range(650):
  x=rng.randrange(3,W-10);y=rng.randrange(3,H-6)
  if not mask.getpixel((x,y)):continue
  col=im.getpixel((x,y))
  if not (col[0]<86 and col[2]>col[0]+50):continue
  r=rng.choice([1,2,3,5,7])
  pts=[(x-r,y+1),(x-r//2,y-r//2),(x+r-2,y-r//2-1),(x+r,y),(x+1,y+r//2+1)]
  if all(0<=xx<W and 0<=yy<H and mask.getpixel((xx,yy)) for xx,yy in pts):
   d.polygon(pts,fill=rng.choice([(96,148,203),(121,173,220),(149,196,229),(174,217,238)]))
   d.line(pts[1:3],fill=(210,234,246),width=1)
 for x,y in cfg.get('fields',[]):
  for j in range(3):
   xx=x+j*6;yy=y+j*8; w=rng.randrange(21,44)
   d.polygon([(xx-12,yy),(xx+w,yy-9),(xx+w+6,yy-3),(xx-7,yy+6)],fill=mix2(ground,.14+j*.06))
   for k in range(4):d.line((xx+k*5,yy+2,xx+w-k*3,yy-4),fill=mix2(ground,-.11))
 for x,y,a,b in cfg.get('wood',[]):
  for i in range(255 if not cfg.get('scrub') else 124):
   t=rng.random()*math.tau; rr=math.sqrt(rng.random());xx=round(x+a*rr*math.cos(t));yy=round(y+b*rr*math.sin(t))
   if not (2<=xx<W-2 and 2<=yy<H-2) or mask.getpixel((xx,yy)) or terrain.getpixel((xx,yy))>165 and cfg.get('ice'):continue
   col=im.getpixel((xx,yy));size=2 if cfg.get('scrub') else rng.choice([2,3,3,4])
   if cfg.get('scrub'):
    d.line((xx-1,yy,xx,yy-1,xx+1,yy),fill=mix2(col,-.36))
   else:
    d.rectangle((xx-1,yy,xx+size,yy+1),fill=mix2(col,-.28))
    d.polygon([(xx,yy-size),(xx-size,yy+1),(xx+size-1,yy+1)],fill=mix(ink,col,.35))
    if rng.random()<(.94 if cfg.get('ice') else .75):d.line((xx-1,yy-size+1,xx-size,yy),fill=mix(col,frost,.72))
 for x,y,count in cfg.get('town',[]):
  for i in range(count):
   if cfg.get('industrial'):
    xx=x+(i%6)*10-35+rng.randrange(-2,3);yy=y+(i//6)*9-20;w=rng.randrange(4,10);h=rng.randrange(3,7)
   else:
    t=rng.random()*math.tau;rr=math.sqrt(rng.random());xx=round(x+rr*math.cos(t)*count*.9);yy=round(y+rr*math.sin(t)*count*.52);w=rng.randrange(2,6);h=rng.randrange(3,8)
   if not (0<=xx<W-8 and 0<=yy<H-8) or mask.getpixel((xx,yy)):continue
   d.rectangle((xx+1,yy+2,xx+w+2,yy+h+2),fill=ink)
   d.rectangle((xx,yy,xx+w,yy+h),fill=mix(near,far,.46))
   d.line((xx,yy,xx+w,yy),fill=mix(frost,far,.42))
   if w>=4 and rng.random()<.4:d.point((xx+w//2,yy+h),fill=light)
 if name=='providence':
  # Boston: deliberately distinct waterfront skyline, piers, and dense icy
  # blue roofs centered at normalized GPS (0.9, 0.1) = (346,26).
  for x,y,w,h,side in [(331,17,5,10,3),(338,11,7,15,3),(348,14,6,13,3),(357,10,5,11,2),(325,29,5,8,3),(334,30,7,10,3),(344,32,6,9,3),(353,30,5,10,2),(362,22,4,6,2),(332,43,5,6,2),(344,44,7,6,2)]:
   d.polygon([(x,y),(x+w,y),(x+w+side,y+side),(x+side,y+side)],fill=(216,233,245))
   d.polygon([(x,y),(x+side,y+side),(x+side,y+h+side),(x,y+h)],fill=(56,70,115))
   d.polygon([(x+side,y+side),(x+w+side,y+side),(x+w+side,y+h+side),(x+side,y+h+side)],fill=(89,113,155))
   d.line((x+side+1,y+side+3,x+w+side-1,y+side+3),fill=(166,201,225))
  d.line((344,10,344,5),fill=(61,85,129));d.line((361,38,375,38),fill=(136,161,189),width=2)
  d.line((362,42,374,42),fill=(143,177,199),width=2)
 if cfg.get('bridge'):
  # Sculptural silhouette in river; not a connection or route line.
  x,y,s=cfg['bridge'];d.line((x-s,y-s,x+s,y+s),fill=ink,width=3);d.line((x-s,y-s-2,x+s,y+s-2),fill=frost)
  for z in (-6,5):d.rectangle((x+z,y+z-4,x+z+1,y+z+2),fill=ink)
 for i in range(2120):
  x=rng.randrange(W);y=rng.randrange(H);c=im.getpixel((x,y))
  d.line((x,y,x+rng.choice([0,0,1,2,3]),y),fill=mix(c,frost,rng.choice([.12,.17,.24,.28])))
 # Muted peripheral texture; frozen terrain fills the frame edge to edge.
 p=im.load()
 for y in range(H):
  for x in range(W):
   e=max(abs(x-W/2)/(W/2),abs(y-H/2)/(H/2))
   if e>.55:p[x,y]=mix(p[x,y],ink,(e-.55)*.24)
 return im
if __name__=='__main__':
 prior.render=overhead
 prior.emit()
 for meta in (prior.OUT/'data/server-storage/files/art').glob('campaign-map-*/metadata.json'):
  value=json.loads(meta.read_text());value['savedAt']=1795319520000
  meta.write_text(json.dumps(value,indent=2)+'\n')
