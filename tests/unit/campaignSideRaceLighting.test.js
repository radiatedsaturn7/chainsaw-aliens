import test from 'node:test';
import assert from 'node:assert/strict';
import {applySideRaceLighting} from '../../tools/campaigns/side_race_lighting.mjs';
import {raceStartsWithHeadlights} from '../../src/racing/RaceLighting.js';

test('Pawtucket highway side race overrides inherited night brightness with noon',()=>{
 const race={timeOfDay:'night',brightness:.05,visualFx:{motionBlur:0,skyBrightness:1}};
 assert.equal(applySideRaceLighting(race,'H01-S01'),'noon');
 assert.equal(race.brightness,1);assert.equal(race.timeOfDay,'day');
 assert.equal(race.visualFx.sunEnabled,true);assert.equal(race.visualFx.motionBlur,0);
 assert.equal(raceStartsWithHeadlights(race),false);
});
test('side race lighting varies but stays stable across reimports and matches sky and scene brightness',()=>{
 const times=new Set();
 for(let h=1;h<=11;h++)for(let n=1;n<=9;n++){
  const id=`H${String(h).padStart(2,'0')}-S${String(n).padStart(2,'0')}`;
  const a={},b={};times.add(applySideRaceLighting(a,id));applySideRaceLighting(b,id);
  assert.deepEqual(a,b);assert.equal(a.visualFx.skyBrightness,a.brightness);assert.equal(a.visualFx.motionBlur,0);
  if(a.timeOfDay==='night')assert.equal(raceStartsWithHeadlights(a),true);
 }
 assert.equal(times.size,4);
});
