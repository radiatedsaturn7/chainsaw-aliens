import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {buildRaceCanonicalSurfaceMesh} from '../../src/racing/RaceCanonicalSurfaceMesh.js';
import {buildRoadTextureStrips,roadTextureSettings} from '../../src/racing/RaceRoadTextures.js';
import {addTightTurnBarriers,roadClearanceChecker} from '../../tools/campaigns/tight_turn_barriers.mjs';
function load(){
 const stored=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/races/Boston%252C MA %25E2%2580%2594 Landmark Run/document.json',import.meta.url)));
 return stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;
}
const signature=points=>points.map(p=>p.map(Math.fround).join(',')).sort().join('|');
test('Boston recorded right/hairpin texture triangles coincide with the physical road, without lifted edges',()=>{
 const e=new RaceEditor({});e.applyLoadedRaceDocument(load());
 const sections=e.withRaceGeometryReadCache(()=>e.getRaceSurfaceBake({step:2.5})).sections.filter(s=>s.center.distance>=5200&&s.center.distance<=5380);
 const surfaceBake={sections},mesh=buildRaceCanonicalSurfaceMesh({surfaceBake});
 const bake={surfaceBake,mesh,runtimeType:'destination'};
 const strips=buildRoadTextureStrips(bake,roadTextureSettings(e.selectedRace));
 const geometry=e.getRaceThreeMeshGeometry(strips.roadMeshes);
 const actual=[];const positions=geometry.attributes.position.array;
 for(let i=0;i<positions.length;i+=9)actual.push(signature([Array.from(positions.slice(i,i+3)),Array.from(positions.slice(i+3,i+6)),Array.from(positions.slice(i+6,i+9))]));
 const expected=mesh.triangles.filter(t=>t.region==='road').map(t=>signature(t.vertices.map(p=>[p.x,p.elevation*12,p.z])));
 assert.deepEqual(actual.sort(),expected.sort(),'artwork must use precisely the existing physical deck');
 assert.ok(strips.roadMeshes.every(m=>m.threeLiftM===0));
 geometry.dispose();
});

test('Boston shortcut barriers leave both road legs clear, remain solid and are repeatable',()=>{
 const document=load(),race=document.race;
 // Ignore prior generated barriers when testing a fresh authoring pass.
 race.scenery=race.scenery.filter(p=>!p.fenceId?.startsWith('tight-turn-v1-'));
 const e=new RaceEditor({});e.applyLoadedRaceDocument(document);
 const sections=e.withRaceGeometryReadCache(()=>e.getRaceSurfaceBake({step:2.5})).sections;
 const before=JSON.stringify(race.road),oldIds=race.scenery.map(p=>p.id);
 const def={name:'Guardrail',widthM:4,heightM:1,isFence:true,artRef:'guardrail'};
 const options={roadside:{project:p=>e.getRaceRouteProjectionForWorldPoint(p),pose:d=>e.getRaceWorldPoseAtDistance(d),roadWidthM:race.road.width}};
 const report=e.withRaceGeometryReadCache(()=>addTightTurnBarriers(race,sections,def,options));
 assert.ok(report.some(r=>Math.abs(r.distanceM-5293)<5&&r.lengthM>15));
 assert.equal(JSON.stringify(race.road),before);
 assert.deepEqual(race.scenery.slice(0,oldIds.length).map(p=>p.id),oldIds);
 const safe=roadClearanceChecker(sections,1);
 for(const panel of race.scenery.slice(oldIds.length)){
  assert.equal(panel.solid,true);assert.equal(panel.previewDoodad.defaultRule.behavior,'collide');
  for(let t=-.5;t<=.5;t+=.1)assert.ok(safe({x:panel.x-Math.cos(panel.yaw)*panel.widthM*t,z:panel.z+Math.sin(panel.yaw)*panel.widthM*t}),'entire panel clears every road leg');
 }
 const first=JSON.stringify(race.scenery);
 e.withRaceGeometryReadCache(()=>addTightTurnBarriers(race,sections,def,options));assert.equal(JSON.stringify(race.scenery),first);
});

test('ordinary bends and grade-separated roads do not acquire hairpin fences',()=>{
 for(const structure of ['road','bridge','tunnel']){
  const sections=Array.from({length:40},(_,i)=>{
   const yaw=structure==='road'?i*.01:i<20?0:Math.PI;
   const center={x:i,z:i*3,yaw,distance:i*3,segment:{structure}};
   return {center,left:{x:i+3,z:i*3},right:{x:i-3,z:i*3}};
  });
  const race={scenery:[]};assert.deepEqual(addTightTurnBarriers(race,sections,{isFence:true,widthM:4,heightM:1,artRef:'rail'}),[]);
 }
});
