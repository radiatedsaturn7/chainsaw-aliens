import {test} from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {racePerformanceStatus,drawRacePerformanceStatus} from '../../src/racing/RacePerformanceStatus.js';
test('status distinguishes recording, pending, confirmed, and failed',()=>{
 const capture={active:true,started:0,now:()=>23500,durationMs:60000};
 assert.match(racePerformanceStatus(capture).text,/REC 23s \/ 60s/);
 capture.active=false;capture.uploadState='uploading';assert.match(racePerformanceStatus(capture).text,/Uploading/);
 capture.uploadState='queued';assert.match(racePerformanceStatus(capture).text,/when paused/);
 capture.uploadState='saved';assert.match(racePerformanceStatus(capture).text,/submitted/);
 capture.uploadState='failed';assert.match(racePerformanceStatus(capture).text,/failed/);
 assert.equal(racePerformanceStatus(null),null);
});
test('badge stays within phone viewport and restores canvas state',()=>{
 const operations=[];const ctx={save:()=>operations.push('save'),restore:()=>operations.push('restore'),measureText:t=>({width:t.length*9}),fillRect:(...a)=>operations.push(a),beginPath(){},arc(){},fill(){},fillText(){}};
 drawRacePerformanceStatus(ctx,{x:10,y:20,w:240,h:180},{uploadState:'failed'});
 const [x,y,w,h]=operations[1];assert.ok(x>=10&&x+w<=250&&y>=20&&y+h<=200);assert.equal(operations.at(-1),'restore');
});
test('debug submenus preserve actions and hierarchical Back',()=>{
 const editor=new RaceEditor({});editor.playtestSession={running:true,aiRuntime:[]};editor.raceInput.pauseMenuMode='debug';
 const root=editor.getRacePauseMenuRows();assert.ok(root.length<=8);
 for(const [group,id] of [['performance','race-perf-start'],['ai','race-debug-ai-add'],['weather','race-debug-weather'],['vehicle','race-test-indicators'],['overlays','race-toggle-physics-performance']]){
  root.find(r=>r.id==='race-debug-menu-'+group).onClick();
  const rows=editor.getRacePauseMenuRows();assert.ok(rows.some(r=>r.id===id));assert.ok(rows.length<=8);
  editor.backRacePauseMenu();assert.equal(editor.raceInput.pauseMenuMode,'debug');
 }
 editor.backRacePauseMenu();assert.equal(editor.raceInput.pauseMenuMode,'settings');
 editor.backRacePauseMenu();assert.equal(editor.raceInput.pauseMenuMode,'main');
});

 test('failed status retains the server error and wraps it on a phone',()=>{
  const capture={uploadState:'failed',uploadError:'Capture exceeds 192 MiB'};
  assert.equal(racePerformanceStatus(capture).detail,capture.uploadError);
  const lines=[];const ctx={save(){},restore(){},measureText:t=>({width:t.length*7}),fillRect(){},beginPath(){},arc(){},fill(){},fillText:t=>lines.push(t)};
  drawRacePerformanceStatus(ctx,{x:0,y:0,w:240,h:180},capture);
  assert.ok(lines.join(' ').includes(capture.uploadError));
  assert.ok(lines.length>1);
 });
