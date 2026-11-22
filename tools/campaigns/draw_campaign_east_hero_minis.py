from PIL import Image,ImageDraw
from pathlib import Path
import random
from colorsys import rgb_to_hsv,hsv_to_rgb
ROOT=None
class P:
 def __init__(self): self.im=Image.new('RGBA',(96,80)); self.d=ImageDraw.Draw(self.im)
 def p(self,poly,c): self.d.polygon(poly,fill=c)
 def r(self,box,c): self.d.rectangle(box,fill=c)
 def l(self,pts,c,w=1): self.d.line(pts,fill=c,width=w)
 def e(self,box,c): self.d.ellipse(box,fill=c)
 def base(self,kind):
  self.e((13,51,84,62),(9,19,34,46)); self.e((18,53,81,60),(9,19,34,54))
  self.p([(10,50),(14,44),(30,39),(60,42),(72,42),(87,48),(81,55),(61,58),(45,57),(29,59)],'#1c2c40')
  self.p([(10,50),(14,44),(30,39),(60,42),(72,42),(87,48),(78,53),(60,57),(45,55),(29,57)],'#7893a0' if kind=='city' else '#8da4ab')
  self.l([(12,48),(27,42),(42,42),(56,44),(65,44),(72,43),(84,48)],'#d4e7e4')
  self.l([(13,51),(28,56),(39,55),(47,56),(60,56),(77,52)],'#4e6877')
 def wall(self,x,y,w,h,z,front,side,roof):
  self.p([(x,y-h),(x+z,y-h-z),(x+w+z,y-h-z),(x+w,y-h)],roof)
  self.p([(x+w,y-h),(x+w+z,y-h-z),(x+w+z,y-z),(x+w,y)],side)
  self.r((x,y-h,x+w-1,y),front)
  self.l([(x,y-h),(x+w,y-h)],'#b6cfcc')
 def windows(self,x,y,w,h,stride=4,c='#8dd8cd',seed=0):
  rng=random.Random(seed)
  for a in range(x+2,x+w-1,stride):
   for b in range(y-h+3,y-1,4):
    v=rng.randrange(7)
    self.r((a,b,a+1,b+1),c if v<=1 else '#ffca79' if v==2 else '#233c50')
 def roof(self,x,y,w,h=7,front='#975e4b'):
  self.wall(x,y,w,h,4,front,'#513b45','#b7d3d1')
  self.p([(x-1,y-h),(x+4,y-h-5),(x+w+1,y-h-5),(x+w,y-h)],'#d2e3df')
  self.l([(x-1,y-h),(x+4,y-h-5),(x+w,y-h-5)],'#f3e6c9')
  self.r((x+2,y-4,x+4,y-3),'#ffc478')
  self.r((x+w-4,y-5,x+w-2,y-2),'#243b50')
 def water(self,poly):
  self.p(poly,'#2b576e');self.l(poly+[poly[0]],'#9bc9ce')
 def dome(self,x,y,scale=1,gold=False):
  def c(a,b):return x+round(a*scale),y+round(b*scale)
  self.wall(*c(-13,0),round(26*scale),round(7*scale),3,
            '#ae8462' if gold else '#aebcb4','#4b5a60','#c7dbd4')
  self.r((*c(-7,-10),*c(7,-7)),'#a6744b' if gold else '#79938e')
  self.e((*c(-7,-18),*c(7,-8)),'#e7af58' if gold else '#dbe7d6')
  self.l([c(-5,-15),c(-3,-17),c(0,-18),c(3,-17)],'#ffeab9' if gold else '#fbf8e1')
  self.l([c(0,-20),c(0,-18)],'#e0e6c7')
  self.r((*c(0,-22),*c(1,-20)),'#d3a45f')
  for t in [-9,-5,-1,3,7]:self.l([c(t,-6),c(t,-1)],'#e6e3c4')
 def spruce(self,x,y):
  self.p([(x,y-8),(x-4,y-2),(x-2,y-2),(x-5,y+1),(x+5,y+1),(x+2,y-2),(x+4,y-2)],'#244c52')
  self.l([(x,y-8),(x-3,y-3),(x,y-4),(x-4,y)],'#a8ced0')
 def save(self,region,file):
  p=ROOT/region/file;p.parent.mkdir(parents=True,exist_ok=True)
  # Art 8575 is keyed around rich blue shadows, pale ice and warm signals.
  # Grade only opaque artwork; keep the soft contact shadow unchanged.
  palette={}
  pixels=list(self.im.get_flattened_data()) if hasattr(self.im,"get_flattened_data") else list(self.im.getdata())
  for color in set(pixels):
   r,g,b,alpha=color
   if alpha!=255:
    palette[color]=color;continue
   h,s,v=rgb_to_hsv(r/255,g/255,b/255)
   if h<.16 and s>.20:
    h=min(h,.109);s=min(.89,s*1.13+.08);v=min(1,v*1.05)
   elif .27<h<.70 or s<.20:
    h=.58+(h-.53)*.12;s=min(.86,s*1.24+(.21 if v<.68 else .13))
    v=min(1,v*.97+(.09 if v>.70 else .005))
   r2,g2,b2=hsv_to_rgb(h,s,v)
   palette[color]=(round(r2*255),round(g2*255),round(b2*255),alpha)
  self.im.putdata([palette[pixel] for pixel in pixels])
  framed=Image.new("RGBA",(96,80))
  framed.alpha_composite(self.im.resize((86,72),Image.Resampling.NEAREST),(5,6))
  framed.resize((192,160),Image.Resampling.NEAREST).save(p,optimize=True)

def boston():
 a=P();a.base('city')
 a.water([(10,47),(17,43),(28,41),(45,42),(48,47),(58,48),(67,45),(79,43),(87,48),(77,53),(60,57),(45,55),(29,57)])
 for x,y,w in [(14,48,13),(23,52,13),(33,50,12),(37,54,6),(63,53,11),(69,50,12),(52,54,7)]:
  a.l([(x,y),(x+w,y-2)],'#71bac2'); a.l([(x+2,y-1),(x+w-3,y-2)],'#bbd6d0')
 # Dark broken waterfront skyline, deliberately behind the local silhouettes.
 for x,y,w,h,z,f in [(18,40,8,13,3,'#426473'),(26,39,9,18,4,'#426174'),(34,40,7,21,4,'#507782'),(63,39,9,25,4,'#4b6871'),(73,41,8,16,3,'#426273')]:
  a.wall(x,y,w,h,z,f,'#27404f','#8eaaa6');a.windows(x,y,w,h,3,seed=x)
 for x,y,w in [(46,49,7),(57,46,8),(66,48,7),(69,50,8),(75,48,7),(54,50,8)]:a.roof(x,y,w)
 # Custom House: pale square shaft, 2-stage clock chamber and copper spire.
 a.wall(49,48,12,27,5,'#aeb8a5','#5b7274','#c4d4c1')
 for dy in range(24,45,5): a.r((51,dy,52,dy+2),'#65828b');a.r((56,dy,58,dy+2),'#38576b')
 a.wall(48,22,14,6,4,'#d1c6a0','#6c807b','#a9c9b6')
 a.e((51,16,58,22),'#434757'); a.e((52,17,57,21),'#eedcb2')
 a.l([(55,17),(55,19),(57,20)],'#374654')
 a.p([(49,16),(51,11),(54,5),(57,5),(61,15)],'#7bb3a7')
 a.p([(56,5),(61,15),(64,12),(59,5)],'#526f6b')
 a.l([(53,7),(54,4),(57,4)],'#d4dac2')
 a.r((55,3,55,4),'#ffd582')
 # Old North's tall bone-white bell spire, on a brick lower body.
 a.wall(66,45,7,12,3,'#a36a58','#4e464d','#d4dcd0')
 a.r((67,29,71,38),'#d8ded1');a.r((68,31,69,33),'#ffbd65')
 a.r((68,26,70,28),'#abc4bc');a.p([(67,26),(69,19),(71,26)],'#679087')
 # Zakim's striped steel deck and twin asymmetric cable fans.
 front=[(12,48),(20,48),(26,46),(33,43),(40,41),(48,40)]
 a.l(front,'#344d60',4);a.l([(x,y-1) for x,y in front],'#d6e4db')
 for x,y in [(23,46),(38,42)]:
  a.l([(x-3,y+3),(x,y-9),(x,y-15)],'#e5eadb',2)
  a.l([(x+4,y+2),(x,y-9)],'#71949d')
  for u in (-7,-4,5,10):
   a.l([(x,y-13),(x+u,y-round(u*.3))],'#a2c7cb')
  a.r((x,y-16,x+1,y-16),'#ffc76d')
 a.dome(39,52,.62,True)
 a.save('providence','stop-7.png')
def providence():
 a=P();a.base('city')
 a.water([(37,42),(44,43),(49,46),(46,47),(39,51),(41,55),(49,56),(61,57),(73,53),(81,51),(75,49),(63,49),(56,47),(55,44),(46,42)])
 a.e((37,45,50,50),'#8ebac2');a.e((39,45,49,49),'#40758c')
 a.l([(37,49),(42,52),(48,51),(51,48)],'#b8d7d0')
 for x,y,w,h,z in [(19,44,8,13,3),(29,43,8,16,3),(42,44,7,14,4),(61,42,8,15,4),(69,44,7,15,3),(77,49,5,13,3)]:
  a.wall(x,y,w,h,z,'#637984','#334e5f','#96b7b5');a.windows(x,y,w,h,3,seed=x)
 for x,y,w in [(15,50,7),(26,48,8),(39,52,7),(51,52,8),(69,50,8),(73,52,7)]:a.roof(x,y,w)
 # The primary Art Deco limestone shaft and increasingly narrow set-backs.
 a.wall(52,50,12,30,5,'#a7b4a8','#596c73','#abcacf')
 a.wall(54,20,9,6,4,'#b6c0b0','#557078','#a7c3b8')
 a.wall(56,14,6,5,3,'#adc5b2','#4d7273','#cfe1c7')
 a.wall(57,9,4,4,2,'#6eaa92','#416f62','#b3d6b7')
 a.l([(59,5),(59,2)],'#e1e4ce');a.r((59,1,60,2),'#ffc068')
 a.l([(53,22),(53,48)],'#d1d2b9');a.windows(52,50,12,29,3,seed=52);a.windows(54,20,9,6,3,seed=54)
 a.l([(54,49),(64,49)],'#b6c9c0')
 # The State House really has the bigger pale dome (contrast Boston gold).
 a.dome(31,46,1.05,False)
 a.l([(32,21),(34,18),(34,16)],'#efce82')
 a.p([(21,46),(39,46),(43,49),(18,49)],'#b7c8c5')
 a.l([(21,47),(39,47)],'#e9e8ce');a.l([(19,49),(43,49)],'#89aaa7')
 for x,y,w in [(54,55,9),(62,53,9),(72,52,4)]:a.l([(x,y),(x+w,y-1)],'#84cad0')
 a.save('providence','stop-5.png')
def washington():
 a=P();a.base('terrain')
 # White Mountains summit profile, steep eastern slopes and below-treeline spruce.
 a.p([(12,51),(19,47),(23,39),(30,33),(35,25),(42,20),(46,10),(50,9),
      (57,20),(63,24),(67,34),(77,43),(83,51),(74,56),(45,57),(27,55)],'#455878')
 a.p([(13,51),(23,39),(32,32),(39,24),(47,13),(50,11),(54,20),(51,23),
      (46,25),(46,29),(40,29),(39,34),(33,36),(32,43),(25,42),(21,50)],'#c7dce0')
 a.p([(50,20),(56,23),(62,26),(66,35),(75,43),(80,51),(70,52),(66,43),
      (57,42),(59,35),(49,30)],'#718ba0')
 a.l([(17,48),(26,44),(34,43),(40,38),(46,38)],'#a6c7d5')
 a.l([(48,27),(52,32),(54,37),(60,40),(66,42)],'#b0d4d5',2)
 for i in range(5):
  a.l([(27+i*2,48+i%2),(34+i*2,47+i%2)],'#7699ae')
 for x,y in [(21,48),(26,51),(72,48),(77,51),(82,52)]:a.spruce(x,y)
 # Sherman Adams visitor block and Tip Top House on the exposed shoulder.
 a.wall(43,23,14,6,3,'#8fa1a0','#4e6070','#c3d5d1')
 a.roof(53,28,10,5,'#8a8077')
 a.l([(49,17),(53,6),(56,17)],'#51687d')
 a.l([(52,6),(52,3)],'#d7e6d8');a.r((51,2,52,3),'#ffc177')
 a.r((46,20,47,21),'#6dd5d1')
 a.save('mount-washington','stop-5.png')
def ohiopyle():
 a=P();a.base('terrain')
 # Youghiogheny's broad, icy ledge waterfall and sedimentary escarpment.
 a.p([(12,43),(22,29),(40,27),(53,28),(69,24),(80,29),(79,35),(84,46),(71,53),(33,56)],'#4e697c')
 for j in (0,4,8):
  a.l([(15+j,44-j),(23+j,34-j),(32+j,33-j),(42+j,36-j),
       (58+j,31-j),(73+j,31-j)],'#7896ad',2)
 a.water([(28,29),(39,26),(51,24),(69,24),(78,27),(72,33),(55,36),(45,40),(44,46),
          (49,48),(70,49),(76,54),(55,58),(36,54),(25,48),(27,44),(30,39),(38,35)])
 for q in [[(29,38),(37,38),(41,41),(46,42)],[(31,40),(37,40),(43,43)],
           [(33,44),(44,45),(47,43)],[(31,47),(39,48),(53,51)],[(41,50),(47,52),(59,53)]]:
  a.l(q,'#addcdd',2)
 a.l([(32,45),(41,46),(46,43)],'#e3f2e1')
 for x,y in [(17,37),(23,31),(18,43),(68,33),(77,38),(79,43),(70,41)]:a.spruce(x,y)
 a.save('laurel-highlands','stop-5.png')
def marietta():
 a=P();a.base('city')
 a.water([(10,48),(17,41),(33,40),(44,45),(49,41),(54,36),(62,36),(63,42),(60,46),(72,45),(85,48),(81,53),(61,56),(41,57),(27,57)])
 for x,y,w in [(53,29,7),(66,35,9),(72,39,8),(27,42,7),(72,45,8)]:a.roof(x,y,w)
 a.wall(66,42,10,14,4,'#a16b59','#5b4550','#cbd8ce');a.windows(66,42,10,14,4,seed=7)
 a.l([(16,52),(29,51),(42,49),(60,44),(78,41)],'#3f5164',5)
 a.l([(16,51),(29,50),(42,48),(60,43),(78,40)],'#e5d2ad')
 for x,y in [(19,50),(34,48),(49,45),(64,41)]:
  a.l([(x,y),(x+5,y-9),(x+12,y-1)],'#af795a',2)
  a.l([(x+5,y-9),(x+8,y-9),(x+12,y-1)],'#dcc09a')
  a.l([(x+4,y+1),(x+4,y+4)],'#344e67',2)
 for x,y,w in [(28,54,14),(46,54,15),(58,50,10),(52,40,5),(72,48,10)]:
  a.l([(x,y),(x+w,y-1)],'#8ec5cb')
 a.save('ohio-river','stop-5.png')
if __name__=='__main__':
 import argparse
 p=argparse.ArgumentParser(description='Redraw five eastern campaign hero miniatures.')
 p.add_argument('--output',required=True,type=Path)
 ROOT=p.parse_args().output
 boston()
 providence()
 washington()
 ohiopyle()
 marietta()
