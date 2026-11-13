import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Stonepod 2006/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/stonepod-2006/import.json',import.meta.url)));
test('Stonepod native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Stonepod production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Stonepod failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Stonepod uses US2006 EX2WD manual OEM table, not another trim/year',()=>{const{car}=c,t=car.tuning;assert.equal(t.weightKg,1538.13172667);assert.equal(t.powerHp,156);assert.equal(t.torqueLbFt,160);assert.equal(t.engineDisplacementL,2.354);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);assert.equal(t.steeringRatio,16.2);assert.equal(t.frontWeightDistribution,.58);assert.deepEqual(t.gearRatios,[3.533,2.042,1.355,1.028,.825]);assert.equal(t.gearFinalDrive,4.765);assert.equal(t.reverseRatio,3.583);assert.deepEqual(car.transmissions.manual.gearRatios,t.gearRatios);assert.equal(car.transmissions.manual.label,'5MT');assert.equal(car.dimensions.wheelbaseM,2.57556);assert.equal(car.dimensions.lengthM,4.30022);assert.equal(car.dimensions.widthM,1.8160999999999998);assert.equal(t.physics.bodyProfile.overallHeightM,1.78816);assert.equal(t.physics.bodyProfile.groundClearanceM,.17526);assert.deepEqual(car.setup.tireSize,{widthMm:215,aspectRatio:70,wheelDiameterIn:16});assert.equal(t.wheelRadiusM,.3537);assert.equal(car.mechanics.fuelLiters,60.1880473656);const notes=c.provenance.estimates.join(' ');assert.match(notes,/3391lb/);assert.match(notes,/6200redline\/6500limiter are explicit simulation estimates/);assert.match(notes,/SAE revision/);assert.ok(d.car.art.interior.steeringWheel.anchorX<.3);});
