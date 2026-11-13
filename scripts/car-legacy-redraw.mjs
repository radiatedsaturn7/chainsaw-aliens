import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import RaceEditor from '../src/ui/RaceEditor.js';
import {decodePng} from './car-catalog-import.mjs';
import {prepareCarSheet,carSheetDocument,assignCarSheet} from '../src/racing/CarGraphicImport.js';
import {calibrateCatalogPlacement} from './car-catalog-placement.mjs';
const root='data/server-storage/files';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
export function unchangedProjection(doc){const d=structuredClone(doc);for(const layer of Object.values(d.car.art.angleLayers)){delete layer.body;delete layer.tires.transforms;delete layer.tires.tireMode;}return d;}
const hash=d=>createHash('sha256').update(JSON.stringify(d)).digest('hex');
for(const id of ['sti-airslayer','rtg-s']){
 const config=JSON.parse(fs.readFileSync(`assets/car-catalog/${id}/redraw.json`));
 const file=`${root}/cars/${config.name}/document.json`,doc=read(file),im=decodePng(`assets/car-catalog/${id}/body.png`),prepared=prepareCarSheet(im),art=carSheetDocument(im,prepared);
 if(hash(unchangedProjection(doc))!==config.preservedDocumentSha256)throw Error('Existing car changed outside exterior: rebase and re-review');
 const car=structuredClone(doc.car),ref=`catalog-${id}-body`;
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
 assignCarSheet(car,'body',ref,config.mapping,art);
 calibrateCatalogPlacement(editor,car,art,prepared,config.mapping,config.authoredWheelAnchors,'cover');
 for(const layer of Object.values(car.art.angleLayers))layer.tires.tireMode='auto';
 doc.car=car;
 if(hash(unchangedProjection(doc))!==config.preservedDocumentSha256)throw Error('Redraw changed non-exterior fields');
 fs.writeFileSync(file,JSON.stringify(doc,null,2)+'\n');
 const dir=`${root}/art/${ref}`;fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(`${dir}/document.json`,JSON.stringify({__chainsawStorage:'compact-v1',encoding:'json-gzip-base64',data:gzipSync(JSON.stringify(art),{mtime:0}).toString('base64')})+'\n');
 fs.writeFileSync(`${dir}/metadata.json`,JSON.stringify({name:ref,folder:'art',savedAt:1794543600000,version:1})+'\n');
 const manifest=JSON.parse(fs.readFileSync(`${root}/manifest.json`));manifest.folders.art[ref]=`art/${ref}/document.json`;fs.writeFileSync(`${root}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
 console.log(`${config.name}: preserved physics/interior/gauges/camera/smoke, imported ${art.frames.length} exterior frames`);
}
