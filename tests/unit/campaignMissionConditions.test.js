import {reverseRaceRoute} from '../../src/racing/reverseRaceRoute.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {MIDDLE_MISSION_CONDITIONS,applyMissionConditions} from '../../tools/campaigns/mission_conditions.mjs';
import {createRaceTrackState} from '../../src/racing/trackState/TrackStateIntegration.js';
import {resolveCompoundSurfaceGrip} from '../../src/racing/simulation/SurfaceConditionGrip.js';
import {roughRoadSuspensionDamage} from '../../src/racing/simulation/SurfaceWearModel.js';
import parts from '../../src/content/garage-parts.json' with {type:'json'};
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const catalog=read('data/campaigns/america/catalog.json');
const race=s=>read('data/server-storage/files/'+s.documentPath).race;
const tire=n=>read(`data/server-storage/files/tires/${n}/document.json`).compound;

test('mission conditions survive installation, preserve geometry and only recommend available equipment',()=>{
 for(const s of catalog){
  const r=race(s),before=structuredClone(r);
  if(s.stage===1){assert.equal(applyMissionConditions(r),false);assert.deepEqual(r,before);continue;}
  assert.ok(applyMissionConditions(r));assert.deepEqual(r,before,'reapplying conditions is idempotent');
  assert.equal(r.weather,MIDDLE_MISSION_CONDITIONS[r.id].weather);
  assert.deepEqual(r.road.nodes,before.road.nodes);
  assert.deepEqual(r.road.continuations,before.road.continuations);
  for(const id of r.campaignChallenge.recommendedParts){
   const p=parts.items.find(p=>p.id===id)?.carPart;
   assert.ok(p?.forSale);assert.ok(!p.unlockKey&&!p.requires?.length);
  }
  assert.ok(!r.campaignChallenge.requiredParts);
  assert.ok(r.codriver.calls.length>0);
 }
});

test('authoring changes conditions, never surveyed road geometry or race behavior',()=>{
 const r=race(catalog[2]);
 for(const segment of r.road.segments){segment.surface='snow';segment.bumpiness=0;}
 const before=structuredClone(r);
 applyMissionConditions(r);
 assert.deepEqual(r.road.nodes,before.road.nodes);
 assert.deepEqual(r.source.routeReference,before.source.routeReference);
 assert.deepEqual(r.finishBehavior,before.finishBehavior);
 assert.deepEqual(r.competition,before.competition);
 for(const [i,s] of r.road.segments.entries()){
  const {surface,bumpiness,...geometry}=s;
  const {surface:oldSurface,bumpiness:oldRoughness,...oldGeometry}=before.road.segments[i];
  assert.deepEqual(geometry,oldGeometry);
 }
});

test('existing saved compounds give substantial grip advantages on mission surfaces',()=>{
 const checks=[['snow','Snow',2.5],['gravel','Rally',1.5],['wet-asphalt','Rain',1.15],['asphalt','Tarmac',1.2]];
 for(const [surface,name,minRatio] of checks){
  const state=createRaceTrackState({surfaceModel:{sampleWorld:()=>({region:'road',segment:{surface,bumpiness:.05}})}});
  const material=state.getOrCreateCell({x:0,z:0});
  const stock=resolveCompoundSurfaceGrip(tire('Stock'),material);
  const upgraded=resolveCompoundSurfaceGrip(tire(name),material);
  assert.ok(upgraded>stock*minRatio,`${name}: ${upgraded/stock}`);
 }
});

test('authored road roughness reaches track-state materials, with terrain and missing-data fallbacks',()=>{
 const sample=(surfaceSample)=>createRaceTrackState({surfaceModel:{sampleWorld:()=>surfaceSample}}).getOrCreateCell({x:0,z:0});
 assert.equal(sample({region:'road',segment:{surface:'asphalt',bumpiness:.36}}).roughness,.36);
 assert.equal(sample({region:'road',segment:{surface:'asphalt',bumpiness:0}}).roughness,0);
 assert.equal(sample({region:'road',segment:{surface:'asphalt'}}).roughness,.08);
 assert.equal(sample({region:'terrain',materialId:'gravel',segment:{bumpiness:.01}}).roughness,.46);
 assert.equal(sample({region:'road',roughness:.22,segment:{surface:'asphalt',bumpiness:.36}}).roughness,.22);
});

test('rough-road stages contain sustained damage-threshold challenges with a slower stock escape',()=>{
 for(const key of ['laurel','moki']){
  const r=race(catalog.find(s=>s.sourceKey===key));
  const length=r.road.segments.reduce((n,s)=>n+s.length,0);
  const rough=r.road.segments.filter(s=>s.bumpiness>.25).reduce((n,s)=>n+s.length,0);
  assert.ok(rough>length*.35,`${key}: substantial rough sections`);
  const peak=Math.max(...r.road.segments.map(s=>s.bumpiness));
  const base={roughness:peak,speed:35,staticLoadN:3500,suspension:{suspensionTravelM:.15,bumpTravelM:.075,springRateNpm:30000,damperRateNsM:2500},dt:1};
  assert.ok(roughRoadSuspensionDamage(base)>0);
  assert.equal(roughRoadSuspensionDamage({...base,speed:8}),0,'stock car can slow down');
  assert.equal(roughRoadSuspensionDamage({...base,strength:1.8,suspension:{...base.suspension,suspensionTravelM:.3,bumpTravelM:.2}}),0,'long-travel reinforced assembly has reserve');
 }
});


test('campaign specialties balance dirt, urban pavement, summit snow and mixed canyon conditions',()=>{
 const get=key=>race(catalog.find(s=>s.sourceKey===key));
 const share=(r,surface)=>r.road.segments.filter(s=>s.surface===surface).reduce((n,s)=>n+s.length,0)/r.road.segments.reduce((n,s)=>n+s.length,0);
 const ozark=get('ozark'),city=get('city'),pikes=get('pikes'),oak=get('oak');
 assert.ok(share(ozark,'dirt')>.70&&share(ozark,'gravel')>.20);
 assert.ok(share(city,'asphalt')>.88&&share(city,'gravel')>.05);
 assert.ok(share(pikes,'asphalt')>.94&&share(pikes,'snow')>.02&&share(pikes,'snow')<.06);
 assert.equal(pikes.weather,'clear');
 assert.ok(pikes.road.nodes.at(-1).elevation>pikes.road.nodes[0].elevation);
 assert.equal(pikes.road.segments.at(-1).surface,'snow');
 assert.ok(share(oak,'asphalt')>.60&&share(oak,'wet-asphalt')>.30);
 assert.equal(oak.weather,'clear','rain must not turn every dry section wet');
 for(const r of [city,oak])assert.deepEqual(r.campaignChallenge.recommendedParts,['street-tires']);
});


test('Pikes authoring reverses a downhill import once and remaps route-relative scenery and GPS endpoints',()=>{
 const r=race(catalog.find(s=>s.sourceKey==='pikes'));
 reverseRaceRoute(r);
 const before=structuredClone(r),length=r.road.segments.reduce((sum,s)=>sum+s.length,0);
 applyMissionConditions(r);
 assert.deepEqual(r.road.nodes.map(n=>[n.x,n.y,n.elevation]),before.road.nodes.map(n=>[n.x,n.y,n.elevation]).reverse());
 assert.deepEqual(r.campaign.startGps,before.campaign.finishGps);
 assert.deepEqual(r.campaign.finishGps,before.campaign.startGps);
 r.scenery.forEach((prop,i)=>{
  const old=before.scenery[i];
  assert.equal(prop.x,old.x);assert.equal(prop.z,old.z);
  assert.equal(prop.trackDistance,length-old.trackDistance);
  assert.equal(prop.trackLateral,-old.trackLateral);
 });
 assert.deepEqual(r.finishBehavior,before.finishBehavior);
 const applied=structuredClone(r);applyMissionConditions(r);assert.deepEqual(r,applied);
});
