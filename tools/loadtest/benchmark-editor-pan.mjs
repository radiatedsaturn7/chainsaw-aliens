import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
const packed=JSON.parse(fs.readFileSync('data/server-storage/files/races/p1/document.json'));
const doc=packed.encoding?JSON.parse(gunzipSync(Buffer.from(packed.data,'base64'))):packed;
const e=new RaceEditor({});e.applyLoadedRaceDocument(doc,{name:'p1'});
const ctx=new Proxy({measureText:t=>({width:String(t).length*6}),createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
const stats={};
for(const key of ['getRaceRawMapPoints','getRaceMapTransform','drawRaceTopDownTileMap','drawRaceTopDownScenerySprites','drawRaceTopDownDecals']){
 const original=e[key];stats[key]={calls:0,ms:0};e[key]=function(...args){const t=performance.now();try{return original.apply(this,args);}finally{stats[key].calls++;stats[key].ms+=performance.now()-t;}};
}
const times=[];for(let i=0;i<5;i++){e.raceMapPan={x:i*10,y:i*5};const t=performance.now();e.drawRaceTopDownEditor(ctx,{x:0,y:0,w:960,h:540});times.push(performance.now()-t);}
console.log(JSON.stringify({authority:'Node CPU drawing preparation; mock canvas, no GPU',scenery:e.ensureRaceScenery().length,times,stats},null,2));
