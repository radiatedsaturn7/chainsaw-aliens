import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildCatalogDocuments,decodePng} from '../../scripts/car-catalog-import.mjs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const base=new URL('../../assets/car-catalog/dustjack-v8/',import.meta.url);
const config=JSON.parse(fs.readFileSync(new URL('import.json',base)));
test('Dustjack representative LS3 build distinguishes facts from estimates',()=>{
 const c=config.car,t=c.tuning,b=t.physics.bodyProfile;
 assert.equal(c.defaultTransmissionType,'automatic');assert.equal(t.drivetrain,'rwd');
 assert.deepEqual(c.transmissions.automatic.gearRatios,[2.48,1.48,1,.75]);assert.equal(c.transmissions.automatic.gearFinalDrive,4.11);
 assert.equal(t.weightKg,3900*.45359237);assert.equal(t.powerHp,430);assert.equal(t.torqueLbFt,424);
 assert.equal(c.dimensions.wheelbaseM,2.921);assert.equal(b.overallWidthM,2.057);
 assert.ok(Math.abs(b.frontAxleDistanceFromCgM+b.rearAxleDistanceFromCgM-2.921)<1e-9);
 assert.deepEqual(c.setup.tireSize,{widthMm:275,aspectRatio:70,wheelDiameterIn:17});assert.equal(c.setup.defaultTireCompound,'offroad');
 const peak=t.engineCurve.torquePoints.find(p=>p.rpm===5900);assert.ok(Math.abs(peak.torqueLbFt*5900/5252-430)<1e-9);
 assert.ok(t.engineCurve.torquePoints.some(p=>p.rpm===4600&&p.torqueLbFt===424));
 assert.match(config.provenance.referenceVehicle,/Representative/);
 assert.ok(config.provenance.estimates.some(s=>/midpoint/.test(s)));assert.ok(config.provenance.estimates.some(s=>/2.032m/.test(s)));
});
test('Dustjack artwork builds eight calibrated angles and roundtrips editor without shared manifest writes',()=>{
 const built=buildCatalogDocuments(config,decodePng(new URL('body.png',base).pathname),decodePng(new URL('dashboard.png',base).pathname));
 assert.equal(built.art['catalog-dustjack-v8-body'].frames.length,8);
 const c=built.car.car;
 assert.equal(c.art.interior.steeringWheel.artRef,'steeringwheel');
 for(const slot of Object.keys(config.authoredWheelAnchors)){
  const layer=c.art.angleLayers[slot];assert.ok(layer.body.transforms.bodyScaleX>0);assert.ok(Number.isFinite(layer.body.transforms.bodyOffsetX));assert.ok(layer.tires.transforms.tireScaleX>0);
 }
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});editor.applyLoadedCarDocument(built.car,{name:c.name});
 const again=editor.serializeSelectedCarDocument().car;
 assert.deepEqual(again.transmissions.automatic.gearRatios,[2.48,1.48,1,.75]);assert.equal(again.id,'dustjack-v8');assert.equal(again.catalogProvenance.referenceVehicle,config.provenance.referenceVehicle);
 const dash=built.art['catalog-dustjack-v8-dashboard'];
 assert.ok(dash.frames[0].slice(0,dash.width*200).every(p=>p===null || (p.length===9 && parseInt(p.slice(-2),16)<=1)),'upper windshield has no visible opaque art (source has sparse alpha1 noise)');
});

test('Dustjack front-right near-wheel anchor is inside the authored wheel opening, not the front bumper',()=>{
 const image=decodePng(new URL('body.png',base).pathname),anchor=config.authoredWheelAnchors.frontRight.find(p=>p.wheel==='fr');
 const y=720;let start=anchor.x,end=anchor.x;
 const alpha=x=>image.data[(y*image.width+x)*4+3];
 assert.ok(alpha(anchor.x)<128,'wheel center is in the original transparent opening');
 while(start>0&&alpha(start-1)<128)start--;while(end<image.width-1&&alpha(end+1)<128)end++;
 assert.ok(end-start>40&&end-start<100,'measured wheel opening, not empty outside canvas');
 assert.ok(Math.abs(anchor.x-(start+end)/2)<=3,'anchor matches center of measured wheel opening');
});
