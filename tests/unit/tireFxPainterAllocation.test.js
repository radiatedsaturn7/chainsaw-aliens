import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {drawRaceTireFxParticles as legacy} from '../fixtures/tireFxPainterLegacy.js';
import {acquireRaceTireFxProjection,projectRaceTireFxParticles,releaseRaceTireFxProjection} from '../../src/racing/RaceTireFxParticles.js';
function fixture(){
 const editor=Object.create(RaceEditor.prototype);
 editor.playtestSession={tireFxParticles:Array.from({length:140},(_,i)=>({id:i,slotId:i%3?'skidSmoke':'asphaltSkid',x:i,z:i%7,ageMs:i*5,lifetimeMs:700,sizeM:.4,alpha:.6,artRef:i%2?'smoke':'',color:'#abc'}))};
 editor.projectRaceWorldVisualPoint=p=>({screenX:p.x,screenY:p.id%10===0?1000:50,visible:p.id%9!==0,cameraZ:p.z,renderZ:p.z});
 const art={width:16,height:16};editor.getRaceArtSpriteCanvas=()=>art;editor.getRaceTintedTireFxArtCanvas=a=>a;
 return editor;
}
function context(ellipse){
 const calls=[],target={imageSmoothingEnabled:true};if(!ellipse)target.ellipse=undefined;
 const ctx=new Proxy(target,{get(t,k){if(k in t)return t[k];return (...args)=>calls.push([k,...args]);},set(t,k,v){t[k]=v;calls.push(['set',k,v]);return true;}});
 return {ctx,calls};
}
test('pooled tire projection preserves layer selection, depth ties, clipping, artwork and fallback canvas commands',()=>{
 const editor=fixture(),bounds={x:0,y:0,w:390,h:240};
 for(const layer of ['all','ground','air'])for(const ellipse of [true,false])for(const camera of [{},{firstPersonFrame:{},roadWidthScale:2}]){
  const a=context(ellipse),b=context(ellipse),options={camera,cameraYaw:.3,layer};
  assert.equal(RaceEditor.prototype.drawRaceTireFxParticles.call(editor,a.ctx,bounds,options),legacy.call(editor,b.ctx,bounds,options));
  assert.deepEqual(a.calls,b.calls);
 }
});
test('projection records reuse storage, isolate concurrent leases, and release references after painting',()=>{
 const editor=fixture(),session=editor.playtestSession,bounds={x:0,y:0,w:390,h:240};
 const first=acquireRaceTireFxProjection(session);
 const sorted=projectRaceTireFxParticles(first,editor,session.tireFxParticles,bounds,{},0,'all');
 const record=first.records[0],length=sorted.length;
 const nested=acquireRaceTireFxProjection(session);assert.notEqual(nested,first);
 projectRaceTireFxParticles(nested,editor,[],bounds,{},0,'all');assert.equal(sorted.length,length);
 releaseRaceTireFxProjection(nested);releaseRaceTireFxProjection(first);
 assert.equal(record.point,null);assert.equal(record.particle,null);assert.equal(first.options.camera,null);
 const next=acquireRaceTireFxProjection(session);assert.equal(next,first);
 projectRaceTireFxParticles(next,editor,session.tireFxParticles,bounds,{},0,'all');assert.equal(next.records[0],record);
 releaseRaceTireFxProjection(next);
});
test('projection errors release scratch so later draws recover',()=>{
 const editor=fixture(),project=editor.projectRaceWorldVisualPoint,bounds={x:0,y:0,w:390,h:240};
 editor.projectRaceWorldVisualPoint=()=>{throw Error('projection failed');};
 assert.throws(()=>editor.drawRaceTireFxParticles(context(true).ctx,bounds),/projection failed/);
 const lease=acquireRaceTireFxProjection(editor.playtestSession);releaseRaceTireFxProjection(lease);
 editor.projectRaceWorldVisualPoint=project;
 assert.equal(editor.drawRaceTireFxParticles(context(true).ctx,bounds),true);
 assert.equal(acquireRaceTireFxProjection(editor.playtestSession),lease);
 releaseRaceTireFxProjection(lease);
});
