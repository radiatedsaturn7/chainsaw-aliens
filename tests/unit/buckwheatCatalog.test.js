import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Buckwheat 2.4 1997/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/buckwheat-1997/import.json',import.meta.url)));
test('Buckwheat native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Buckwheat production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Buckwheat failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Buckwheat exact-year low 2WD pickup facts and adjacent-year gear caveat survive',()=>{const {car}=c,t=car.tuning;assert.equal(t.powerHp,142);assert.equal(t.torqueLbFt,160);assert.equal(t.weightKg,2560*.45359237);assert.equal(t.engineDisplacementL,2.438);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(t.drivetrain,'rwd');assert.deepEqual(t.gearRatios,[3.954,2.141,1.384,1,.810]);assert.equal(t.gearFinalDrive,3.416);assert.equal(t.reverseRatio,4.091);assert.ok(Math.abs(t.wheelRadiusM-.32405)<1e-10);assert.deepEqual(car.setup.tireSize,{widthMm:195,aspectRatio:75,wheelDiameterIn:14});assert.equal(car.dimensions.wheelbaseM,103.3*.0254);assert.equal(car.mechanics.fuelTankGallons,15.1);assert.equal(t.physics.bodyProfile.overallHeightM,61.8*.0254);assert.equal(t.physics.bodyProfile.bed.lengthM,74.5*.0254);assert.equal(t.physics.bodyProfile.bed.widthM,57.9*.0254);assert.equal(t.steeringRatio,22.3);const notes=c.provenance.estimates.join(' ');for(const pattern of [/ADJACENT-YEAR CARRYOVER INFERENCE/,/NOT exact 1997 primary gearbox verification/,/simulation estimates/,/no driver mass adjustment/,/No cargo/])assert.match(notes,pattern);});
test('Buckwheat conventional gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<5;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,3.416);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
