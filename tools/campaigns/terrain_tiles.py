"""Cached Tilezen Terrarium DEM samples for the existing track importer.
Source: https://registry.opendata.aws/terrain-tiles/ (Mapzen/Tilezen).
Encoding: https://github.com/tilezen/joerd/blob/master/docs/formats.md
"""
import math
import struct
import threading
import zlib
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

CACHE=Path('data/server-storage/race-import-cache/terrain-tiles')
_tiles={}
_lock=threading.Lock()
ZOOM=12


def decode_png(raw):
    if raw[:8]!=b'\x89PNG\r\n\x1a\n':raise ValueError('Invalid terrain PNG')
    pos=8;packed=[];width=height=channels=None
    while pos<len(raw):
        size=struct.unpack('>I',raw[pos:pos+4])[0];kind=raw[pos+4:pos+8];body=raw[pos+8:pos+8+size];pos+=size+12
        if kind==b'IHDR':
            width,height,depth,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',body)
            if depth!=8 or color not in (2,6) or interlace or width!=256 or height!=256:raise ValueError('Unsupported terrain PNG format')
            channels=3 if color==2 else 4
        elif kind==b'IDAT':packed.append(body)
        elif kind==b'IEND':break
    if channels is None:raise ValueError('Terrain PNG has no header')
    data=zlib.decompress(b''.join(packed));stride=width*channels;rows=[];previous=bytearray(stride)
    if len(data)!=(stride+1)*height:raise ValueError('Invalid terrain PNG pixel count')
    for y in range(height):
        start=y*(stride+1);mode=data[start];row=bytearray(data[start+1:start+1+stride])
        for i in range(stride):
            left=row[i-channels] if i>=channels else 0;up=previous[i];corner=previous[i-channels] if i>=channels else 0
            if mode==0:predict=0
            elif mode==1:predict=left
            elif mode==2:predict=up
            elif mode==3:predict=(left+up)//2
            elif mode==4:
                p=left+up-corner;a,b,c=abs(p-left),abs(p-up),abs(p-corner)
                predict=left if a<=b and a<=c else up if b<=c else corner
            else:raise ValueError('Unknown PNG filter')
            row[i]=(row[i]+predict)&255
        rows.append([row[i]*256+row[i+1]+row[i+2]/256-32768 for i in range(0,stride,channels)])
        previous=row
    return rows


def tile(x,y):
    key=(x,y)
    with _lock:
        if key in _tiles:return _tiles[key]
        file=CACHE/f'{ZOOM}-{x}-{y}.png'
        if file.exists():raw=file.read_bytes()
        else:
            url=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{x}/{y}.png'
            with urlopen(Request(url,headers={'User-Agent':'LastOnTheGrid-CampaignImporter/1.0'}),timeout=20) as response:raw=response.read(2_000_001)
            if len(raw)>2_000_000:raise ValueError('Terrain tile exceeds size limit')
        rows=decode_png(raw)
        if not file.exists():CACHE.mkdir(parents=True,exist_ok=True);file.write_bytes(raw)
        _tiles[key]=rows
        return rows


def elevation(lat,lon):
    scale=(2**ZOOM)*256
    px=(lon+180)/360*scale-.5
    py=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*scale-.5
    x,y=math.floor(px),math.floor(py);tx,ty=px-x,py-y
    def pixel(x,y):return tile(x//256,y//256)[y%256][x%256]
    a=pixel(x,y)*(1-tx)+pixel(x+1,y)*tx
    b=pixel(x,y+1)*(1-tx)+pixel(x+1,y+1)*tx
    value=a*(1-ty)+b*ty
    if not -500<=value<=9000:raise ValueError('No valid DEM elevation at location')
    return value


def importer_fetch(url,**kwargs):
    query=parse_qs(urlparse(url).query)
    try:return {'value':elevation(float(query['y'][0]),float(query['x'][0]))}
    except (OSError,KeyError,ValueError) as error:raise ValueError('Terrain tile sample unavailable: '+str(error)) from error
