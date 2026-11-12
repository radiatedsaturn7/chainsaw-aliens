import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {buildCatalogDocuments,writeCatalogDocuments,decodePng} from '../../scripts/car-catalog-import.mjs';
import {createDefaultCar} from '../../src/racing/raceData.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
function fixture(){
 const width=80,height=40,data=new Uint8ClampedArray(width*height*4);
 for(let n=0;n<8;n++)for(let y=2;y<10;y++)for(let x=2;x<12;x++)data.set([120,30,90,255],(((n>>2)*20+y)*width+(n%4)*20+x)*4);
 const car=createDefaultCar();car.id='test-catalog';car.name='Test Catalog';
 const config={car,mapping:[0,7,2,3,4,5,6,1],provenance:{sources:[{url:'https://example.org/spec',fields:['tuning.weightKg']}],estimates:['Test fixture only']}};
 return {config,body:{width,height,data},dash:{width:2,height:1,data:new Uint8ClampedArray([1,2,3,255,0,0,0,0])}};
}
test('catalog uses editor serialization and preserves original eight angles and provenance',()=>{
 const {config,body,dash}=fixture();const built=buildCatalogDocuments(config,body,dash,{body:'abc'});
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
 editor.applyLoadedCarDocument(built.car,{name:config.car.name});const roundtrip=editor.serializeSelectedCarDocument();
 assert.equal(roundtrip.car.id,'test-catalog');assert.equal(roundtrip.car.art.angleLayers.frontRight.body.frameIndex,7);
 assert.equal(roundtrip.car.art.interior.steeringWheel.artRef,'steeringwheel');
 assert.deepEqual(roundtrip.car.catalogProvenance,built.car.car.catalogProvenance);
 assert.equal(built.art['catalog-test-catalog-body'].frames.length,8);
 assert.deepEqual(built.art['catalog-test-catalog-dashboard'].frames[0],['#010203',null]);
});
test('requires explicit source data and mappings',()=>{
 const {config,body,dash}=fixture();assert.throws(()=>buildCatalogDocuments({...config,mapping:[]},body,dash),/mapping/);
 assert.throws(()=>buildCatalogDocuments({...config,provenance:{}},body,dash),/Sources/);
 assert.throws(()=>buildCatalogDocuments({...config,car:{...config.car,name:'../bad'}},body,dash),/safe/);
});
test('writes compact art/metadata/manifest, refuses duplicate without overwriting',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'car-catalog-test-'));
 try{
  fs.mkdirSync(path.join(root,'cars'));fs.mkdirSync(path.join(root,'art'));
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({folders:{cars:{},art:{steeringwheel:'art/steeringwheel/document.json'}}}));
  const {config,body,dash}=fixture();const built=buildCatalogDocuments(config,body,dash);
  writeCatalogDocuments(root,built);
  const before=fs.readFileSync(path.join(root,'manifest.json'),'utf8');
  assert.throws(()=>writeCatalogDocuments(root,built),/already exists|overwrite/);
  assert.equal(fs.readFileSync(path.join(root,'manifest.json'),'utf8'),before);
  const d=JSON.parse(fs.readFileSync(path.join(root,'art/catalog-test-catalog-body/document.json')));
  assert.equal(JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))).frames.length,8);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('Pillow PNG adapter preserves RGBA and rejects non-PNG inputs',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'car-png-test-'));
 try{
  const png=path.join(root,'test.png');
  const r=spawnSync('python3',['-c',"from PIL import Image;import sys;Image.new('RGBA',(2,1),(12,34,56,78)).save(sys.argv[1])",png]);
  assert.equal(r.status,0);const image=decodePng(png);assert.equal(image.width,2);assert.equal(image.height,1);assert.deepEqual([...image.data.slice(0,4)],[12,34,56,78]);
  fs.writeFileSync(path.join(root,'bad.png'),'not an image');assert.throws(()=>decodePng(path.join(root,'bad.png')),/decode failed/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('Kestrel pilot retains sourced geometry, ratios, torque and power anchors',()=>{
 const c=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/2018 Kestrel 660/document.json',import.meta.url))).car;
 const b=c.tuning.physics.bodyProfile;
 assert.equal(b.overallHeightM,1.18);assert.equal(b.overallLengthM,3.395);assert.equal(b.overallWidthM,1.475);
 assert.ok(Math.abs(b.frontAxleDistanceFromCgM+b.rearAxleDistanceFromCgM-2.285)<1e-9);
 assert.ok(b.trackWidthM<c.dimensions.widthM);assert.equal(b.wheelRadiusM,c.tuning.wheelRadiusM);
 assert.equal(c.transmissions.manual.reverseRatio,3.615);assert.equal(c.transmissions.manual.gearFinalDrive,4.875);
 assert.equal(c.tuning.weightKg,830);assert.equal(c.tuning.powerHp,63);
 assert.ok(c.tuning.engineCurve.torquePoints.some(p=>p.rpm===6000&&p.torqueLbFt===55));
});

for(const [id,name] of [['kestrel-660-2018','2018 Kestrel 660']])
test(`${name} measured wheel wells coincide with production rig after editor roundtrip`,()=>{
 const config=JSON.parse(fs.readFileSync(new URL(`../../assets/car-catalog/${id}/import.json`,import.meta.url)));
 const document=JSON.parse(fs.readFileSync(new URL(`../../data/server-storage/files/cars/${name}/document.json`,import.meta.url)));
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
 editor.applyLoadedCarDocument(document,{name:document.car.name});
 const car=editor.serializeSelectedCarDocument().car;
 const stored=JSON.parse(fs.readFileSync(new URL(`../../data/server-storage/files/art/catalog-${id}-body/document.json`,import.meta.url)));
 const art=JSON.parse(gunzipSync(Buffer.from(stored.data,'base64')));
 const source=decodePng(new URL(`../../assets/car-catalog/${id}/body.png`,import.meta.url).pathname);
 // Use the exact import layout, including differently centered crop rectangles.
 return import('../../src/racing/CarGraphicImport.js').then(({prepareCarSheet})=>{
  const prepared=prepareCarSheet(source);
  const visibleWidth=slot=>{const entry=car.art.angleLayers[slot].body;return 100*entry.transforms.bodyScaleX*art.frameBounds[entry.frameIndex].width/art.width;};
  for(const [diagonal,a,b] of [['frontRight','front','right'],['frontLeft','front','left'],['rearRight','rear','right'],['rearLeft','rear','left']]) {
   const expected=(visibleWidth(a)+visibleWidth(b))/Math.SQRT2;
   assert.ok(Math.abs(visibleWidth(diagonal)-expected)<.01,`${diagonal}: perspective must not inflate overall vehicle size`);
  }

  for(const [i,slot]of ['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'].entries()){
   const body=car.art.angleLayers[slot].body.transforms,tires=car.art.angleLayers[slot].tires.transforms;
   const neutral=structuredClone(car);neutral.art.tireScaleX=1;neutral.art.tireScaleY=1;
   const rig=editor.getRaceSpriteWheelRig({car:neutral,viewSlot:slot,bodyBaseWidth:100});
   const f=config.mapping[i],crop=prepared.crops[f],bounds=art.frameBounds[f];
   for(const p of config.authoredWheelAnchors[slot]){
    const x=(p.x-crop.x+bounds.x)/art.width,y=(p.y-crop.y+bounds.y)/art.height;
    const bx=(x-.5)*100*body.bodyScaleX+body.bodyOffsetX*16;
    const by=(y-.58)*74*body.bodyScaleY+body.bodyOffsetY*74*.22;
    const axle=p.wheel.startsWith('f')?'front':'rear',hub=rig.wheels[p.wheel];
    const hx=hub.x+tires[axle+'TireOffsetX']*100*rig.offsetScale*.14;
    const hy=hub.y+tires[axle+'TireOffsetY']*74*rig.offsetScale*.2;
    assert.ok(Math.abs(bx-hx)<.01,`${slot}/${p.wheel} x detached`);
    assert.ok(Math.abs(by-hy)<.01,`${slot}/${p.wheel} y detached`);
   }
  }
 });
});
