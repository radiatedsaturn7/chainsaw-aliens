import fs from 'node:fs';import zlib from 'node:zlib';import RaceEditor from '../../src/ui/RaceEditor.js';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
fs.mkdirSync('artifacts/campaign-quality',{recursive:true});
const root='data/server-storage/files/',manifest=read(root+'manifest.json');
const allNames=[...new Set(['catalog.json','side-races/catalog.json','raceways/catalog.json'].flatMap(p=>read('data/campaigns/america/'+p)).map(r=>r.raceRef||r.name))];
const output='artifacts/campaign-quality/progression.json',retry=process.argv.includes('--retry');
const results=retry?read(output).results:[],names=retry?results.filter(r=>r.errors.length).map(r=>r.name):allNames;
if(retry&&(results.length!==allNames.length||results.some(r=>!allNames.includes(r.name))))throw Error('Catalog changed; run a fresh progression audit.');
for(const name of names){
 const race=read(root+manifest.folders.races[name]).race,editor=new RaceEditor({deviceIsMobile:true});editor.applyLoadedRaceDocument({...race,scenery:[],sceneryDefinitions:[]});
 const result=editor.withRaceGeometryReadCache(()=>{
  const routeLength=editor.getRaceRouteLength(),routeRuntimeType=editor.getSelectedRaceRuntimeType();
  const checkpoints=editor.getRaceCheckpointDistances({routeLength}),errors=[];
  editor.playtestSession={routeLength,routeRuntimeType,checkpointDistances:checkpoints,checkpointIndex:0,passedCheckpoints:[]};
  let previous=0,maxProjectionErrorM=0;
  for(let d=Math.min(20,routeLength);;d=Math.min(routeLength,d+20)){
   const at=d===routeLength&&routeRuntimeType==='circuit'?0:d;
   const p=editor.getRaceWorldPoseAtDistance(at),projection=editor.getRaceRouteProjectionForWorldPoint({...p,y:p.elevation*12,routeDistanceHint:previous,routeHintWindowM:40});
   let error=Math.abs(projection.distance-at);if(routeRuntimeType==='circuit')error=Math.min(error,Math.abs(routeLength-error));maxProjectionErrorM=Math.max(maxProjectionErrorM,error);
   editor.updateRaceCheckpointProgress({previousDistance:previous,nextDistance:at,routeAdvance:d-previous});
   if(d>=routeLength)break;previous=d;
  }
  if(maxProjectionErrorM>40)errors.push('Route projection jumped outside its progress window');
  if(editor.playtestSession.checkpointIndex!==checkpoints.length)errors.push('Sequential course traversal did not satisfy every finish checkpoint');
  return {name,checkpoints:checkpoints.length,passed:editor.playtestSession.checkpointIndex,maxProjectionErrorM,errors};
 });if(retry)results[results.findIndex(r=>r.name===name)]=result;else results.push(result);console.log(JSON.stringify(result));
}
fs.writeFileSync('artifacts/campaign-quality/progression.json',JSON.stringify({scope:'Synthetic ordered centerline traversal using runtime projection hints and checkpoint advancement; not a driven vehicle simulation.',count:results.length,errors:results.filter(r=>r.errors.length).length,results},null,2)+'\n');
if(results.some(r=>r.errors.length))process.exitCode=1;
