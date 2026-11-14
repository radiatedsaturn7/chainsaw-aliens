import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import RaceEditor from '../../src/ui/RaceEditor.js';import {axleTireGeometry} from '../../src/racing/TireSizes.js';
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/copperwing-2004/import.json',import.meta.url))),d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Copperwing 2004/document.json',import.meta.url)));
test('Copperwing native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,3,4,5,6,7]);});

test('Copperwing production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Copperwing failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Copperwing uses final owner chassis dimensions, NA six-speed and staggered axles',()=>{
const t=c.car.tuning;assert.equal(t.weightKg,1389);assert.ok(Math.abs(t.powerHp*.7456998715822702-160)<1e-8);assert.ok(Math.abs(t.torqueLbFt*1.3558179483314-310)<1e-8);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(t.drivetrain,'rwd');assert.deepEqual(t.gearRatios,[4.459,2.614,1.723,1.245,1,.838]);assert.equal(t.gearFinalDrive,3.27);assert.equal(d.car.mechanics.boostBar,0);assert.equal(d.car.mechanics.fuelLiters,60);assert.equal(d.car.defaultTransmissionType,'manual');assert.equal(c.car.dimensions.lengthM,4.058);assert.equal(c.car.tuning.physics.bodyProfile.overallHeightM,1.307);assert.equal(c.car.dimensions.wheelbaseM,2.4);assert.deepEqual(c.car.setup.tireSize,{widthMm:225,aspectRatio:40,wheelDiameterIn:18});assert.deepEqual(c.car.setup.tireSizeByAxle.rear,{widthMm:255,aspectRatio:35,wheelDiameterIn:19});assert.equal(c.provenance.sources.length,2);assert.ok(c.provenance.estimates.length>=4);for(const x of[c,d]){assert.doesNotMatch(x.car.description,/UK2004|utility|Turbocharged/);assert.equal(x.car.mechanics.fuelMpg,22);}
});

test('Copperwing nominal axle radii stay independent in runtime tuning',()=>{const g=axleTireGeometry(c.car.setup,c.car.tuning);assert.ok(Math.abs(g.wheelRadiusByWheelM.fl-.3186)<1e-10);assert.ok(Math.abs(g.wheelRadiusByWheelM.rl-.33055)<1e-10);assert.equal(g.wheelRadiusM,g.wheelRadiusByWheelM.rl);assert.equal(c.car.dimensions.trackFrontM,1.493);assert.equal(c.car.dimensions.trackRearM,1.502);assert.equal(c.car.tuning.physics.bodyProfile.frontOverhangM,.822);assert.equal(c.car.tuning.physics.bodyProfile.rearOverhangM,.836);});
