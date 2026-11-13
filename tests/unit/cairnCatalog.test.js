import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import {axleTireGeometry} from '../../src/racing/TireSizes.js';
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/cairn-1974/import.json',import.meta.url))),d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Cairn 1974/document.json',import.meta.url)));
test('Cairn reconciles primary metric output, curb mass and original four speed ratios',()=>{const t=c.car.tuning;assert.ok(Math.abs(t.powerHp*0.7456998715822702-125)<1e-9);assert.ok(Math.abs(t.torqueLbFt*1.3558179483314004-240)<1e-9);assert.equal(t.weightKg,1080);assert.equal(t.engineDisplacementL,1.99);assert.equal(c.car.transmissions.manual.label,'4MT');assert.deepEqual(t.gearRatios,[3.764,2.09,1.32,1]);assert.equal(t.gearFinalDrive,3.36);assert.equal(t.reverseRatio,4.096);assert.equal(t.rearDifferentialAccel,.4);assert.equal(t.steeringRatio,17.57);assert.ok(c.provenance.estimates.some(s=>s.includes('NOT original brochure1035kg')));const g=axleTireGeometry(c.car.setup,t);assert.ok(Math.abs(g.wheelRadiusByWheelM.fl-.2946)<1e-9);assert.equal(g.wheelRadiusByWheelM.fl,g.wheelRadiusByWheelM.rr);assert.ok(Math.abs(t.engineCurve.torquePoints.find(p=>p.rpm===5800).torqueLbFt*5800/5252-t.powerHp)<1e-9);assert.equal(d.car.mechanics.fuelTankGallons,70/3.785411784);});
test('Cairn native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'dashboard');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Cairn production editor preview launches on tire support, not an occluding sedan box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Cairn failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});
