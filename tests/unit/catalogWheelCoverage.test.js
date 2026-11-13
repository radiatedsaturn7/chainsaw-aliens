import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {decodePng} from '../../scripts/car-catalog-import.mjs';
for(const [slug,name] of [['stormline-2002','Stormline 2002'],['cinder-si-1991','Cinder Si 1991'],['lark-1600-1990','Lark 1600 1990'],['kestrel-660-2018','2018 Kestrel 660'],['trailglass-2024','Trailglass 2024'],['sentinel-sedan-2024','2024 Sentinel Sedan'],['ember-pod','Ember Pod Prototype'],['nightcoil-gt-1995','Nightcoil GT 1995']]){
 test(name+' published wheel graphics cover original opening heights without changing physical radius',()=>{
  const root=new URL('../../',import.meta.url);
  const read=p=>{const v=JSON.parse(fs.readFileSync(new URL(p,root)));return v.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(v.data,'base64'))):v;};
  const cfg=read('assets/car-catalog/'+slug+'/import.json');
  const car=read('data/server-storage/files/cars/'+name+'/document.json').car;
  const packed=read('data/server-storage/files/art/catalog-'+slug+'-body/document.json');
  const art=packed.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(packed.data,'base64'))):packed;
  const im=decodePng(new URL('assets/car-catalog/'+slug+'/body.png',root).pathname);
  const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
  assert.equal(cfg.wheelFit,'cover');
  assert.equal(car.tuning.wheelRadiusM,cfg.car.tuning.wheelRadiusM);
  for(const [slot,points]of Object.entries(cfg.authoredWheelAnchors)){
   if(slot==='front'||slot==='rear')continue;
   const layer=car.art.angleLayers[slot],scale=100*layer.body.transforms.bodyScaleX/art.width;
   const neutral=structuredClone(car);neutral.art.tireScaleX=1;neutral.art.tireScaleY=1;
   const rig=editor.getRaceSpriteWheelRig({car:neutral,viewSlot:slot,bodyBaseWidth:100});
   for(const p of points){
    assert.ok(im.data[(p.y*im.width+p.x)*4+3]<128,slot+' center in opening');
    let top=p.y;
    while(top>0&&im.data[((top-1)*im.width+p.x)*4+3]<128)top--;
    const extent=p.y-top;
    assert.ok(extent>20&&extent<100,slot+' bounded upper opening');
    assert.ok(p.radius>=extent,slot+' vertical measurement');
    const rendered=rig.wheels[p.wheel].height*layer.tires.transforms.tireScaleY/2;
    assert.ok(rendered>=extent*scale,slot+'/'+p.wheel+' covers upper hole');
    assert.ok(rendered<=p.radius*scale*1.6,slot+' limited far-wheel overfill');
   }
  }
 });
}
