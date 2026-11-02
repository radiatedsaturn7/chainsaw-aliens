import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSceneryTriggerIndex,querySceneryTriggers} from '../../src/racing/SceneryTriggerIndex.js';
import {prepareRaceSceneryTriggers,updateRaceSceneryCollisions} from '../../src/racing/simulation/DamageModel.js';

test('spatial candidates preserve exhaustive collision results and authored order across boundaries and large props',()=>{
 const sprites=Array.from({length:2000},(_,i)=>({id:i,x:Math.sin(i*3.7)*500,z:Math.cos(i*1.3)*500,radius:i%39===0?250:1+i%6}));
 const index=buildSceneryTriggerIndex(sprites,s=>s.radius);
 const hits=(ss,ps)=>ss.filter(s=>ps.some(p=>Math.hypot(p.x-s.x,p.z-s.z)<=s.radius+.34)).map(s=>s.id);
 for(let i=0;i<250;i++){
  const points=[{x:Math.sin(i)*600,z:Math.cos(i)*600},{x:Math.sin(i)*600+2,z:Math.cos(i)*600-2}];
  assert.deepEqual(hits(querySceneryTriggers(index,points),points),hits(sprites,points));
 }
 assert.deepEqual(querySceneryTriggers(index,[]),[]);
});
function fixture(){
 const rule={behavior:'flatten',speedDrainPercent:8,damage:{panels:1,suspension:0,engine:0}};
 const sprites=Array.from({length:2090},(_,i)=>({id:`bush-${i}`,x:i*40,z:0,definition:{widthM:2,hitboxWidthM:2,heightM:2,defaultRule:rule,rules:[]}}));
 let reads=0;const impacts=[];
 const session={worldX:0,worldZ:0,speedMps:10,groundSpeedMps:10};
 const editor={playtestSession:session,ensureRaceScenery:()=>sprites,getRaceDoodadForScenery:s=>{reads++;return s.definition;},getRaceSessionCar:()=>({}),getRaceCarTuning:()=>({}),getRaceVehicleCollisionContactPoints:()=>[{x:session.worldX,z:session.worldZ,wheel:'fl'}],applyRaceDamage:(...args)=>impacts.push(args)};
 return {editor,session,sprites,impacts,reads:()=>reads,clear:()=>{reads=0;}};
}
test('warm collision updates avoid distant bushes, flatten once, and find new candidates after a teleport',()=>{
 const f=fixture();prepareRaceSceneryTriggers(f.editor);f.clear();
 updateRaceSceneryCollisions(f.editor,1/60);
 assert.deepEqual(f.session.flattenedSceneryIds,['bush-0']);assert.ok(f.reads()<3);
 assert.equal(f.session.sceneryTriggerWork.nearby,1);
 const count=f.impacts.length;updateRaceSceneryCollisions(f.editor,1/60);assert.equal(f.impacts.length,count);
 f.session.worldX=4000;updateRaceSceneryCollisions(f.editor,1/60);
 assert.deepEqual(f.session.flattenedSceneryIds,['bush-0','bush-100']);
 assert.ok(f.reads()<5);
});
test('source replacement, added placements, preview edits and fresh sessions rebuild the trigger index',()=>{
 const f=fixture();const first=prepareRaceSceneryTriggers(f.editor);
 assert.equal(prepareRaceSceneryTriggers(f.editor),first);
 f.sprites.push({...f.sprites[0],id:'extra',x:-40});assert.notEqual(prepareRaceSceneryTriggers(f.editor),first);
 f.editor.ensureRaceScenery=()=>[f.sprites[0]];const replaced=prepareRaceSceneryTriggers(f.editor);assert.equal(replaced.sprites.length,1);
 f.session.carEditorPreview=true;f.sprites[0].x=-100;const preview=prepareRaceSceneryTriggers(f.editor);
 assert.notEqual(preview,replaced);assert.equal(querySceneryTriggers(preview.index,[{x:-100,z:0}]).length,1);
 f.editor.playtestSession={};assert.notEqual(prepareRaceSceneryTriggers(f.editor),preview);
});
