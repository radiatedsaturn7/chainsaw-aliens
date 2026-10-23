import {normalizeRaceRouteNetwork,getNetworkEdgePoints} from './RaceRouteNetwork.js';

export function networkSelection(network,nodeIds=[],edgeIds=[]){
 const validNodes=new Set(network.nodes.map(n=>n.id)),validEdges=new Set(network.edges.map(e=>e.id));
 const nodes=new Set(nodeIds.filter(id=>validNodes.has(id)));
 const edges=new Set(edgeIds.filter(id=>validEdges.has(id)));
 const geometryNodes=new Set(nodes);
 for(const edge of network.edges)if(edges.has(edge.id)){geometryNodes.add(edge.from);geometryNodes.add(edge.to);}
 const roads=new Set(network.edges.filter(e=>edges.has(e.id)||nodes.has(e.from)||nodes.has(e.to)).map(e=>e.id));
 return {nodes:geometryNodes,edges:roads};
}
export function transformNetworkSelection(network,nodeIds,edgeIds,{dx=0,dz=0,scale=1,rotation=0,widthScale=1,surface=''}={}){
 if(![dx,dz,scale,rotation,widthScale].every(Number.isFinite)||scale<=0||widthScale<=0)throw Error('Use finite values and positive scale factors.');
 const selection=networkSelection(network,nodeIds,edgeIds),next=structuredClone(network);
 const vertices=network.nodes.filter(n=>selection.nodes.has(n.id));
 if(!vertices.length)return next;
 const points=[...vertices,...network.edges.filter(e=>selection.nodes.has(e.from)&&selection.nodes.has(e.to)).flatMap(e=>e.points)];
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(const p of points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}
 const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2;
 const angle=rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
 const transform=p=>({...p,x:cx+((p.x-cx)*c-(p.z-cz)*s)*scale+dx,z:cz+((p.x-cx)*s+(p.z-cz)*c)*scale+dz});
 const delta=new Map();
 for(const node of next.nodes)if(selection.nodes.has(node.id)){const moved=transform(node);delta.set(node.id,{x:moved.x-node.x,z:moved.z-node.z});Object.assign(node,moved);}
 const originalEdges=new Map(network.edges.map(e=>[e.id,e]));
 for(const edge of next.edges){
  const source=originalEdges.get(edge.id),a=delta.get(edge.from),b=delta.get(edge.to);
  if(a&&b)edge.points=source.points.map(transform);
  else if(a||b){
   const line=getNetworkEdgePoints(network,source),lengths=line.slice(1).map((p,i)=>Math.hypot(p.x-line[i].x,p.z-line[i].z,p.heightM-line[i].heightM));
   const total=lengths.reduce((sum,v)=>sum+v,0);let travelled=0;
   edge.points=source.points.map((p,i)=>{travelled+=lengths[i];const t=total?travelled/total:(i+1)/(source.points.length+1);return {...p,x:p.x+(a?.x||0)*(1-t)+(b?.x||0)*t,z:p.z+(a?.z||0)*(1-t)+(b?.z||0)*t};});
  }
  if(selection.edges.has(edge.id)){edge.widthM*=widthScale;if(surface)edge.surface=surface;}
 }
 return normalizeRaceRouteNetwork(next);
}

// Crossing selection: include an edge even when both endpoints lie outside
// the box. Test every segment, so bends do not behave like endpoint chords.
export function networkSelectionInBox(network,a,b){
 const left=Math.min(a.x,b.x),right=Math.max(a.x,b.x),top=Math.min(a.z,b.z),bottom=Math.max(a.z,b.z);
 const contains=p=>p.x>=left&&p.x<=right&&p.z>=top&&p.z<=bottom;
 const crosses=(p,q)=>{
  let low=0,high=1;
  for(const [start,end,min,max] of [[p.x,q.x,left,right],[p.z,q.z,top,bottom]]){
   const d=end-start;
   if(!d){if(start<min||start>max)return false;continue;}
   const t1=(min-start)/d,t2=(max-start)/d;
   low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));
   if(low>high)return false;
  }
  return true;
 };
 return {
  nodes:network.nodes.filter(contains).map(n=>n.id),
  edges:network.edges.filter(edge=>{const points=getNetworkEdgePoints(network,edge);return points.slice(1).some((p,i)=>crosses(points[i],p));}).map(e=>e.id)
 };
}
