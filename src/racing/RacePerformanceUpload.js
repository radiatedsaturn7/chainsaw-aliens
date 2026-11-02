import {getActiveRaceEditor} from '../game/FrameTiming.js';

// At most one deferred report per editor. No polling timer retains a departed
// session: the ordinary frame loop services this queue after pausing or exiting.
const pendingByEditor = new WeakMap();
const generationByEditor = new WeakMap();
const generationOf = editor => editor ? generationByEditor.get(editor)||0 : 0;
const cancelledError = () => {const error=new Error('Capture preparation superseded');error.name='AbortError';return error;};
function checkGeneration(editor,generation) {
 if(generationOf(editor)!==generation)throw cancelledError();
}

export function isRacePerformanceWorkDeferred(editor) {
 const game=editor?.game;
 const activeEditor=game?.state == null ? editor : getActiveRaceEditor(game)
  || (game.state==='race-editor' || game.state==='car-editor' ? editor : null);
 const session=activeEditor?.playtestSession;
 return Boolean(session?.running && !session.finishing && !session.raceResults
  && !activeEditor.raceInput?.paused);
}

export function serviceRacePerformanceWork(editor) {
 const pending=editor && pendingByEditor.get(editor);
 if(!pending || isRacePerformanceWorkDeferred(editor))return false;
 pendingByEditor.delete(editor);clearTimeout(pending.timer);pending.resolve();return true;
}

export function cancelRacePerformanceWork(editor) {
 if(editor)generationByEditor.set(editor,generationOf(editor)+1);
 const pending=editor && pendingByEditor.get(editor);
 if(!pending)return false;
 pendingByEditor.delete(editor);clearTimeout(pending.timer);
 pending.reject(cancelledError());return true;
}

function waitForRacePerformanceIdle(capture,generation) {
 const editor=capture.editor;
 checkGeneration(editor,generation);
 if(!editor)return new Promise(resolve=>setTimeout(resolve,0));
 const existing=pendingByEditor.get(editor);
 if(existing?.capture===capture)return existing.promise;
 if(existing){
  pendingByEditor.delete(editor);clearTimeout(existing.timer);existing.reject(cancelledError());
 }
 const pending={capture};
 pending.promise=new Promise((resolve,reject)=>{pending.resolve=resolve;pending.reject=reject;});
 pendingByEditor.set(editor,pending);
 // A single yield also serves calls made outside the frame loop while paused.
 // If driving continues, the frame loop will release it; there is no timer loop.
 pending.timer=setTimeout(()=>{
  if(pendingByEditor.get(editor)===pending)serviceRacePerformanceWork(editor);
 },0);
 return pending.promise;
}

export function prepareRacePerformanceReport(capture) {
 if(capture.active)return Promise.reject(new Error('Stop capture before preparing a report'));
 if(capture.reportPreparationPromise)return capture.reportPreparationPromise;
 const generation=generationOf(capture.editor);
 capture.reportPreparationPromise=(async()=>{
  do { await waitForRacePerformanceIdle(capture,generation);checkGeneration(capture.editor,generation); }
  while(isRacePerformanceWorkDeferred(capture.editor));
  if(!capture.preparedReport){
   const report=capture.report();
   capture.preparedReport={report,json:JSON.stringify(report)};
  }
  return capture.preparedReport;
 })().finally(()=>{capture.reportPreparationPromise=null;});
 return capture.reportPreparationPromise;
}

// Upload only completed captures, after timing hooks have been removed and
// report construction can no longer interrupt an active race.
export function uploadRacePerformanceCapture(capture, {fetchImpl=globalThis.fetch, timeoutMs=60000}={}) {
 if(capture.active)return Promise.reject(new Error('Stop capture before uploading'));
 if(capture.uploadPromise)return capture.uploadPromise;
 if(capture.uploadState==='saved')return Promise.resolve(capture.uploadResult);
 capture.uploadState='queued';capture.uploadError=null;
 const generation=generationOf(capture.editor);
 capture.uploadPromise=(async()=>{
  let timer;
  try{
   const prepared=await prepareRacePerformanceReport(capture);
   checkGeneration(capture.editor,generation);
   while(isRacePerformanceWorkDeferred(capture.editor)){
    await waitForRacePerformanceIdle(capture,generation);checkGeneration(capture.editor,generation);
   }
   capture.uploadState='uploading';
   const controller=new AbortController();timer=setTimeout(()=>controller.abort(),timeoutMs);
   const response=await fetchImpl('/__performance/captures',{method:'POST',headers:{'Content-Type':'application/json'},body:prepared.json,signal:controller.signal});
   if(!response.ok){
    let detail;try{detail=(await response.json()).error;}catch{}
    throw new Error(detail || `Server returned ${response.status}`);
   }
   const result=await response.json();if(!result.ok||!result.id)throw new Error('Server did not confirm saving');
   capture.uploadState='saved';capture.uploadResult=result;return result;
  }catch(error){
   capture.uploadState=error.name==='AbortError' && !timer?'cancelled':'failed';
   capture.uploadError=error.message;throw error;
  }
  finally{clearTimeout(timer);capture.uploadPromise=null;}
 })();
 return capture.uploadPromise;
}
