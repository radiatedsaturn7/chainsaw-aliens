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
  drawRaceDrivingAssistHud(editor,ctx,bounds);assert.equal(texts.pop(),'1');
  editor.selectedRace.codriver.spoken=true;drawRaceDrivingAssistHud(editor,ctx,bounds);assert.equal(texts.length,0);
  editor.selectedRace.codriver.enabled=false;drawRaceDrivingAssistHud(editor,ctx,bounds);assert.equal(texts.length,0);
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
 row('race-pace-notes').onClick();assert.equal(row('race-pace-notes').value,'Voice');
 row('race-pace-notes').onAdjust();assert.equal(row('race-pace-notes').value,'Icons');
 row('race-pace-notes').onClick();assert.equal(row('race-pace-notes').value,'Both');
 assert.equal(editor.selectedRace.codriver.spoken,true);assert.equal(editor.selectedRace.codriver.icons,true);
 const saved=editor.serializeSelectedRaceDocument();
 assert.equal(editor.normalizeLoadedRaceDocument(saved).codriver.icons,true);
 row('race-pace-notes').onClick();assert.equal(row('race-pace-notes').value,'Off');
});
test('notes wait until 100 metres even at high speed and omit Brake prefixes',()=>{
 const calls=[{at:300,text:'Brake, Right 1',recce:{braking:true,apexSpeedMps:10}}];
 assert.equal(nextRacePaceNote(calls,180,50,500),null);assert.ok(nextRacePaceNote(calls,200,50,500));
 assert.equal(nextRacePaceNote(calls,260,8,500).text,'Right 1');
 assert.equal(calls[0].text,'Brake, Right 1');
});

test('call distance is fixed once, voice hides text, and speed changes never repeat or add Brake',()=>{
 const originalSpeech=globalThis.speechSynthesis,originalUtterance=globalThis.SpeechSynthesisUtterance;
 const spoken=[],texts=[];
 globalThis.speechSynthesis={speaking:false,speak:u=>spoken.push(u.text)};
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 try{
  const editor={...bend,selectedRace:{codriver:{enabled:true,spoken:true}},raceInput:{paused:false},selectedCar:{},getRaceCarTuning:()=>({}),getRaceSessionCar:()=>null,
   playtestSession:{worldX:0,worldZ:0,distance:200,speedMps:30,routeLength:400,routeRuntimeType:'destination',codriverCalls:[{at:300,text:'Brake, Right 6',recce:{braking:true,apexSpeedMps:20}}]}};
  const tick=()=>updateRaceDrivingAssists(editor,.1);
  tick();assert.deepEqual(spoken,['100 Right 6']);
  editor.playtestSession.distance=250;editor.playtestSession.speedMps=20;tick();
  assert.equal(spoken.length,1);assert.equal(editor.playtestSession.drivingAssists.note.displayText,'100 m · Right 6');
  const ctx=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{})});
  drawRaceDrivingAssistHud(editor,ctx,{x:0,y:0,w:800,h:600});assert.deepEqual(texts,[]);
  editor.selectedRace.codriver.icons=true;tick();drawRaceDrivingAssistHud(editor,ctx,{x:0,y:0,w:800,h:600});assert.deepEqual(texts,['6','100 m']);
  assert.equal(editor.selectedRace.codriver.spoken,true);assert.equal(spoken.length,1);
  editor.selectedRace.codriver.spoken=true;editor.playtestSession.distance=310;tick();editor.playtestSession.distance=250;tick();assert.equal(spoken.length,1);
 }finally{globalThis.speechSynthesis=originalSpeech;globalThis.SpeechSynthesisUtterance=originalUtterance;}
});

test('nearby calls speak once without units and each icon remains until its marker is passed',()=>{
 const speech=globalThis.speechSynthesis,utterance=globalThis.SpeechSynthesisUtterance,spoken=[];
 globalThis.speechSynthesis={speaking:false,speak:u=>spoken.push(u.text)};
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 try{
  const editor={...bend,selectedRace:{codriver:{enabled:true,spoken:true,icons:true}},raceInput:{paused:false},selectedCar:{},getRaceCarTuning:()=>({}),getRaceSessionCar:()=>null,
   playtestSession:{worldX:0,worldZ:0,distance:180,speedMps:50,routeLength:600,routeRuntimeType:'destination',codriverCalls:[{at:300,body:'Right 6',text:'Right 6, into Left 3',linkedAt:320},{at:320,text:'Left 3'}]}};
  const s=editor.playtestSession,tick=()=>updateRaceDrivingAssists(editor,.1);
  tick();assert.equal(spoken.length,0);assert.equal(s.drivingAssists.notes.length,0);
  s.distance=220;tick();assert.deepEqual(spoken,['80 Right 6, 100 Left 3']);assert.equal(s.drivingAssists.notes.length,2);
  s.speedMps=0;s.distance=290;tick();assert.equal(s.drivingAssists.notes.length,2);assert.equal(spoken.length,1);
  s.distance=301;tick();assert.deepEqual(s.drivingAssists.notes.map(n=>n.at),[320]);
  s.distance=321;tick();assert.equal(s.drivingAssists.note,null);
 }finally{globalThis.speechSynthesis=speech;globalThis.SpeechSynthesisUtterance=utterance;}
});
