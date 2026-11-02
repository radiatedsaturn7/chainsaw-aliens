import test from 'node:test';
import assert from 'node:assert/strict';
import {requestTrackImport,importRealTrack} from '../../src/ui/RaceTrackImport.js';

const data={search:{places:[{id:'p',name:'Venue'}]},layouts:{layouts:[{id:'l',name:'Oval',points:[{x:0,y:0}]}]},build:{race:{name:'Oval'},warnings:['Banking is flat'],attribution:'OSM'}};
function harness({cancelAt=null,fail=null}={}){
 const events=[],editor={mode:'race',selectedRace:{id:'old'},game:{input:{reset(){}}},applyImageRace(race,source){events.push(['apply',race,source]);return true;}};
 const form=async(title,fields,options)=>{
  if(options?.pending)return new Promise(resolve=>options.signal.addEventListener('abort',()=>resolve(null),{once:true}));
  events.push(title);if(title===cancelAt)return null;
  return title==='Import Real Track'?{name:'NH Motor Speedway'}:title==='Choose venue'?{place:'p'}:title==='Choose circuit layout'?{layout:'l',width:12,elevation:true,reverse:false}:{};
 };
 const request=async body=>{events.push(body.action);if(body.action===fail)throw Error('Provider unavailable');return data[body.action];};
 return {editor,events,form,request};
}
test('real track import selects venue and layout before applying a new editable document',async()=>{
 const h=harness();assert.equal(await importRealTrack(h.editor,h),true);
 assert.deepEqual(h.events.filter(Array.isArray),[['apply',data.build.race,'OpenStreetMap']]);
 assert.equal(h.editor.realTrackImportOpen,false);
});
test('cancelling the reviewed import leaves the race untouched',async()=>{
 const h=harness({cancelAt:'Track ready'});assert.equal(await importRealTrack(h.editor,h),false);
 assert.equal(h.events.some(Array.isArray),false);assert.equal(h.editor.selectedRace.id,'old');
});
test('provider failures remain visible and do not replace current work',async()=>{
 const h=harness({fail:'layouts'});assert.equal(await importRealTrack(h.editor,h),false);
 assert.ok(h.events.includes('Track import failed'));assert.equal(h.events.some(Array.isArray),false);
});
test('static hosting and upstream errors report actionable failures',async()=>{
 await assert.rejects(requestTrackImport({},{fetcher:async()=>({json:async()=>{throw Error();}})}),/Python server/);
 await assert.rejects(requestTrackImport({},{fetcher:async()=>({ok:false,json:async()=>({error:'No circuit found'})})}),/No circuit found/);
});
test('cancel during a request aborts it and cannot apply late data',async()=>{
 const h=harness();h.form=async(title,fields,options)=>options?.pending?null:{name:'NHMS'};
 h.request=async(body,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(Error('Cancelled'),{name:'AbortError'})),{once:true}));
 assert.equal(await importRealTrack(h.editor,h),false);assert.equal(h.events.some(Array.isArray),false);
});

test('temporary map outage can retry the same step without repeating name or venue selection',async()=>{
 const h=harness(),original=h.request;let attempts=0;
 h.request=async body=>{
  if(body.action==='layouts'&&attempts++===0)throw Error('Map/elevation service unavailable. HTTP 502');
  return original(body);
 };
 assert.equal(await importRealTrack(h.editor,h),true);
 assert.equal(attempts,2);
 assert.equal(h.events.filter(x=>x==='Import Real Track').length,1);
 assert.equal(h.events.filter(x=>x==='Choose venue').length,1);
 assert.ok(h.events.includes('Track service unavailable'));
});

test('layout labels expose kilometres and miles',async()=>{
 const {trackLayoutLabel}=await import('../../src/ui/RaceTrackImport.js');
 assert.equal(trackLayoutLabel({name:'Lime Rock Park',lengthM:2400}),'Lime Rock Park — 2.40 km / 1.49 mi');
});
test('import all builds each layout before changing the project',async()=>{
 const h=harness(),originalForm=h.form,originalRequest=h.request;
 h.form=async(title,fields,options)=>{const r=await originalForm(title,fields,options);return title==='Choose circuit layout'?{...r,importAll:true}:r;};
 h.request=async body=>{
  if(body.action==='layouts')return {layouts:[{id:'a',name:'Main',lengthM:2400},{id:'b',name:'Autocross',lengthM:750}]};
  if(body.action==='build'){assert.equal(h.events.some(Array.isArray),false);return {...data.build,race:{name:body.layoutId}};}
  return originalRequest(body);
 };
 assert.equal(await importRealTrack(h.editor,h),true);
 assert.deepEqual(h.events.filter(Array.isArray).map(e=>e[1].name),['a','b']);
});
test('cancelling a batch at review adds none of its races',async()=>{
 const h=harness({cancelAt:'Track ready'}),originalForm=h.form;
 h.form=async(title,fields,options)=>{const r=await originalForm(title,fields,options);return title==='Choose circuit layout'?{...r,importAll:true}:r;};
 assert.equal(await importRealTrack(h.editor,h),false);assert.equal(h.events.some(Array.isArray),false);
});
