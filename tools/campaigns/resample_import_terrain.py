"""Resample a rectangular imported heightmap; never edits the road control points."""
import math

def resample_import_terrain(race,size):
 tile=race['road']['tileMap'];old=float(tile['cellSizeM']);cells=tile['cells']
 if old==size:return
 coords=[tuple(map(int,k.split(','))) for k in cells];xmin=min(x for x,y in coords);xmax=max(x for x,y in coords);ymin=min(y for x,y in coords);ymax=max(y for x,y in coords)
 def cell(x,y):return cells[f'{max(xmin,min(xmax,x))},{max(ymin,min(ymax,y))}']
 result={}
 for y in range(math.floor(ymin*old/size),math.ceil((ymax+1)*old/size)):
  for x in range(math.floor(xmin*old/size),math.ceil((xmax+1)*old/size)):
   gx=(x+.5)*size/old-.5;gy=(y+.5)*size/old-.5;i,j=math.floor(gx),math.floor(gy);u,v=gx-i,gy-j
   a,b,c,d=cell(i,j),cell(i+1,j),cell(i,j+1),cell(i+1,j+1)
   h=(a['elevation']*(1-u)+b['elevation']*u)*(1-v)+(c['elevation']*(1-u)+d['elevation']*u)*v
   result[f'{x},{y}']={'tileId':cell(round(gx),round(gy))['tileId'],'elevation':h}
 tile['cellSizeM']=size;tile['cells']=result
 race['source']['terrainResampling']={'fromCellM':old,'toCellM':size,'method':'Bilinear resampling of imported surrounding terrain for mobile bake memory; road control points unchanged.'}
