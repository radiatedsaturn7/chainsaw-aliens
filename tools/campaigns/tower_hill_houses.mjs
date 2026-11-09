import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';

// Authored scenery inspired by the wooded historic district, not surveyed lots.
export function placeTowerHillHouses(race,definitions){
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true});editor.applyLoadedRaceDocument(race);
 const length=editor.getRacePathSamplesCached({step:5}).at(-1).distance;
 const fractions=[.025,.055,.085,.115,.145,.175,.205,.24,.275,.31,.35,.39,.425,.46,.49,.59,.72,.87];
 const houses=[];
 for(const [i,fraction] of fractions.entries()){
  const ref=`house${i%4+1}`,def=definitions[ref],side=i%2?1:-1;
  let chosen;
  for(const shift of [0,18,-18,36,-36]){
   const pose=editor.getRaceWorldPoseAtDistance(length*fraction+shift),offset=side*(22+(i*7%10));
   const x=pose.x+Math.cos(pose.yaw)*offset,z=pose.z-Math.sin(pose.yaw)*offset;
   const projection=editor.getRaceRouteProjectionForWorldPoint({x,z});
   if(Math.abs(projection.lateral)<9+def.widthM/2)continue;
   if(houses.some(h=>Math.hypot(h.x-x,h.z-z)<(h.widthM+def.widthM)/2+18))continue;
   chosen={id:`tower-house-${i}`,presetId:'doodad',definitionId:def.id,doodadRef:ref,artRef:def.artRef,label:def.name,x,z,yaw:pose.yaw+side*Math.PI/2,trackDistance:projection.distance,trackLateral:projection.lateral,widthM:def.widthM,heightM:def.heightM,groundOffsetM:def.groundOffsetM,behavior:'collide',weightKg:def.weightKg,state:'standing'};
   break;
  }
  if(!chosen)throw Error(`No safe placement for house ${i}`);
  houses.push(chosen);
 }
 // Small house clearings and a narrow sightline towards the road; leave the
 // surrounding wooded lots and every guardrail in place.
 race.scenery=(race.scenery||[]).filter(s=>!s.id?.startsWith('tower-house-')).filter(s=>{
  if(s.fenceId||!['tree','frozenbush','frozenrock'].includes(s.doodadRef))return true;
  return !houses.some(h=>{
   const radius=h.widthM*.55+Math.min(4,(Number(s.widthM)||0)*.25);
   const lot=Math.hypot(s.x-h.x,s.z-h.z)<radius;
   const sightline=Math.sign(s.trackLateral)===Math.sign(h.trackLateral)&&Math.abs(s.trackDistance-h.trackDistance)<6&&Math.abs(s.trackLateral)<Math.abs(h.trackLateral);
   return lot||sightline;
  });
 });
 race.scenery.push(...houses);
 race.source||={};race.source.houseAuthoring={description:'Scattered wooded homes, mostly in the first half; artistic placement, not exact real-world buildings.',count:houses.length,sources:['https://www.cumberlandri.gov/DocumentCenter/View/171/Cumberland-Historic-District-Property-Owner-Guide-PDF','https://preservation.ri.gov/pdfs_zips_downloads/national_pdfs/cumberland/cumb_tower-hill-road_ballou-weatherhead-house.pdf']};
 return houses;
}
export function loadTowerHillHouseDefinitions(){
 return Object.fromEntries([1,2,3,4].map(i=>{const ref=`house${i}`;return [ref,JSON.parse(fs.readFileSync(`data/server-storage/files/doodads/${ref}/document.json`)).doodad];}));
}
