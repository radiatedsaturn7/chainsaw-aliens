import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import {axleTireGeometry} from '../../src/racing/TireSizes.js';
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/dewskipper-2004/import.json',import.meta.url))),d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Dewskipper 2004/document.json',import.meta.url)));
test('Dewskipper preserves UK2004 standard roadster and overall reductions once',()=>{const t=c.car.tuning;assert.equal(t.weightKg,790);assert.ok(Math.abs(t.powerHp*.7456998715822702-60)<1e-8);assert.ok(Math.abs(t.torqueLbFt*1.3558179483314-110)<1e-8);assert.equal(t.aspiration,'Turbocharged');for(const [i,total]of[13.250,9.604,7.370,5.796,4.208,3.230].entries())assert.ok(Math.abs(t.gearRatios[i]*t.gearFinalDrive-total)<1e-9);assert.equal(d.car.mechanics.boostBar,1);assert.equal(d.car.mechanics.fuelLiters,35);assert.equal(t.drivetrain,'rwd');assert.equal(d.car.defaultTransmissionType,'automatic');assert.equal(d.car.transmissions.automatic.torqueConverterSlip,0);assert.deepEqual(c.car.setup.tireSize,{widthMm:185,aspectRatio:55,wheelDiameterIn:15});});
test('Dewskipper native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,3,4,5,6,7]);});

test('Dewskipper production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Dewskipper failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Dewskipper description and fuel economy match its roadster source',()=>{for(const x of [c,d]){assert.match(x.car.description,/UK2004 60kW standard roadster/);assert.doesNotMatch(x.car.description,/utility|2019|4H/);assert.ok(Math.abs(x.car.mechanics.fuelMpg-235.214583/5.1)<1e-5);}});
