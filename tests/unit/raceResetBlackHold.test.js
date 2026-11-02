import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
function fixture(fadeMs,paused=false,cameraView='third-person') {
 const calls=[];
 const editor={playtestSession:{edgeResetFadeMs:fadeMs},raceInput:{paused,cameraView},
  lastRaceRenderStats:{threeCarDepthSpriteCount:29,drawCalls:100},
  drawMode7Preview(){calls.push('world');throw Error('world rendering reached');},
  drawRacePauseOverlay(){calls.push('pause');},drawRaceDisplayModeFilter(){calls.push('filter');}};
 const ctx={save(){calls.push('save');},restore(){calls.push('restore');},beginPath(){},rect(){},clip(){},fillRect(...args){calls.push(['fill',this.fillStyle,...args]);}};
 return {editor,ctx,calls};
}
for(const camera of ['third-person','first-person'])test(`opaque reset hold skips hidden scene and retains overlays (${camera})`,()=>{
 for(const fade of [620,700,870]){
  const {editor,ctx,calls}=fixture(fade,true,camera);
  RaceEditor.prototype.drawRacePlaytestScreenContents.call(editor,ctx,{x:10,y:20,w:400,h:200});
  assert.deepEqual(calls,['save',['fill','#000',10,20,400,200],'pause','filter','restore']);
  assert.equal(editor.lastRaceRenderStats.resetBlackHold,true);
  assert.equal(editor.lastRaceRenderStats.threeCarDepthSpriteCount,undefined,'do not retain stale draw counts');
 }
});
test('visible fade portions still render the scene',()=>{
 for(const fade of [0,619,871,1490]){
  const {editor,ctx}=fixture(fade);
  assert.throws(()=>RaceEditor.prototype.drawRacePlaytestScreenContents.call(editor,ctx,{x:0,y:0,w:400,h:200}),/world rendering reached/);
 }
});
