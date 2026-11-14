import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Bluebell GT 2006/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/bluebell-gt-2006/import.json',import.meta.url)));
test('Bluebell native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Bluebell production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Bluebell failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Bluebell retains OEM dual finals through explicit effective representation',()=>{const t=c.car.tuning,g=c.calculatedSimulationGearing;assert.equal(t.powerHp,263);assert.equal(t.torqueLbFt,260);assert.equal(t.weightKg,1575);assert.equal(t.engineDisplacementL,3.828);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(t.drivetrain,'fwd');assert.equal(t.gearFinalDrive,4);for(let i=0;i<6;i++){assert.ok(Math.abs(t.gearRatios[i]*4-g.overallForward[i])<1e-8);assert.ok(Math.abs(g.physicalForward[i]*g.physicalFinalsForward[i]-g.overallForward[i])<1e-8);}assert.ok(Math.abs(t.reverseRatio*4-g.overallReverse)<1e-8);assert.equal(c.car.dimensions.wheelbaseM,2.575);assert.equal(t.physics.bodyProfile.frontOverhangM,1.007);assert.equal(t.physics.bodyProfile.rearOverhangM,.983);assert.equal(t.physics.bodyProfile.groundClearanceM,.148);assert.equal(t.wheelRadiusM,.3284);assert.equal(c.car.mechanics.fuelLiters,67);assert.deepEqual(c.car.setup.tireSize,{widthMm:225,aspectRatio:50,wheelDiameterIn:17});const notes=c.provenance.estimates.join(' ');assert.match(notes,/PRELIMINARY OEM/);assert.match(notes,/194 kW and 263 HP are inconsistent/);assert.match(notes,/NOT physical tooth ratios/);assert.match(notes,/6700 electronic cutoff/);});
test('Bluebell conventional gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<6;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,4);for(let i=0;i<6;i++)assert.ok(Math.abs(saved.tuning.gearRatios[i]*4-c.calculatedSimulationGearing.overallForward[i])<=.002);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
