import test from 'node:test';
import assert from 'node:assert/strict';
import {raceLineGraphic,distantRaceLineGraphic,RACE_LINE_DEPTH_M} from '../../src/racing/RaceLineGraphics.js';

test('race markings are cached, immutable and inset inside their road footprint',()=>{
  assert.equal(RACE_LINE_DEPTH_M,2.4);
  for(const kind of ['start','finish']) {
    const graphic=raceLineGraphic(kind);
    assert.equal(graphic,raceLineGraphic(kind));
    assert.ok(Object.isFrozen(graphic));
    assert.ok(graphic.length < 300);
    let coverage=0;
    for(const p of graphic) {
      assert.ok(Object.isFrozen(p));
      assert.ok(p.u0>=.025-1e-9 && p.u1<=.975+1e-9 && p.u1>p.u0);
      assert.ok(p.v0>=0 && p.v1<=1 && p.v1>p.v0);
      coverage+=(p.u1-p.u0)*(p.v1-p.v0);
    }
    assert.ok(coverage> .45 && coverage< .95,'sparse transparent chips expose the real road');
  }
});
test('start bars and two-row finish checkers have distinct identities',()=>{
  assert.ok(raceLineGraphic('start').some(p=>p.color==='#b79950'));
  assert.ok(!raceLineGraphic('start').some(p=>p.color==='#292d2b'));
  const finish=distantRaceLineGraphic('finish');
  assert.equal(finish.length,24);
  for(let col=0;col<12;col++) assert.notEqual(finish[col].color,finish[col+12].color);
  assert.equal(distantRaceLineGraphic('start').length,2);
  assert.equal(raceLineGraphic(),raceLineGraphic('finish'));
});

import RaceEditor from '../../src/ui/RaceEditor.js';
test('road graphics end at the real finish, follow cross sections and keep circuit shared',()=>{
  const e=Object.create(RaceEditor.prototype);
  e.playtestSession={routeRuntimeType:'destination'};
  e.getRaceRoadCrossSectionAtDistance=(d)=>({left:{x:-5,z:d,elevation:d/100},right:{x:5,z:d,elevation:d/100+.1}});
  const args={travel:0,routeLength:100,slices:[{center:{distance:0}},{center:{distance:100}}]};
  const meshes=e.getRaceWebGLCheckerStripeMeshes(args);
  const all=meshes.flatMap(m=>m.points);
  assert.ok(all.every(p=>p.z>=0 && p.z<=100 && Math.abs(p.x)<=4.75+1e-9));
  assert.equal(Math.max(...all.map(p=>p.z)),100);
  assert.ok(all.some(p=>p.z<2.4));
  assert.ok(meshes.some(m=>m.color==='#b79950'));
  e.playtestSession.routeRuntimeType='circuit';
  const shared=e.getRaceWebGLCheckerStripeMeshes(args);
  assert.equal(shared.length,raceLineGraphic('finish').length);
  assert.ok(shared.flatMap(m=>m.points).every(p=>p.z<=2.4));
  assert.ok(!shared.some(m=>m.color==='#b79950'));
});
