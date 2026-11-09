import fs from 'node:fs';
import {placeTowerHillHouses,loadTowerHillHouseDefinitions} from './tower_hill_houses.mjs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceFencePlacements} from '../../src/racing/RaceFences.js';

export function configureTowerHillEvent(race){
 race.raceStart={...race.raceStart,cutsceneRef:'introtowerhill'};
 race.snowClouds={...race.snowClouds,enabled:true,artRef:'snowcloud'};
 // Road ribbon UVs follow bends; one image across the width keeps two tracks.
 if(race.surfaceArt)delete race.surfaceArt.asphalt;
 race.roadTextures={...race.roadTextures,builtInLines:false,road:{artRef:'snowroad',repeatM:7,repeatWidthM:0,filterMode:'inherit',mipmapDistance:10,mipmaps:true,anisotropy:16}};
 race.mechanicalMission={...race.mechanicalMission,startingFuel:{mode:'percent',value:15.3},fuelWarningAfterDistanceM:804.672};
 race.finishBehavior={...race.finishBehavior,type:'menu',menuScreen:'world-map',cutsceneRef:'lastongridintro',skipResults:true,fadeOutMs:800,timeLimitSeconds:210};
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(race);
 const samples=editor.getRacePathSamplesCached({step:5}),length=samples.at(-1).distance;
 const candidates=[];
 for(let distance=75;distance<length-75;distance+=10){
  const a=editor.getRaceWorldPoseAtDistance(distance-25),b=editor.getRaceWorldPoseAtDistance(distance+25);
  const turn=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw));
  if(Math.abs(turn)>.3)candidates.push({distance,turn});
 }
 candidates.sort((a,b)=>Math.abs(b.turn)-Math.abs(a.turn));
 const turns=[];
 for(const c of candidates){if(turns.every(t=>Math.abs(t.distance-c.distance)>170))turns.push(c);if(turns.length===6)break;}
 const definition=JSON.parse(fs.readFileSync('data/server-storage/files/doodads/fenceguardrail/document.json')).doodad;
 race.scenery=(race.scenery||[]).filter(s=>!s.fenceId?.startsWith('tower-guardrail-'));
 for(const [i,turn] of turns.entries()){
  const points=[],offset=-Math.sign(turn.turn)*6.5;
  for(let d=turn.distance-65;d<=turn.distance+65;d+=5){
   const p=editor.getRaceWorldPoseAtDistance(d),x=p.x+Math.cos(p.yaw)*offset,z=p.z-Math.sin(p.yaw)*offset;
   const projection=editor.getRaceRouteProjectionForWorldPoint({x,z});
   if(Math.abs(projection.lateral)<5.5)throw Error(`Guardrail ${i} intrudes into road`);
   points.push({x,z});
  }
  race.scenery.push(...buildRaceFencePlacements(points,definition,{id:`tower-guardrail-${i}`,ref:'fenceguardrail'}));
 }
 race.source.guardrailAuthoring={description:'Fictional safety rails on the outside of the six sharpest separated bends, with approach and exit coverage.',turns};
 placeTowerHillHouses(race,loadTowerHillHouseDefinitions());
 return race;
}
