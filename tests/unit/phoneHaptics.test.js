import test from 'node:test';
import assert from 'node:assert/strict';
import {PhoneHaptics,phoneDrivingPattern} from '../../src/racing/PhoneHaptics.js';
import {RaceHaptics,normalizeHaptics} from '../../src/racing/RaceHaptics.js';

test('phone cues have distinct rhythms, bounded pulses and priority',()=>{
 const road=phoneDrivingPattern({road:.3}),skid=phoneDrivingPattern({slip:.5}),abs=phoneDrivingPattern({braking:.5}),impact=phoneDrivingPattern({impact:.7,slip:1});
 assert.equal(impact.kind,'impact');assert.equal(typeof road.pattern,'number');
 assert.notDeepEqual(skid.pattern,abs.pattern);assert.ok(impact.pattern>road.pattern);
 assert.equal(phoneDrivingPattern({road:.01}),null);
 assert.ok(phoneDrivingPattern({road:.7}).interval<road.interval);
 for(const cues of [{road:1},{bump:1},{slip:1},{braking:1},{impact:1}]){
  const p=phoneDrivingPattern(cues,30),values=[p.pattern].flat();
  assert.ok(values.reduce((a,b)=>a+b,0)<p.interval);
  for(const v of values)assert.ok(Number.isInteger(v)&&v>=16&&v<=250);
 }
 assert.equal(normalizeHaptics({phonePulse:500}).phonePulse,30);
 assert.ok(phoneDrivingPattern({road:.3},30).pattern>road.pattern);
});
test('road cannot restart skid patterns; impacts interrupt immediately and retain a recovery gap',()=>{
 let now=0;const calls=[];const phone=new PhoneHaptics({vibrate:p=>{calls.push(p);return true;}},()=>now);
 phone.play({road:.4});now=20;phone.play({road:.8});assert.equal(calls.length,1);
 phone.play({slip:.6});assert.equal(calls.length,2);
 now=40;phone.play({road:.8});phone.play({slip:.6});assert.equal(calls.length,2);
 phone.play({impact:.8});assert.equal(calls.length,3);
 now=100;phone.play({});phone.play({road:1});assert.equal(calls.length,3);
 now=400;phone.play({road:.6});assert.equal(calls.length,4);
 phone.stop();assert.equal(calls.at(-1),0);phone.stop();assert.equal(calls.length,5);
});
test('failed phone output does not lock out retries and unavailable hardware is harmless',()=>{
 let calls=0;const phone=new PhoneHaptics({vibrate:()=>++calls>1},()=>0);
 phone.play({road:.5});phone.play({road:.5});assert.equal(calls,2);assert.equal(phone.active,true);
 new PhoneHaptics({},()=>0).play({impact:1});
 new PhoneHaptics({vibrate(){throw Error('blocked');}},()=>0).play({impact:1});
});
test('collision bypasses output throttle and is not repeated from the controller decay envelope',()=>{
 let now=0;const calls=[];
 const h=new RaceHaptics({navigator:{vibrate:p=>{calls.push(p);return true;}},window:null,document:null,now:()=>now});
 const session={speedMps:20,elapsedMs:1000,vehicleDynamicsRunner:{state:{contactPatches:{}},impactHistory:[]}};
 h.update(session,{},.016,{active:true});assert.equal(calls.length,0);
 session.vehicleDynamicsRunner.impactHistory.push({sequence:1,bodyNormalImpulseNs:7000});
 now=16;h.update(session,{},.016,{active:true});assert.equal(calls.length,1);assert.ok(calls[0]>50);
 for(let i=0;i<30;i++){now+=16;h.update(session,{},.016,{active:true});}
 assert.equal(calls.length,1);
 h.update(session,{},.016,{active:false});assert.equal(calls.at(-1),0);
});

test('phone front and rear cues stay recognizable over ordinary rough-road bumps',()=>{
 const front=phoneDrivingPattern({frontSlip:.6,bump:.8,road:.8});
 const rear=phoneDrivingPattern({rearSlip:.6,bump:.8,road:.8});
 assert.equal(front.kind,'front-slip');assert.ok(front.pattern>=140);
 assert.equal(rear.kind,'rear-slip');assert.equal(rear.pattern.length,5);
 assert.ok(rear.pattern[1]>=35&&rear.pattern[3]===rear.pattern[1]);
 assert.ok(rear.pattern[0]<front.pattern);
 assert.equal(phoneDrivingPattern({rearSlip:.8,impact:.5}).kind,'impact');
 assert.equal(phoneDrivingPattern({frontSlip:.8,braking:.5}).kind,'braking');
});

function duty(pattern){
 const pulses=[pattern.pattern].flat();
 return pulses.reduce((sum,v,i)=>sum+(i%2===0?v:0),0)/pattern.interval;
}
test('all skid rhythms and crashes grow with intensity, with much higher skid duty at the limit',()=>{
 for(const key of ['slip','frontSlip','rearSlip']){
  const low=phoneDrivingPattern({[key]:.15}),medium=phoneDrivingPattern({[key]:.5}),high=phoneDrivingPattern({[key]:1});
  assert.ok(duty(low)<duty(medium),key);assert.ok(duty(medium)<duty(high),key);
  assert.ok(duty(high)>duty(low)*2,key);assert.ok(duty(high)>.7,key);
 }
 assert.ok(phoneDrivingPattern({impact:1}).pattern>phoneDrivingPattern({impact:.15}).pattern*2);
});
test('a worsening skid interrupts a weaker pattern without restarting for small fluctuations',()=>{
 let now=0;const calls=[];const phone=new PhoneHaptics({vibrate:p=>{calls.push(p);return true;}},()=>now);
 phone.play({rearSlip:.2});now=90;phone.play({rearSlip:.25});assert.equal(calls.length,1);
 phone.play({rearSlip:.8});assert.equal(calls.length,2);assert.ok(calls[1][0]>calls[0][0]);
 now=110;phone.play({rearSlip:1});assert.equal(calls.length,2);
 phone.play({impact:.7});assert.equal(calls.length,3);
});
test('new defaults are stronger without overriding saved strength or disabled effects',()=>{
 const defaults=normalizeHaptics();assert.equal(defaults.strength,.85);assert.equal(defaults.phonePulse,24);
 const saved=normalizeHaptics({strength:.3,slip:0,impacts:0,phonePulse:16,enabled:false});
 assert.equal(saved.strength,.3);assert.equal(saved.slip,0);assert.equal(saved.impacts,0);
 assert.equal(saved.phonePulse,16);assert.equal(saved.enabled,false);
});
