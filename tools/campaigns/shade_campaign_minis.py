"""Color-grade original transparent location drawings into the 2994 world palette."""
from PIL import Image
import random

ICE = {'providence','mount-washington','laurel-highlands','ohio-river','pikes-peak','angeles-crest'}
COPPER = {'moki-dugway','oak-creek-canyon','route-66'}

def byte(v):
    return max(0,min(255,round(v)))

def shade(image, region, index):
    # Treat each 2x2 source block as one graphic pixel for the distress and rim
    # lights. Keep source silhouettes, transparent gaps and tiny warm lamps.
    image=image.convert('RGBA')
    src=image.load()
    out=Image.new('RGBA',image.size)
    dst=out.load()
    icy=region in ICE
    red=region in COPPER
    rng=random.Random(region+str(index))
    material=Image.new('L',(96,80))
    material.putdata([rng.randrange(100) for _ in range(96*80)])
    noise=material.load()
    for y in range(image.height):
        for x in range(image.width):
            r,g,b,a=src[x,y]
            if not a:continue
            if a<115:
                dst[x,y]=(7,15,45,a)
                continue
            l=.28*r+.56*g+.16*b
            warm = r-g>39 and g-b>18 and l>123
            rim= y>=2 and src[x,y-2][3]<80
            n=noise[x//2,y//2]
            grain=5 if n>82 else -8 if n<22 else 0
            if warm and n>20:
                dst[x,y]=(byte(r*1.1+11),byte(g*1.01+4),byte(b*.80+7),a)
                continue
            if icy:
                v=(r*.83-20,g*1.04-10,b*1.12+15)
                if rim and n>31 and l>43:
                    v=(max(v[0],l*.95+28),max(v[1],l*1.04+48),max(v[2],l*1.11+67))
            elif red:
                v=(r*1.07-13,g*.97-13,b*1.12+8)
                if rim and n>54 and l>52:
                    v=(l*.76+29,l*.92+43,l*1.12+58)
            else:
                v=(r*.93-16,g*1.02-10,b*1.16+16)
                if rim and n>50 and l>52:
                    v=(l*.74+21,l*.98+30,l*1.16+48)
            dst[x,y]=tuple(byte(c+grain) for c in v)+(a,)
    return out
