// Car-scoped importer. Uses the existing production serializers without shared edits.
import fs from 'node:fs';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import path from 'node:path';
import {decodePng,buildCatalogDocuments,writeCatalogDocuments} from '../../../scripts/car-catalog-import.mjs';
import {carSheetDocument,assignCarTireSheet} from '../../../src/racing/CarGraphicImport.js';
import {normalizeTireSheetOpacity} from '../../../src/racing/CarTireTextureFit.js';
import {applyCockpitAnchors} from '../../../scripts/car-catalog-cockpit.mjs';
const dir=path.dirname(fileURLToPath(import.meta.url)),cfgPath=path.join(dir,'import.json'),cfg=JSON.parse(fs.readFileSync(cfgPath));
const hash=f=>createHash('sha256').update(fs.readFileSync(path.join(dir,f))).digest('hex');
const wheels=carSheetDocument(normalizeTireSheetOpacity(decodePng(path.join(dir,cfg.wheelsPng))));
assignCarTireSheet(cfg.car,'catalog-rampion-1987-wheels',wheels);
applyCockpitAnchors(cfg.car,cfg.cockpitCalibration);
fs.writeFileSync(cfgPath,JSON.stringify(cfg,null,2)+'\n');
const built=buildCatalogDocuments(cfg,decodePng(path.join(dir,cfg.bodyPng)),decodePng(path.join(dir,cfg.dashboardPng)),{body:hash(cfg.bodyPng),dashboard:hash(cfg.dashboardPng),wheels:hash(cfg.wheelsPng)});
built.art['catalog-rampion-1987-wheels']=wheels;
writeCatalogDocuments(path.resolve('data/server-storage/files'),built);
console.log('Imported Rampion 1987 with original silver mesh touring wheel art; browser review required.');
