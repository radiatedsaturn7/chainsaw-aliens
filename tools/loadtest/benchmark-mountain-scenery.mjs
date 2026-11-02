import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import * as THREE from '../../src/vendorBridge/three.js';
const doc=JSON.parse(fs.readFileSync('artifacts/mountain-stress/candidate.json'));
const e=new RaceEditor({});e.applyLoadedRaceDocument(doc);e.playtestSession={worldBake:{surfaceRevision:'stress'},routeRuntimeType:'destination',routeLength:12000};
// Isolate geometry batching from terrain queries and GPU texture upload.
e.getRaceSurfaceModel=()=>({sampleWorld:()=>({elevation:0})});e.getRaceArtSpriteCanvas=()=>null;
const material=new THREE.MeshBasicMaterial();e.getRaceThreeDoodadMaterial=()=>material;
const renderer={scene:new THREE.Scene()};const at=performance.now();e.withRaceGeometryReadCache(()=>e.addRaceThreeDoodads(renderer));const buildMs=performance.now()-at;
const rows=[];for(let i=0;i<120;i++){const t=performance.now();e.withRaceGeometryReadCache(()=>e.addRaceThreeDoodads(renderer));rows.push(performance.now()-t);}
rows.sort((a,b)=>a-b);
const meshes=renderer.dynamicDoodadGroup.children;
const result={authority:'CPU geometry batching with flat ground; no GPU',placements:doc.race.scenery.length,meshes:meshes.length,retainedTriangles:meshes.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0),buildMs,warmP50Ms:rows[60],warmP95Ms:rows[114]};
console.log(JSON.stringify(result));fs.writeFileSync('artifacts/mountain-stress/scenery.json',JSON.stringify(result,null,2));
