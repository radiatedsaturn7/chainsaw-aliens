import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import {axleTireGeometry} from '../../src/racing/TireSizes.js';
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/podmoss-2005/import.json',import.meta.url))),d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Podmoss 2005/document.json',import.meta.url)));
test('Podmoss preserves exact2005German1.6manual source and driver-inclusive mass',()=>{const t=c.car.tuning;assert.equal(t.weightKg,1375);assert.ok(Math.abs(t.powerHp*.7456998715822702-76)<1e-8);assert.ok(Math.abs(t.torqueLbFt*1.3558179483314-145)<1e-8);assert.equal(t.aspiration,'Naturally Aspirated');assert.deepEqual(t.gearRatios,[3.909,2.238,1.520,1.156,.946]);assert.equal(t.gearFinalDrive,3.933);assert.equal(t.reverseRatio,3.909);assert.equal(d.car.mechanics.fuelLiters,63);assert.equal(t.drivetrain,'fwd');assert.equal(t.dragCoefficient,.32);assert.ok(c.provenance.estimates.some(s=>s.includes('with-driver')));assert.deepEqual(c.car.setup.tireSize,{widthMm:185,aspectRatio:65,wheelDiameterIn:15});});
test('Podmoss native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,3,4,5,6,7]);});

test('Podmoss production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Podmoss failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test("Naturally aspirated source engine is not mislabeled turbo",()=>{assert.equal(c.car.tuning.aspiration,"Naturally Aspirated");assert.equal(d.car.tuning.aspiration,"Naturally Aspirated");assert.equal(d.car.mechanics.boostBar,0);});

test("Podmoss wheel-opening instruments align with authored binnacle vertically",()=>{assert.equal(d.car.art.interior.steeringWheel.anchorY,660/793);assert.equal(c.car.art.interior.steeringWheel.anchorY,660/793);});
