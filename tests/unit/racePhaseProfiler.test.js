import test from 'node:test';
import assert from 'node:assert/strict';
import {createRacePhaseProfiler} from '../../tools/loadtest/race-phase-profiler.mjs';

test('phase profiler records nested work, replacements and errors without changing calls',()=>{
 let time=0;
 const runner=()=>({stepIndex:0,advance(){time+=3;this.stepIndex+=2;}});
 const editor={playtestSession:{vehicleDynamicsRunner:runner(),aiRuntime:[],trackState:{}},
 updateRaceAiDrivers(){time+=4;throw Error('expected');}};
 const p=createRacePhaseProfiler(editor,()=>time);
 p.begin(1);editor.playtestSession.vehicleDynamicsRunner.advance();assert.throws(()=>editor.updateRaceAiDrivers(),/expected/);
 let row=p.end();assert.equal(row.ms.playerPhysics,3);assert.equal(row.work.playerPhysics,2);assert.equal(row.ms.ai,4);
 editor.playtestSession.vehicleDynamicsRunner=runner();p.begin(2);editor.playtestSession.vehicleDynamicsRunner.advance();row=p.end();
 assert.equal(row.calls.playerPhysics,1);assert.equal(row.work.playerPhysics,2);
});

test('player detail follows the authoritative provider and preserves nested return values',()=>{
 let time=0;
 const authority={raceEnvironmentProvider(){time+=2;return {grip:1};}};
 const runner={stepIndex:0,tireContactSubsystem:{step(){time+=3;return 42;}},
  runStep(){assert.equal(this.environmentProvider().grip,1);return this.tireContactSubsystem.step();},
  advance(){this.stepIndex++;return this.runStep();}};
 const editor={vehicleDynamicsAuthority:authority,playtestSession:{vehicleDynamicsRunner:runner,aiRuntime:[],trackState:{}}};
 const p=createRacePhaseProfiler(editor,()=>time,{playerDetail:true});
 for(let frame=0;frame<2;frame++){
  p.begin(frame);
  // RaceSimulation reassigns the runner callback each rendered update.
  runner.environmentProvider=authority.raceEnvironmentProvider;
  assert.equal(runner.advance(),42);
  const r=p.end();assert.equal(r.ms['player.environmentProvider'],2);
  assert.equal(r.ms['player.tires'],3);assert.equal(r.ms['player.runStep'],5);
  assert.equal(r.ms.playerPhysics,5);assert.equal(r.calls['player.environmentProvider'],1);
 }
});
