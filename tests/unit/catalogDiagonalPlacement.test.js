import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decodePng} from '../../scripts/car-catalog-import.mjs';
import {prepareCarSheet} from '../../src/racing/CarGraphicImport.js';
const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
for(const [slug,name] of [['glowmoth-sc-1988','Glowmoth SC 1988'],['wispwing-1993','Wispwing 660 1993'],['primrose-st-2005','Primrose ST 2005'],['hazel-2011','Hazel S 2011'],['foxmint-2000','Foxmint 1.7 2000'],['moonpetal-2000','Moonpetal GT 2000'],['buckwheat-1997','Buckwheat 2.4 1997']]){
 if(!fs.existsSync(new URL(`../../assets/car-catalog/${slug}/import.json`,import.meta.url))) continue;
 test(name+' diagonal source mapping keeps calibrated body with its tires',()=>{
  const root=new URL('../../',import.meta.url),read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
  const config=read(`assets/car-catalog/${slug}/import.json`),car=read(`data/server-storage/files/cars/${name}/document.json`).car;
  const sheet=prepareCarSheet(decodePng(new URL(`assets/car-catalog/${slug}/body.png`,root).pathname));
  for(const i of [1,3,5,7]){
   const slot=slots[i],crop=sheet.crops[config.mapping[i]],body=car.art.angleLayers[slot].body;
   assert.equal(body.frameIndex,config.mapping[i]);
   for(const p of config.authoredWheelAnchors[slot]){
    assert.ok(p.x>=crop.x&&p.x<crop.x+crop.width,`${slot}/${p.wheel}: anchor must belong to selected crop, not opposite sheet corner`);
    assert.ok(p.y>=crop.y&&p.y<crop.y+crop.height,`${slot}/${p.wheel}: anchor row must match selected crop`);
   }
   // Regression: wrong diagonal crops produced ±16 serializer-clamped X and
   // Y around ±10–14, visibly detaching body from tires and moving it offscreen.
   assert.ok(Math.abs(body.transforms.bodyOffsetX)<8,`${slot}: body X displaced`);
   assert.ok(Math.abs(body.transforms.bodyOffsetY)<4,`${slot}: body Y displaced`);
  }
 });
}
