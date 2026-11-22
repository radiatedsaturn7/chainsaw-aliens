"""Tiny 2994 landmark dioramas for central campaign stops; art only."""
from PIL import ImageDraw
import math
import re

ALIAS = {
    'ozarks':'ozarks', 'data-center-city':'data-center-city', 'route-66':'route-66', 'pikes-peak':'pikes-peak',
    'ozark backroads':'ozarks', 'data center city':'data-center-city', 'historic route 66':'route-66', 'pikes peak highway':'pikes-peak',
}
# Main/optional stops use fragments of the existing raceRef, never replacement gameplay names.
MOTIFS={
 'ozarks':[
  ('eminence','canoes'),('alley spring','mill'),('roberts field','field'),('jerktail','bluff'),
  ('pig trail','switchback'),('ozark backroads','cave'),('gravois mills','pits'),('two rivers','confluence'),
 ],
 'data-center-city':[
  ('great river road','limestone'),('defiance augusta','winery'),('technology raceway','pitsteel'),('stan musial','cablebridge'),
  ('st. louis','arch'),('data center city','reactor'),('chicago','chicago'),('kartplex','kartpits'),
 ],
 'route-66':[
  ('pony bridge','truss'),('shamrock','deco'),('palo duro','hoodoo'),('amarillo','cadillac'),
  ('adrian glenrio','motel'),('historic route 66','shield'),('hallett','pits'),('vega adrian','midpoint'),
 ],
 'pikes-peak':[
  ('garden of the gods','redfins'),('gold camp road','tunnel'),('ute pass','pass'),('phantom canyon','minetrestle'),
  ('cripple creek','mineshaft'),('pikes peak highway','summit'),('bayard','chimney'),('squaw creek','prairie'),
 ],
}

def decorate(name, im, nodes):
    """Add eight place-specific visual landmarks, reserving clear space for UI pins."""
    nkey=str(name).removeprefix('campaign-map-').lower()
    region=ALIAS.get(nkey)
    if not region:
        return im
    w,h=im.size; draw=ImageDraw.Draw(im)
    colors={
        'ozarks':('#142329','#526657','#84936a','#c19873','#ffe2a2'),
        'data-center-city':('#151b37','#31536d','#5a92a5','#8caaaf','#b9f3ed'),
        'route-66':('#342336','#845e58','#b58259','#d3a276','#ffe3af'),
        'pikes-peak':('#21203c','#5b6280','#909aab','#c0ada1','#eff2e4'),
    }
    dark,shade,mid,top,hi=colors[region]
    amber='#ffc175'; cyan='#68e3ed'
    centers=[]
    for n in nodes:
        if n.get('kind')=='junction' or not n.get('raceRef'):
            continue
        try: x,y=round(float(n['x'])*(w-1)),round(float(n['y'])*(h-1))
        except (KeyError,ValueError,TypeError): continue
        nref=' '.join(re.findall(r'[A-Za-z0-9.]+',str(n['raceRef']).lower()))
        choice=next((icon for token,icon in MOTIFS[region] if token in nref),None)
        if choice:
            centers.append((x,y,choice))
    occupied=[]
    for nx,ny,icon in centers:
        # Pins and their colored halos are live UI. Keep all native marks outside their breathing circles.
        candidates=[(nx+19,ny-20),(nx-20,ny-20),(nx+20,ny+20),(nx-21,ny+20),(nx,ny-25),
                    (nx+24,ny),(nx-24,ny),(nx,ny+25),(nx+23,ny-23),(nx-23,ny-23)]
        def score(v):
            x,y=v
            if not (18<=x<=w-18 and 17<=y<=h-18):
                return -9999
            return min([math.hypot(x-a,y-b)-14 for a,b,_ in centers]+[math.hypot(x-a,y-b)-26 for a,b in occupied])
        x,y=max(candidates,key=score)
        if score((x,y))<0:
            continue
        occupied.append((x,y))
        def pt(a,b,z=0):
            return (round(x+a-b),round(y+(a+b)*.44-z))
        def pl(p,c):
            draw.polygon(p,fill=c)
        def ln(p,c,k=1):
            draw.line(p,fill=c,width=k)
        def lamp(a,b,c=amber):
            draw.point((a-2,b),fill=shade);draw.point((a+2,b),fill=shade)
            draw.line((a-1,b,a+1,b),fill=c);draw.point((a,b-1),fill=hi)
        def block(u,v,ww,ll,z,roof=top,left=mid,right=shade,bottom=0):
            A,B,C,D=[pt(a,b,bottom+z) for a,b in ((u,v),(u+ww,v),(u+ww,v+ll),(u,v+ll))]
            a,b,c,d=[pt(a,b,bottom) for a,b in ((u,v),(u+ww,v),(u+ww,v+ll),(u,v+ll))]
            pl([D,C,c,d],left);pl([B,C,c,b],right);pl([A,B,C,D],roof)
            ln([D,A,B],hi);ln([D,C,B],dark)
        def roof(u,v,ww,ll,z,rise,c1,c2):
            a,b,c,d=[pt(a,b,z) for a,b in ((u,v),(u+ww,v),(u+ww,v+ll),(u,v+ll))]
            e,f=pt(u+ww/2,v,z+rise),pt(u+ww/2,v+ll,z+rise)
            pl([a,d,f,e],c1);pl([e,f,c,b],c2);ln([a,e,f],hi)
        def pine(xx,yy,s=4,snow=False):
            pl([(xx,yy-s*2),(xx-s,yy),(xx+s,yy)],shade)
            ln([(xx,yy-s*2),(xx-s+1,yy-1)],hi if snow else mid)
            draw.point((xx,yy+1),fill=dark)
        def crag(xx,yy,ww,hh,t=top,side=mid):
            pl([(xx-ww,yy),(xx-ww+3,yy-hh//2),(xx-1,yy-hh),(xx+4,yy-hh),(xx+ww,yy)],t)
            pl([(xx-1,yy-hh),(xx+4,yy-hh),(xx+ww,yy),(xx+1,yy)],side)
            for k in range(4,hh-2,4):
                ln([(xx-k//3-1,yy-hh+k),(xx+4+k//4,yy-hh+k+1)],shade)
        def trusses(full=False):
            ln([(x-15,y+5),(x+15,y-3)],shade,4)
            for j in range(4):
                a=x-16+8*j;b=y+5-2*j
                ln([(a,b),(a+2,b-7),(a+7,b-10),(a+8,b-2),(a,b)],hi if full else top)
                ln([(a+2,b-7),(a+7,b-2)],mid)
        draw.ellipse((x-15,y-4,x+16,y+9),fill=dark)
        if icon in {'canoes','confluence','field','bluff','cave','switchback','limestone','pass','prairie'}:
            if icon=='canoes':
                draw.ellipse((x-14,y-6,x+13,y+8),fill='#26636d',outline='#6da89e')
                for j, c in enumerate(('#d5604e','#f4b466','#8cbfba')):
                    xx=x-9+5*j;yy=y+3-3*j
                    ln([(xx,yy),(xx+7,yy-1)],c,2);ln([(xx+1,yy),(xx+6,yy)],dark)
                pine(x-12,y-2);pine(x+11,y)
            elif icon=='confluence':
                ln([(x-13,y-9),(x-4,y),(x+4,y),(x+13,y+6)],'#1f5863',5)
                ln([(x+10,y-11),(x+3,y-4),(x+4,y)],'#458f8e',5)
                ln([(x-12,y-8),(x-3,y+1),(x+10,y+5)],hi)
                pine(x-8,y+3);pine(x+11,y-2)
            elif icon=='field':
                for j in range(4):ln([pt(-10,j*3-4),pt(12,j*3-4)],mid if j%2 else top,2)
                block(2,4,7,6,6,top);roof(1,3,9,8,6,3,mid,shade)
                lamp(x+2,y-1)
            elif icon in {'bluff','limestone','cave'}:
                crag(x-5,y+4,12,15);crag(x+8,y+1,8,10,mid,shade)
                if icon=='cave':
                    draw.ellipse((x-8,y-6,x+6,y+5),fill=dark);draw.arc((x-9,y-10,x+8,y+6),175,348,fill=hi,width=2)
                    lamp(x-11,y+3);lamp(x+8,y+4,cyan)
                else:
                    ln([(x-14,y+6),(x-5,y+9),(x+14,y+7)],'#54959b',2);pine(x+8,y-3)
                    if icon=='limestone':
                        # Small recolored cliff mural hint, not a fabricated inscription.
                        ln([(x-9,y-7),(x-6,y-9),(x-3,y-7),(x,y-9)],'#b67b69',2)
            elif icon=='switchback':
                pine(x-9,y,5);pine(x+8,y+2,5);pine(x+2,y-4,4)
                ln([(x-5,y+5),(x-1,y+1),(x+2,y+2),(x+5,y-4)],top,2)
                lamp(x-5,y+4)
            elif icon=='pass':
                crag(x-9,y+5,9,18);crag(x+9,y+5,9,17)
                pine(x-8,y+5,4,True);pine(x+10,y+4,4,True);lamp(x,y+5)
            else:
                for xx,yy in [(x-12,y),(x-3,y+3),(x+6,y-3),(x+12,y+3)]:
                    ln([(xx,yy),(xx+2,yy-3),(xx+4,yy)],top)
                ln([(x-14,y+4),(x-4,y+1),(x+12,y+5)],mid)
                lamp(x+6,y+3)
        elif icon in {'mill','winery','motel','midpoint','deco'}:
            cols={'mill':('#a14d48','#703d40','#bfa685'),'winery':('#957164','#605366','#bd9b83'),
                  'motel':('#b37865','#604b53','#d7b188'),'midpoint':('#aa715b','#6b5050','#cfae84'),
                  'deco':('#d19565','#7e554f','#e7b67d')}
            a,b,rr=cols[icon]
            block(-7,-5,16,10,11,rr,a,b)
            if icon in {'mill','winery'}:
                roof(-8,-6,18,12,11,7,rr,b)
                if icon=='winery':
                    for j in range(3):ln([pt(-10,7+j*3),pt(8,7+j*3)],'#84945a')
            else:
                block(-7,5,20,5,7,rr,a,b)
                if icon=='deco':block(4,-6,5,5,20,rr,a,b)
                if icon in {'midpoint','motel'}:
                    ln([(x+10,y+1),(x+10,y-12),(x+15,y-12)],hi)
                    lamp(x+14,y-12,'#f18471')
            for j in range(-4,10,4):lamp(*pt(j,5,5))
        elif icon in {'pits','pitsteel','kartpits'}:
            # Stands/garages only, no painted representation of the route graph.
            block(-10,-8,23,14,3,shade,mid,dark)
            for j in range(4):block(-9+j*6,-6,5,6,8,top,mid,shade)
            ln([pt(-10,6,3),pt(14,6,3)],hi,2)
            for j in range(4):lamp(*pt(-7+j*6,3,2),[amber,cyan][j%2])
            if icon=='kartpits':
                for j in range(4):draw.point(pt(-8+j*5,8),fill='#ee7769')
        elif icon in {'cablebridge','truss','minetrestle'}:
            trusses(icon=='truss')
            if icon=='cablebridge':
                for xx,yy in [(x-7,y-1),(x+9,y-5)]:
                    ln([(xx,yy+4),(xx,yy-16)],hi,2)
                    for j in (-10,-5,3,8):ln([(xx,yy-15),(xx+j,yy+2)],mid)
                    lamp(xx,yy-16)
            if icon=='minetrestle':
                for j in range(-10,14,5):ln([(x+j,y+1),(x+j,y+10)],mid)
        elif icon in {'arch','chicago','reactor'}:
            if icon=='arch':
                q=[(x+i,y-2-round(18*(1-(i/11)**2))) for i in range(-11,12)]
                ln([(a+1,b) for a,b in q],shade,3);ln(q,hi,2);lamp(x-10,y)
                block(6,-4,5,4,6,top,mid,shade)
            elif icon=='chicago':
                for a,b,t in [(-9,-6,11),(-3,-5,19),(3,-2,16),(8,1,12)]:
                    block(a,b,5,5,t,top,mid,shade)
                    px,py=pt(a+2,b+2,t);ln([(px,py),(px,py-4)],hi);lamp(px,py-4)
            else:
                for a,b,t in [(-7,-5,13),(0,-4,19),(7,-2,14)]:
                    block(a,b,6,7,t,'#76afbd','#34779d','#234362')
                    for j in (3,7,11):
                        ln([pt(a+1,b+7,j),pt(a+5,b+7,j)],cyan)
                for j in [-9,0,9]:lamp(x+j,y+5,cyan)
        elif icon in {'hoodoo','redfins','chimney','summit'}:
            if icon=='hoodoo':
                crag(x,y+4,11,18,'#d29565','#9a6150')
                draw.ellipse((x-7,y-17,x+5,y-12),fill='#edaa78',outline=hi)
            elif icon=='redfins':
                for xx,yy,ww,hh in [(x-9,y,8,13),(x+1,y+1,7,21),(x+9,y-2,5,12)]:
                    crag(xx,yy,ww,hh,'#bd7565','#714c5b')
                draw.ellipse((x+6,y+3,x+13,y+9),fill='#d0916d')
            elif icon=='chimney':
                crag(x,y+5,13,12,top,mid)
                pl([(x-2,y-7),(x-2,y-19),(x+1,y-21),(x+4,y-19),(x+4,y-7)],top)
                ln([(x+3,y-19),(x+3,y-7)],shade)
                lamp(x-13,y+6)
            else:
                crag(x,y+6,14,16,'#dce5e5','#6e84a0')
                block(-4,-5,10,7,4,'#b9cccc','#526983','#405771')
                for j in range(-4,7,3):lamp(x+j,y-1)
        elif icon in {'tunnel','mineshaft'}:
            if icon=='tunnel':
                crag(x,y+3,13,17)
                draw.ellipse((x-6,y-8,x+7,y+5),fill=dark);draw.arc((x-7,y-11,x+8,y+5),180,351,fill=hi,width=2)
                for a in (-10,10):lamp(x+a,y+4)
            else:
                block(-10,0,11,8,8,top,mid,shade)
                ln([(x-8,y+1),(x-2,y-18),(x+5,y-18),(x+12,y+4)],top,2)
                ln([(x-5,y-8),(x+8,y-7),(x-3,y-14),(x+6,y-14)],mid)
                lamp(x+3,y-17)
        elif icon in {'shield','cadillac'}:
            if icon=='shield':
                ln([(x,y-9),(x,y+8)],top,2)
                p=[(x-9,y-11),(x-4,y-14),(x,y-12),(x+4,y-14),(x+9,y-11),(x+7,y-4),(x,y+1),(x-7,y-4)]
                pl(p,shade);ln(p+[p[0]],amber)
                draw.text((x-6,y-12),'66',fill=hi,stroke_width=0)
            else:
                # Half-buried cars, three large upright tail fins, not a driving lane.
                for j,col in enumerate(('#67aeb5','#ca7468','#cba167','#9567a2')):
                    a=x-11+j*7;b=y+4-j%2
                    pl([(a-2,b),(a+3,b-12),(a+6,b-11),(a+3,b)],col);ln([(a+3,b-12),(a+6,b-11)],hi)
                    draw.point((a+3,b-7),fill=dark)
    return im
