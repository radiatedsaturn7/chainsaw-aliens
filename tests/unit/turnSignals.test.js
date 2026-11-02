import test from 'node:test';
import assert from 'node:assert/strict';
import {setTurnSignal,advanceTurnSignals,turnSignalLit} from '../../src/racing/TurnSignals.js';
import {controlLamp} from '../../src/racing/MechanicalInstruments.js';
import {carFxDrivingState,carFxActive,normalizeCarFx} from '../../src/racing/CarFx.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('signals toggle, replace one another and hazards blink both sides in sync',()=>{
 const s={};setTurnSignal(s,'left');assert.ok(turnSignalLit(s,'left'));assert.equal(turnSignalLit(s,'right'),false);
 setTurnSignal(s,'right');assert.equal(turnSignalLit(s,'left'),false);assert.ok(turnSignalLit(s,'right'));
 setTurnSignal(s,'right');assert.equal(s.turnSignals.mode,'off');
 setTurnSignal(s,'hazards');assert.equal(controlLamp('leftsignallight',s),1);assert.equal(controlLamp('rightsignallight',s),1);
 advanceTurnSignals(s,.41,.8);assert.equal(controlLamp('leftsignallight',s),0);assert.equal(controlLamp('rightsignallight',s),0);
 advanceTurnSignals(s,.4,0);assert.ok(turnSignalLit(s,'left'));assert.ok(turnSignalLit(s,'right'));assert.equal(s.turnSignals.mode,'hazards');
});
test('auto cancel requires a meaningful turn in the selected direction then centering',()=>{
 for(const [side,sign] of [['left',-1],['right',1]]){
  const s={};setTurnSignal(s,side);
  advanceTurnSignals(s,1,0);assert.equal(s.turnSignals.mode,side);
  advanceTurnSignals(s,.2,-sign*.8);advanceTurnSignals(s,.2,0);assert.equal(s.turnSignals.mode,side);
  advanceTurnSignals(s,.2,sign*.5);assert.ok(s.turnSignals.armed);
  advanceTurnSignals(s,.1,0);assert.equal(s.turnSignals.mode,side);
  advanceTurnSignals(s,.1,0);assert.equal(s.turnSignals.mode,'off');
 }
});
test('blink phase is elapsed-time based, independent of frame count',()=>{
 const a={},b={};setTurnSignal(a,'left');setTurnSignal(b,'left');
 advanceTurnSignals(a,.6,0);for(let i=0;i<60;i++)advanceTurnSignals(b,.01,0);
 assert.ok(Math.abs(a.turnSignals.elapsed-b.turnSignals.elapsed)<1e-9);assert.equal(turnSignalLit(a,'left'),turnSignalLit(b,'left'));
 const phase=a.turnSignals.elapsed;advanceTurnSignals(a,0,0);assert.equal(a.turnSignals.elapsed,phase);
 advanceTurnSignals(a,NaN,NaN);assert.equal(a.turnSignals.elapsed,phase);
});
test('HUD arrows and car FX share the same blink signal',()=>{
 const s={};setTurnSignal(s,'left');const [fx]=normalizeCarFx([{triggers:['turn-left']}]);
 for(const dt of [0,.41,.4]){advanceTurnSignals(s,dt,0);assert.equal(carFxActive(fx,carFxDrivingState(s)),!!controlLamp('leftsignallight',s));}
});
test('pause settings expose left, right and hazard controls',()=>{
 const e=new RaceEditor({},{mode:'car'});e.playtestSession={};e.raceInput.pauseMenuMode='settings';
 const row=id=>e.getRacePauseMenuRows().find(r=>r.id==='race-signal-'+id);
 row('left').onClick();assert.equal(row('left').value,'On');row('right').onAdjust();assert.equal(row('left').value,'Off');assert.equal(row('right').value,'On');
 row('hazards').onClick();assert.equal(e.playtestSession.turnSignals.mode,'hazards');row('hazards').onClick();assert.equal(e.playtestSession.turnSignals.mode,'off');
});
