"""Build the 11 native campaign-map plates from the current saved map nodes.

Usage: python tools/campaigns/draw_campaign_2994_attractions.py --output /tmp/regional-art
The menu is read only; its bespoke entrances, links, progression and world
overview are never emitted by this tool. The output consists of 33 art files
and a separate QA contact sheet/receipt.
"""
import argparse
import base64
import gzip
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw
from draw_overhead_campaign_map_art import overhead
from draw_campaign_attractions_central import boards as central_bases
from draw_campaign_attractions_west import render as west_base
from draw_campaign_2994_providence import decorate as anchors_providence
from draw_campaign_2994_east_details import decorate as anchors_east
from draw_campaign_2994_central_details import decorate as anchors_central
from draw_campaign_2994_west_details import decorate as anchors_west

ROOT=Path(__file__).resolve().parents[2]
MENU=Path('data/server-storage/files/menus/Game Menu/document.json')
ASSET=Path('assets/campaign-art/maps')
NATIVE=Path('data/server-storage/files/art')
W,H=384,256
REGIONS=('providence','mount-washington','laurel-highlands','ohio-river','ozarks',
         'data-center-city','route-66','pikes-peak','moki-dugway','oak-creek-canyon','angeles-crest')
ART_REVISION=1795356000000

def read_document(path):
    doc=json.loads(path.read_bytes())
    if doc.get('__chainsawStorage')=='compact-v1':
        return json.loads(gzip.decompress(base64.b64decode(doc['data'])))
    return doc

def sha(b):return hashlib.sha256(b).hexdigest()

def write_file(path, data):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(data)

def draw(name,nodes):
    if name=='providence':return anchors_providence(name,overhead(name),nodes)
    if name in REGIONS[1:4]:return anchors_east(name,overhead(name),nodes)
    if name in REGIONS[4:8]:
        im=central_bases[name]() if name in central_bases else west_base(name)
        return anchors_central(name,im,nodes)
    return anchors_west(name,west_base(name),nodes)

def generate(menu,out):
    raw=menu.read_bytes()
    doc=read_document(menu)
    screens={s['id']:s for s in doc['screens']}
    records={}
    contact=Image.new('RGB',(W*3,(H+21)*4),'#142035')
    captions=ImageDraw.Draw(contact)
    for i,name in enumerate(REGIONS,1):
        screen=screens[f'campaign-hub-{i}']
        element=next(e for e in screen['elements'] if e.get('property')=='campaign-path')
        ref=f'campaign-map-{name}'
        if element.get('artRef')!=ref:
            raise ValueError(f'{screen["id"]} uses {element.get("artRef")}, expected {ref}')
        nodes=element['nodes']
        races=[node['raceRef'] for node in nodes if node.get('raceRef')]
        if len(races)!=8 or len(set(races))!=8:
            raise ValueError(f'{screen["id"]} unfamiliar route, review landmark associations first')
        im=draw(name,nodes).convert('RGB')
        if im.size!=(W,H):raise ValueError(f'{ref} has unexpected image dimensions {im.size}')
        png=ASSET/(ref+'.png')
        png_path=out/png
        png_path.parent.mkdir(parents=True,exist_ok=True)
        im.resize((1536,1024),Image.Resampling.NEAREST).save(png_path,optimize=True)
        native=NATIVE/ref/'document.json'
        pixel_doc={'kind':'actor-state-animation','width':W,'height':H,'fps':1,
                   'frames':[['#%02x%02x%02xff'%c for c in im.getdata()]],
                   'importSource':{'path':png.as_posix(),'sha256':sha(png_path.read_bytes()),
                                   'width':1536,'height':1024,'sampling':'nearest-neighbor','maxEdge':384}}
        encoded=base64.b64encode(gzip.compress(json.dumps(pixel_doc,separators=(',',':')).encode(),mtime=0)).decode()
        write_file(out/native,(json.dumps({'__chainsawStorage':'compact-v1','encoding':'json-gzip-base64','data':encoded},indent=2)+'\n').encode())
        metadata=NATIVE/ref/'metadata.json'
        source_metadata=ROOT/metadata
        saved=json.loads(source_metadata.read_bytes()) if source_metadata.is_file() else {'name':ref,'folder':'art','version':1}
        saved['savedAt']=ART_REVISION
        write_file(out/metadata,(json.dumps(saved,indent=2)+'\n').encode())
        files=(png,native,metadata)
        records[ref]={'races':races,'files':{p.as_posix():sha((out/p).read_bytes()) for p in files}}
        x,y=(i-1)%3*W,(i-1)//3*(H+21)
        contact.paste(im,(x,y));captions.text((x+8,y+H+4),f'{i:02}  {name}',fill='#e1e9ee')
    write_file(out/'receipt.json',(json.dumps({'inputMenuSha256':sha(raw),'maps':records},indent=2)+'\n').encode())
    contact.save(out/'contact.png')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--menu',type=Path,default=ROOT/MENU)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    generate(args.menu,args.output)
