import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
function fixture(){
 const e=Object.create(RaceEditor.prototype),events=[];
 e.playtestSession={running:true,startupFramePending:true};
 e.game={showModalPrompt:m=>events.push(['modal',m]),showSystemToast:m=>events.push(['toast',m])};
 e.resetRacePlaytestInputs=()=>{};e.restoreRaceAuthoringMenuState=()=>events.push(['editor']);
 return {e,events};
}
test('startup timeout retains a dismissible reason after returning to the editor',()=>{
 const {e,events}=fixture();e.failRaceStartupPresentation('First frame timed out');
 assert.equal(e.playtestSession,null);
 assert.deepEqual(events,[['editor'],['modal','First frame timed out']]);
 assert.equal(e.status,'First frame timed out');assert.equal(e.lastRaceFailure.message,e.status);
});
test('preparation failure preserves its exact error beyond cleanup',()=>{
 const {e,events}=fixture();e.recordRacePreparationDiagnostics=()=>{};
 e.cancelRacePlaytestPreparation=()=>{e.status='Cancelled';e.playtestSession=null;};
 e.failRacePlaytestPreparation('Missing road texture');
 assert.deepEqual(events,[['editor'],['modal','Missing road texture']]);
 assert.equal(e.status,'Missing road texture');
});
test('car previews keep lightweight errors; games without modal support retain toast fallback',()=>{
 const {e,events}=fixture();e.reportRaceFailure('Preview error',{preview:true});
 assert.deepEqual(events,[['toast','Preview error']]);
 delete e.game.showModalPrompt;e.reportRaceFailure('Race error');
 assert.deepEqual(events.at(-1),['toast','Race error']);
});
test('startup collision preparation exceptions are routed through failure handling',()=>{
 const {e}=fixture();e.syncRacePhysicalGamepad=()=>{};
 e.playtestSession.raceIntro={active:false};
 e.getRaceSessionCar=()=>{throw Error('Bad collider');};
 let error;e.handleRaceSimulationFailure=cause=>{error=cause;};
 e.draw({},800,600);assert.equal(error.message,'Bad collider');
});
