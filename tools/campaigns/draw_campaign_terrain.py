"""Deterministic terrain-only campaign backplates; no objects, roads or markers."""
from pathlib import Path
from PIL import Image, ImageDraw
import math
import random

# shadow, lowland, alpine/high ground, material and watercourse configuration
REGIONS = {
    "providence": ("#293747", "#546171", "#b8c2c9", "coast", (.80,.33,.09)),
    "mount-washington": ("#163840", "#487477", "#d9efde", "alpine", None),
    "laurel-highlands": ("#263b36", "#50614e", "#a5aa94", "folds", (.29,.21,.042)),
    "ohio-river": ("#293847", "#5c6652", "#b0ae94", "valley", (.52,.31,.078)),
    "ozarks": ("#283e36", "#61715a", "#aba58a", "karst", (.69,.33,.056)),
    "data-center-city": ("#212a42", "#48465f", "#9fa5b5", "floodplain", (.68,.24,.086)),
    "route-66": ("#4b352e", "#8f6850", "#d7b586", "prairie", None),
    "pikes-peak": ("#2d3c55", "#687487", "#dbe6eb", "alpine", None),
    "moki-dugway": ("#54342f", "#9a5d49", "#dca782", "mesa", None),
    "oak-creek": ("#49332c", "#885743", "#cbb38a", "canyon", (.54,.27,.035)),
    "angeles-crest": ("#38362d", "#777655", "#c6a673", "ridge", None),
}

def _rgb(value):
    return tuple(bytes.fromhex(value[1:]))

def _lerp(a,b,t):
    return a+(b-a)*t

def _smooth(t):
    return t*t*(3-2*t)

def _clamp(v,a=0,b=1):
    return max(a,min(b,v))

def _grid(rng, dimension):
    return [[rng.random() for _ in range(dimension+1)] for _ in range(dimension+1)]

def _sample(g,x,y):
    n=len(g)-1
    x=_clamp(x,0,.99999)*n; y=_clamp(y,0,.99999)*n
    i,j=int(x),int(y)
    s,t=_smooth(x-i),_smooth(y-j)
    return _lerp(_lerp(g[j][i],g[j][i+1],s),_lerp(g[j+1][i],g[j+1][i+1],s),t)

def render_terrain(region_id, size=(384,256)):
    key=region_id.removeprefix("campaign-map-")
    key={"white-mountains":"mount-washington", "ohio-river-crossing":"ohio-river", "historic-route-66":"route-66","pikes-peak-highway":"pikes-peak","oak-creek-canyon":"oak-creek","angeles-crest-highway":"angeles-crest","ozark-backroads":"ozarks"}.get(key,key)
    dark,mid,light,mode,river=REGIONS[key]
    dark,mid,light=map(_rgb,(dark,mid,light))
    rng=random.Random("2994-campaign-terrain-v1:"+key)
    coarse,ridges,fine,grain=(_grid(rng,n) for n in (5,12,24,45))
    w,h=384,256
    def fields(x,y):
        a=_sample(coarse,x,y); b=_sample(ridges,x,y); c=_sample(fine,x,y)
        if river:
            center,phase,width=river
            if mode=="coast":
                course=center+.12*math.sin(y*6+phase)+.05*math.sin(y*22+phase)
            elif mode=="valley":
                course=center+.28*math.sin(y*4.8+2.5)-.18*y+.055*math.sin(y*14)
            elif mode=="floodplain":
                course=center-.44*y+.10*math.sin(y*5.2)+.021*math.sin(y*14)
            elif mode=="karst":
                course=center-.34*y+.10*math.sin(y*13)+.072*math.sin(y*25)
            elif mode=="canyon":
                course=center-.20*math.cos(y*7)+.037*math.sin(y*19)+.020*math.cos(y*33)
            else:
                course=center+.10*math.sin(y*8+.9)+.06*math.sin(y*15+2)
            bank=abs(x-course)-(width*(.85+.28*b))
            if mode=="coast":
                bank=course-x
        else:
            bank=1
        return a,b,c,bank
    samples=[]
    for y in range(h):
        row=[]
        for x in range(w):
            u=x/(w-1); v=y/(h-1)
            a,b,c,bank=fields(u,v)
            # Uneven fold axes and sharp, contiguous ridges rather than isolated circles.
            fold=1-abs(math.sin(math.pi*(u*4.6+v*2.65+a*1.17+b*.25)))
            mtn=_clamp(1-abs(u-(.44+.22*math.sin(v*4.4+1)))*1.57)
            if mode=="alpine":
                if key=="mount-washington":
                    spine=1-math.hypot((u-.49)*1.4,(v-.43)*1.1)
                    q=.10+.43*spine+.24*a+.14*fold+.16*(b-.5)+.10*(c-.5)
                else:
                    q=.09+.43*mtn+.26*a+.17*fold+.16*(b-.5)+.09*(c-.5)
            elif mode=="folds":
                q=.30+.21*a+.23*fold+.17*(b-.5)+.08*(c-.5)
            elif mode=="ridge":
                slope=1-abs(math.sin(math.pi*(u*2.7-v*.83+a*.95+b*.2)))
                q=.26+.22*a+.27*slope+.16*(b-.5)+.08*(c-.5)
            elif mode=="mesa":
                plateau=_clamp((a*.76+b*.24-.43)*3.4)
                q=.16+.48*plateau+.13*fold+.08*c
            elif mode=="canyon":
                q=.21+.34*_smooth(_clamp(bank*4))+.25*a+.10*fold+.075*c
            elif mode=="karst":
                q=.23+.23*a+.15*fold+.23*b+.045*c
            elif mode=="prairie":
                q=.32+.24*a+.09*b+.04*fold+.095*c
            elif mode=="floodplain":
                terrace=_smooth(_clamp(bank*2.7))
                q=.39+.13*a+.10*b+.10*terrace+.04*c
            elif mode=="coast":
                q=.35+.22*a+.10*fold+.13*b+.04*c
            else:
                q=.26+.21*a+.15*b+.08*fold+.04*c
            if river and mode!="coast":
                q-=.17*(1-_smooth(_clamp(bank*7)))
            row.append((q,bank,c))
        samples.append(row)
    im=Image.new("RGB",(w,h)); pixels=im.load()
    for y,row in enumerate(samples):
        for x,(q,bank,c) in enumerate(row):
            qx=samples[y][max(0,x-2)][0]-samples[y][min(w-1,x+2)][0]
            qy=samples[max(0,y-2)][x][0]-samples[min(h-1,y+2)][x][0]
            relief=_clamp((qx+qy)*1.6,-.135,.12)
            n=(_sample(grain,x/(w-1),y/(h-1))-.5)*.065
            if bank<0:
                deep=_clamp(-bank*10)
                color=tuple(round(_lerp(a,b,deep)) for a,b in zip((63,91,102),(26,48,67)))
                variation=round((c-.5)*7+n*32)
                color=tuple(k+variation for k in color)
            else:
                q=_clamp(q+relief+n)
                if mode=="alpine":
                    q=_lerp(q,q*.40+.60,_smooth(_clamp((q-.62)*3.4)))
                elif mode in ("mesa","canyon"):
                    # Broken rock strata follow slope/elevation, never connect as a route.
                    q+=.06 * math.sin(q*99) * _clamp(abs(qx+qy)*16)
                q=_clamp(q)
                a,b,t=(dark,mid,q/.50) if q<.50 else (mid,light,(q-.50)/.50)
                color=tuple(round(_lerp(d,e,t)) for d,e in zip(a,b))
            pixels[x,y]=color
    if size!=im.size:
        return im.resize(size, Image.Resampling.NEAREST)
    return im

def build(output):
    native=output/"native"
    high=output/"1152"
    native.mkdir(parents=True,exist_ok=True); high.mkdir(parents=True,exist_ok=True)
    preview=Image.new("RGB",(960,584),"#111820")
    draw=ImageDraw.Draw(preview)
    for index,name in enumerate(REGIONS):
        im=render_terrain(name)
        # Shared palette keeps bytes low while making the 3× presentation a lossless expansion.
        exact=im.quantize(colors=96,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE)
        filename=f"campaign-map-{name}.png"
        exact.save(native/filename,optimize=True)
        exact.resize((1152,768),Image.Resampling.NEAREST).save(high/filename,optimize=True)
        x=index%4*240; y=index//4*192
        preview.paste(exact.resize((232,154),Image.Resampling.NEAREST),(x+4,y+4))
        draw.text((x+8,y+165),name,fill="white")
    preview.save(output/"terrain-contact-sheet.png",optimize=True)

if __name__=="__main__":
    import argparse
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output",type=Path)
    build(parser.parse_args().output)
