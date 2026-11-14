import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Aster 170 2003/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/aster-170-2003/import.json',import.meta.url)));
test('Aster native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Aster production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Aster failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Aster uses OEM rounded overall reductions with explicitly effective gearing',()=>{const{car}=c,t=car.tuning;assert.equal(t.powerHp,170);assert.equal(t.torqueLbFt,145);assert.equal(t.weightKg,2750*.45359237);assert.equal(t.frontWeightDistribution,.61);assert.equal(t.drivetrain,'fwd');assert.equal(t.engineDisplacementL,1.988);assert.equal(t.redlineRpm,7200);assert.equal(t.revLimitRpm,7400);assert.equal(t.gearFinalDrive,4);assert.deepEqual(t.gearRatios,[3.175,1.925,1.425,1.15,.95,.775]);for(let i=0;i<6;i++)assert.ok(Math.abs(t.gearRatios[i]*4-[12.7,7.7,5.7,4.6,3.8,3.1][i])<1e-10);assert.equal(t.reverseRatio*4,12);assert.equal(car.transmissions.manual.label,'6MT');assert.deepEqual(car.setup.tireSize,{widthMm:215,aspectRatio:45,wheelDiameterIn:17});assert.equal(car.setup.tireSizeByAxle,undefined);assert.equal(t.wheelRadiusM,.31265);assert.equal(car.dimensions.wheelbaseM,2.615);assert.equal(car.dimensions.lengthM,4.27);assert.equal(car.mechanics.fuelLiters,50);const notes=c.provenance.estimates.join(' ');assert.match(notes,/NOT physical final drive/);assert.match(notes,/model-family/);assert.match(notes,/type not verified/);});
test('Aster effective gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<6;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,4);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
