import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Wispwing 660 1993/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/wispwing-1993/import.json',import.meta.url)));
test('Wispwing native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Wispwing production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Wispwing failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Wispwing preserves actual Suzuki table, converted units and authored RHD cockpit',()=>{const {car}=c,t=car.tuning;assert.equal(t.powerHp,64*.986320070619);assert.equal(t.torqueLbFt,8.7*9.80665/1.3558179483314004);assert.equal(t.weightKg,720);assert.equal(t.engineDisplacementL,.657);assert.equal(t.aspiration,'Turbocharged');assert.equal(t.drivetrain,'rwd');assert.deepEqual(t.gearRatios,[3.818,2.277,1.521,1.030,.837]);assert.equal(t.gearFinalDrive,4.705);assert.equal(t.reverseRatio,3.583);assert.equal(t.wheelRadiusM,.26585);assert.deepEqual(car.setup.tireSize,{widthMm:155,aspectRatio:65,wheelDiameterIn:13});assert.equal(car.dimensions.wheelbaseM,2.235);assert.equal(car.mechanics.fuelLiters,30);assert.equal(t.rearDifferentialAccel,0);const notes=c.provenance.estimates.join(' ');for(const pattern of [/official Suzuki/,/PS converted/,/kgf-m/,/simulation estimates/,/no driver mass adjustment/,/RHD/,/family counted once/])assert.match(notes,pattern);assert.ok(d.car.art.interior.steeringWheel.anchorX>.7);assert.deepEqual(c.cockpitCalibration.wheelPivotAndWidthPixels,[1455,665,250]);assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');});
test('Wispwing conventional gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<5;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,4.705);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
