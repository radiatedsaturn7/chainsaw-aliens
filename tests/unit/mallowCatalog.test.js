import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Mallow S 2006/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/mallow-s-2006/import.json',import.meta.url)));
test('Mallow native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Mallow production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Mallow failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Mallow preserves revised 2006 rating and disclosed source conflicts',()=>{const{car}=c,t=car.tuning;assert.equal(t.weightKg,2840*.45359237);assert.equal(t.powerHp,201);assert.equal(t.torqueLbFt,140);assert.equal(t.engineDisplacementL,1.998);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);assert.equal(t.drivetrain,'fwd');assert.equal(t.redlineRpm,8100);assert.equal(t.revLimitRpm,8300);assert.equal(t.torquePeakStartRpm,7000);assert.deepEqual(t.gearRatios,[3.267,2.13,1.517,1.147,.921,.738]);assert.equal(t.gearFinalDrive,4.765);assert.equal(t.reverseRatio,3.583);assert.equal(car.transmissions.manual.label,'6MT');assert.equal(t.frontDifferentialAccel,0);assert.deepEqual(car.setup.tireSize,{widthMm:215,aspectRatio:45,wheelDiameterIn:17});assert.equal(car.setup.tireSizeByAxle,undefined);assert.equal(t.wheelRadiusM,.31265);assert.equal(car.dimensions.wheelbaseM,2.57);assert.equal(car.dimensions.lengthM,4.3795);assert.equal(car.dimensions.trackFrontM,1.487);assert.equal(car.dimensions.trackRearM,1.486);assert.equal(car.mechanics.fuelLiters,50);const notes=c.provenance.estimates.join(' ');assert.match(notes,/NOT older 210 hp/);assert.match(notes,/trim-specific63\/37/);assert.match(notes,/generic61\/39/);assert.match(notes,/No JDM Type R LSD/);assert.match(notes,/clearance .14m is a simulation estimate/);});
test('Mallow conventional gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<6;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,4.765);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
