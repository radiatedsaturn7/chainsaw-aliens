import {applyWildernessConditions} from './wilderness_dressing.mjs';
// Shared regional dressing for imported side events and raceway layouts.
import {applySideRaceLighting} from './side_race_lighting.mjs';
import {authorRaceContinuations} from './author_continuations.mjs';
import {analyzeRaceDrivingRoute,racePaceNotes} from '../../src/racing/RaceDrivingAssists.js';
export function dressImportedRace(race,row,parent,manifest,editor){
 for(const key of ['brightness','visualFx','skyboxArtRef','skyboxSettings','groundPlaneArtRef'])if(parent[key]!==undefined)race[key]=structuredClone(parent[key]);
 const lightingPreset=applySideRaceLighting(race,row.id);
 if(['H08-S08','H11-S07','H11-S08'].includes(row.id))race.campaign.scoring='drift';
 race.margin={marginMode:'hidden'};
 race.road.autoExtend=false;
 race.road.groundTiles=structuredClone(parent.road.groundTiles);
 race.road.tileMap.defaultTileId=parent.road.tileMap.defaultTileId;
 for(const cell of Object.values(race.road.tileMap.cells))cell.tileId=race.road.tileMap.defaultTileId;
 race.roadTextures={builtInLines:false,road:{artRef:'road-asphalt-patched',repeatM:24,filterMode:'balanced',mipmaps:true},
  surfaceRoads:Object.fromEntries([['asphalt','road-asphalt-patched'],['gravel','road-gravel-gray'],['dirt','road-dirt-packed'],['snow','snowroad']].filter(([,ref])=>manifest.folders.art[ref]).map(([surface,artRef])=>[surface,{artRef,repeatM:12,filterMode:'balanced',mipmaps:true}]))};
 if(['H01-S01','H06-S04','H06-S05'].includes(row.id)){
  const highway={artRef:'road-asphalt-worn',repeatM:12,laneWidthM:3.6576,filterMode:'balanced',mipmaps:true};
  race.roadTextures.road={...highway};race.roadTextures.surfaceRoads.asphalt={...highway};
 }
 // A regional art palette is shared, not the boss's scripts or geometry.
 race.weather=row.event_type.toLowerCase().includes('snow')?'snow':'clear';
 if(race.weather==='snow'){
  race.weatherIntensity=.25;race.weatherTemperatureC=-4;
  for(const segment of race.road.segments)segment.surface='snow';
 }
 if(row.id==='H05-S05'){
  for(const [i,segment] of race.road.segments.entries())if(i%5===3){segment.surface='gravel';segment.bumpiness=.09;}
  race.source.campaignConditions='Fictional 2994 damage exposes gravel in intermittent sections of the mapped paved NN access road; geometry is unchanged.';
 }
 applyWildernessConditions(race,row);
 race.source.elevationSmoothingRadiusM=45;
 Object.assign(race.source,{shoulderFlatJoinM:8,shoulderBlendWidthM:32,shoulderMaxSlope:.22});
 if(race.type==='destination')authorRaceContinuations(race);
 editor.applyLoadedRaceDocument(race);
 const length=editor.getRaceRouteLength();
 const props=[...new Map((parent.scenery||[]).filter(p=>p.doodadRef&&p.widthM<35).map(p=>[p.doodadRef,p])).values()];
 let seed=[...row.id].reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))>>>0,row.hubStage*713);const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 editor.withRaceGeometryReadCache(()=>{
 for(let d=40;props.length&&d<length-30;d+=row.city?35:45){
  const pose=editor.getRaceWorldPoseAtDistance(d);
  for(const side of [-1,1]){
   const source=props[Math.floor(random()*props.length)];
   const clearance=row.city?(/streetlight/.test(source.doodadRef)?2.5:5):8;
   const roadHalf=Math.max(race.road.width/2,(pose.segment?.roadWidthM||0)/2);
   const offset=side*(row.city?roadHalf+clearance+random()*12+source.widthM/2:22+random()*75+source.widthM/2);
   const x=pose.x+Math.cos(pose.yaw)*offset,z=pose.z-Math.sin(pose.yaw)*offset;
   const projection=editor.getRaceRouteProjectionForWorldPoint({x,z});
   if(Math.abs(projection.lateral)<Math.max(race.road.width/2,(projection.segment?.roadWidthM||0)/2)+clearance+source.widthM/2)continue;
   const prop={...structuredClone(source),id:`${race.id}-prop-${race.scenery.length}`,x,z,yaw:pose.yaw,trackDistance:projection.distance,trackLateral:projection.lateral,groundOffsetM:0};
   delete prop.y;delete prop.elevation;
   race.scenery.push(prop);
  }
 }
 const asphalt=race.road.segments.filter(s=>s.surface==='asphalt').length>race.road.segments.length/2;
 const decals=(parent.decals||[]).filter(d=>d.artRef&&(asphalt?/crack|patch|tire|oil/:/gravel|dirt|rut/).test(d.artRef));
 for(let d=90;decals.length&&d<length-30;d+=180){
  const pose=editor.getRaceWorldPoseAtDistance(d),decal=decals[Math.floor(random()*decals.length)];
  race.decals.push({...structuredClone(decal),id:`${race.id}-decal-${race.decals.length}`,x:pose.x,z:pose.z,rotation:pose.yaw});
 }
 });
 editor.applyLoadedRaceDocument(race);
 race.codriver={enabled:false,spoken:false,calls:racePaceNotes(race,analyzeRaceDrivingRoute(editor))};
 race.drivingGuide={line:true};
 return {lightingPreset};
}
