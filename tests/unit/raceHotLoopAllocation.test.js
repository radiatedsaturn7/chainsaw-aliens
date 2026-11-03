import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireRaceTireFxParticle,advanceRaceTireFxParticles,trimRaceTireFxParticles} from '../../src/racing/RaceTireFxParticles.js';
import {updateWeatherParticleMotion,updateWeatherSystem,createWeatherRuntimeState,WEATHER_PROFILES} from '../../src/shared/weatherEffects.js';
const oldTireStep=(particles,seconds)=>particles.map(p=>({...p,
 ageMs:Number(p.ageMs||0)+seconds*1000,x:Number(p.x||0)+Number(p.vx||0)*seconds,
 z:Number(p.z||0)+Number(p.vz||0)*seconds,elevation:Number(p.elevation||0)+Number(p.vy||0)*seconds
})).filter(p=>Number(p.ageMs||0)<Number(p.lifetimeMs||1));
test('tire FX matches legacy motion, expiry and order while retaining active object/array identities',()=>{
 const session={tireFxParticles:Array.from({length:140},(_,i)=>({id:i,ageMs:i*3,lifetimeMs:200+i*10,x:i,z:-i,elevation:i/9,vx:i%4-.5,vz:i%5,vy:.05,artRef:'smoke'}))};
 let reference=structuredClone(session.tireFxParticles);
 const array=session.tireFxParticles,original=[...array];
 for(let i=0;i<180;i++){
  const seconds=[0,1/60,1/120,.2][i%4];reference=oldTireStep(reference,seconds);advanceRaceTireFxParticles(session,seconds);
  assert.equal(session.tireFxParticles,array);assert.deepEqual(array,reference);
  for(const p of array)assert.equal(p,original[p.id]);
 }
});
test('expired/capped tire FX are reused within one session, without reusing live particles or exceeding the pool bound',()=>{
 const session={tireFxParticles:Array.from({length:300},(_,id)=>({id,ageMs:0,lifetimeMs:1}))};
 const originals=new Set(session.tireFxParticles);
 trimRaceTireFxParticles(session);assert.equal(session.tireFxParticles.length,140);assert.equal(session.tireFxParticles[0].id,160);
 const active=new Set(session.tireFxParticles),borrowed=[];
 for(let i=0;i<140;i++){const p=acquireRaceTireFxParticle(session);assert.ok(originals.has(p));assert.ok(!active.has(p));borrowed.push(p);}
 assert.equal(new Set(borrowed).size,140);
 assert.ok(!originals.has(acquireRaceTireFxParticle(session)),'pool is bounded even after a larger imported list');
 advanceRaceTireFxParticles(session,.1);assert.equal(session.tireFxParticles.length,0);
 assert.ok(active.has(acquireRaceTireFxParticle(session)));
 assert.ok(!originals.has(acquireRaceTireFxParticle({})),'no cross-race reuse');
});
function legacyWeather(particles,dt,wind){
 particles.forEach(p=>{
  p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.spin*dt;
  if(p.style.kind==='weather')p.x+=wind*dt;
  if(p.style.gravity)p.vy+=900*Math.max(0,Number(p.style.gravityScale??1))*dt;
  if(p.style.swayAmplitude){p.sway+=dt*(p.style.swaySpeed||3);p.x+=Math.sin(p.sway)*p.style.swayAmplitude*dt;}
 });return particles.filter(p=>p.life>0);
}
test('weather compaction preserves exact motion and surviving order without replacement arrays',()=>{
 const particles=Array.from({length:900},(_,i)=>({life:i/900,x:i,y:-i,vx:-8,vy:40,angle:0,spin:2,sway:i,style:i%2?{kind:'weather',swayAmplitude:16,swaySpeed:2}:{gravity:true,gravityScale:.7}}));
 let expected=structuredClone(particles);
 for(let i=0;i<90;i++){
  expected=legacyWeather(expected,1/60,-30);
  assert.equal(updateWeatherParticleMotion(particles,1/60,-30),particles);assert.deepEqual(particles,expected);
 }
});
test('weather viewport culling retains unrelated particles and does not clear the compacted live array',()=>{
 const state=createWeatherRuntimeState(),style=WEATHER_PROFILES['weather-rain'];
 const particle=(id,x,custom=style)=>({id,x,y:0,vx:0,vy:0,life:5,angle:0,spin:0,style:custom});
 state.particles.push(particle('inside',50),particle('outside',500),particle('other',500,{}));
 const array=state.particles;
 updateWeatherSystem({state,weatherType:'weather-rain',bounds:{x:0,y:0,w:100,h:100},dt:1/60,intensity:.00001,rng:()=>.5});
 assert.equal(state.particles,array);assert.deepEqual(array.slice(0,2).map(p=>p.id),['inside','other']);
 assert.equal(array.length,3,'the existing emitter also adds one rain particle');
 assert.ok(array[2].life>0);
});

import {MECHANICAL_COMPONENTS,createMechanicalState,stepMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
import {calculateAuthoritativeSteeringEnvelope,classifySteeringResponseTelemetry} from '../../src/racing/simulation/ContactPatchTireModel.js';
test('compiled mechanical damage lookups preserve every catalog path and positive-only damage propagation',()=>{
 for(const changed of MECHANICAL_COMPONENTS){
  const state=createMechanicalState(),damage={};
  const keys=changed.damagePath.split('.');
  const set=value=>{let target=damage;for(const key of keys.slice(0,-1))target=target[key] ||= {};target[keys.at(-1)]=value;};
  set(65);stepMechanicalState(state,1/120,{},damage);
  for(const component of MECHANICAL_COMPONENTS)assert.equal(state.components[component.id].damage,component.damagePath===changed.damagePath?65:0,`${changed.id} -> ${component.id}`);
  set(20);stepMechanicalState(state,1/120,{},damage);
  assert.equal(state.components[changed.id].damage,65,'lower external damage does not repair internal failures');
  set(25);stepMechanicalState(state,1/120,{},damage);
  assert.equal(state.components[changed.id].damage,70,'only the positive delta is applied');
 }
});
test('steering diagnostics preserve numeric coercion, finite grip averaging, and own-property semantics',()=>{
 const legacy=t=>{
  const utilization=Math.max(0,...Object.values(t.frontUtilization||{}).map(Number));
  const longitudinal=Math.max(0,...Object.values(t.throttleFrictionCircleUse||{}).map(Number));
  const grip=Object.values(t.frontGripCoefficients||{}).map(Number).filter(Number.isFinite);
  if(longitudinal>.55&&utilization>.82)return 'drivetrain-understeer';
  if(utilization>.92)return 'front-tire-saturation';
  if(grip.length&&grip.reduce((a,b)=>a+b,0)/grip.length<.45)return 'insufficient-surface-grip';
  return 'responsive';
 };
 for(const value of [undefined,null,NaN,Infinity,0,.6,.99,'0.3']){
  const input={frontUtilization:{fl:value},throttleFrictionCircleUse:{fl:value},frontGripCoefficients:{fl:value,fr:.1}};
  assert.equal(classifySteeringResponseTelemetry(input),legacy(input));
 }
 const inherited=Object.assign(Object.create({fake:100}),{fl:.2});
 const input={frontUtilization:inherited,throttleFrictionCircleUse:inherited,frontGripCoefficients:inherited};
 assert.equal(classifySteeringResponseTelemetry(input),legacy(input));
 assert.equal(classifySteeringResponseTelemetry({}),'responsive');
});
test('steering envelope supports either front wheel without changing its input contacts',()=>{
 const patch={normalLoadN:3000,suspensionNormalLoadN:4000};
 const left={groundSpeedMps:25,contactPatches:{fl:patch}},right={groundSpeedMps:25,contactPatches:{fr:patch}};
 const before=structuredClone(left);
 assert.equal(calculateAuthoritativeSteeringEnvelope(left),calculateAuthoritativeSteeringEnvelope(right));
 assert.deepEqual(left,before);
 assert.ok(Math.abs(calculateAuthoritativeSteeringEnvelope({groundSpeedMps:25})-.002)<1e-12);
});
