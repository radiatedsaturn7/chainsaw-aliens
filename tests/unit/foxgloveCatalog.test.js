import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import {createVehicleRenderStateFromRunner} from '../../src/racing/simulation/VehicleRenderState.js';
import {axleTireGeometry} from '../../src/racing/TireSizes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Foxglove Z 2003/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/foxglove-z-2003/import.json',import.meta.url)));
test('Foxglove native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Foxglove production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Foxglove failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const runner=s.vehicleDynamicsRunner;const render=createVehicleRenderStateFromRunner(runner);for(const id of ['fl','fr','rl','rr']){const expected=id.startsWith('f')?.3284:.3334;assert.ok(Math.abs(runner.config.wheelRadiusByWheelM[id]-expected)<1e-10);assert.ok(Math.abs(render.wheels[id].radiusM-expected)<1e-10);}
 const patches=runner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Foxglove preserves base trim, verified manual gears and staggered radii with honest provenance',()=>{const{car}=c,t=car.tuning;assert.equal(t.powerHp,287);assert.equal(t.torqueLbFt,274);assert.equal(t.weightKg,3188*.45359237);assert.equal(t.frontWeightDistribution,.53);assert.equal(t.differentialAccel,0);assert.equal(t.differentialDecel,0);assert.equal(t.drivetrain,'rwd');assert.deepEqual(t.gearRatios,[3.794,2.324,1.624,1.271,1,.794]);assert.equal(t.reverseRatio,3.446);assert.equal(t.gearFinalDrive,3.538);assert.equal(car.transmissions.manual.label,'6MT');assert.equal(car.dimensions.wheelbaseM,104.3*.0254);assert.equal(car.dimensions.lengthM,169.6*.0254);assert.equal(car.mechanics.fuelLiters,76);assert.equal(t.redlineRpm,6600);assert.equal(t.revLimitRpm,6800);assert.deepEqual(car.setup.tireSizeByAxle.front,{widthMm:225,aspectRatio:50,wheelDiameterIn:17});assert.deepEqual(car.setup.tireSizeByAxle.rear,{widthMm:235,aspectRatio:50,wheelDiameterIn:17});for(const x of[c,d]){const g=axleTireGeometry(x.car.setup,x.car.tuning);assert.ok(Math.abs(g.wheelRadiusByWheelM.fl-.3284)<1e-10);assert.ok(Math.abs(g.wheelRadiusByWheelM.rr-.3334)<1e-10);}const notes=c.provenance.estimates.join(' ');assert.match(notes,/NOT authenticated original scan/);assert.match(notes,/NOT proven fuelcut/);assert.match(notes,/not optional VLSD/);assert.match(notes,/secondary typo .974/);});
