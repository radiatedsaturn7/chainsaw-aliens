import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {projectNetworkPoint,sampleNetworkRoute} from '../../src/racing/RaceRouteNetwork.js';
import {createRaceNetworkQueryIndex} from '../../src/racing/RaceNetworkQueryIndex.js';
const stored=JSON.parse(fs.readFileSync('data/server-storage/files/races/p2loadtest/document.json'));
const {race}=stored.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(stored.data,'base64'))):stored;
const network=race.road.network,samples=sampleNetworkRoute(network,undefined,{stepM:10}),index=createRaceNetworkQueryIndex(network);
const queries=Array.from({length:2000},(_,i)=>{const p=samples[i%samples.length];return{x:p.x+Math.sin(i)*8,z:p.z+Math.cos(i)*8,heightM:p.heightM+.5};});
const results=[];let expected;
for(const indexed of [false,true]){
 const start=performance.now(),values=queries.map(p=>indexed?index.project(p):projectNetworkPoint(network,p));
 results.push({indexed,queries:queries.length,elapsedMs:performance.now()-start});
 if(!indexed)expected=values;else for(let i=0;i<values.length;i++){
  if(values[i].edgeId!==expected[i].edgeId||Math.abs(values[i].distance-expected[i].distance)>1e-8)throw Error('Projection mismatch');
 }
}
console.log(JSON.stringify(results));
