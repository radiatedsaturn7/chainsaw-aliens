import fs from 'node:fs';import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';import * as THREE from '../../src/vendorBridge/three.js';
import {prepareManagedRaceScenery} from '../../src/racing/RaceVisibleScenery.js';
const root='data/server-storage/files/';const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const manifest=read(root+'manifest.json'),name='Providence, RI — Landmark Run',e=new RaceEditor({});e.applyLoadedRaceDocument(read(root+manifest.folders.races[name]).race);
e.playtestSession={routeRuntimeType:'destination',routeLength:7348,elapsedMs:0,worldBake:{surfaceRevision:'benchmark'},removedSceneryIds:[],flattenedSceneryIds:[]};
let groundSamples=0;e.getRaceSurfaceModel=()=>({sampleWorld:()=>{groundSamples++;return {elevation:0};}});
const art=new Map();let changedRef;
for(const p of e.selectedRace.scenery){const ref=e.getRaceDoodadForScenery(p).artRef;art.set(ref,{__raceArtCacheKey:ref+':1'});if(p.doodadRef==='roadside-streetlight')changedRef=ref;}
e.getRaceArtSpriteCanvas=ref=>art.get(ref);const material=new THREE.MeshBasicMaterial();e.getRaceThreeDoodadMaterial=()=>material;e.addRaceThreeDoodadHitboxMeshes=()=>{};
const renderer={scene:new THREE.Scene()};prepareManagedRaceScenery(e.selectedRace.scenery,e.playtestSession);
const run=()=>{const stats={},start=performance.now();groundSamples=0;e.addRaceThreeDoodads(renderer,{stats});return {ms:performance.now()-start,groundSamples,...stats};};
const cold=run(),warm=[];for(let i=0;i<120;i++)warm.push(run().ms);warm.sort((a,b)=>a-b);
art.set(changedRef,{__raceArtCacheKey:changedRef+':2'});const refresh=run();
console.log(JSON.stringify({authority:'Node CPU geometry/scene invalidation only; flat terrain, mocked artwork/materials, no GPU or phone FPS',race:name,placements:e.selectedRace.scenery.length,changedRef,cold,warmP50Ms:warm[60],warmP95Ms:warm[114],refresh},null,2));
