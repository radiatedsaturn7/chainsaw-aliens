import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Sunmallow 2006/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/sunmallow-2006/import.json',import.meta.url)));
test('Sunmallow candidate preserves US2006 base5MT source, not GXP',()=>{
 const {car}=c,t=car.tuning;
 assert.equal(t.powerHp,177);assert.equal(t.torqueLbFt,166);assert.equal(t.weightKg,1297);assert.equal(t.engineDisplacementL,2.384);assert.equal(t.revLimitRpm,7000);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(t.drivetrain,'rwd');assert.equal(car.mechanics.boostBar,0);
 assert.deepEqual(t.gearRatios,[3.75,2.26,1.37,1,.73]);assert.equal(t.gearFinalDrive,3.91);assert.equal(t.reverseRatio,3.67);assert.equal(car.transmissions.manual.label,'5MT');assert.deepEqual(car.transmissions.manual.gearRatios,t.gearRatios);
 assert.equal(car.dimensions.lengthM,3.992);assert.equal(car.dimensions.wheelbaseM,2.415);assert.equal(car.dimensions.trackFrontM,1.543);assert.equal(car.dimensions.trackRearM,1.561);assert.equal(t.physics.bodyProfile.overallHeightM,1.273);
 assert.equal(car.mechanics.fuelTankGallons,13.8);assert.equal(car.mechanics.fuelLiters,13.8*3.785411784);assert.deepEqual(car.setup.tireSize,{widthMm:245,aspectRatio:45,wheelDiameterIn:18});assert.equal(car.setup.tireSizeByAxle,undefined);assert.equal(t.wheelRadiusM,.33885);
});
test('Sunmallow candidate preserves mapped angles and has explicitly attributed estimates',()=>{assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);assert.equal(c.provenance.sources.length,1);assert.ok(c.provenance.estimates.length>=4);assert.equal(c.car.camera.trackingMode,'fixed-rear');assert.equal(c.car.art.gauges.interior.coordinateSpace,'wheel-opening');});
test('Sunmallow native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Sunmallow production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Sunmallow failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});
