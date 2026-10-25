import { getNetworkFinishNodes } from './RaceFinishNodes.js';
import {normalizeRaceRouteNetwork,getNetworkEdgePoints} from './RaceRouteNetwork.js';
const angles={y:[Math.PI,-Math.PI/4,Math.PI/4],t:[Math.PI,-Math.PI/2,Math.PI/2],cross:[0,Math.PI/2,Math.PI,-Math.PI/2],normal:[]};
const unique=(items,prefix)=>{let i=1;while(items.some(n=>n.id===`${prefix}-${i}`))i++;return `${prefix}-${i}`;};

// Reuse authored roads; only unused, automatically generated arms may be removed.
export function setNetworkNodeType(source,nodeId,kind,{lengthM=40,widthM=3.6}={}){
 if(!Object.hasOwn(angles,kind))throw Error('Unknown node type.');
 const network=structuredClone(source),center=network.nodes.find(n=>n.id===nodeId);
 if(!center)throw Error('Select a node first.');
 for(const edge of [...network.edges]){
  if(edge.junctionOwner!==nodeId)continue;
  const other=edge.from===nodeId?edge.to:edge.from;
  if([network.startNodeId,...getNetworkFinishNodes(network).map(node=>node.id)].includes(other)||network.edges.some(e=>e.id!==edge.id&&(e.from===other||e.to===other)))continue;
  network.edges=network.edges.filter(e=>e.id!==edge.id);network.nodes=network.nodes.filter(n=>n.id!==other);
 }
 const connected=network.edges.filter(e=>e.from===nodeId||e.to===nodeId);
 const directions=connected.map(edge=>{const points=getNetworkEdgePoints(network,edge);const p=edge.from===nodeId?points[1]:points.at(-2);return Math.atan2(p.x-center.x,p.z-center.z);});
 const heading=directions.length?directions[0]-Math.PI:0;
 const remaining=angles[kind].map(a=>a+heading);
 for(const direction of directions){
  if(!remaining.length)break;
  let best=0;for(let i=1;i<remaining.length;i++)if(Math.abs(Math.atan2(Math.sin(direction-remaining[i]),Math.cos(direction-remaining[i])))<Math.abs(Math.atan2(Math.sin(direction-remaining[best]),Math.cos(direction-remaining[best]))))best=i;
  remaining.splice(best,1);
 }
 for(const angle of remaining){
  const id=unique(network.nodes,'junction');network.nodes.push({id,name:'',x:center.x+Math.sin(angle)*lengthM,z:center.z+Math.cos(angle)*lengthM,heightM:center.heightM});
  network.edges.push({id:unique(network.edges,'route'),from:nodeId,to:id,widthM:connected[0]?.widthM||widthM,surface:connected[0]?.surface||'asphalt',junctionOwner:nodeId});
 }
 center.junctionKind=kind;
 return normalizeRaceRouteNetwork(network);
}
