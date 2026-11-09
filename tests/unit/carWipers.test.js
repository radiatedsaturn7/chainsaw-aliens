import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCarWipers,toggleWipers,advanceWipers,wiperAngle,drawInteriorWipers} from '../../src/racing/CarWipers.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const config=()=>normalizeCarWipers({artRef:'windshieldwiper'});
test('wipers start parked, sweep and return using elapsed simulation time',()=>{
 const s={},c=config();assert.equal(wiperAngle(s,c),-5*Math.PI/180);toggleWipers(s);
 advanceWipers(s,.8,c);assert.ok(Math.abs(wiperAngle(s,c)-(-85*Math.PI/180))<1e-12);
 advanceWipers(s,.8,c);assert.equal(s.wipers.phase,0);assert.equal(s.wipers.enabled,true);
 const b={};toggleWipers(b);for(let i=0;i<40;i++)advanceWipers(b,.01,c);advanceWipers(s,.4,c);
 assert.ok(Math.abs(wiperAngle(b,c)-wiperAngle(s,c))<1e-12);
});
test('switch off completes the cycle and parks, without jumping on disable or pause',()=>{
 const s={},c=config();toggleWipers(s);advanceWipers(s,.4,c);const angle=wiperAngle(s,c);toggleWipers(s);
 assert.equal(wiperAngle(s,c),angle);advanceWipers(s,0,c);assert.equal(wiperAngle(s,c),angle);
 advanceWipers(s,.4,c);assert.equal(s.wipers.moving,true);advanceWipers(s,1,c);
 assert.deepEqual(s.wipers,{enabled:false,phase:0,moving:false});
 advanceWipers(s,5,c);assert.equal(s.wipers.phase,0);toggleWipers(s);assert.equal(s.wipers.moving,true);
});
test('wiper artwork is clipped to first-person viewport and rotates around its left edge',()=>{
 const calls=[],ctx=new Proxy({}, {get:(_,k)=>(...args)=>calls.push([k,...args]),set:()=>true});const c=config(),image={width:506,height:47},bounds={x:20,y:30,w:512,h:288};
 drawInteriorWipers(ctx,bounds,{},c,()=>image,'third-person');assert.equal(calls.length,0);
 drawInteriorWipers(ctx,bounds,{},c,()=>null,'first-person');assert.equal(calls.length,0);
 drawInteriorWipers(ctx,bounds,{},c,()=>image,'first-person');
 assert.deepEqual(calls.find(a=>a[0]==='rect'),['rect',20,30,512,288]);assert.equal(calls.filter(a=>a[0]==='rotate').length,2);
 for(const call of calls.filter(a=>a[0]==='drawImage')){assert.equal(Math.abs(call[2]),0);assert.ok(Math.abs(call[3]+call[5]/2)<1e-9);assert.ok(Math.abs(call[4]/call[5]-506/47)<1e-9);}
});
test('wiper settings survive car save normalization and participate in art preloading',()=>{
 const e=new RaceEditor({},{mode:'car'});e.selectedCar.art.interior.wipers=config();
 const car=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument());assert.deepEqual(car.art.interior.wipers,config());
 assert.ok(e.collectRaceCarArtRefs(car).includes('windshieldwiper'));
 e.playtestSession={};e.raceInput.pauseMenuMode='car-controls';const row=()=>e.getRacePauseMenuRows().find(r=>r.id==='race-wipers');assert.equal(row().value,'Off');row().onClick();assert.equal(row().value,'On');row().onAdjust();assert.equal(row().value,'Off');
});
