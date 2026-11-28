import test from 'node:test';
import assert from 'node:assert/strict';
import {raceGuideCapabilities,raceGuidePlannedSpeed} from '../../src/racing/RaceGuideSpeed.js';
const ids=['fl','fr','rl','rr'];
function chassis(mu=1,mass=1500){return {contactPatches:Object.fromEntries(ids.map(id=>[id,{validTreadContact:true,normalLoadN:mass*9.81/4,gripCoefficient:mu}]))};}
function road(grade=0,circuit=false){const count=101;return {length:400,step:4,count,circuit,curvature:Float64Array.from({length:count},(_,i)=>i>=60&&i<70?.06:0),grade:new Float64Array(count).fill(grade),risk:new Float64Array(count)};}
test('guide uses live compounds, load and brake force without multiplying grip twice',()=>{
 const tuning={weightKg:1500,brakeForceN:15000,tireGrip:10};
 const dry=raceGuideCapabilities(chassis(),tuning),loose=raceGuideCapabilities(chassis(.4),tuning);
 assert.equal(dry.live,true);assert.ok(loose.lateral<dry.lateral);assert.ok(loose.braking<dry.braking);
 assert.deepEqual(dry,raceGuideCapabilities(chassis(),{...tuning,tireGrip:.2}));
 assert.ok(raceGuideCapabilities(chassis(1,2500),{...tuning,weightKg:2500,brakeForceN:6000}).braking<dry.braking);
});
test('brake pressure, bias and per-wheel damage affect usable stopping capacity',()=>{
 const tuning={weightKg:1500,brakeForceN:9000};const normal=raceGuideCapabilities(chassis(),tuning);
 assert.ok(raceGuideCapabilities(chassis(),{...tuning,brakePressure:.2}).braking<normal.braking);
 assert.ok(raceGuideCapabilities(chassis(),{...tuning,frontBrakeBias:.85}).braking<normal.braking);
 assert.ok(raceGuideCapabilities(chassis(),tuning,1,{effects:{brakes:{fl:0,fr:0}}}).braking<normal.braking);
});
test('unsupported tires and suspension unloading reduce guidance; landing spikes cannot inflate it',()=>{
 const physics=chassis(),tuning={weightKg:1500,brakeForceN:30000};const before=raceGuideCapabilities(physics,tuning);
 physics.contactPatches.fl.validTreadContact=false;physics.contactPatches.fr.normalLoadN=0;
 const unloaded=raceGuideCapabilities(physics,tuning);assert.ok(unloaded.lateral<before.lateral);assert.ok(unloaded.braking<before.braking);
 for(const p of Object.values(physics.contactPatches)){p.validTreadContact=true;p.normalLoadN=1500*9.81;}
 assert.ok(raceGuideCapabilities(physics,tuning).lateral<=before.lateral+1e-9);
});
test('uphill, level and downhill braking envelopes differ before the same corner',()=>{
 const target=grade=>raceGuidePlannedSpeed(road(grade),130,30,6,5);
 assert.ok(target(-.12)<target(0));assert.ok(target(0)<target(.12));
});
test('the slope ahead matters even while the car is on a level approach',()=>{
 const flat=road(),down=road();for(let i=35;i<60;i++)down.grade[i]=-.15;
 assert.ok(raceGuidePlannedSpeed(down,80,30,6,5)<raceGuidePlannedSpeed(flat,80,30,6,5));
});
test('weaker tires/brakes and a slower pedal response move braking earlier',()=>{
 const p=road();const target=raceGuidePlannedSpeed(p,100,30,6,5);
 assert.ok(raceGuidePlannedSpeed(p,100,30,3,2)<target);
 assert.ok(raceGuidePlannedSpeed(p,100,30,6,5,{responseSeconds:1})<target);
 assert.equal(raceGuidePlannedSpeed(p,100,30,6,0),0);
});
test('downhill beyond braking authority is finite and warns instead of promising a stop',()=>{
 const target=raceGuidePlannedSpeed(road(-.2),100,25,1,.5);assert.equal(target,0);
});
test('circuit seam is continuous and guide cache stays bounded independently of AI',()=>{
 const p=road(-.08,true);p.curvature[2]=.1;
 const a=raceGuidePlannedSpeed(p,399.999,20,5,4),b=raceGuidePlannedSpeed(p,0,20,5,4);assert.ok(Math.abs(a-b)<.01);
 for(let i=1;i<40;i++)raceGuidePlannedSpeed(p,100,20,i,i*.8);
 assert.ok(p.guideProfiles.size<=16);assert.equal(p.profiles,undefined);
});
test('physical brake damage reduces guide capacity as well as mechanical failures',()=>{
 const tuning={weightKg:1500,brakeForceN:9000};
 assert.ok(raceGuideCapabilities(chassis(),tuning,1,{}, {brakes:90}).braking<raceGuideCapabilities(chassis(),tuning).braking);
});
