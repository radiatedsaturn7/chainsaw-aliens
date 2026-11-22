"""Draw terrain-only central campaign plates on a fixed tactical pixel grid.

The locations, gameplay roads, player car and UI remain separate. These scenes
are atmosphere and landmarks of geography, not substitutes for the race minis.
"""
import argparse
from pathlib import Path
from random import Random

from PIL import Image, ImageDraw

W, H = 192, 128
GRID = (W, H)
NATIVE = (384, 256)
REGIONS = ('ozarks', 'data-center-city', 'route-66', 'pikes-peak')


class PixelBoard:
    def __init__(self, name, palette):
        self.p = palette
        self.image = Image.new('RGB', GRID, palette[0])
        self.d = ImageDraw.Draw(self.image)
        self.rng = Random('2994-campaign-pixel-central-v1/' + name)

    def polygon(self, pts, c):
        self.d.polygon(pts, fill=c)

    def line(self, pts, c, width=1):
        self.d.line(pts, fill=c, width=width, joint='curve')

    def rect(self, box, c):
        self.d.rectangle(box, fill=c)

    def point(self, p, c):
        self.d.point(p, fill=c)

    def soil(self, pts, sector, edge=False):
        """Angular relief planes, lit from northwest with an abrupt lower rim."""
        soil = self.p[sector]
        if edge:
            shadow = [(x+2,y+3) for x,y in pts]
            self.polygon(shadow, self.p[max(0,sector-2)])
        self.polygon(pts,soil)
        if edge:
            col = self.p[min(sector+1,len(self.p)-1)]
            self.line(pts[:max(2,len(pts)//2)],col)

    def specks(self, allowed, tones, count, box=(0,0,191,127), stripes=0):
        """Clustered, restrained one-pixel texture stays inside assigned materials."""
        px = self.image.load()
        x0,y0,x1,y1 = box
        for _ in range(count):
            x,y = self.rng.randint(x0,x1),self.rng.randint(y0,y1)
            if px[x,y] in allowed:
                c = self.rng.choice(tones)
                self.point((x,y),c)
                if x+1 < W and stripes and self.rng.randrange(stripes)==0 and px[x+1,y] in allowed:
                    self.point((x+1,y),c)

    def water(self, points, highlights, dark='#162b3b', mid='#275065', light='#397386'):
        self.polygon(points, dark)
        for outer, inner in highlights:
            self.line(outer, mid, 2)
            self.line(inner, light)
        dashes = [tuple(bytes.fromhex(c.lstrip('#'))) for c in (dark,mid)]
        self.specks(dashes,['#285369','#386478','#518695'],470,stripes=2)

    def ice(self, x,y,r):
        # A moving floe with abrupt lit edges and thick deep-blue underside.
        self.polygon([(x-r,y),(x-1,y-2),(x+r-2,y-1),(x+r,y+1),(x+2,y+3),(x-r+1,y+2)], '#2c577b')
        self.polygon([(x-r,y),(x-1,y-2),(x+r-2,y-1),(x+r,y),(x+2,y+2),(x-r+1,y+1)], '#779fbd')
        self.line([(x-r,y),(x-1,y-2),(x+r-2,y-1)],'#c2dfec')
        if r > 4: self.line([(x-2,y),(x+1,y),(x+3,y+1)],'#547a9c')

    def fracture(self, pts, dark, middle, bright, widths):
        # Broken contours, staggered stone planes and alternating fault lips.
        offsets = [(x+self.rng.randrange(1,4),y+n) for (x,y),n in zip(pts,widths)]
        self.polygon(pts+list(reversed(offsets)), dark)
        self.line([(x-1,y-1) for x,y in pts],middle)
        for j, ((x,y),(u,v)) in enumerate(zip(pts,pts[1:])):
            lip = offsets[j]
            d=self.rng.randint(1,max(1,widths[j]-1))
            self.polygon([(x,y),(u,v),(u-1,v+d),(lip[0]-1,lip[1]-2)],middle)
            self.line([(x,y-2),((x+u)//2,(y+v)//2-2)],bright)
            self.line([(x+1,y+2),(lip[0]-2,lip[1]-1)],bright if j%3==0 else dark)
            self.point((u-1,v-2),middle)

    def embers(self,x,y,large=False):
        # Deep indigo scorch marks keep the two amber tones vivid.
        self.polygon([(x-4,y+4),(x-2,y-2),(x+1,y-4),(x+6,y+1),(x+5,y+4),(x,y+6)],'#231a2b')
        self.line([(x-3,y+3),(x-1,y+1),(x+1,y+2),(x+4,y)],'#922e2f',2)
        self.line([(x-2,y+3),(x-1,y),(x+1,y+3),(x+3,y+2)],'#e4653a')
        self.point((x-1,y+2),'#ffa451')
        self.point((x+3,y+1),'#ffc575')
        if large:
            self.point((x,y-4),'#f98742')
            self.point((x+3,y-2),'#ffad58')
            self.point((x+5,y),'#d45131')
            self.line([(x-2,y-2),(x-4,y-5),(x-4,y-9),(x-1,y-14)],'#43404f',2)
            self.point((x-5,y-8),'#636170')

    def tree(self,x,y,s=3,warm=False,snow=False):
        shadow, shade, light = ('#152b32','#294842','#507063')
        if warm: shadow,shade,light = ('#493435','#675547','#88805a')
        if snow: shadow,shade,light = ('#24344e','#486176','#a3bdbf')
        self.polygon([(x,y-s),(x-s,y+1),(x+1,y+2),(x+s,y+1)],shadow)
        self.polygon([(x,y-s-1),(x-s+1,y),(x+1,y),(x+s-1,y-1)],shade)
        self.line([(x,y-s-1),(x-s+1,y-1)],light)
        self.point((x+1,y+2),'#453d42')

    def trees(self, boxes, count, snow=False):
        for i,(x0,y0,x1,y1) in enumerate(boxes):
            for _ in range(count+i%8):
                x,y=self.rng.randint(x0,x1),self.rng.randint(y0,y1)
                if self.rng.randrange(100) < 80-abs((x-x0)-(y-y0)):
                    self.tree(x,y,self.rng.randint(2,4),snow=snow)

    def shed(self, x,y,w,h,rise,roof,wall,edge,broken=False):
        """An isometric roof, with strong west light and intact/failed roof panels."""
        a,b,c,d=(x,y),(x+w,y-3),(x+w+5,y+h-3),(x+5,y+h)
        self.polygon([d,c,(c[0],c[1]+rise),(d[0],d[1]+rise)],wall)
        self.polygon([b,c,(c[0],c[1]+rise),(b[0],b[1]+rise)],edge)
        self.polygon([a,b,c,d],roof)
        self.line([d,a,b],edge)
        for j in range(4,w,4):
            self.line([(x+j,y-3*j//w),(x+5+j,y+h-3*j//w)],wall)
        if broken and w>=9:
            self.polygon([(x+w//3,y+1),(x+w*2//3,y-1),(x+w*2//3+3,y+h-3),(x+w//2+1,y+h-1)],'#202734')
            self.line([(x+w//3,y+1),(x+w//2+3,y+h-3)],edge)
            self.point((x+4,y+h+rise+2),roof)
        for j in range(4,w,6):
            self.point((x+5+j,y+h+rise-2-3*j//w),'#c48453' if j%3 else '#7ba0a3')

    def cable(self,a,b,c='#151d2b'):
        x,y=a;u,v=b
        self.line([a,((x+u)//2,(y+v)//2+2),b],c)

    def pylon(self,x,y,h):
        self.line([(x-3,y),(x,y-h),(x+3,y-1),(x-3,y)],'#33404d')
        self.line([(x-5,y-h+2),(x+5,y-h+1)],'#9a9a88')
        self.line([(x-3,y-3),(x+2,y-5),(x-2,y-7)],'#77828a')
        self.point((x+5,y-h+1),'#c2a87b')
        return x,y-h+2

    def scrap(self,x,y,rotation=1,body='#74685c',glass='#92aa9d'):
        """A burned vehicle seen from above, with punched-out wheels and glass."""
        width = 6
        a = (x,y); b = (x+width,y-2*rotation); c = (x+width+2,y+2); d = (x+2,y+2+2*rotation)
        self.polygon([(a[0],a[1]+1),(b[0],b[1]+1),(c[0],c[1]+2),(d[0],d[1]+2)],'#222833')
        self.polygon([a,b,c,d],body)
        self.line([(x+2,y),(x+4,y+rotation)],glass)
        self.point((x+6,y-rotation),'#c58d65')

    def bot(self,x,y,facing=1):
        """Tiny salvage crawler with chilled steel, hazard orange and a live arc."""
        self.rect((x-2,y+2,x+3,y+3),'#151e2d')
        self.polygon([(x-2,y),(x+1,y-1),(x+4,y),(x+3,y+2),(x-2,y+3)],'#58717d')
        self.rect((x-1,y-1,x+1,y+1),'#be824c')
        self.point((x+facing,y-2),'#efc87d')
        self.line([(x+2*facing,y),(x+4*facing,y-1),(x+5*facing,y+1)],'#95a4a0')
        self.point((x+5*facing,y+1),'#8ce8ea')
        self.point((x+6*facing,y),'#527c86')

    def worksite(self,x,y,mode):
        """Small robot crews repair a wreck, never a lane or player-facing prop."""
        self.polygon([(x-5,y+3),(x+7,y-2),(x+14,y+1),(x+23,y+8),(x+14,y+11),(x+2,y+10)],mode[0])
        self.line([(x-3,y+3),(x+7,y),(x+14,y+3),(x+19,y+6)],mode[1])
        self.scrap(x+5,y+4,body=mode[2]); self.scrap(x+14,y+5,-1,body=mode[2])
        self.bot(x+2,y+4,1);self.bot(x+15,y+8,-1)
        for a,b,col in [(1,8,'#ba8d65'),(8,9,'#768f92'),(4,9,'#5c615d'),(11,10,'#a16853'),(13,8,'#41454c')]:
            self.point((x+a,y+b),col)


def ozarks():
    m = PixelBoard('ozarks', ('#18272d','#2e3a3a','#42463f','#5b5948','#81725e','#c7a77e'))
    # West-facing karst break, chalk shelves, patchy forest floor.
    m.soil([(0,0),(86,0),(103,15),(88,29),(73,31),(56,46),(30,45),(13,51),(0,45)],2,True)
    m.soil([(1,6),(34,2),(53,9),(89,5),(92,13),(75,22),(54,23),(40,33),(18,29),(0,36)],3,True)
    m.soil([(0,91),(15,78),(42,68),(51,75),(51,86),(37,99),(27,104),(17,123),(0,127)],2,True)
    m.soil([(119,93),(140,68),(147,50),(175,33),(191,35),(191,116),(181,126),(129,127)],2,True)
    m.soil([(142,102),(159,82),(165,66),(183,56),(191,60),(191,98),(178,105),(169,114),(148,116)],3,True)
    m.soil([(99,0),(138,0),(140,13),(154,19),(154,30),(129,42),(110,33),(101,19)],3,True)
    m.soil([(106,0),(130,0),(127,11),(142,19),(136,25),(117,23)],4,True)
    m.water([(191,0),(172,0),(165,11),(147,27),(119,31),(102,46),(108,60),(130,70),(133,83),(111,94),(97,113),(99,128),(119,128),(112,114),(124,100),(150,90),(154,78),(143,62),(121,54),(118,47),(133,41),(159,37),(179,19),(191,12)],
      [([(174,3),(163,16),(149,28),(122,32),(109,46),(112,57),(137,68),(145,81),(142,88),(116,102),(103,118),(106,127)],
        [(180,5),(165,20),(152,29),(133,36),(120,41),(114,51),(122,59),(140,67),(147,77),(149,86),(125,98),(111,112),(109,123)])])
    m.specks([tuple(bytes.fromhex(c[1:])) for c in m.p], ['#304745','#536356','#686655','#7f7059'],2150,stripes=3)
    for pts in [[(0,38),(14,32),(30,34),(55,29),(62,22),(72,21)],[(0,44),(14,37),(30,39),(54,35)],[(126,90),(132,88),(143,89)],[(157,58),(162,52),(175,47),(187,47)],[(0,94),(19,86),(32,84),(42,78)]]:
        m.line(pts,'#9d9b7e')
    for pts in [
        [(0,37),(14,30),(25,37),(39,35),(53,29),(67,22),(81,17)],
        [(0,92),(12,84),(24,83),(36,76),(49,74)],
        [(137,117),(143,105),(152,102),(160,91),(170,82),(181,81),(191,74)],
        [(114,21),(122,25),(136,21),(145,18)],
    ]: m.fracture(pts,'#2f2933','#88745e','#b59b75',[4+(i*5)%7 for i in range(len(pts))])
    m.trees([(3,5,40,27),(46,4,76,19),(10,45,51,65),(62,37,90,54),(6,105,42,122),(67,89,91,111),(162,18,189,31),(155,99,189,123)],22)
    for x,y,r in [(12,15,5),(26,23,4),(40,10,5),(51,16,7),(8,100,5),(21,112,4),(59,29,5),
                  (143,47,3),(164,77,4),(169,96,5),(188,86,4),(179,115,7)]:
        m.polygon([(x-r,y),(x-2,y-2),(x+3,y-2),(x+r,y),(x+1,y+2),(x-r+1,y+1)],'#5e7181')
        m.line([(x-r,y),(x-2,y-2),(x+3,y-2)],'#969c9b')
    # A ruined quarry loading shelf at the high bank, no original race building.
    m.polygon([(54,63),(74,57),(86,64),(78,73),(62,76)],'#4a4b45')
    m.line([(53,63),(74,57),(86,64)],'#a29d7f')
    m.shed(61,61,13,7,4,'#9a8e73','#766457','#574d4d',True)
    t0=m.pylon(63,75,9); t1=m.pylon(84,73,10);m.cable(t0,t1)
    m.embers(74,73,True)
    m.worksite(54,79,('#4b554b','#777d60','#93725c'))
    return m.image


def data_center():
    m = PixelBoard('data-center-city', ('#151d34','#242b43','#343a50','#48495c','#5f5b64','#85808a'))
    for pts,s in [
        ([(0,0),(104,0),(111,24),(80,38),(40,40),(20,50),(0,45)],2),
        ([(0,53),(29,43),(76,40),(101,52),(93,67),(79,75),(53,80),(41,92),(0,100)],2),
        ([(0,110),(42,99),(54,98),(64,108),(80,107),(76,128),(0,128)],1),
        ([(149,0),(192,0),(192,91),(142,105),(120,89),(128,69),(145,56)],2),
        ([(130,22),(147,15),(165,20),(179,31),(178,51),(149,65),(136,62)],3),
        ([(128,104),(153,93),(192,83),(192,128),(105,128)],3),
        ([(139,104),(156,97),(171,94),(180,97),(171,109),(142,121),(123,118)],4),
    ]: m.soil(pts,s,True)
    m.water([(117,0),(145,0),(142,18),(148,31),(134,51),(117,67),(106,81),(111,92),(97,110),(95,128),(67,128),(74,105),(89,88),(81,77),(84,63),(110,44),(123,22),(115,9)],
      [([(125,0),(126,12),(130,22),(124,35),(111,44),(97,55),(88,67),(88,79),(95,89),(81,107),(74,122)],
        [(138,0),(135,14),(141,32),(134,45),(119,58),(102,73),(103,81),(104,91),(91,108),(86,125)])], '#162846','#244879','#508daf')
    m.specks([tuple(bytes.fromhex(c[1:])) for c in m.p],['#3d455e','#46485b','#625765','#796578'],1820,stripes=3)
    # Jagged, ice-crusted Ohio/Mississippi floodplain, not another road.
    for pts in [
        [(88,57),(94,50),(105,45),(112,38),(119,26),(119,20)],
        [(102,110),(105,100),(115,92),(111,82),(115,74),(129,58),(139,50),(149,35)],
    ]: m.fracture(pts,'#172945','#354b72','#6c8fa5',[2+(i*5)%5 for i in range(len(pts))])
    for x,y,r in [(128,7,5),(136,17,3),(137,27,6),(126,42,5),(116,52,4),(108,59,2),(91,74,6),
                  (99,80,3),(98,87,5),(90,100,3),(79,114,6),(90,118,3),(77,122,4)]:
        m.ice(x,y,r)
    # Collapsed substation on the northwestern bank.
    for x,y,shade in ((34,19,'#676674'),):
        m.polygon([(x-11,y+3),(x+26,y-2),(x+35,y+17),(x+2,y+26)],'#363b4c')
        m.line([(x-11,y+3),(x+26,y-2),(x+35,y+17),(x+2,y+26),(x-11,y+3)],shade)
        for a,b,w,h,pal in ((-2,0,15,9,('#817d87','#555668','#3d455c')),
                           (13,3,12,7,('#8b8c98','#5e677d','#41495d')),
                           (-1,12,14,7,('#687e8d','#586276','#333e52'))):
            m.shed(x+a,y+b,w,h,4,*pal,broken=True)
        t0=m.pylon(x-7,y+11,12);t1=m.pylon(x+28,y+21,15);m.cable(t0,t1)
    # A half-drained industrial pond on the east bank, with a broken ring
    # of coolant pipes and a rusty factory shell. The data-center race stays separate.
    m.polygon([(142,79),(153,69),(172,70),(188,82),(182,98),(163,105),(144,98)],'#303247')
    m.polygon([(144,81),(154,73),(173,74),(184,82),(177,96),(162,100),(148,95)],'#263752')
    m.line([(145,81),(154,73),(174,74),(182,79)],'#6b899b',2)
    m.line([(182,86),(177,95),(162,100),(151,96)],'#57738a',2)
    m.line([(152,86),(160,81),(174,82),(177,86)],'#3b5a74',2)
    m.shed(152,80,16,7,4,'#8b7a82','#5c5166','#434159',True)
    m.line([(154,83),(145,87),(145,93)],'#b9765b',2)
    m.line([(171,88),(178,91),(179,88)],'#966357',2)
    m.point((149,87),'#f1a465');m.point((178,91),'#84baca')
    # Broken piers in the floodplain and a warm salvage crew on the west-side pad.
    for x,y in [(104,59),(103,61),(99,65),(96,70)]:
        m.rect((x,y,x+3,y+1),'#4e6474')
        m.point((x,y),'#82949b')
    m.embers(61,44,True)
    m.embers(159,95,True)
    m.worksite(42,80,('#4d5360','#777a85','#948179'))
    m.worksite(150,108,('#4a4d59','#6d7986','#a38170'))
    for x,y in [(162,41),(175,47),(31,65),(9,74),(36,113)]:
        m.scrap(x,y,body='#796d70',glass='#8a8f90')
    return m.image


def route_66():
    m = PixelBoard('route-66', ('#433541','#6b493f','#855742','#a46e50','#c18b63','#daa26a'))
    m.soil([(0,29),(25,29),(41,46),(53,48),(57,68),(88,85),(80,99),(83,128),(0,128)],2,True)
    m.soil([(0,66),(17,60),(34,65),(48,86),(64,97),(66,111),(54,127),(0,127)],0,True)
    m.soil([(0,68),(17,63),(26,68),(36,79),(32,93),(43,102),(36,107),(36,125),(0,127)],1,True)
    m.soil([(0,96),(11,87),(29,94),(26,108),(38,122),(32,127),(0,127)],2,True)
    m.soil([(112,0),(161,0),(162,16),(181,22),(191,31),(191,99),(175,103),(155,91),(135,90),(119,75),(93,67),(86,53),(105,34)],3,True)
    m.soil([(122,0),(167,0),(164,15),(183,26),(191,42),(178,56),(155,62),(137,57),(124,48),(119,34)],4,True)
    for i,pts in enumerate([[(0,42),(19,40),(32,48),(43,51),(49,63),(63,76),(76,81)],[(0,47),(17,45),(30,50),(39,55),(46,68),(64,81),(76,85)],[(0,102),(12,96),(26,100),(24,109),(31,119)],[(124,53),(146,59),(169,58),(189,49)],[(119,62),(140,66),(154,71),(177,66),(191,57)],[(77,95),(75,111),(83,126)]]):
        m.line(pts, '#d4a27c' if i%2==0 else '#513c3d')
    m.specks([tuple(bytes.fromhex(c[1:])) for c in m.p],['#674843','#b88058','#a17356','#c79770'],2470,stripes=2)
    for pts in [
        [(0,63),(10,62),(19,65),(28,70),(41,78),(49,88),(58,94),(63,106),(59,118)],
        [(104,66),(116,60),(129,63),(146,69),(156,66),(177,63),(190,52)],
        [(0,106),(10,97),(23,97),(26,104),(30,110)],
    ]: m.fracture(pts,'#493546','#93604d','#d69a6e',[4+(i*2)%6 for i in range(len(pts))])
    for j in range(13):
        x,y=119+(j*23)%62, 67+(j*19)%44
        m.polygon([(x-1,y),(x-4,y+2),(x,y+3),(x+3,y+1)],'#715a4f')
        m.line([(x-2,y+1),(x,y-2),(x+2,y+1)],'#b1a073')
    # Dust-choked loading terminal and fuel hoppers, deliberately away from neon minis.
    m.polygon([(72,11),(91,4),(113,12),(119,25),(109,36),(79,32),(69,22)],'#75574d')
    m.line([(72,11),(91,4),(113,12),(119,25)],'#cfab80')
    m.shed(78,13,23,10,4,'#a79b81','#765e59','#5c4750',True)
    m.shed(77,25,11,5,3,'#c19170','#9c6657','#58414a',True)
    for x in (105,110,115):
        m.rect((x,26,x+2,34),'#604951')
        m.line([(x,26),(x+1,24),(x+3,26)],'#ab9181')
    m.embers(97,34,True)
    m.embers(111,107)
    m.worksite(96,99,('#866b5a','#a7836c','#845754'))
    for x,y in [(65,85),(93,25),(166,44),(176,42),(86,107),(93,111)]:
        m.scrap(x,y,body='#9e6556',glass='#a69c7d')
    return m.image


def pikes_peak():
    m = PixelBoard('pikes-peak', ('#15213e','#293c64','#3e5f91','#5376aa','#92b2d9','#d3e8f6'))
    m.soil([(0,0),(106,0),(104,15),(94,35),(98,48),(89,65),(76,76),(71,101),(55,128),(0,128)],2,True)
    m.soil([(0,23),(26,8),(58,13),(76,22),(82,38),(70,55),(75,69),(67,82),(54,110),(41,128),(0,128)],3,True)
    m.soil([(3,66),(11,52),(29,46),(38,31),(51,26),(62,31),(60,47),(49,55),(44,69),(31,79),(16,94),(0,100)],4,True)
    m.soil([(2,67),(14,55),(31,49),(39,34),(50,29),(59,34),(44,48),(43,57),(34,59),(26,76),(6,82)],5)
    m.soil([(0,7),(28,0),(58,0),(54,10),(28,11),(14,27),(0,29)],4,True)
    m.soil([(0,115),(17,105),(32,88),(40,80),(46,84),(44,96),(35,106),(34,118),(31,128),(0,128)],4,True)
    m.soil([(75,93),(89,60),(100,54),(101,46),(123,46),(138,34),(161,30),(192,34),(192,128),(64,128)],1,True)
    m.soil([(87,101),(108,82),(110,71),(128,60),(143,57),(155,44),(192,42),(192,127),(75,127)],2,True)
    m.polygon([(120,77),(123,62),(136,59),(145,51),(162,53),(170,62),(178,64),(184,75),(181,82),(166,85),(161,95),(143,97),(130,92)],'#734d56')
    m.polygon([(126,74),(133,64),(143,63),(147,54),(161,54),(169,64),(181,68),(179,75),(158,75),(148,87),(133,84)],'#a5756b')
    m.polygon([(131,74),(139,68),(154,65),(158,58),(165,61),(169,67),(161,70),(149,73),(144,78)],'#bf9280')
    for pts in [[(113,84),(129,77),(139,83),(157,79),(170,78),(188,71)],[(141,98),(161,91),(180,88),(191,83)],[(119,76),(129,71),(140,71),(152,61)],[(0,64),(15,52),(27,48),(37,32),(49,25),(59,29)],[(16,92),(28,81),(40,76),(45,66),(53,58)],[(26,113),(37,106),(49,101),(62,84)]]:
        m.line(pts,'#adadb0')
    m.specks([tuple(bytes.fromhex(c[1:])) for c in m.p[:4]],['#436491','#5575a5','#7096c1','#305077'],1850,stripes=2)
    m.specks([tuple(bytes.fromhex(c[1:])) for c in m.p[4:]],['#88a9d0','#daedfd','#b0cbea'],730,stripes=2)
    for pts in [
        [(0,64),(8,62),(16,52),(29,48),(34,35),(45,33),(52,27),(61,30)],
        [(17,99),(24,89),(36,83),(40,80),(43,69),(51,63),(57,52),(70,46)],
        [(4,117),(13,111),(24,110),(35,103),(46,93),(50,96)],
        [(70,77),(80,68),(87,61),(90,53),(96,50)],
    ]: m.fracture(pts,'#263d6a','#6a91c3','#d7eaff',[4+(i*4)%9 for i in range(len(pts))])
    m.fracture([(120,77),(135,68),(146,68),(154,58),(165,57),(170,66),(179,67)],'#473545','#9a5b5e','#dc9d83',[3,5,4,5,3,5,4])
    m.trees([(8,22,46,39),(69,42,87,64),(86,72,111,87),(58,107,88,125),(118,102,152,120),(153,91,188,108)],18,snow=True)
    # Frostbound ore tram sheds and maintenance crawler at a disused quarry pad.
    m.polygon([(89,21),(109,13),(132,17),(140,28),(122,38),(94,38)],'#536278')
    m.line([(89,21),(109,13),(132,17),(140,28)],'#a7b5bb')
    m.shed(102,20,18,9,5,'#a5a1a1','#736c79','#4f556d',True)
    t0=m.pylon(98,35,14);t1=m.pylon(132,31,17);m.cable(t0,t1)
    m.embers(119,31,True)
    m.worksite(102,36,('#5b697b','#8e929d','#907c7e'))
    m.worksite(155,113,('#526273','#81929e','#92786e'))
    return m.image


PAINTERS = dict(zip(REGIONS, (ozarks, data_center, route_66, pikes_peak)))


def build(output):
    output.mkdir(parents=True, exist_ok=True)
    preview = Image.new('RGB', (NATIVE[0]*2, (NATIVE[1]+18)*2), '#1d2130')
    captions = ImageDraw.Draw(preview)
    for i, (name,painter) in enumerate(PAINTERS.items()):
        plate = painter().resize(NATIVE, Image.Resampling.NEAREST)
        # Fewer than 256 authored colors: compact PNG with pixel-exact palette.
        palette = plate.quantize(colors=256, dither=Image.Dither.NONE)
        assert plate.tobytes() == palette.convert('RGB').tobytes(), name
        path = output / ('campaign-map-' + name + '.png')
        palette.save(path, optimize=True)
        x,y=(i%2)*NATIVE[0],(i//2)*(NATIVE[1]+18)
        preview.paste(plate,(x,y))
        captions.text((x+6,y+NATIVE[1]+3),name,fill='#e2d8c2')
    preview.save(output/'central-contact.png', optimize=True)


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',required=True,type=Path)
    build(p.parse_args().output)
