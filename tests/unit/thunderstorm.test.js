import test from 'node:test';
import assert from 'node:assert/strict';
import {createThunderstorm,advanceThunderstorm,strikeFlash,thunderProfile} from '../../src/racing/Thunderstorm.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
function run(fps,intensity=1){const s=createThunderstorm('P1'),heard=[];for(let i=0;i<fps*120;i++)advanceThunderstorm(s,1/fps,{intensity,onThunder:e=>heard.push(e)});return {s,heard};}
test('seeded storm timing is independent of rendering and intensity increases strike activity',()=>{
 const a=run(30),b=run(120);assert.deepEqual(a,b);assert.ok(a.s.sequence>run(60,.2).s.sequence);
 assert.ok(a.heard.length>0);assert.ok(a.s.pending.length<=16);assert.ok(a.s.strikes.length<=4);
 const before=structuredClone(a.s);advanceThunderstorm(a.s,0);assert.deepEqual(a.s,before);
});
test('flash has a precursor and separate brighter strokes before delayed thunder',()=>{
 const s=createThunderstorm(7);s.hazard=0;const heard=[];
 advanceThunderstorm(s,1/120,{onThunder:e=>heard.push(e)});
 const strike=s.strikes[0];assert.ok(strike.pulses.length>=2);assert.equal(heard.length,0);
 assert.ok(strikeFlash(strike,strike.time+strike.pulses[1].at)>strikeFlash(strike,strike.time));
 assert.equal(strikeFlash(strike,strike.time+2),0);
 const due=s.pending[0];assert.ok(Math.abs(due.delaySeconds-strike.distanceM/343)<1e-9);
 while(s.time<due.at-.02)advanceThunderstorm(s,1/120,{intensity:0,onThunder:e=>heard.push(e)});
 assert.equal(heard.length,0);advanceThunderstorm(s,.05,{intensity:0,onThunder:e=>heard.push(e)});assert.equal(heard.length,1);
});
test('near thunder is sharper/louder/shorter; distant thunder is filtered and delayed',()=>{
 const near=thunderProfile(100),far=thunderProfile(5000);
 assert.ok(near.gain>far.gain);assert.ok(near.cutoffHz>far.cutoffHz*8);assert.ok(near.durationSeconds<far.durationSeconds);assert.ok(far.delaySeconds>14);
});
test('clearing weather cancels queued thunder and session state does not leak',()=>{
 const heard=[],e=new RaceEditor({audio:{playWeatherThunder:v=>heard.push(v)}});e.playtestSession={};
 const weather={id:'storm',visualIntensity:1};e.updateRaceWeatherFxState(.01,{weatherState:weather});e.playtestSession.weatherFxState.storm.hazard=0;
 e.updateRaceWeatherFxState(.02,{weatherState:weather});assert.ok(e.playtestSession.weatherFxState.storm.pending.length);
 e.updateRaceWeatherFxState(.01,{weatherState:{id:'clear',visualIntensity:0}});assert.equal(e.playtestSession.weatherFxState.storm,null);assert.equal(heard.length,0);
});

test('storm haze reveals the lit distant sky during a flash',()=>{
 const e=new RaceEditor({});e.projectRaceDepthToScreenY=()=>100;
 const stops=[],c={createLinearGradient:()=>({addColorStop:(_p,color)=>stops.push(color)}),fillRect(){}};
 const weather={id:'storm',visibilityDistanceM:20,visibilityStrength:1,visibilityFarAlpha:.97};
 e.getRaceLightningFlash=()=>0;e.drawRaceWeatherVisibilityVeil(c,{x:0,y:0,w:512,h:288},weather);const dark=stops[0];
 stops.length=0;e.getRaceLightningFlash=()=>1;e.drawRaceWeatherVisibilityVeil(c,{x:0,y:0,w:512,h:288},weather);
 assert.notEqual(stops[0],dark);assert.ok(stops[0].includes('0.1455'));
});
