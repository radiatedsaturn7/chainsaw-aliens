import fs from 'node:fs';

// Preserve surveyed map positions. Generic artwork is explicitly a placeholder.
export function addBayardLandmarks(race,manifest,read,editor){
 if(race.id!=='detour-bayard')return;
 const plan=JSON.parse(fs.readFileSync('data/campaigns/america/bayard/landmarks.json'));
 editor.applyLoadedRaceDocument(race);
 const origin=race.source.origin,R=6371008.8,rad=Math.PI/180;
 const placed=[];
 for(const [i,mark] of plan.landmarks.entries()){
  const x=(mark.lon-origin.lon)*rad*R*Math.cos(origin.lat*rad),z=-(mark.lat-origin.lat)*rad*R;
  const p=editor.getRaceRouteProjectionForWorldPoint({x,z});
  const def=read(`data/server-storage/files/${manifest.folders.doodads[mark.placeholderRef]}`).doodad;
  if(Math.abs(p.lateral)<mark.widthM/2+8)throw Error(`Landmark encroaches on road: ${mark.name}`);
  placed.push({...mark,routeDistanceM:Math.round(p.distance),routeMiles:Number((p.distance/1609.344).toFixed(2)),offsetFromRoadM:Math.round(Math.abs(p.lateral)),side:p.lateral<0?'left':'right',worldX:x,worldZ:z});
  race.scenery=race.scenery.filter(s=>s.id!==`bayard-landmark-${i}`&&!(Number.isFinite(s.x)&&Number.isFinite(s.z)&&Math.hypot(s.x-x,s.z-z)<mark.widthM/2+8));
  race.scenery.push({id:`bayard-landmark-${i}`,presetId:'doodad',definitionId:def.id,doodadRef:mark.placeholderRef,artRef:def.artRef,label:mark.name,x,z,yaw:0,trackDistance:p.distance,trackLateral:p.lateral,widthM:mark.widthM,heightM:mark.heightM,groundOffsetM:0,behavior:'collide',weightKg:def.weightKg,state:'standing'});
 }
 race.source.landmarks=placed.sort((a,b)=>a.routeDistanceM-b.routeDistanceM);
 race.source.landmarkNotesPath='data/campaigns/america/bayard/landmark-placement.json';
 fs.writeFileSync(race.source.landmarkNotesPath,JSON.stringify({...plan,landmarks:race.source.landmarks,placementNote:'Mapped locations; dimensions and artwork provisional. Distances from timed start. No road geometry changes.'},null,2)+'\n');
}
