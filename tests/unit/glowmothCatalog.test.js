import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Glowmoth SC 1988/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/glowmoth-sc-1988/import.json',import.meta.url)));
test('Glowmoth native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Glowmoth production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Glowmoth failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Glowmoth preserves OEM supercharged variant facts and secondary gearbox caveat',()=>{const {car}=c,t=car.tuning;assert.equal(t.powerHp,145);assert.equal(t.torqueLbFt,140);assert.equal(t.weightKg,2493*.45359237);assert.equal(t.engineDisplacementL,1.587);assert.equal(t.aspiration,'Supercharged');assert.equal(t.drivetrain,'rwd');assert.deepEqual(t.gearRatios,[3.23,1.913,1.258,.918,.731]);assert.equal(t.gearFinalDrive,4.285);assert.equal(t.reverseRatio,3.583);assert.equal(t.wheelRadiusM,.2888);assert.deepEqual(car.setup.tireSize,{widthMm:185,aspectRatio:60,wheelDiameterIn:14});assert.equal(car.dimensions.wheelbaseM,91.3*.0254);assert.equal(car.mechanics.fuelTankGallons,10.8);assert.equal(t.frontWeightDistribution,.42);assert.equal(t.dragCoefficient,.36);assert.equal(t.rearDifferentialAccel,0);const notes=c.provenance.estimates.join(' ');for(const pattern of [/SECONDARY gearing/,/NOT OEM numeric verification/,/simulation estimates/,/no driver mass adjustment/,/T-bar/,/DOES NOT physically simulate|does NOT physically simulate/,/not an unrelated body family/])assert.match(notes,pattern);assert.ok(d.car.art.interior.steeringWheel.anchorX<.4);assert.deepEqual(c.cockpitCalibration.wheelPivotAndWidthPixels,[525,755,250]);assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');});
test('Glowmoth conventional gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<5;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,4.285);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
