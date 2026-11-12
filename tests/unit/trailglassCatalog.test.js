import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalogDocuments,decodePng} from '../../scripts/car-catalog-import.mjs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const base=new URL('../../assets/car-catalog/trailglass-2024/',import.meta.url);
const config=JSON.parse(fs.readFileSync(new URL('import.json',base)));
test('Trailglass retains OEM US2024 S FWD seven-seat mechanical facts',()=>{
 const c=config.car,t=c.tuning,b=t.physics.bodyProfile;
 assert.equal(c.defaultTransmissionType,'automatic');assert.equal(t.drivetrain,'fwd');
 assert.deepEqual(c.transmissions.automatic.gearRatios,[5.59,3.14,1.95,1.43,1.21,1,.81,.67]);
 assert.equal(c.transmissions.automatic.gearFinalDrive,3.33);assert.equal(c.transmissions.automatic.reverseRatio,3.99);
 assert.equal(t.weightKg,1693);assert.equal(t.powerHp,184);assert.equal(t.torqueLbFt,221);
 assert.equal(c.dimensions.wheelbaseM,2.791);assert.equal(b.overallHeightM,1.688);assert.equal(b.groundClearanceM,.187);
 assert.ok(Math.abs(b.frontAxleDistanceFromCgM+b.rearAxleDistanceFromCgM-2.791)<1e-9);
 assert.deepEqual(c.setup.tireSize,{widthMm:215,aspectRatio:65,wheelDiameterIn:17});assert.equal(t.wheelRadiusM,.35565);
 assert.equal(t.dragCoefficient,.34);
 const power=t.engineCurve.torquePoints.find(p=>p.rpm===4400);assert.ok(Math.abs(power.torqueLbFt*4400/5252-184)<1e-9);
 assert.ok(t.engineCurve.torquePoints.some(p=>p.rpm===1600&&p.torqueLbFt===221));
 assert.ok(config.provenance.sources.some(s=>s.url.includes('17298-2024TiguanTechnicalSpecsFINAL.pdf')));
 assert.ok(config.provenance.estimates.some(s=>s.includes('59%')));
});
test('Trailglass source wheel anchors lie in bounded original openings',()=>{
 const im=decodePng(new URL('body.png',base).pathname);
 for(const [slot,points] of Object.entries(config.authoredWheelAnchors)){
  if(slot==='front'||slot==='rear')continue;
  for(const p of points){
   const alpha=x=>im.data[(p.y*im.width+x)*4+3];let lo=p.x,hi=p.x;
   assert.ok(alpha(p.x)<128,`${slot} ${p.wheel} center transparent`);
   while(lo>0&&alpha(lo-1)<128)lo--;while(hi<im.width-1&&alpha(hi+1)<128)hi++;
   assert.ok(hi-lo>25&&hi-lo<120,`${slot} ${p.wheel} bounded opening`);
   assert.ok(Math.abs(p.x-(lo+hi)/2)<5,`${slot} ${p.wheel} horizontally centered`);
  }
 }
});
test('Trailglass eight calibrated angles and shared-wheel cockpit roundtrip editor',()=>{
 const built=buildCatalogDocuments(config,decodePng(new URL('body.png',base).pathname),decodePng(new URL('dashboard.png',base).pathname));
 assert.equal(built.art['catalog-trailglass-2024-body'].frames.length,8);
 const c=built.car.car;assert.equal(c.art.interior.steeringWheel.artRef,'steeringwheel');
 for(const slot of Object.keys(config.authoredWheelAnchors)){
  const layer=c.art.angleLayers[slot];assert.ok(layer.body.transforms.bodyScaleX>0);assert.ok(Number.isFinite(layer.body.transforms.bodyOffsetX));assert.ok(layer.tires.transforms.tireScaleX>0);
 }
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});editor.applyLoadedCarDocument(built.car,{name:c.name});
 const again=editor.serializeSelectedCarDocument().car;
 assert.deepEqual(again.transmissions.automatic.gearRatios,[5.59,3.14,1.95,1.43,1.21,1,.81,.67]);assert.equal(again.tuning.weightKg,1693);assert.equal(again.id,'trailglass-2024');
 const dash=built.art['catalog-trailglass-2024-dashboard'];assert.ok(dash.frames[0].slice(0,dash.width*200).every(p=>p===null || (p.length===9 && parseInt(p.slice(-2),16)<=1)));
});
