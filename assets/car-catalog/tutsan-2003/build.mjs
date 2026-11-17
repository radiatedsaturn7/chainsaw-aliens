// Car-scoped importer. Uses the existing production serializers without shared edits.
import fs from 'node:fs';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import path from 'node:path';
import {decodePng,buildCatalogDocuments,writeCatalogDocuments} from '../../../scripts/car-catalog-import.mjs';
import {carSheetDocument,assignCarTireSheet} from '../../../src/racing/CarGraphicImport.js';
import {normalizeTireSheetOpacity} from '../../../src/racing/CarTireTextureFit.js';
import {applyCockpitAnchors} from '../../../scripts/car-catalog-cockpit.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),cfgPath=path.join(dir,'import.json'),cfg=JSON.parse(fs.readFileSync(cfgPath));
const hash=f=>createHash('sha256').update(fs.readFileSync(path.join(dir,f))).digest('hex');
const wheels=carSheetDocument(normalizeTireSheetOpacity(decodePng(path.join(dir,cfg.wheelsPng))));
assignCarTireSheet(cfg.car,'catalog-tutsan-2003-wheels',wheels);
applyCockpitAnchors(cfg.car,cfg.cockpitCalibration);
// Standard ECHO has no tachometer. Center speed/fuel live widgets only.
const gauges=cfg.car.art.gauges.interior.widgets;
cfg.car.art.gauges.interior.widgets=gauges.filter(g=>['speed','fuel'].includes(g.source));
const speed=cfg.car.art.gauges.interior.widgets.find(g=>g.source==='speed');
Object.assign(speed,{x:665/1536,y:410/1024,width:230/1536,height:48/1024,fontSize:18});
fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n');
const built=buildCatalogDocuments(cfg,decodePng(path.join(dir,cfg.bodyPng)),decodePng(path.join(dir,cfg.dashboardPng)),{body:hash(cfg.bodyPng),dashboard:hash(cfg.dashboardPng),wheels:hash(cfg.wheelsPng)});
built.art['catalog-tutsan-2003-wheels']=wheels;
if(process.argv.includes('--refresh-candidate')) {
 const {gzipSync}=await import('node:zlib');
 const root=path.resolve('data/server-storage/files');
 const existing=JSON.parse(fs.readFileSync(path.join(root,'cars/Tutsan 2003/document.json')));
 if(existing.car.id!=='tutsan-2003')throw Error('Candidate identity mismatch');
 fs.writeFileSync(path.join(root,'cars/Tutsan 2003/document.json'),JSON.stringify(built.car)+'\n');
 for(const [name,doc] of Object.entries(built.art)) {
  if(!name.startsWith('catalog-tutsan-2003-'))throw Error('Outside candidate scope');
  fs.writeFileSync(path.join(root,'art',name,'document.json'),JSON.stringify({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:gzipSync(JSON.stringify(doc),{mtime:0}).toString('base64')})+'\n');
 }
} else writeCatalogDocuments(path.resolve('data/server-storage/files'),built);
console.log('Imported Tutsan 2003 with original skinny wheel-cover art; browser review required.');
