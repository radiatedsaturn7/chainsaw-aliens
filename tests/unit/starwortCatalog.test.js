import {createVehicleRenderStateFromRunner} from '../../src/racing/simulation/VehicleRenderState.js';
import {axleTireGeometry} from '../../src/racing/TireSizes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Starwort 2005/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/starwort-2005/import.json',import.meta.url)));
test('Starwort native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Starwort production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Starwort failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const runner=s.vehicleDynamicsRunner;const render=createVehicleRenderStateFromRunner(runner);for(const id of ['fl','fr','rl','rr']){const expected=id.startsWith('f')?.29225:.29995;assert.ok(Math.abs(runner.config.wheelRadiusByWheelM[id]-expected)<1e-10);assert.ok(Math.abs(render.wheels[id].radiusM-expected)<1e-10);}
 const patches=runner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Starwort retains exact2005 anchors, provisional gears and independent staggered tire geometry',()=>{const{car}=c,t=car.tuning;assert.equal(t.weightKg,995.63525215);assert.equal(t.powerHp,138);assert.equal(t.torqueLbFt,125);assert.equal(t.drivetrain,'rwd');assert.equal(t.differentialAccel,0);assert.equal(t.differentialDecel,0);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);assert.deepEqual(t.gearRatios,[3.166,1.904,1.392,1.031,.815]);assert.equal(t.gearFinalDrive,4.312);assert.equal(t.reverseRatio,3.25);assert.deepEqual(car.transmissions.manual.gearRatios,t.gearRatios);assert.equal(car.transmissions.manual.label,'5MT');assert.equal(car.dimensions.wheelbaseM,2.4511);assert.equal(car.dimensions.lengthM,3.8861999999999997);assert.equal(t.physics.bodyProfile.overallHeightM,1.23952);assert.equal(t.physics.bodyProfile.groundClearanceM,4.9*.0254);assert.deepEqual(car.setup.tireSize,{widthMm:185,aspectRatio:55,wheelDiameterIn:15});assert.deepEqual(car.setup.tireSizeByAxle.rear,{widthMm:215,aspectRatio:45,wheelDiameterIn:16});for(const x of[c,d]){const g=axleTireGeometry(x.car.setup,x.car.tuning);assert.ok(Math.abs(g.wheelRadiusByWheelM.fl-.29225)<1e-10);assert.ok(Math.abs(g.wheelRadiusByWheelM.fr-.29225)<1e-10);assert.ok(Math.abs(g.wheelRadiusByWheelM.rl-.29995)<1e-10);assert.ok(Math.abs(g.wheelRadiusByWheelM.rr-.29995)<1e-10);assert.equal(g.wheelRadiusM,g.wheelRadiusByWheelM.rl);}assert.equal(t.wheelRadiusM,.29995);assert.equal(car.mechanics.fuelLiters,48.074729656799995);const notes=c.provenance.estimates.join(' ');assert.match(notes,/NOT exact2005 OEM verified/);assert.match(notes,/6800redline\/7000limiter/);assert.match(notes,/2195lb/);assert.match(notes,/optional LSD not assumed/);assert.ok(d.car.art.interior.steeringWheel.anchorX<.3);});
