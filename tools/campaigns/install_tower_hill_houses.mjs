import fs from 'node:fs';
import zlib from 'node:zlib';
import {placeTowerHillHouses,loadTowerHillHouseDefinitions} from './tower_hill_houses.mjs';
const root='data/server-storage/files';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(d.data,'base64'))):d;};
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const savedAt=Date.now(),manifest=read(`${root}/manifest.json`);
for(const [i,widthM] of [13.5,17,18,16].entries()){
 const ref=`house${i+1}`,art=read(`${root}/art/${ref}/document.json`),heightM=widthM*art.height/art.width;
 let bottom=0;
 for(const [j,pixel] of art.frames[0].entries())if(pixel&&(pixel.length===7||parseInt(pixel.slice(7,9),16)>32))bottom=Math.floor(j/art.width);
 const groundOffsetM=(art.height-1-bottom)/art.height*heightM;
 const doodad={id:ref,name:ref,artRef:ref,isFence:false,itemType:'scenery',unlockTrackId:'',model:null,widthM,heightM,groundOffsetM,hitboxWidthM:widthM*.8,hitboxHeightM:heightM*.82,weightKg:100000,defaultRule:{minSpeedMph:0,behavior:'collide',speedDrainPercent:90,damage:{panels:20,suspension:10,engine:6}},rules:[]};
 const dir=`${root}/doodads/${ref}`;fs.mkdirSync(dir,{recursive:true});
 write(`${dir}/document.json`,{schemaVersion:1,kind:'race-doodad',savedAt,selectedDoodadId:ref,doodad});
 write(`${dir}/metadata.json`,{name:ref,folder:'doodads',savedAt,version:1});manifest.folders.doodads[ref]=`doodads/${ref}/document.json`;
}
const path=`${root}/races/Tower Hill Road/document.json`,doc=read(path),before=doc.race.scenery.length;
const houses=placeTowerHillHouses(doc.race,loadTowerHillHouseDefinitions());doc.savedAt=savedAt;
write(path,{__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:zlib.gzipSync(Buffer.from(JSON.stringify(doc)),{level:9}).toString('base64')});
const metaPath=`${root}/races/Tower Hill Road/metadata.json`;write(metaPath,{...read(metaPath),savedAt});write(`${root}/manifest.json`,manifest);
console.log(JSON.stringify({houses:houses.length,clearedVegetation:before+houses.length-doc.race.scenery.length,scenery:doc.race.scenery.length}));
