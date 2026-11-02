import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {changeRaceDebugAi} from '../../src/racing/RaceDebugAi.js';

test('debug adds and removes running opponents without editing the saved race',()=>{
 const e=new RaceEditor({});
 e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const s=e.playtestSession;s.aiRuntime=[];s.aiDrivers=[];
 const authored=JSON.stringify(e.selectedRace.competition);
 assert.equal(changeRaceDebugAi(e,1),true);
 const ai=s.aiRuntime[0];
 assert.ok(ai.vehicleDynamicsRunner);
 assert.ok(Math.hypot(ai.worldX-s.worldX,ai.worldZ-s.worldZ)>=12);
 assert.equal(ai.vehicleDynamicsRunner.stepIndex,0);
 assert.equal(changeRaceDebugAi(e,1),true);
 assert.notEqual(s.aiRuntime[1].id,ai.id);
 assert.ok(Math.hypot(ai.worldX-s.aiRuntime[1].worldX,ai.worldZ-s.aiRuntime[1].worldZ)>=12);
 assert.equal(changeRaceDebugAi(e,-1),true);
 assert.equal(s.aiRuntime.length,1);
 assert.equal(changeRaceDebugAi(e,-1),true);
 assert.equal(changeRaceDebugAi(e,-1),false);
 assert.equal(JSON.stringify(e.selectedRace.competition),authored);
});

test('debug worker lifecycle and count controls are session-only',()=>{
 const e=new RaceEditor({});e.startPlaytest(e.selectedCar.id,{hydrateCars:false});
 const s=e.playtestSession;s.aiRuntime=[];s.aiDrivers=[];
 const events=[];
 e.vehicleDynamicsAuthority ||= {};
 e.vehicleDynamicsAuthority.workerBridge={addDebugAiVehicle:ai=>events.push(['add',ai.id]),removeDebugAiVehicle:ai=>events.push(['remove',ai.id])};
 assert.equal(changeRaceDebugAi(e,1),true);
 assert.equal(changeRaceDebugAi(e,-1),true);
 assert.equal(events[0][1],events[1][1]);
 s.aiRuntime=Array.from({length:29},()=>({}));
 assert.equal(changeRaceDebugAi(e,1),false);
 e.raceInput.pauseMenuMode='debug-ai';
 assert.equal(e.getRacePauseMenuRows().find(r=>r.id==='race-debug-ai-add').disabled,true);
 s.aiRuntime=[];
 assert.equal(e.getRacePauseMenuRows().find(r=>r.id==='race-debug-ai-remove').disabled,true);
});
