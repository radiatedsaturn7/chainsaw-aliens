import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRaceDrivingRoute, nextRacePaceNote, racePaceNotes, updateWrongWay, drivingSpeedAdvice, updateRaceDrivingAssists} from '../../src/racing/RaceDrivingAssists.js';
import {buildRaceAiRoadPlan} from '../../src/racing/RaceAiRoadPlan.js';
import {drawRaceDrivingAssistHud, drawRaceDrivingLine} from '../../src/racing/RaceDrivingGuideRenderer.js';

const editorFor = yaw => ({getSelectedRaceRuntimeType:()=> 'destination',getRaceRouteLength:()=>400,
  getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:yaw(d),elevation:0}),getRaceRoadHalfWidthWorld:()=>5});
const bend = editorFor(d => d < 160 ? 0 : d < 220 ? (d-160)/35 : 60/35);
test('geometry analysis separates left/right turns, ignores straights and preserves manual notes',()=>{
  assert.deepEqual(analyzeRaceDrivingRoute(editorFor(()=>0)),[]);
  const right = analyzeRaceDrivingRoute(bend);
  assert.equal(right.length,1); assert.match(right[0].text,/Left 2/);
  const left = analyzeRaceDrivingRoute(editorFor(d=>-bend.getRaceWorldPoseAtDistance(d).yaw));
  assert.match(left[0].text,/Right 2/);
  const manual={at:right[0].at,text:'Caution bridge'};
  assert.deepEqual(racePaceNotes({codriver:{calls:[manual,...right]}},right),[manual]);
});
test('braking begins before the corner and adjusts for poor grip and damaged brakes',()=>{
  const plan=buildRaceAiRoadPlan(bend,{routeLength:400,runtimeType:'destination'});
  assert.equal(drivingSpeedAdvice(plan,120,30).action,'BRAKE');
  assert.equal(drivingSpeedAdvice(plan,0,5).action,'ACCELERATE');
  const dry=drivingSpeedAdvice(plan,120,20);
  assert.ok(drivingSpeedAdvice(plan,120,20,.25).target<dry.target);
  assert.ok(drivingSpeedAdvice(plan,120,20,1,{},.3).target<dry.target);
  assert.equal(drivingSpeedAdvice(plan,120,20,1,{},0).action,'BRAKE');
});
test('wrong way requires sustained backwards travel; pause, stop and reset clear it',()=>{
  const state={};let z=100;
  const tick=(velocity,active=true)=>{z+=velocity*.1;updateWrongWay(state,{x:0,z,yaw:0,dt:.1,active});};
  for(let i=0;i<20;i++)tick(0);assert.equal(state.wrongWay,false);
  for(let i=0;i<4;i++)tick(-10);assert.equal(state.wrongWay,false);
  for(let i=0;i<7;i++)tick(-10);assert.equal(state.wrongWay,true);
  for(let i=0;i<10;i++)tick(10);assert.equal(state.wrongWay,false);
  for(let i=0;i<12;i++)tick(-10);assert.equal(state.wrongWay,true);
  tick(-10,false);assert.equal(state.wrongWay,false);
  z+=200;tick(-10);assert.equal(state.wrongWay,false);
});
test('pace notes respect lookahead, finish and circuit seam without replaying stale calls',()=>{
  const calls=[{at:20,text:'Left 2'},{at:300,text:'Right 3'}];
  assert.equal(nextRacePaceNote(calls,100,10,400),null);
  assert.equal(nextRacePaceNote(calls,280,10,400).text,'Right 3');
  assert.equal(nextRacePaceNote(calls,350,10,400),null);
  assert.equal(nextRacePaceNote(calls,390,10,400,true).text,'Left 2');
});
test('settings save and load; saving regenerates notes after a route edit',async()=>{
  const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
  const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
  // Keep the editor save/load path real, with a controlled small geometry fixture.
  Object.assign(editor,bend);
  editor.selectedRace.codriver={enabled:true,spoken:false,calls:[]};
  editor.selectedRace.drivingGuide={line:false};
  const saved=editor.serializeSelectedRaceDocument();
  assert.equal(saved.race.codriver.calls.length,1);
  const loaded=editor.normalizeLoadedRaceDocument(saved);
  assert.equal(loaded.codriver.enabled,true);assert.equal(loaded.drivingGuide.line,false);
  editor.getRaceWorldPoseAtDistance=d=>({x:0,z:d,yaw:0,elevation:0});
  editor.selectedRace.codriver.calls=saved.race.codriver.calls;
  assert.deepEqual(editor.serializeSelectedRaceDocument().race.codriver.calls,[]);
  const ids=editor.getMenuItems('settings').map(item=>item.id);
  assert.ok(ids.includes('race-driving-guide'));assert.ok(ids.includes('race-pace-notes'));
});
test('HUD blinks wrong-way, honors note toggle and keeps projected arrows finite',()=>{
  const texts=[],lines=[];
  const ctx=new Proxy({fillText:t=>texts.push(t),lineTo:(x,y)=>lines.push([x,y])},{get:(o,k)=>o[k]||(()=>{})});
  const plan=buildRaceAiRoadPlan(bend,{routeLength:400,runtimeType:'destination'});
  const editor={...bend,selectedRace:{codriver:{enabled:true}},
    playtestSession:{routeLength:400,routeRuntimeType:'destination',distance:0,speedMps:10,elapsedMs:0,
      drivingAssists:{active:true,plan,note:{text:'Right 1',remaining:100},wrongWay:true}},
    lastRaceRenderCamera:{camera:{},cameraYaw:0},getRaceRightVector:()=>({x:1,z:0}),
    getRaceRoadSurfaceProfileAtDistance:()=>({elevation:0}),
    projectRaceWorldPointToCamera:p=>({visible:true,screenX:180+p.x,screenY:700-p.z})};
  const bounds={x:0,y:0,w:390,h:844};
  drawRaceDrivingAssistHud(editor,ctx,bounds);assert.equal(texts.pop(),'WRONG WAY');
  editor.playtestSession.elapsedMs=500;drawRaceDrivingAssistHud(editor,ctx,bounds);assert.equal(texts.length,0);
  editor.playtestSession.drivingAssists.wrongWay=false;
  drawRaceDrivingAssistHud(editor,ctx,bounds);assert.match(texts.pop(),/Right 1/);
  editor.selectedRace.codriver.enabled=false;drawRaceDrivingAssistHud(editor,ctx,bounds);assert.match(texts.pop(),/Right 1/);
  drawRaceDrivingLine(editor,ctx,bounds);assert.ok(lines.length>4);assert.ok(lines.flat().every(Number.isFinite));
  lines.length=0;editor.selectedRace.drivingGuide={line:false};drawRaceDrivingLine(editor,ctx,bounds);assert.equal(lines.length,0);
});
test('solo runtime loads visible notes and suppresses them while paused or at countdown',()=>{
  const editor={...bend,selectedRace:{codriver:{enabled:true}},raceInput:{paused:false},selectedCar:{},
    getRaceCarTuning:()=>({}),getRaceSessionCar:()=>null,
    playtestSession:{worldX:0,worldZ:0,distance:120,speedMps:15,routeLength:400,routeRuntimeType:'destination',codriverCalls:analyzeRaceDrivingRoute(bend)}};
  updateRaceDrivingAssists(editor,.1);assert.match(editor.playtestSession.drivingAssists.note.text,/Left/);
  editor.raceInput.paused=true;updateRaceDrivingAssists(editor,.1);assert.equal(editor.playtestSession.drivingAssists.note,null);
  editor.raceInput.paused=false;editor.playtestSession.countdownRemainingMs=1000;updateRaceDrivingAssists(editor,.1);
  assert.equal(editor.playtestSession.drivingAssists.active,false);
});
test('real solo startup populates notes instead of discarding the saved call list',async()=>{
  const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
  const editor=new RaceEditor({});
  editor.preloadSelectedRaceArtRefs=()=>{};editor.prewarmRacePlaytestRenderResources=()=>{};
  editor.selectedRace.codriver={enabled:true,calls:[{at:20,text:'Caution bridge'}]};
  editor.selectedRace.aiDrivers=[];
  editor.startPlaytest(editor.selectedCar.id,{hydrateCars:false});
  assert.ok(editor.playtestSession.codriverCalls.some(c=>c.text==='Caution bridge'));
  assert.ok(editor.playtestSession.drivingAssists.plan);
  editor.playtestSession.tireSlip={gripFactor:.3};
  updateRaceDrivingAssists(editor,.016);
  assert.equal(editor.playtestSession.drivingAssists.grip,.3);
});
test('pause settings toggle the same guide and pace-note preferences used by the HUD',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=new RaceEditor({});
 editor.raceInput.pauseMenuMode='settings';
 editor.selectedRace.drivingGuide={line:true};editor.selectedRace.codriver={enabled:false};
 const row=id=>editor.getRacePauseMenuRows().find(r=>r.id===id);
 row('race-driving-guide').onClick();assert.equal(editor.selectedRace.drivingGuide.line,false);
 row('race-pace-notes').onClick();assert.equal(row('race-pace-notes').value,'Text');
 row('race-pace-notes').onAdjust();assert.equal(row('race-pace-notes').value,'Voice');
 row('race-pace-notes').onClick();assert.equal(row('race-pace-notes').value,'Off');
});
test('note lead time includes braking distance and suppresses unnecessary brake commands at low speed',()=>{
 const calls=[{at:300,text:'Brake, Right 1',recce:{braking:true,apexSpeedMps:10}}];
 assert.ok(nextRacePaceNote(calls,0,50,500));
 assert.equal(nextRacePaceNote(calls,260,8,500).text,'Right 1');
 assert.equal(calls[0].text,'Brake, Right 1');
});
