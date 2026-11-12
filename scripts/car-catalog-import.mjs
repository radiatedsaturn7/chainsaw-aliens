#!/usr/bin/env node
/** Import reviewed original PNGs through the same car/art serializers as the editor.
 * Usage: node scripts/car-catalog-import.mjs manifest.json [project-files-root]
 * Manifest: {car:{...complete sourced car fields...}, bodyPng, dashboardPng,
 * mapping:[0,1,2,3,4,5,6,7], provenance:{sources:[{url,fields:[]}],estimates:[]}}
 * PNG paths resolve relative to the manifest. Existing documents are never replaced.
 * Requires Python Pillow. No map/world files are touched. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import RaceEditor from '../src/ui/RaceEditor.js';
import {carSheetDocument,prepareCarSheet,assignCarSheet} from '../src/racing/CarGraphicImport.js';
const hash=b=>createHash('sha256').update(b).digest('hex');
const safe=s=>typeof s==='string' && /^[a-zA-Z0-9][a-zA-Z0-9 _.-]*$/.test(s) && !s.includes('..');
export function decodePng(filename){
 const r=spawnSync('python3',['-c',`import sys,struct\nfrom PIL import Image\nim=Image.open(sys.argv[1])\nassert im.format=='PNG','PNG required'\nassert im.width*im.height<=4194304,'Image exceeds 4M pixels'\nim=im.convert('RGBA')\nsys.stdout.buffer.write(struct.pack('>II',*im.size)+im.tobytes())`,filename],{maxBuffer:18*1024*1024});
 if(r.status!==0)throw Error(`PNG decode failed: ${r.stderr?.toString() || r.error}`);
 return {width:r.stdout.readUInt32BE(0),height:r.stdout.readUInt32BE(4),data:new Uint8ClampedArray(r.stdout.subarray(8))};
}
function dashboardDocument(im){
 if(!Number.isInteger(im.width)||!Number.isInteger(im.height)||im.width<1||im.height<1||im.width*im.height>4194304||im.data.length!==im.width*im.height*4)throw Error('Invalid dashboard pixels');
 const frame=[];for(let i=0;i<im.data.length;i+=4){const [r,g,b,a]=im.data.subarray(i,i+4);frame.push(a?'#'+[r,g,b,...(a===255?[]:[a])].map(v=>v.toString(16).padStart(2,'0')).join(''):null);}
 return {kind:'actor-state-animation',width:im.width,height:im.height,fps:1,frames:[frame]};
}
export function buildCatalogDocuments(config,body,dashboard,sourceHashes={}){
 const {car,provenance,mapping}=config;
 if(!car||!safe(car.name)||!safe(car.id))throw Error('Unique safe car name/id required');
 if(!Array.isArray(provenance?.sources)||!provenance.sources.length||!Array.isArray(provenance.estimates))throw Error('Sources and explicit estimates list required');
 for(const source of provenance.sources)if(!/^https:\/\//.test(source.url||'')||!Array.isArray(source.fields)||!source.fields.length)throw Error('Each source needs HTTPS URL and attributed fields');
 for(const key of ['lengthM','widthM','wheelbaseM'])if(!(car.dimensions?.[key]>0))throw Error(`Missing dimensions.${key}`);
 for(const key of ['weightKg','powerHp','torqueLbFt'])if(!(car.tuning?.[key]>0))throw Error(`Missing tuning.${key}`);
 if(!car.transmissions||!car.transmissions[car.defaultTransmissionType])throw Error('Explicit transmission configuration required');
 if(!Array.isArray(mapping)||mapping.length!==8||new Set(mapping).size!==8||mapping.some(n=>!Number.isInteger(n)||n<0||n>7))throw Error('Explicit eight-angle mapping required');
 const bodyName=`catalog-${car.id}-body`,dashboardName=`catalog-${car.id}-dashboard`;
 const bodyDoc=carSheetDocument(body,prepareCarSheet(body));
 const dashDoc=dashboardDocument(dashboard);
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
 const clean=editor.normalizeLoadedCarDocument(structuredClone(car));
 assignCarSheet(clean,'body',bodyName,mapping,bodyDoc);
 clean.art.interior.dashboard={...clean.art.interior.dashboard,artRef:dashboardName};
 clean.art.interior.steeringWheel={...clean.art.interior.steeringWheel,artRef:'steeringwheel',frameIndex:0};
 clean.catalogProvenance={...structuredClone(provenance),sourceHashes};
 editor.applyLoadedCarDocument({kind:'race-car',car:clean},{name:car.name});
 const document=editor.serializeSelectedCarDocument();
 return {car:document,art:{[bodyName]:bodyDoc,[dashboardName]:dashDoc}};
}
export function writeCatalogDocuments(root,built){
 const entries=[['cars',built.car.car.name,built.car],...Object.entries(built.art).map(([n,d])=>['art',n,d])];
 const manifestPath=path.join(root,'manifest.json');const manifest=JSON.parse(fs.readFileSync(manifestPath));
 if(!manifest.folders?.art?.steeringwheel)throw Error('Shared steeringwheel art missing');
 // Read all current cars, including compact exports, before any writes.
 for(const rel of Object.values(manifest.folders.cars||{})){
  let d=JSON.parse(fs.readFileSync(path.join(root,rel)));
  if(d.__chainsawStorage){if(d.encoding!=='json-gzip-base64')throw Error('Unsupported existing car encoding');d=JSON.parse(gunzipSync(Buffer.from(d.data,'base64')));}
  if(d.car?.id===built.car.car.id)throw Error('Car ID already exists');
 }
 for(const [folder,name]of entries){if(fs.existsSync(path.join(root,folder,name))||manifest.folders[folder]?.[name])throw Error(`Refusing overwrite: ${folder}/${name}`);}
 const stamp=Date.now();const created=[];
 try{
  for(const [folder,name,doc]of entries){const dir=path.join(root,folder,name);fs.mkdirSync(dir);created.push(dir);
   const stored=folder==='art'?{__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:gzipSync(JSON.stringify(doc),{mtime:0}).toString('base64')}:doc;
   fs.writeFileSync(path.join(dir,'document.json'),JSON.stringify(stored)+'\n',{flag:'wx'});
   fs.writeFileSync(path.join(dir,'metadata.json'),JSON.stringify({name,folder,savedAt:stamp,version:1})+'\n',{flag:'wx'});
  }
  // Refuse concurrent manifest edits rather than discarding them.
  const current=JSON.parse(fs.readFileSync(manifestPath));if(JSON.stringify(current)!==JSON.stringify(manifest))throw Error('Manifest changed concurrently; retry import');
  for(const [folder,name]of entries){manifest.folders[folder]||={};manifest.folders[folder][name]=`${folder}/${name}/document.json`;}
  const tmp=manifestPath+`.catalog-${process.pid}.tmp`;fs.writeFileSync(tmp,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,manifestPath);
 }catch(e){for(const d of created)fs.rmSync(d,{recursive:true,force:true});throw e;}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const manifestFile=path.resolve(process.argv[2]||'');const config=JSON.parse(fs.readFileSync(manifestFile));
 const files=['bodyPng','dashboardPng'].map(k=>path.resolve(path.dirname(manifestFile),config[k]));
 const built=buildCatalogDocuments(config,...files.map(decodePng),Object.fromEntries(files.map((f,i)=>[['body','dashboard'][i],hash(fs.readFileSync(f))])));
 writeCatalogDocuments(path.resolve(process.argv[3]||'data/server-storage/files'),built);
 console.log(`Imported ${built.car.car.name}; review in Car Editor before release.`);
}
