import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import {axleTireGeometry} from '../../src/racing/TireSizes.js';
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/glimmer-1986/import.json',import.meta.url))),d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Glimmer 1986/document.json',import.meta.url)));
test('Glimmer US 1986 naturally aspirated manual anchors are not UK specs',()=>{const t=c.car.tuning;assert.equal(t.weightKg,2291*.45359237);assert.equal(t.powerHp,112);assert.equal(t.torqueLbFt,97);assert.equal(t.frontWeightDistribution,.46);assert.equal(t.redlineRpm,7500);assert.deepEqual(t.gearRatios,[3.166,1.904,1.310,.969,.815]);assert.equal(t.gearFinalDrive,4.312);assert.equal(t.reverseRatio,3.25);assert.equal(d.car.defaultTransmissionType,'manual');assert.equal(d.car.mechanics.fuelTankGallons,10.8);assert.equal(t.drivetrain,'rwd');assert.equal(t.engineDisplacementL,1.587);const g=axleTireGeometry(c.car.setup,t);assert.ok(Math.abs(g.wheelRadiusByWheelM.fl-.2888)<1e-9);assert.ok(d.car.art.interior.steeringWheel.anchorX<.3);});
test('Glimmer native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'dashboard');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Glimmer production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Glimmer failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Naturally aspirated source label is corrected without physics or artwork changes',async()=>{const{createHash}=await import('node:crypto');for(const [car,expected]of[[c.car,'d77be7173d5e60c237c7827fd09af024703d3e8b762e4ae97db6849ec6a10d4e'],[d.car,'cbb2a9d38b547522e5d9b1e184b7e97d6e787448f3210963a55846c29b736760']]){assert.equal(car.tuning.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);const rest=structuredClone(car);delete rest.tuning.aspiration;assert.equal(createHash('sha256').update(JSON.stringify(rest)).digest('hex'),expected);}});
