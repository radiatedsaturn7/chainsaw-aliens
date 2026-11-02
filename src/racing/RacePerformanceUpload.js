// Upload only completed captures, after timing hooks have been removed.
export function uploadRacePerformanceCapture(capture, {fetchImpl=globalThis.fetch, timeoutMs=60000}={}) {
 if(capture.active)return Promise.reject(new Error('Stop capture before uploading'));
 if(capture.uploadPromise)return capture.uploadPromise;
 if(capture.uploadState==='saved')return Promise.resolve(capture.uploadResult);
 capture.uploadState='uploading';capture.uploadError=null;
 capture.uploadPromise=(async()=>{
  // Yield so stopping a capture does not serialize inside a measured frame.
  await new Promise(resolve=>setTimeout(resolve,0));
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   const response=await fetchImpl('/__performance/captures',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(capture.report()),signal:controller.signal});
   if(!response.ok){
    let detail;try{detail=(await response.json()).error;}catch{}
    throw new Error(detail || `Server returned ${response.status}`);
   }
   const result=await response.json();if(!result.ok||!result.id)throw new Error('Server did not confirm saving');
   capture.uploadState='saved';capture.uploadResult=result;return result;
  }catch(error){capture.uploadState='failed';capture.uploadError=error.message;throw error;}
  finally{clearTimeout(timer);capture.uploadPromise=null;}
 })();
 return capture.uploadPromise;
}
