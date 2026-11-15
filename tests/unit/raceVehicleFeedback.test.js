import test from 'node:test';
import assert from 'node:assert/strict';
import {updateVehicleFeedback,vehicleFeedbackRows} from '../../src/racing/RaceVehicleFeedback.js';
import {updateCodriverEvents} from '../../src/racing/RaceCodriver.js';
const controls={throttle:1,brake:0,handbrake:0};
function fixture(){return {bodyLongitudinalSpeedMps:3,bodyLateralSpeedMps:0,powertrainState:{gear:1,clutchCoupling:.35,engineRpm:2200,shiftTimeRemainingSeconds:0},contactPatches:Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{validTreadContact:true,normalLoadN:3000,driveTorqueNm:300,rawSlipRatio:.02,hardStopForceN:0,overtravelM:0}]))};}
function advance(session,physics,seconds=4,c=controls){for(let t=0;t<seconds;t+=.1)updateVehicleFeedback(session,physics,c,.1);return session.vehicleFeedback;}
test('clutch diagnosis requires sustained loaded slip; normal launches and missing controls are silent',()=>{
 const s={},p=fixture();advance(s,p,.8);assert.equal(s.vehicleFeedback.current,null);
 p.powertrainState.clutchCoupling=1;advance(s,p);assert.equal(s.vehicleFeedback.current,null);
 p.powertrainState.clutchCoupling=.35;advance(s,p);assert.equal(s.vehicleFeedback.current.id,'clutch');
 advance(s,p,1,null);assert.equal(s.vehicleFeedback.current,null);
});
test('wheelspin excludes airborne wheels, braking and intentional sideways slides',()=>{
 for(const kind of ['normal','airborne','slide','braking']){
  const s={},p=fixture();for(const w of Object.values(p.contactPatches)){w.rawSlipRatio=1;if(kind==='airborne')w.validTreadContact=false;}
  if(kind==='slide')p.bodyLateralSpeedMps=4;
  advance(s,p,3,kind==='braking'?{...controls,handbrake:1}:controls);
  assert.equal(s.vehicleFeedback.current?.id,kind==='normal'?'wheelspin':undefined);
 }
});
test('heat, actual brake loss and sustained hard stops produce specific advice',()=>{
 for(const id of ['heat','brakes','suspension']){
  const s={},p=fixture();p.powertrainState.clutchCoupling=1;
  p.mechanical={config:{enabled:true},engineRunning:true,coolantTemperatureC:id==='heat'?116:90,tires:{fl:{brakeTemperatureC:600}},effects:{brakes:{fl:id==='brakes'?.6:1}}};
  if(id==='suspension')Object.assign(p.contactPatches.fl,{hardStopForceN:2000,overtravelM:.02});
  advance(s,p);assert.equal(s.vehicleFeedback.current.id,id);
  assert.match(vehicleFeedbackRows(s).map(r=>r.label).join(' '),/\./);
  assert.ok(vehicleFeedbackRows(s).length<=7);
  assert.ok(vehicleFeedbackRows(s).every(r=>r.label.length<=40));
 }
});
test('advice cooldown, pause and recovery prevent repeated or stale calls',()=>{
 const s={},p=fixture();advance(s,p);assert.ok(s.vehicleFeedback.pending);
 s.vehicleFeedback.pending=null;advance(s,p,10);assert.equal(s.vehicleFeedback.pending,null);
 updateVehicleFeedback(s,p,controls,1,{active:false});assert.equal(s.vehicleFeedback.pending,null);
 p.powertrainState.clutchCoupling=1;advance(s,p);assert.equal(s.vehicleFeedback.current,null);
});
test('road calls take precedence and disabled voice never speaks vehicle advice',()=>{
 const original=[globalThis.speechSynthesis,globalThis.SpeechSynthesisUtterance];const spoken=[];
 globalThis.speechSynthesis={speak:u=>spoken.push(u.text),cancel(){},speaking:false,pending:false};globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 try{
  const s={speedMps:10},p=fixture();advance(s,p);const state={};
  const opts={enabled:true,paused:false,intro:false,active:true,roadDue:true,nextRemaining:20};
  updateCodriverEvents(state,s,.1,opts);assert.equal(spoken.length,0);
  updateCodriverEvents(state,s,.1,{...opts,roadDue:false,nextRemaining:1000});assert.equal(spoken.length,1);
  const muted={};advance(muted,p);updateCodriverEvents({},muted,.1,{...opts,enabled:false});assert.equal(spoken.length,1);
 }finally{[globalThis.speechSynthesis,globalThis.SpeechSynthesisUtterance]=original;}
});


test('feedback submenu fits eight rows and Back restores its selection',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const e=new RaceEditor({items:{},radio:{available:true}});e.playtestSession={};
 e.raceInput.pauseMenuMode='main';assert.ok(e.getRacePauseMenuRows().length<=8);
 e.getRacePauseMenuRows().find(r=>r.id==='race-vehicle-feedback').onClick();
 assert.ok(e.getRacePauseMenuRows().length<=8);
 e.backRacePauseMenu();assert.equal(e.raceInput.pauseMenuMode,'main');
 assert.equal(e.getRacePauseMenuRows()[e.raceInput.pauseMenuIndex].id,'race-vehicle-feedback');
});


test('overheating supersedes lower-priority advice and missing physics cannot invent wheel faults',()=>{
 const session={},physics=fixture();advance(session,physics);
 assert.equal(session.vehicleFeedback.current.id,'clutch');
 physics.mechanical={config:{enabled:true},engineRunning:true,coolantTemperatureC:120};
 advance(session,physics);assert.equal(session.vehicleFeedback.current.id,'heat');
 const missing={};advance(missing,null);assert.equal(missing.vehicleFeedback.current,null);
});
