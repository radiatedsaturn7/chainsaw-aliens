import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {PowertrainModel} from '../../src/racing/simulation/PowertrainModel.js';
const config=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/silverleaf-200-2018/import.json',import.meta.url)));
const document=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Silverleaf 200 2018/document.json',import.meta.url)));
test('Silverleaf 200 2018 native editor roundtrip retains fixed rear and individually fitted wheel-opening cockpit',()=>{
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(document),{name:document.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,document.car);const c=document.car,w=c.art.interior.steeringWheel;assert.equal(c.camera.trackingMode,'fixed-rear');assert.equal(w.artRef,'steeringwheel');assert.equal(w.sizeSpace,'viewport');assert.equal(w.scaleX,1.6875);assert.equal(w.scaleY,1.6875);assert.ok(w.anchorX>0&&w.anchorX<.45);assert.equal(c.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(c.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.ok(config.authoredWheelAnchors);assert.ok(config.cockpitCalibration);assert.equal(c.tuning.physics.bodyProfile.wheelWellAware,true);
});
test('Silverleaf 200 2018 actual editor preview launches on all four tire contacts',()=>{
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});e.applyLoadedCarDocument(structuredClone(document),{name:document.car.name});const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);preview.session.startupFramePending=false;const start={x:preview.session.worldX,z:preview.session.worldZ};for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);const s=e.carEditorPreviewPlaytest.session;assert.ok(s.speedMps>.25,`failed launch ${s.speedMps}`);assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');assert.equal(Object.keys(s.vehicleDynamicsRunner.state.contactPatches).length,4);for(const p of Object.values(s.vehicleDynamicsRunner.state.contactPatches))assert.notEqual(p.invalidContactReason,'body-occluded');e.disposeRacePlaytestSession(s,'test-complete');
});
test('Silverleaf source anchors and simulation estimates remain distinguished',()=>{
 const c=config.car,t=c.tuning;assert.equal(t.powerHp,120/.7456998715822702);assert.equal(t.torqueLbFt,250/1.3558179483314004);assert.equal(t.weightKg,1375);assert.equal(t.engineDisplacementL,1.332);assert.equal(c.mechanics.fuelLiters,43);assert.equal(c.dimensions.wheelbaseM,2.729);assert.equal(c.defaultTransmissionType,'automatic');assert.equal(c.transmissions.automatic.gearRatios.length,7);assert.equal(t.drivetrain,'fwd');assert.deepEqual(new PowertrainModel().getDrivenWheelIds(t),['fl','fr']);assert.match(config.provenance.estimates.join(' '),/NOT claimed as OEM ratios/);assert.equal(t.engineCurve.torquePoints.find(p=>p.rpm===5500).torqueLbFt,t.powerHp*5252/5500);
});
