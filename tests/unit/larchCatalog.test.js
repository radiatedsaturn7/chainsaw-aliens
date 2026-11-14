import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import {axleTireGeometry} from '../../src/racing/TireSizes.js';
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/larch-turbo-1995/import.json',import.meta.url))),d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Larch Turbo 1995/document.json',import.meta.url)));
test('Larch sourced US four-speed ratios, mass derivation and explicit peak envelope',()=>{const t=c.car.tuning;assert.equal(t.weightKg,3455*.45359237);assert.equal(t.drivetrain,'fwd');assert.equal(t.powerHp,237);assert.equal(t.engineDisplacementL,2.319);assert.deepEqual(t.gearRatios,[3.61,2.06,1.37,.98]);assert.equal(t.gearFinalDrive,2.54);assert.equal(t.reverseRatio,3.95);assert.equal(d.car.defaultTransmissionType,'automatic');assert.equal(d.car.mechanics.fuelTankGallons,73/3.785411784);const g=axleTireGeometry(c.car.setup,t);assert.ok(Math.abs(g.wheelRadiusByWheelM.fl-.30815)<1e-9);assert.ok(c.provenance.estimates.some(s=>s.includes('NOT a timed30second')));assert.ok(d.car.art.interior.steeringWheel.anchorX<.3);for(const g of d.car.art.gauges.interior.widgets)assert.ok(g.x+g.width<.36);});
test('Larch native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'dashboard');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Larch production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Larch failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});
