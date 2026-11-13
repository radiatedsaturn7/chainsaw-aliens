import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Snowdrop T5 2008/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/snowdrop-t5-2008/import.json',import.meta.url)));
test('Snowdrop native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Snowdrop production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Snowdrop failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Snowdrop retains standard chassis assumptions and explicit nominal-mass uncertainty',()=>{const{car}=c,t=car.tuning;assert.equal(t.weightKg,3201*.45359237);assert.equal(t.powerHp,227);assert.equal(t.torqueLbFt,236);assert.equal(t.engineDisplacementL,2.521);assert.equal(t.aspiration,'Turbocharged');assert.equal(t.drivetrain,'fwd');assert.equal(t.redlineRpm,6500);assert.equal(t.revLimitRpm,6700);assert.equal(t.torquePeakStartRpm,1500);assert.equal(t.torquePeakEndRpm,5000);assert.deepEqual(t.gearRatios,[3.39,1.91,1.27,.95,.78,.65]);assert.equal(t.gearFinalDrive,3.77);assert.equal(t.reverseRatio,3.2);assert.equal(car.transmissions.manual.label,'6MT');assert.deepEqual(car.setup.tireSize,{widthMm:205,aspectRatio:50,wheelDiameterIn:17});assert.equal(car.setup.tireSizeByAxle,undefined);assert.equal(t.wheelRadiusM,.3184);assert.equal(car.dimensions.wheelbaseM,103.9*.0254);assert.equal(car.dimensions.lengthM,167.4*.0254);assert.equal(car.mechanics.fuelLiters,15.9*3.785411784);const notes=c.provenance.estimates.join(' ');assert.match(notes,/OEM nominal model mass/);assert.match(notes,/NOT verified exact Version 1.0 manual/);assert.match(notes,/NOT optional Dynamic/);assert.match(notes,/no rim-width assertion/);assert.match(notes,/NOT proven fuelcut/);assert.match(notes,/do not exactly satisfy/);});
test('Snowdrop conventional gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<6;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,3.77);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
