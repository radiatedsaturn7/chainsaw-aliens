import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {getStressPerimeter} from './stress-perimeter.mjs';
import {buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
const base='http://127.0.0.1:8000/__storage/file';
const name='Mount Washington Auto Road — point-to-point';
const read=async(folder,name)=>(await(await fetch(`${base}?folder=${folder}&name=${encodeURIComponent(name)}`)).json()).file.data;
const doc=await read('races',name),p1=await read('races','p1'),tree=(await read('doodads','tree')).doodad,fence=(await read('doodads','fenceguardrail')).doodad;
const e=new RaceEditor({});e.applyLoadedRaceDocument(doc,{name});
for(const car of ['RTG-001','CT-86','PZ-24','BUSE-019'])e.applyLoadedCarDocument(await read('cars',car),{name:car});
e.hydrateProjectCarsFromSavedFiles=()=>{};
e.setRaceAiCount(29);
const race=e.selectedRace;
race.scenery=(race.scenery||[]).filter(s=>!s.id?.startsWith('mountain-stress-'));
race.groundPlaneArtRef='providenceGround';race.roadTextures=structuredClone(p1.race.roadTextures);
race.weather='storm';race.weatherIntensity=1;race.weatherVisibilityM=0;
let seed=20261028;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let count=0,minClearance=Infinity;
e.withRaceGeometryReadCache(()=>{
 const length=e.getRaceRouteLength();
 for(let d=0;d<=length;d+=8){
  const pose=e.getRaceWorldPoseAtDistance(d),right=e.getRaceRightVector(pose.yaw);
  for(const side of [-1,1])for(let row=0;row<3;row++){
   const offset=side*(24+row*22+random()*12),along=(random()-.5)*6;
   const x=pose.x+right.x*offset+Math.sin(pose.yaw)*along,z=(pose.z??pose.y)+right.z*offset+Math.cos(pose.yaw)*along;
   const nearest=e.getRaceRouteProjectionForWorldPoint({x,z}),clearance=nearest.distanceToRoute-e.getRaceRoadHalfWidthWorld(nearest.segment);
   if(clearance<tree.widthM/2+7)continue;
   minClearance=Math.min(minClearance,clearance);
   race.scenery.push({id:`mountain-stress-tree-${count++}`,presetId:'doodad',doodadRef:'tree',previewDoodad:structuredClone(tree),artRef:tree.artRef,x,z,yaw:random()*Math.PI*2,widthM:tree.widthM,heightM:tree.heightM,state:'standing'});
  }
 }
});
// Include the actual runtime starting grid, not only the authored road.
// With 30 cars, the negative-distance grid extends past the old perimeter.
const grid=e.createRaceAiRuntime(race.competition.aiDrivers);
const perimeter=getStressPerimeter(race.road.nodes,grid);
for(let i=0;i<6;i++)race.scenery.push(...buildRaceFencePlacements(perimeter.slice(i,i+2),fence,{id:`mountain-stress-fence-${i}`,ref:'fenceguardrail'}));
race.loadTest={version:1,seed:20261028,treeCount:count,fenceCount:6,totalCars:30,weather:'storm',intensity:1};
const output={...doc,race,savedAt:Date.now()};
fs.mkdirSync('artifacts/mountain-stress',{recursive:true});
fs.writeFileSync('artifacts/mountain-stress/candidate.json',JSON.stringify(output));
const summary={trees:count,fences:6,panels:race.scenery.filter(s=>s.fenceId?.startsWith('mountain-stress-')).length,totalScenery:race.scenery.length,aiDrivers:race.competition.aiDrivers.length,minTreeRoadClearanceM:minClearance,ground:race.groundPlaneArtRef,road:race.roadTextures};
fs.writeFileSync('artifacts/mountain-stress/setup.json',JSON.stringify(summary,null,2));
if(process.argv.includes('--save')){
 const response=await fetch(base,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({folder:'races',name,data:output,createVersion:true})});
 const result=await response.json();if(!response.ok||result.ok===false)throw Error(JSON.stringify(result));
 console.log('Saved with previous version preserved');
}
console.log(JSON.stringify(summary));
