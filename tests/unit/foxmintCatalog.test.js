import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Foxmint 1.7 2000/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/foxmint-2000/import.json',import.meta.url)));
test('Foxmint native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Foxmint production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Foxmint failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Foxmint preserves dated UK source, unit conversion and RHD fit',()=>{const {car}=c,t=car.tuning;assert.equal(t.powerHp,92/.7456998715822702);assert.ok(t.powerHp<125);assert.equal(t.torqueLbFt,157/1.3558179483314004);assert.equal(t.weightKg,1038);assert.equal(t.engineDisplacementL,1.679);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(t.drivetrain,'fwd');assert.deepEqual(t.gearRatios,[3.15,1.93,1.41,1.11,.88]);assert.equal(t.gearFinalDrive,3.82);assert.equal(t.reverseRatio,3.62);assert.equal(t.wheelRadiusM,.288);assert.deepEqual(car.setup.tireSize,{widthMm:195,aspectRatio:50,wheelDiameterIn:15});assert.equal(car.dimensions.wheelbaseM,2.446);assert.equal(car.mechanics.fuelLiters,40);assert.equal(t.topSpeedMph,203/1.609344);const notes=c.provenance.estimates.join(' ');assert.match(notes,/09.2000/);assert.match(notes,/NOT 125 mechanical hp/);assert.match(notes,/full fluid levels/);assert.match(notes,/two decimals/);assert.match(notes,/RIGHT HAND DRIVE/);assert.ok(d.car.art.interior.steeringWheel.anchorX>.7);assert.deepEqual(c.cockpitCalibration.wheelPivotAndWidthPixels,[1450,655,250]);assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');});
test('Foxmint conventional gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<5;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,3.82);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
