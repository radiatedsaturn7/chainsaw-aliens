import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mapRoadPoint,campaignRoadDirectionalNode} from '../../src/menus/MenuMapRoads.js';
const V={right:[1,0],down:[0,1],left:[-1,0],up:[0,-1]};
const names=Object.keys(V),near=.045;
const samples=32;
const styleBounds=[[1,1],[390,535],[930,490],[250,350]];
function screenPoints(nodes,map){
 return styleBounds.map(([w,h])=>new Map(nodes.map(n=>{
  if(w===1)return [n.id,n];
  const radius=Math.max(8,Math.min(w,h)*.035)*(map.mapStyle?.nodeScale||1);
  const px=Math.min(w/2,radius+7),py=Math.min(h/2,radius+7),height=h-36;
  return [n.id,{...n,x:Math.max(px,Math.min(w-px,n.x*w))/w,y:Math.max(py,Math.min(h-py,n.y*height))/height}];
 })));
}
const points=(road,nodes,res=samples)=>Array.from({length:res+1},(_,i)=>mapRoadPoint(road,nodes.get(road.from),nodes.get(road.to),i/res));
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function hits(a,b,c,d){
 const eps=1e-10;
 if(Math.max(a.x,b.x)+eps<Math.min(c.x,d.x)||Math.max(c.x,d.x)+eps<Math.min(a.x,b.x)||Math.max(a.y,b.y)+eps<Math.min(c.y,d.y)||Math.max(c.y,d.y)+eps<Math.min(a.y,b.y))return false;
 return cross(a,b,c)*cross(a,b,d)<=eps**2&&cross(c,d,a)*cross(c,d,b)<=eps**2;
}
function gap(p,a,b){
 const x=b.x-a.x,y=b.y-a.y;
 const t=Math.max(0,Math.min(1,((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1)));
 return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);
}
function intersect(e,ex,f,fx,nodes,spacing=.034){
 const shared=[e.from,e.to].find(v=>v===f.from||v===f.to),j=shared&&nodes.get(shared);
 const endpoint=(a,b)=>j&&distance(a,j)<near&&distance(b,j)<near;
 for(let k=1;k<ex.length;k++)for(let l=1;l<fx.length;l++){
  const a=ex[k-1],b=ex[k],c=fx[l-1],d=fx[l];
  const physicalCommon=j&&Math.min(distance(a,j),distance(b,j))<1e-9&&Math.min(distance(c,j),distance(d,j))<1e-9;
  if(!physicalCommon&&hits(a,b,c,d))return true;
  if(endpoint(a,b)&&endpoint(c,d))continue;
  const margin=shared?Math.min(spacing,.026):spacing;
  if(gap(a,c,d)<margin||gap(c,a,b)<margin)return true;
 }
 return false;
}
function shapeOk(e,p,nodes){
 if(p.some(q=>q.x<=.012||q.x>=.988||q.y<=.012||q.y>=.988))return false;
 for(const n of nodes.values())if(n.id!==e.from&&n.id!==e.to){
   for(let i=1;i<p.length;i++)if(gap(n,p[i-1],p[i])<.032)return false;
 }
 for(let i=1;i<p.length;i++)for(let j=i+2;j<p.length;j++)if(hits(p[i-1],p[i],p[j-1],p[j]))return false;
 return true;
}
export function validateTopology(map){
 const nodes=map.nodes;
 assert.equal(nodes.length,8);assert.ok(nodes.every(n=>n.raceRef));
 const graph=new Map(nodes.map(n=>[n.id,[]])),used=new Map(nodes.map(n=>[n.id,new Set()]));
 for(const e of map.connections){
  assert.ok(e.from!==e.to&&graph.has(e.from)&&graph.has(e.to));
  for(const [id,port] of [[e.from,e.fromPort],[e.to,e.toPort]]){
   assert.ok(names.includes(port));assert.ok(!used.get(id).has(port),`duplicate port ${id}/${port}`);used.get(id).add(port);
  }
  graph.get(e.from).push(e.to);graph.get(e.to).push(e.from);
  const from=nodes.find(n=>n.id===e.from),to=nodes.find(n=>n.id===e.to);
  assert.equal(campaignRoadDirectionalNode(nodes,map.connections,from,e.fromPort,n=>n)?.id,to.id);
  assert.equal(campaignRoadDirectionalNode(nodes,map.connections,to,e.toPort,n=>n)?.id,from.id);
  for(const t of [.025,.075,.125]){
   const g=mapRoadPoint(e,from,to,t), h=mapRoadPoint(e,from,to,1-t);
   for(const [u,p,port] of [[from,g,e.fromPort],[to,h,e.toPort]]){
    const [x,y]=V[port],dx=p.x-u.x,dy=p.y-u.y;
    assert.ok(x*dx+y*dy>0&&Math.abs(x*dy-y*dx)<1e-12,'straight cardinal port');
   }
  }
 }
 const seen=new Set([nodes[0].id]),queue=[nodes[0].id];
 for(let i=0;i<queue.length;i++)for(const id of graph.get(queue[i]))if(!seen.has(id)){seen.add(id);queue.push(id);}
 assert.equal(seen.size,8);
 for(const view of screenPoints(nodes,map)){
  const ps=map.connections.map(e=>points(e,view,96));
  for(let i=0;i<ps.length;i++){
   const e=map.connections[i];
   assert.ok(shapeOk(e,ps[i],view),`invalid path ${e.from}/${e.to}`);
   for(let j=0;j<i;j++)assert.ok(!intersect(e,ps[i],map.connections[j],ps[j],view,.030),`crossing paths ${e.from}/${e.to}`);
  }
 }
 return graph;
}
function nextParts(map,r){
 const byRef=new Map(map.nodes.map(n=>[n.raceRef,n.id]));
 assert.equal(byRef.size,8,r.bossRef);
 const start=byRef.get(r.mainPath[0]),boss=byRef.get(r.bossRef);
 const required=new Set(r.mainPath.map(ref=>byRef.get(ref)));
 const optional=new Set(map.nodes.filter(n=>!required.has(n.id)&&n.id!==boss).map(n=>n.id));
 assert.ok(start&&boss);assert.equal(required.size,5);assert.equal(optional.size,2);
 return {start,boss,required,optional,byRef};
}
function build(map,r){
 const nodes=map.nodes,view=screenPoints(nodes,map),raw=view[0];
 const {start,boss,required,optional,byRef}=nextParts(map,r);
 const phaseOf=n=>required.has(n)?0:optional.has(n)?1:2;
 let iterations=0,last;
 function search(connected,roads,taken){
  if(++iterations>3500)return null;
  if(connected.size===nodes.length)return roads;
  const phase=Math.min(...nodes.filter(n=>!connected.has(n.id)).map(n=>phaseOf(n.id)));
  const candidates=[];
  for(const aId of connected)for(const b of nodes){
   if(connected.has(b.id)||phaseOf(b.id)!==phase||aId===boss||phase===2&&(!required.has(aId)||aId===start))continue;
   const a=raw.get(aId);
   const dist=distance(a,b);
   const dx=b.x-a.x,dy=b.y-a.y;
   const force=(r.stage===1&&aId===start&&roads.length<2&&['Blue Hills — Reservation Parkways','RI 116 — North Smithfield Scituate'].includes(b.raceRef))?-.40:0;
   const base=dist+.04*(taken.get(aId).size)**2+force+(phaseOf(aId)===1?.075:0);
   for(const pa of names)for(const pb of names){
    if(taken.get(aId).has(pa)||taken.get(b.id).has(pb))continue;
    const dot=(d,x,y)=>(V[d][0]*x+V[d][1]*y)/dist;
    const angular=.093*(2-dot(pa,dx,dy)-dot(pb,-dx,-dy));
    for(const portBend of [1,.72,.46]){
     const edge={id:`road-${roads.length+1}`,from:aId,to:b.id,curve:'bezier',fromPort:pa,toPort:pb,portBend,
      ...(optional.has(b.id)?{pattern:'dotted'}:{})};
     candidates.push({edge,score:base+angular+(1-portBend)*.025});
    }
   }
  }
  candidates.sort((a,b)=>a.score-b.score||a.edge.from.localeCompare(b.edge.from)||a.edge.to.localeCompare(b.edge.to)||a.edge.fromPort.localeCompare(b.edge.fromPort));
  for(const {edge} of candidates){
   const ep=view.map(v=>points(edge,v));
   if(ep.some((p,i)=>!shapeOk(edge,p,view[i])||roads.some(l=>intersect(edge,p,l.edge,l.ep[i],view[i]))))continue;
   connected.add(edge.to);taken.get(edge.from).add(edge.fromPort);taken.get(edge.to).add(edge.toPort);roads.push({edge,ep});
   const solution=search(connected,roads,taken);
   if(solution)return solution;
   connected.delete(edge.to);taken.get(edge.from).delete(edge.fromPort);taken.get(edge.to).delete(edge.toPort);roads.pop();
  }
  last={phase,connected:[...connected],iterations};
  return null;
 }
 const roads=search(new Set([start]),[],new Map(nodes.map(n=>[n.id,new Set()])));
 assert.ok(roads,`${r.bossRef} cannot produce safe topology: ${JSON.stringify(last)}`);
 return {connections:roads.map(o=>o.edge),iterations,start,boss};
}
export function authorCampaignTopology(doc){
 const regions=doc.parameters?.campaignProgression?.regions||[];assert.equal(regions.length,11);
 const summary=[];
 for(const r of regions){
  const screen=doc.screens.find(s=>s.id===`campaign-hub-${r.stage}`);
  const map=screen?.elements.find(e=>e.id==='regional-path'&&e.property==='campaign-path');assert.ok(map,r.bossRef);
  const old=structuredClone(map.nodes); const {connections,iterations,start,boss}=build(map,r);
  map.connections=connections;
  const graph=validateTopology(map);assert.equal(graph.get(boss).length,1,r.bossRef);
  assert.deepEqual(map.nodes,old);
  summary.push({stage:r.stage,bossRef:r.bossRef,start,boss,iterations,maxDegree:Math.max(...[...graph.values()].map(v=>v.length)),edges:connections.length});
 }
 return summary;
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const [, ,input,output]=process.argv;assert.ok(input&&output&&input!==output&&!fs.existsSync(output),'usage: node author.mjs CURRENT_MENU NEW_OUTPUT');
 const doc=JSON.parse(fs.readFileSync(input));const summary=authorCampaignTopology(doc);
 fs.writeFileSync(output,JSON.stringify(doc,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify(summary,null,2));
}
