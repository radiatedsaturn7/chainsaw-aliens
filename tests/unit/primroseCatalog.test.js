import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Primrose ST 2005/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/primrose-st-2005/import.json',import.meta.url)));
test('Primrose native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,5,4,3,6,1]);});

test('Primrose production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Primrose failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Primrose preserves unit conversions and disclosed evidence limits',()=>{const {car}=c,t=car.tuning;assert.equal(t.powerHp,110/0.7456998715822702);assert.ok(t.powerHp<150);assert.equal(t.torqueLbFt,190/1.3558179483314004);assert.equal(t.weightKg,1137);assert.equal(t.engineDisplacementL,1.999);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(t.drivetrain,'fwd');assert.deepEqual(t.gearRatios,[3.583,2.038,1.414,1.108,.878]);assert.equal(t.gearFinalDrive,3.824);assert.equal(t.reverseRatio,3.615);assert.equal(t.wheelRadiusM,.29095);assert.deepEqual(car.setup.tireSize,{widthMm:195,aspectRatio:45,wheelDiameterIn:16});assert.equal(car.dimensions.wheelbaseM,2.486);assert.equal(car.dimensions.trackFrontM,1.471);assert.equal(car.dimensions.trackRearM,1.439);assert.equal(car.mechanics.fuelLiters,45);assert.equal(t.redlineRpm,6500);assert.equal(t.revLimitRpm,6800);const notes=c.provenance.estimates.join(' ');assert.match(notes,/NOT visually inspected primary PDF/);assert.match(notes,/NOT 150 SAE hp/);assert.match(notes,/no 75 kg subtraction/);assert.match(notes,/midpoint simulation estimates/);assert.match(notes,/6800 electronic cutoff/);});
test('Primrose conventional gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<5;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,3.824);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
