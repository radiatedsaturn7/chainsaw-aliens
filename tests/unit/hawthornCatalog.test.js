import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
const config=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/hawthorn-v-2005/import.json',import.meta.url)));
const document=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Hawthorn V 2005/document.json',import.meta.url)));
test('Hawthorn V 2005 retains source-backed V8 drivetrain anchors and explicit caveats',()=>{
 const {car}=config,t=car.tuning;assert.equal(t.powerHp,400);assert.equal(t.torqueLbFt,395);assert.equal(t.weightKg,1746);assert.equal(t.engineDisplacementL,5.665);assert.deepEqual(t.gearRatios,[2.97, 2.07, 1.43, 1, 0.84, 0.56]);assert.equal(t.gearFinalDrive,3.73);assert.equal(car.dimensions.wheelbaseM,2.88);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(t.rearDifferentialAccel,0);assert.equal(t.rearDifferentialDecel,0);
 const type="manual";assert.equal(car.defaultTransmissionType,type);assert.deepEqual(car.transmissions[type].gearRatios,t.gearRatios);assert.equal(car.mechanics.boostBar,0);
 const pts=t.engineCurve.torquePoints;assert.equal(pts.find(p=>p.rpm===4800).torqueLbFt,395);assert.ok(Math.abs(pts.find(p=>p.rpm===6000).torqueLbFt*6000/5252-400)<1e-9);
 const notes=config.provenance.estimates.join(' ');assert.match(notes,/simulation estimates/);assert.match(notes,/open differential/);assert.match(notes,/imperial|lbft|lb-ft/);
 const model=new PowertrainModel();assert.deepEqual(model.getDrivenWheelIds(t),['rl','rr']);
});
test('Hawthorn V 2005 native editor roundtrip retains fixed rear and individually fitted wheel-opening cockpit',()=>{
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(document),{name:document.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,document.car);const c=document.car,w=c.art.interior.steeringWheel;assert.equal(c.camera.trackingMode,'fixed-rear');assert.equal(w.artRef,'steeringwheel');assert.equal(w.sizeSpace,'viewport');assert.equal(w.scaleX,1.6875);assert.equal(w.scaleY,1.6875);assert.ok(w.anchorX>0&&w.anchorX<.45);assert.equal(c.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(c.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.ok(config.authoredWheelAnchors);assert.ok(config.cockpitCalibration);assert.equal(c.tuning.physics.bodyProfile.wheelWellAware,true);
});
test('Hawthorn V 2005 actual editor preview launches on all four tire contacts',()=>{
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});e.applyLoadedCarDocument(structuredClone(document),{name:document.car.name});const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);preview.session.startupFramePending=false;const start={x:preview.session.worldX,z:preview.session.worldZ};for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);const s=e.carEditorPreviewPlaytest.session;assert.ok(s.speedMps>.25,`failed launch ${s.speedMps}`);assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');assert.equal(Object.keys(s.vehicleDynamicsRunner.state.contactPatches).length,4);for(const p of Object.values(s.vehicleDynamicsRunner.state.contactPatches))assert.notEqual(p.invalidContactReason,'body-occluded');e.disposeRacePlaytestSession(s,'test-complete');
});
