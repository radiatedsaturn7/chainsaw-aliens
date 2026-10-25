import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {findNetworkRoute,normalizeRaceRouteNetwork,validateRaceRouteNetwork,networkEdgeLength} from '../../src/racing/RaceRouteNetwork.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
export const readDocument = path => {
  const value=JSON.parse(fs.readFileSync(path));
  return value.__chainsawStorage ? JSON.parse(gunzipSync(Buffer.from(value.data,'base64'))) : value;
};
const source=readDocument('data/server-storage/files/races/p1/document.json');
const race=structuredClone(source.race);
const target=findNetworkRoute(normalizeRaceRouteNetwork(race.road.network)).lengthM*10;
const width=race.road.network.edges[0].widthM;
// Two lobes cross at different heights. The western lobe adds switchbacks.
const count=960, finishIndex=944;
const points=Array.from({length:count+1},(_,i)=>{
  const t=i/count*Math.PI*2;
  return {x:Math.sin(t),z:.65*Math.sin(2*t)+(t>Math.PI?.22*Math.sin(18*t)*Math.sin(t)**2:0),heightM:0};
});
let planarLength=0;
for(let i=1;i<points.length;i++)planarLength+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);
const lengths=[0,0];
for(let i=1;i<=finishIndex;i++)lengths[i<=count/2?0:1]+=Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z);
for(let i=0;i<points.length;i++){
  const p=points[i],scale=target/2/lengths[i<=count/2?0:1];p.x*=scale;p.z*=scale;
  // Smooth climb to the central flyover, and a buried street tunnel.
  p.heightM=14*Math.exp(-(((i-count/2)/24)**2))-9*Math.exp(-(((i-count*.23)/23)**4));
}
points[0].heightM=points[count].heightM=0;
const nodes=[],edges=[];
for(let i=0;i<=finishIndex;i+=8)nodes.push({...points[i],id:`n${i}`,name:i===0?'Start':i===finishIndex?'Finish':`Route ${i/8}`});
for(let i=0;i<finishIndex;i+=8){
  const middle=i+4;
  edges.push({id:`e${i}`,from:`n${i}`,to:`n${i+8}`,points:points.slice(i+1,i+8),widthM:width,
    surface:i<count/2?'asphalt':(i%32<16?'dirt':'gravel'),bidirectional:false,
    structure:Math.abs(middle-count/2)<25?'bridge':Math.abs(middle-count*.23)<35?'tunnel':'road',clearanceM:6,thicknessM:.5});
}
edges.push({id:'loop-close',from:`n${finishIndex}`,to:'n0',points:[],widthM:width,surface:'gravel',bidirectional:false,structure:'road'});
// Long side loops create real branch/rejoin junctions without shortening the main lap.
for(const [a,b,side] of [[80,104,1],[640,664,-1]]){
  const from=nodes.find(n=>n.id===`n${a}`),to=nodes.find(n=>n.id===`n${b}`);
  from.junctionKind='y';to.junctionKind='y';
  edges.push({id:`detour${a}`,from:from.id,to:to.id,widthM:width,surface:a<480?'asphalt':'gravel',bidirectional:false,structure:'road',
    points:[{x:from.x+side*400,z:from.z,heightM:from.heightM},{x:to.x+side*400,z:to.z,heightM:to.heightM}]});
}
race.id=race.name='p2loadtest';race.description='15.7 km endurance load test: street, rally switchbacks, junctions, tunnel and flyover. 11 AI rivals.';
race.type='destination';race.laps=1;race.weather='clear';
race.road.network=normalizeRaceRouteNetwork({nodes,edges,startNodeId:'n0',finishNodeId:`n${finishIndex}`});
// Keep P1's ground artwork, repainting the new corridor rather than retaining its old geography.
const tileTemplate=Object.values(race.road.tileMap.cells).find(c=>c.artRef);
race.road.tileMap.cells={};race.road.tileMap.revision++;
for(const p of points)for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){
  const x=Math.floor(p.x/5)+dx,z=Math.floor(p.z/5)+dz;
  race.road.tileMap.cells[`${x},${z}`]={...tileTemplate,elevation:0};
}
race.road.nodes=[{x:points[0].x,y:points[0].z,elevation:0,role:'start',locked:true}];race.road.segments=[];
const editor=new RaceEditor({});editor.applyLoadedRaceDocument({...source,race},{name:'p2loadtest'});for(const name of ['RTG-001','CT-86','PZ-24','BUSE-019']) editor.applyLoadedCarDocument(readDocument(`data/server-storage/files/cars/${name}/document.json`),{name});
editor.setRaceAiCount(11);
if(editor.getRaceAiCount()!==11)throw Error('Saved load test must contain 11 enabled AI drivers');
race.competition=editor.selectedRace.competition;
const errors=validateRaceRouteNetwork(race.road.network);if(errors.length)throw Error(errors.join('; '));
const length=findNetworkRoute(race.road.network).lengthM;
const savedAt=Date.now();const doc={schemaVersion:1,kind:'race-track',savedAt,selectedRaceId:race.id,race};
const dir='data/server-storage/files/races/p2loadtest';
if(fs.existsSync(dir)&&!process.argv.includes('--replace'))throw Error('p2loadtest already exists; use --replace deliberately');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(`${dir}/document.json`,JSON.stringify({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:gzipSync(JSON.stringify(doc)).toString('base64')},null,2)+'\n');
fs.writeFileSync(`${dir}/metadata.json`,JSON.stringify({name:race.name,folder:'races',savedAt,version:1},null,2)+'\n');
const path='data/server-storage/files/manifest.json',manifest=JSON.parse(fs.readFileSync(path));manifest.folders.races.p2loadtest='races/p2loadtest/document.json';fs.writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({length,target,width,nodes:nodes.length,edges:edges.length,paintedCells:Object.keys(race.road.tileMap.cells).length,surfaceLengths:Object.fromEntries(['asphalt','dirt','gravel'].map(s=>[s,edges.filter(e=>e.surface===s&&!e.id.startsWith('detour')).reduce((sum,e)=>sum+networkEdgeLength(race.road.network,e),0)]))}));
