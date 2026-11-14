import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import {axleTireGeometry} from '../../src/racing/TireSizes.js';
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/vesper-v6-2003/import.json',import.meta.url))),d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Vesper V6 2003/document.json',import.meta.url)));
test('Vesper exact OEM tooth reductions, German mass convention and staggered tires',()=>{const t=c.car.tuning;assert.equal(t.weightKg,1400);assert.equal(t.drivetrain,'rwd');assert.equal(t.engineDisplacementL,2.946);assert.ok(Math.abs(t.powerHp*.7456998715822702-187)<1e-9);assert.ok(Math.abs(t.torqueLbFt*1.3558179483314004-300)<1e-9);assert.deepEqual(t.gearRatios,[40/13,40/21,43/31,43/39,35/39,31/41]);assert.equal(t.gearFinalDrive,67/16);assert.equal(t.reverseRatio,47/27);assert.equal(d.car.mechanics.fuelTankGallons,61/3.785411784);const g=axleTireGeometry(c.car.setup,t);assert.ok(Math.abs(g.wheelRadiusByWheelM.fl-.3106)<1e-9);assert.ok(Math.abs(g.wheelRadiusByWheelM.rl-.3266)<1e-9);assert.ok(d.car.art.interior.steeringWheel.anchorX<.4);for(const g of d.car.art.gauges.interior.widgets)assert.ok(g.x+g.width<.42);assert.ok(Math.abs(t.engineCurve.torquePoints.find(p=>p.rpm===7150).torqueLbFt*7150/5252-t.powerHp)<1e-9);});
test('Vesper native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'dashboard');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Vesper production editor preview launches on tire support, not an occluding mid-engine box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Vesper failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

// Published-car snapshot includes owner gauge changes from 8f300e1, verified on f0e7c58.
// Original pre-gauge snapshot: 3a81422cc9da5c3099fc07fee8bc02595c6bd89616e62c37ef84bd97d55394e3
test('Naturally aspirated source label is corrected without physics or artwork changes',async()=>{const{createHash}=await import('node:crypto');for(const [car,expected]of[[c.car,'b5e5c6ae3407b0af73b44b34aa9530a0aed8fae7dc7437067acc8642e123115f'],[d.car,'b84c8d76ad897ffc38a625f97411b8a610d3101585a4ac18aadac7f5bb622bcd']]){assert.equal(car.tuning.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);const rest=structuredClone(car);delete rest.tuning.aspiration;assert.equal(createHash('sha256').update(JSON.stringify(rest)).digest('hex'),expected);}});
