import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Copperhead SC 2006/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/copperhead-sc-2006/import.json',import.meta.url)));
test('Copperhead native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Copperhead production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Copperhead failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Copperhead preserves direct OEM supercharged F35 facts and unit caveats',()=>{const{car}=c,t=car.tuning;assert.equal(t.weightKg,2925*.45359237);assert.equal(t.powerHp,205);assert.equal(t.torqueLbFt,200);assert.equal(t.engineDisplacementL,1.998);assert.equal(t.aspiration,'Supercharged');assert.equal(t.drivetrain,'fwd');assert.equal(t.redlineRpm,6450);assert.equal(t.revLimitRpm,6650);assert.equal(t.torquePeakStartRpm,4400);assert.equal(t.torquePeakEndRpm,4400);assert.deepEqual(t.gearRatios,[3.38,1.76,1.18,.89,.7]);assert.equal(t.gearFinalDrive,4.05);assert.equal(t.reverseRatio,3.17);assert.equal(car.transmissions.manual.label,'5MT');assert.deepEqual(car.setup.tireSize,{widthMm:215,aspectRatio:45,wheelDiameterIn:18});assert.equal(car.setup.tireSizeByAxle,undefined);assert.equal(t.wheelRadiusM,.32535);assert.equal(car.dimensions.wheelbaseM,2.624);assert.equal(car.dimensions.lengthM,4.58);assert.equal(car.mechanics.fuelLiters,13.2*3.785411784);const notes=c.provenance.estimates.join(' ');assert.match(notes,/NOT printed 230 Nm/);assert.match(notes,/not independently SS-trim verified/);assert.match(notes,/NOT proven fuelcut/);assert.match(notes,/No optional Performance Package/);});
test('Copperhead conventional gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<5;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,4.05);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
