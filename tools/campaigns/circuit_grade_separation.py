"""Preserve mapped circuit overpasses with explicit existing road-network topology.
DEM samples are ground heights, not surveyed decks. Clearance is an authored
approximation and recorded as such; separate node IDs prevent junction merging.
"""
import math

def crossing(a,b,c,d):
 ux,uy=b['x']-a['x'],b['y']-a['y'];vx,vy=d['x']-c['x'],d['y']-c['y'];den=ux*vy-uy*vx
 if abs(den)<1e-8:return None
 dx,dy=c['x']-a['x'],c['y']-a['y'];t=(dx*vy-dy*vx)/den;u=(dx*uy-dy*ux)/den
 return (t,u) if 0<=t<=1 and 0<=u<=1 else None

def apply_grade_separation(race,clearance=6.5):
 road=race['road'];ns=road['nodes'];ss=road['segments'];ds=[0]
 for a,b in zip(ns,ns[1:]):ds.append(ds[-1]+math.hypot(b['x']-a['x'],b['y']-a['y']))
 crossings=[]
 for i,s in enumerate(ss):
  if s.get('structure')!='bridge':continue
  for j in range(len(ss)):
   if abs(i-j)<3 or ss[j].get('structure')=='bridge':continue
   hit=crossing(ns[i],ns[i+1],ns[j],ns[j+1])
   if hit:
    t,u=hit;center=ds[i]+t*(ds[i+1]-ds[i]);upper=ns[i]['elevation']*(1-t)+ns[i+1]['elevation']*t;lower=ns[j]['elevation']*(1-u)+ns[j+1]['elevation']*u
    lift=max(0,(lower-upper)*12+clearance)
    crossings.append(dict(upperSegment=i,lowerSegment=j,centerM=center,clearanceM=clearance,liftM=lift))
    for k,n in enumerate(ns):
     distance=abs(ds[k]-center);weight=max(0,min(1,(180-distance)/120));weight=weight*weight*(3-2*weight)
     n['elevation']+=lift*weight/12
    for k,edge in enumerate(ss):
     if abs((ds[k]+ds[k+1])/2-center)<75:edge['structure']='bridge'
 if not crossings:return
 for n,s in zip(ns[1:],ss):s['elevation']=n['elevation']
 network={'version':1,'nodes':[],'edges':[],'startNodeId':'route-0','finishNodeId':f'route-{len(ns)-1}'}
 for i,n in enumerate(ns):network['nodes'].append(dict(id=f'route-{i}',x=n['x'],z=n['y'],heightM=n['elevation']*12))
 for i,s in enumerate(ss):network['edges'].append(dict(id=f'edge-{i}',**{'from':f'route-{i}','to':f'route-{i+1}'},points=[],widthM=s['roadWidthM'],surface=s['surface'],structure=s.get('structure','road'),clearanceM=clearance,thicknessM=.5,bidirectional=False))
 road['network']=network
 race['source']['gradeSeparation']={'method':'Mapped overpass, explicit independent network nodes; DEM ground heights with approximate 6.5 m minimum deck clearance and blended approaches. Not surveyed bridge elevations.','crossings':crossings}
