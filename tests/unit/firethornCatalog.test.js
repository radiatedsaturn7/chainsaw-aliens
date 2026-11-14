import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Firethorn Turbo 2005/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/firethorn-turbo-2005/import.json',import.meta.url)));
test('Firethorn native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Firethorn production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Firethorn failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Firethorn preserves standard turbo sedan facts with explicit source conflicts',()=>{const{car}=c,t=car.tuning;assert.equal(t.weightKg,2900*.45359237);assert.equal(t.powerHp,230);assert.equal(t.torqueLbFt,250);assert.equal(t.engineDisplacementL,2.429);assert.equal(t.aspiration,'Turbocharged');assert.equal(t.drivetrain,'fwd');assert.equal(t.revLimitRpm,6240);assert.equal(t.torquePeakStartRpm,2200);assert.equal(t.torquePeakEndRpm,4400);assert.deepEqual(t.gearRatios,[3.65,2.05,1.37,.97,.76]);assert.equal(t.gearFinalDrive,3.53);assert.equal(t.reverseRatio,3.47);assert.equal(car.transmissions.manual.label,'5MT');assert.equal(t.frontDifferentialAccel,.35);assert.equal(t.frontDifferentialDecel,.1);assert.deepEqual(car.setup.tireSize,{widthMm:205,aspectRatio:50,wheelDiameterIn:17});assert.equal(car.setup.tireSizeByAxle,undefined);assert.equal(t.wheelRadiusM,.3184);assert.equal(car.dimensions.wheelbaseM,2.667);assert.equal(car.dimensions.lengthM,4.43);assert.equal(car.mechanics.fuelLiters,12.5*3.785411784);const notes=c.provenance.estimates.join(' ');assert.match(notes,/estimated OEM curb/);assert.match(notes,/NOT printed overall top gear 3.2/);assert.match(notes,/NOT measured Quaife calibration/);assert.match(notes,/No ACR/);assert.match(notes,/nominal geometric radius/);});
test('Firethorn conventional gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<5;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,3.53);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
