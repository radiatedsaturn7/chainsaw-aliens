// Alternating, same-process lookup benchmark on the saved mountain fixture.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
let doc=JSON.parse(fs.readFileSync('artifacts/mountain-stress/candidate.json'));
if(doc.__chainsawStorage) doc=JSON.parse(gunzipSync(Buffer.from(doc.data,'base64')));
const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}},{mode:'race'});
editor.applyLoadedRaceDocument(doc,{name:doc.race.name});
const options={runtimeType:editor.getSelectedRaceRuntimeType(),routeLength:editor.getRaceRouteLength()};
const points=Array.from({length:300},(_,i)=>(i+.25)/300*options.routeLength);
let rawCalls=0;
const original=editor.getRaceRawGroundElevationAtWorldPoint.bind(editor);
editor.getRaceRawGroundElevationAtWorldPoint=(...args)=>{rawCalls++;return original(...args);};
const read=(kind,d)=>kind==='full'?editor.getRaceSurfaceSectionAtDistance(d,options).metrics:editor.getRaceSurfaceMetricsAtDistance(d,options);
for(const d of points) assert.deepEqual(read('light',d),read('full',d));
const rows=[];
for(let round=0;round<6;round++) for(const kind of round%2?['light','full']:['full','light']) {
 rawCalls=0;let checksum=0;
 const started=performance.now();
 editor.withRaceGeometryReadCache(()=>{for(const d of points) checksum+=read(kind,d).roadEnd;});
 rows.push({round,kind,ms:performance.now()-started,rawCalls,checksum,queries:points.length});
}
const result={routeLength:options.routeLength,identicalMetrics:true,rows};
fs.writeFileSync('artifacts/mountain-stress/road-metrics-lookup.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
