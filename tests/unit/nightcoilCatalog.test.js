import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalogDocuments,decodePng} from '../../scripts/car-catalog-import.mjs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const base=new URL('../../assets/car-catalog/nightcoil-gt-1995/',import.meta.url);
const config=JSON.parse(fs.readFileSync(new URL('import.json',base)));
test('Nightcoil preserves exact manual AWD identity and qualified source facts',()=>{
 const c=config.car,t=c.tuning; assert.equal(c.name,'Nightcoil GT 1995');assert.equal(t.weightKg,1415);assert.equal(t.drivetrain,'awd');assert.equal(t.powerHp,210);assert.equal(t.torqueLbFt,214);
 assert.deepEqual(c.transmissions.manual.gearRatios,[3.083,1.684,1.115,.833,.666]);assert.ok(Math.abs(c.transmissions.manual.gearFinalDrive-(37/29)*(58/15))<1e-12);assert.equal(c.transmissions.manual.reverseRatio,3.166);
 assert.equal(c.dimensions.wheelbaseM,2.51);assert.match(config.provenance.status,/secondary/);assert.match(c.description,/Not a movie/);
});
test('Nightcoil source wheel anchors lie in bounded original openings',()=>{
 const im=decodePng(new URL('body.png',base).pathname);
 for(const [slot,points] of Object.entries(config.authoredWheelAnchors)){
  if(slot==='front'||slot==='rear')continue;
  for(const p of points){
   const alpha=x=>im.data[(p.y*im.width+x)*4+3];let lo=p.x,hi=p.x;
   assert.ok(alpha(p.x)<128,`${slot} ${p.wheel} center transparent`);
   while(lo>0&&alpha(lo-1)<128)lo--;while(hi<im.width-1&&alpha(hi+1)<128)hi++;
   assert.ok(hi-lo>25&&hi-lo<135,`${slot} ${p.wheel} bounded opening`);
   assert.ok(Math.abs(p.x-(lo+hi)/2)<5,`${slot} ${p.wheel} horizontally centered`);
  }
 }
});
test('Nightcoil eight calibrated angles and shared-wheel cockpit roundtrip editor',()=>{
 const built=buildCatalogDocuments(config,decodePng(new URL('body.png',base).pathname),decodePng(new URL('dashboard.png',base).pathname));
 assert.equal(built.art['catalog-nightcoil-gt-1995-body'].frames.length,8);
 const c=built.car.car;assert.equal(c.art.interior.steeringWheel.artRef,'steeringwheel');
 for(const slot of Object.keys(config.authoredWheelAnchors)){
  const layer=c.art.angleLayers[slot];assert.ok(layer.body.transforms.bodyScaleX>0);assert.ok(Number.isFinite(layer.body.transforms.bodyOffsetX));assert.ok(layer.tires.transforms.tireScaleX>0);
 }
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});editor.applyLoadedCarDocument(built.car,{name:c.name});
 const again=editor.serializeSelectedCarDocument().car;
 assert.deepEqual(again.transmissions.manual.gearRatios,config.car.transmissions.manual.gearRatios);assert.equal(again.tuning.weightKg,1415);assert.equal(again.id,'nightcoil-gt-1995');
 const dash=built.art['catalog-nightcoil-gt-1995-dashboard'];assert.ok(dash.frames[0].slice(0,dash.width*200).every(p=>p===null || (p.length===9 && parseInt(p.slice(-2),16)<=1)));
});
