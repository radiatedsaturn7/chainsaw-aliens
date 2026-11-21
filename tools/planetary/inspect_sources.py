"""Prepare compact rover-source diagnostics. Does not install fictional race roads.
Apollo projected coordinates use the published spherical lunar TM CRS.
Mars best_interp is already localized in the mission frame; never use Earth's radius.
"""
import csv,hashlib,json,math,struct
from pathlib import Path
ROOT=Path('data/campaigns/planetary')
def lunar_latlon(x,y):
 radius=1737400.;d=y/radius;v=(x-500000.)/radius
 return math.degrees(math.asin(math.sin(d)/math.cosh(v))),30.7+math.degrees(math.atan2(math.sinh(v),math.cos(d)))
def shape_lines(raw):
 if struct.unpack_from('>I',raw)[0]!=9994 or struct.unpack_from('<I',raw,32)[0]!=3:raise ValueError('Expected polyline shapefile')
 offset=100;lines=[]
 while offset<len(raw):
  number,size=struct.unpack_from('>II',raw,offset);offset+=8;record=raw[offset:offset+size*2];offset+=size*2
  if struct.unpack_from('<I',record)[0]!=3:raise ValueError('Unexpected shape type')
  parts,count=struct.unpack_from('<II',record,36);starts=list(struct.unpack_from('<'+'I'*parts,record,44))+[count]
  points=[struct.unpack_from('<dd',record,44+parts*4+i*16) for i in range(count)]
  for a,b in zip(starts,starts[1:]):lines.append({'sourceRecord':number,'points':points[a:b]})
 return lines

def inspect_mars(filename):
 rows=[]
 for r in csv.DictReader(open(filename)):
  if r['frame']!='ROVER' or int(r['sol'])<0:continue
  names=['landing_y','landing_x','elevation','planetocentric_latitude','longitude']
  p=[float(r[n]) for n in names]
  if any(not math.isfinite(v) or v==-9999 for v in p):continue
  # x east, z south, metres. Absolute published elevation retained separately.
  p=[p[0],-p[1],p[2],p[3],p[4]]
  rows.append({'sol':int(r['sol']),'site':int(r['site']),'drive':int(r['drive']),'sclk':float(r['sclk']),'point':p})
 rows.sort(key=lambda r:r['sclk']);unique=[]
 for row in rows:
  if not unique or row['point'][:3]!=unique[-1]['point'][:3]:unique.append(row)
 gaps=[];length=0
 for a,b in zip(unique,unique[1:]):
  d=math.dist(a['point'][:2],b['point'][:2]);length+=d
  if d>100:gaps.append({'fromSol':a['sol'],'toSol':b['sol'],'distanceM':round(d,2)})
 return {'body':'Mars','mission':'Perseverance','sourceType':'PDS best_interp rover localizations, not wheel-track survey','columns':['eastM','southM','elevationM','planetocentricLatitudeDeg','eastLongitudeDeg'],'records':unique,'diagnostics':{'sourceRoverRecords':len(rows),'distinctConsecutivePositions':len(unique),'minSol':min(r['sol'] for r in rows),'maxSol':max(r['sol'] for r in rows),'sumOfPositionChordsM':round(length,2),'gapsOver100M':gaps,'warning':'Chord sum is not certified rover odometry. Do not interpolate large gaps into an alleged exact route.'}}
if __name__=='__main__':
 raw=(ROOT/'sources/APOLLO17_TRAVERSE_2018.SHP').read_bytes();lines=shape_lines(raw)
 moon={'body':'Moon','mission':'Apollo 17','source':'Haase et al. 2018 / USGS Apollo17_PDS_fullPackage_Haase.zip','projection':'Spherical transverse Mercator; radius 1737400 m; central meridian 30.7 degrees; false easting 500000 m; scale 1','routeAccuracy':'Reconstructed from maps, surface photography and visible rover tracks, not GPS. Separate source line records preserved; EVA assignment not guessed.','lines':[]}
 for line in lines:
  ps=line['points'];moon['lines'].append({'sourceRecord':line['sourceRecord'],'lengthM':round(sum(math.dist(a,b) for a,b in zip(ps,ps[1:])),2),'projectedPointsM':ps,'latlon':[lunar_latlon(*p) for p in ps]})
 (ROOT/'apollo17-traverses.json').write_text(json.dumps(moon,separators=(',',':'))+'\n')
 mars=inspect_mars('artifacts/planetary/m20-best_interp.csv')
 # Keep the source conversion reproducible without shipping an 8 MB CSV to clients.
 import gzip
 (ROOT/'perseverance-localizations.json.gz').write_bytes(gzip.compress(json.dumps(mars,separators=(',',':')).encode(),mtime=0))
 print(json.dumps({'moonLineLengthsM':[l['lengthM'] for l in moon['lines']],'mars':mars['diagnostics']},indent=2))
