import {applyCampaignArtCoverage} from './campaign_art_coverage.mjs';
// Final campaign dressing uses saved editor data, native fences and ground decals.
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceFencePlacements} from '../../src/racing/RaceFences.js';
import {analyzeRaceDrivingRoute,racePaceNotes} from '../../src/racing/RaceDrivingAssists.js';
const root='data/server-storage/files/';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const save=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const manifest=read(root+'manifest.json'),catalog=read('data/campaigns/america/catalog.json');
const texture=artRef=>({artRef,repeatM:12,repeatWidthM:0,filterMode:'balanced',mipmaps:true});
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const kits={
 tower:['tower-hill-small-shed'],mount:['mount-washington-summit-building-silhouette','snow-covered-pine-01','snow-covered-pine-02','snow-covered-pine-03','roadside-snow-depth-marker-pole','roadside-snowbank-mound'],
 ohio:['ohio-river-crossing-distant-bridge-silhouette','roadside-drainage-culvert-entrance'],
 ozark:['roadside-wooden-fence-intact','gray-boulder-02','gray-boulder-03','dead-broken-tree-01','dead-broken-tree-02','fallen-log-01'],
 city:['roadside-road-closed-barricade','roadside-traffic-cone'],route66:['roadside-reflector-post'],
 pikes:['pikes-peak-summit-sign'],moki:['moki-dugway-mesa-silhouette','moki-dugway-warning-sign','dry-scrub-bush-03'],
 oak:['oak-creek-creekside-tree','oak-creek-red-rock-formation','red-sandstone-boulder-03'],
 angeles:['angeles-crest-mountain-silhouette','angeles-crest-turnout-sign','mostly-bare-pine-02']
};
const decals={laurel:[['cracks-repair-patches','asphalt'],['fallen-leaves-needles','asphalt']],ohio:[['puddle','wet-asphalt']],ozark:[['dirt-drag','dirt']],city:[['gravel-spill','gravel'],['road-edge-debris','gravel']],pikes:[['snow-patch','snow']],angeles:[['tire-skid-marks','asphalt']]};
const expanded=read('data/campaigns/america/expanded-art.json').assets;
const report=[];
for(const [ordinal,entry] of catalog.entries()){
 const key=entry.sourceKey||(ordinal===0?'tower':'mount'),path=root+entry.documentPath,doc=read(path),r=doc.race;
 // Use narrow native shoulders where the road has room; retain mountain
 // cliff corridors and Tower Hill's existing configuration elsewhere.
 if(['mount','ohio','ozark'].includes(key))r.margin={...r.margin,shoulderMode:'on',shoulderWidthM:2};
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});editor.applyLoadedRaceDocument(r);
 const length=editor.getRaceRouteLength();
 const pose=d=>editor.getRaceWorldPoseAtDistance(Math.max(0,Math.min(length,d)));
 const turn=d=>angle(pose(d+45).yaw-pose(d-45).yaw);
 const samples=Array.from({length:200},(_,i)=>({d:length*(i+1)/202})).map(p=>({...p,curve:turn(p.d)}));
 const sharp=[...samples].sort((a,b)=>Math.abs(b.curve)-Math.abs(a.curve))[0];
 function at(d,lateral){const p=pose(d);return {x:p.x+Math.cos(p.yaw)*lateral,z:p.z-Math.sin(p.yaw)*lateral,yaw:p.yaw};}
 function place(name,d,lateral=25,{fixed=false,background=false,suffix='',optional=false,flat=false}={}){
  const id=`campaign-complete-${key}-${name}${suffix}`;
  const existing=r.scenery.find(p=>p.id===id);
  if(existing){
   if(name.startsWith('expanded-')){
    const saved=read(root+manifest.folders.doodads[name]).doodad;
    Object.assign(existing,{weightKg:saved.weightKg,behavior:saved.defaultRule.behavior});
    Object.assign(existing.previewDoodad,{weightKg:saved.weightKg,defaultRule:structuredClone(saved.defaultRule)});
   }
   return;
  }
  const def=structuredClone(read(root+manifest.folders.doodads[name]).doodad);
  // Props use appropriate interaction rules instead of inheriting tree damage.
  if(!name.startsWith('expanded-')&&/cone|marker|reflector|sign|chevron/.test(name)){def.weightKg=15;def.hitboxWidthM=.3;def.defaultRule={behavior:'fly-off',speedDrainPercent:1,damage:{panels:.2,suspension:0,engine:0}};}
  if(/shed|building/.test(name)){def.weightKg=100000;def.defaultRule={behavior:'collide',speedDrainPercent:90,damage:{panels:20,suspension:8,engine:4}};}
  if(/bush/.test(name)){def.weightKg=5;def.defaultRule={behavior:'flatten',speedDrainPercent:1,damage:{panels:0,suspension:0,engine:0}};}
  if(/pine|tree|boulder|bush|fallen-log/.test(name)){
   const family=/boulder/.test(name)?'frozenrock':/bush/.test(name)?'frozenbush':'tree';
   const candidates=r.scenery.filter(q=>q.doodadRef===family&&Number(q.widthM)>=def.widthM).sort((a,b)=>Math.abs((a.trackDistance||0)-d)-Math.abs((b.trackDistance||0)-d));
   for(const q of candidates){
    const projection=editor.getRaceRouteProjectionForWorldPoint(q);if(Math.abs(projection.lateral)<10+def.widthM/2)continue;
    Object.assign(q,{id,doodadRef:name,definitionId:def.id,artRef:def.artRef,label:name,widthM:def.widthM,heightM:def.heightM,groundOffsetM:0,weightKg:def.weightKg,behavior:def.defaultRule.behavior,previewDoodad:def,trackDistance:projection.distance,trackLateral:projection.lateral});return;
   }
  }
  const attempts=fixed?[0]:[0,12,-12,24,-24,40,-40,65,-65,90,-90,140,-140];
  for(const shift of attempts)for(const offset of [0,8,16,24,40,60,90,120]){
   const distance=Math.max(10,Math.min(length-10,d+shift)),side=lateral+Math.sign(lateral||1)*offset,p=at(distance,side),projection=editor.getRaceRouteProjectionForWorldPoint(p);
   if(Math.abs(projection.lateral)<10+def.widthM/2)continue;
   if(r.scenery.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<(Number(q.widthM)||1)/2+def.widthM/2+2))continue;
   if(flat){
    const surface=editor.getRaceSurfaceModel(),half=def.widthM/2;
    const heights=[at(distance-half,side-half),at(distance+half,side-half),at(distance-half,side+half),at(distance+half,side+half)].map(q=>surface.sampleWorld(q,0).elevation*12);
    if(Math.max(...heights)-Math.min(...heights)>2)continue;
   }
   r.scenery.push({id,presetId:'doodad',doodadRef:name,definitionId:def.id,artRef:def.artRef,label:name,...p,
    widthM:def.widthM,heightM:def.heightM,groundOffsetM:def.groundOffsetM,weightKg:def.weightKg,behavior:def.defaultRule.behavior,
    previewDoodad:def,trackDistance:projection.distance,trackLateral:projection.lateral,state:'standing',campaignPlacement:{background,targetDistance:d}});return;
  }
  if(!optional)throw Error(`No clear placement for ${key}: ${name}`);
 }
 if(key==='angeles'){
  const id='campaign-complete-angeles-angeles-crest-turnout-sign';
  const existing=r.scenery.find(p=>p.id===id);
  if(!existing?.campaignPlacement?.turnout){
   const surface=editor.getRaceSurfaceModel();let best=null;
   for(const sample of samples){
    if(Math.abs(sample.curve)>.15)continue;
    for(const side of [-16,16,-22,22]){
     const p=at(sample.d,side),corners=[[-3,-6],[3,-6],[-3,6],[3,6]].map(([across,along])=>at(sample.d+along,side+across));
     const heights=corners.map(q=>surface.sampleWorld(q,0).elevation*12),spread=Math.max(...heights)-Math.min(...heights);
     const access=Math.abs(surface.sampleWorld(at(sample.d,Math.sign(side)*7),0).elevation*12-surface.sampleWorld(p,0).elevation*12);
     if(spread>1.2||access>1.2||r.scenery.some(q=>q.id!==id&&Math.hypot(q.x-p.x,q.z-p.z)<8+(Number(q.widthM)||1)/2))continue;
     if(!best||spread<best.spread)best={d:sample.d,side,spread,p};
    }
   }
   if(!best)throw Error('No usable flat turnout found');
   r.scenery=r.scenery.filter(p=>p.id!==id);
   place('angeles-crest-turnout-sign',best.d-12,best.side,{fixed:true});
   r.scenery.find(p=>p.id===id).campaignPlacement.turnout={...best,widthM:6,lengthM:12};
   const size=r.road.tileMap.cellSizeM,k=`${Math.floor(best.p.x/size)},${Math.floor(best.p.z/size)}`;
   if(r.road.tileMap.cells[k])Object.assign(r.road.tileMap.cells[k],{tileId:'gravel',tileWeights:{gravel:1},artRef:'ground-gray-gravel-v2'});
  }
 }
 for(const [i,name] of (kits[key]||[]).entries()){
  const summit=/summit/.test(name),background=/silhouette/.test(name)&&!name.includes('building');
  const d=summit?length*.97:name.includes('warning')?Math.max(20,sharp.d-75):length*(key==='tower'?.22:.12+i*.095);
  place(name,d,background?150:(summit?45:25),{background});
 }
 // Reviewed additions use the same corridor/overlap search as existing landmarks.
 for(const asset of expanded)for(const [i,plan] of asset.placements.entries()){
  if(plan.race!==key)continue;
  if(asset.kind==='skybox'){
   r.skyboxArtRef=asset.name;
   r.skyboxSettings={...r.skyboxSettings,artRef:asset.name};
   continue;
  }
  const d=length*plan.fraction;
  if(asset.kind==='fence'){
   const id=`campaign-expanded-fence-${asset.name}-${i}`;
   if(r.scenery.some(p=>p.fenceId===id))continue;
   const def=structuredClone(read(root+manifest.folders.doodads[asset.name]).doodad);
   const points=Array.from({length:9},(_,j)=>at(d+j*2,plan.lateralM));
   const panels=buildRaceFencePlacements(points,def,{id,ref:asset.name});
   if(panels.some(p=>Math.abs(editor.getRaceRouteProjectionForWorldPoint(p).lateral)<10+p.widthM/2))throw Error(`Expanded fence infringes road: ${asset.name}`);
   for(const p of panels){const q=editor.getRaceRouteProjectionForWorldPoint(p);p.trackDistance=q.distance;p.trackLateral=q.lateral;}
   r.scenery.push(...panels);
  }else{
   place(asset.name,d,plan.lateralM,{background:asset.kind==='background',flat:asset.kind==='sprite',suffix:`-expanded-${i}`});
  }
 }
 // Signs use measured turn direction, rather than arbitrary map positions.
 if(key==='moki'){
  for(const [name,sign] of [['roadside-chevron-left',-1],['roadside-chevron-right',1]]){
   const event=[...samples].sort((a,b)=>sign*(b.curve-a.curve))[0];
   if(event.curve*sign<.2)throw Error('Expected signed Moki bend');
   place(name,event.d-35,-sign*20,{fixed:true});
  }
  place('roadside-hairpin-warning-sign',Math.max(15,sharp.d-75),22,{fixed:true});
  place('roadside-rockfall-warning-sign',Math.max(15,sharp.d-110),-25,{fixed:true});
 }
 if(key==='pikes'){
  const steep=[...samples].sort((a,b)=>Math.abs(pose(b.d+40).elevation-pose(b.d-40).elevation)-Math.abs(pose(a.d+40).elevation-pose(a.d-40).elevation))[0];
  place('roadside-steep-grade-warning-sign',steep.d-80,23,{fixed:true});
 }
 // Native fences create oriented panels and collision, not circular tree hitboxes.
 const fenceNames=key==='moki'?['metal-guardrail-intact','metal-guardrail-damaged']:key==='city'?['concrete-barrier-clean','concrete-barrier-damaged']:[];
 for(const [j,n] of fenceNames.entries()){
  const id=`campaign-complete-fence-${key}-${n}`;if(r.scenery.some(p=>p.fenceId===id))continue;
  const name='roadside-'+n,def=structuredClone(read(root+manifest.folders.doodads[name]).doodad);
  Object.assign(def,{isFence:true,fenceThicknessM:n.startsWith('metal')?.25:.6,weightKg:100000,rules:[],defaultRule:{behavior:'collide',speedDrainPercent:70,damage:{panels:12,suspension:4,engine:1}}});
  const start=key==='moki'?sharp.d-10+j*30:length*(.35+j*.18),side=key==='moki'?-Math.sign(sharp.curve)*10:12;
  const points=Array.from({length:9},(_,i)=>at(start+i*2,side));
  const panels=buildRaceFencePlacements(points,def,{id,ref:name});
  for(const p of panels){const q=editor.getRaceRouteProjectionForWorldPoint(p);if(Math.abs(q.lateral)<7)throw Error('Fence infringes road');p.trackDistance=q.distance;p.trackLateral=q.lateral;}
  r.scenery.push(...panels);
 }
 // The original Tower Hill snowroad stays intact. Other ribbons select artwork
 // from the physical segment, with rough variants only on rough segments.
 if(!['tower','laurel','mount','route66','angeles','ohio'].includes(key)){
  const asphalt=key==='city'?'road-asphalt-industrial':'road-asphalt-worn';
  const roads={asphalt:texture(asphalt),'wet-asphalt':texture('road-asphalt-wet'),dirt:{...texture('road-dirt-packed'),roughArtRef:'road-dirt-loose'},gravel:{...texture(key==='moki'?'road-gravel-red':'road-gravel-gray'),roughArtRef:'road-gravel-rutted'},snow:texture('road-snow-patchy'),slush:texture('road-slush')};
  r.roadTextures={...r.roadTextures,builtInLines:false,road:roads[r.road.segments[0].surface],surfaceRoads:Object.fromEntries([...new Set(r.road.segments.map(s=>s.surface))].map(s=>[s,roads[s]]))};
 }
 if(key!=='tower'){
  r.roadTextures.shoulder=texture(key==='mount'?'shoulder-snowbank-edge':'shoulder-asphalt-gravel');
  r.roadTextures.surfaceShoulders={dirt:texture('shoulder-dirt-grass'),gravel:texture('shoulder-dirt-grass'),snow:texture('shoulder-snowbank-edge')};
 }
 // Small environment-specific landmark groups separated by open stretches.
 const landmarks={
  laurel:['laurel-park-sign','laurel-forest-cabin'],
  ohio:['ohio-river-crossing-riverside-building','ohio-river-crossing-flood-marker'],
  ozark:['ozarks-barn','ozarks-timber-shed','ozarks-farm-gate'],
  city:['data-center-city-transformer','data-center-city-shipping-container','roadside-abandoned-car-01','roadside-streetlight'],
  route66:['route-66-abandoned-gas-station','route-66-diner','route-66-billboard','route-66-rusted-pickup'],
  oak:['oak-creek-canyon-cabin']
 };
 for(let zone=0;zone<5;zone++)for(const [i,name] of (landmarks[key]||[]).entries()){
  place(name,length*(.08+zone*.18)+i*35,(zone%2?-1:1)*(18+i*4),{suffix:`-landmark-${zone}`,optional:true});
 }
 // Road wear is encountered repeatedly along matching surfaces, not once per race.
 const details={asphalt:['decal-cracks-repair-patches','decal-tire-skid-marks'],'wet-asphalt':['decal-puddle'],dirt:['decal-dirt-drag'],gravel:['decal-gravel-spill'],snow:['decal-snow-patch']};
 {
  let start=0,index=0,next=100;r.decals??=[];
  for(const segment of r.road.segments){
   const end=start+segment.length;
   while(next<end){
    const choices=details[segment.surface];
    if(choices){const id=`campaign-detail-${index}`,p=pose(next);
     if(!r.decals.some(d=>d.id===id))r.decals.push({id,kind:'decal',artRef:choices[index%choices.length],x:p.x,z:p.z,widthM:2.5,heightM:5,rotation:p.yaw,shape:'rectangle'});
    }
    next+=350;index++;
   }
   start=end;
  }
 }
 const replaced=applyCampaignArtCoverage(r,key,name=>read(root+manifest.folders.doodads[name]).doodad);
 if(key==='angeles'){
  const turnout=r.scenery.find(p=>p.id==='campaign-complete-angeles-angeles-crest-turnout-sign')?.campaignPlacement?.turnout;
  if(turnout){
   r.decals??=[];const id='campaign-complete-turnout-ground';
   if(!r.decals.some(d=>d.id===id))r.decals.push({id,kind:'decal',artRef:'ground-gray-gravel-v2',x:turnout.p.x,z:turnout.p.z,widthM:6,heightM:12,rotation:turnout.p.yaw,shape:'rectangle'});
  }
 }
 if(key==='ohio'){
  // A small roadside melt patch uses the game's actual slush material.
  const p=at(length*.3,25),size=r.road.tileMap.cellSizeM,k=`${Math.floor(p.x/size)},${Math.floor(p.z/size)}`;
  if(r.road.tileMap.cells[k]){
   Object.assign(r.road.tileMap.cells[k],{tileId:'slush',tileWeights:{slush:1},artRef:'ground-dirty-snow-v2'});
   r.decals??=[];
   const id='campaign-complete-slush-tracks';
   if(!r.decals.some(d=>d.id===id))r.decals.push({id,kind:'decal',artRef:'road-slush',x:p.x,z:p.z,widthM:3,heightM:8,rotation:p.yaw,shape:'rectangle'});
  }
 }
 r.decals??=[];
 for(const [name,surface] of decals[key]||[]){
  const id=`campaign-complete-decal-${name}`;if(r.decals.some(d=>d.id===id))continue;
  let distance=0,chosen=null;
  for(const s of r.road.segments){if(s.surface===surface&&distance>length*.15){chosen=distance+s.length/2;break;}distance+=s.length;}
  if(chosen===null)throw Error(`No ${surface} for ${name}`);
  const p=pose(chosen);r.decals.push({id,kind:'decal',artRef:'decal-'+name,x:p.x,z:p.z,widthM:3,heightM:6,rotation:p.yaw,shape:'rectangle'});
 }
 editor.applyLoadedRaceDocument(r);if(r.codriver)r.codriver.calls=racePaceNotes(r,analyzeRaceDrivingRoute(editor));
 doc.savedAt=Date.now();save(path,{__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(doc)),{level:9}).toString('base64')});
 save(path.replace('document.json','metadata.json'),{...read(path.replace('document.json','metadata.json')),savedAt:doc.savedAt});
 report.push({race:entry.name,replacedGenericProps:replaced,regionalSceneryCount:r.scenery.filter(p=>p.campaignAppearance).length,untexturedCells:Object.values(r.road.tileMap.cells).filter(c=>!c.artRef).length,sceneryPlacements:r.scenery.filter(p=>p.id.startsWith('campaign-complete')).length,decals:r.decals.filter(d=>d.id.startsWith('campaign-complete')).length});
 console.log(report.at(-1));
}
save('data/campaigns/america/art-placement-report.json',report);
