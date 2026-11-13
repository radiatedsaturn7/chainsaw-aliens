import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Cubby 1.8 2014/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/cubby-2014/import.json',import.meta.url)));
test('Cubby US2014 S6MT excludes CVT/SL specs',()=>{
 const {car}=c,t=car.tuning;
 assert.equal(t.drivetrain,'fwd');assert.equal(t.powerHp,122);assert.equal(t.torqueLbFt,127);assert.equal(t.engineDisplacementL,1.798);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);assert.equal(t.weightKg,2798*.45359237);
 assert.deepEqual(t.gearRatios,[3.727,2.105,1.451,1.171,.971,.81]);assert.equal(t.gearFinalDrive,3.933);assert.equal(t.reverseRatio,3.686);assert.deepEqual(car.transmissions.manual.gearRatios,t.gearRatios);assert.equal(car.transmissions.manual.gearFinalDrive,3.933);assert.equal(car.transmissions.manual.label,'6MT');assert.equal(car.defaultTransmissionType,'manual');
 assert.deepEqual(car.setup.tireSize,{widthMm:195,aspectRatio:60,wheelDiameterIn:15});assert.equal(t.wheelRadiusM,.3075);assert.equal(car.setup.tireSizeByAxle,undefined);assert.equal(car.mechanics.fuelLiters,13.2*3.785411784);
});
test('Cubby preserves height discrepancy, consistent inches and documented runtime estimates',()=>{
 const {car}=c,t=car.tuning,p=t.physics.bodyProfile;
 assert.equal(p.overallHeightM,65*.0254);assert.equal(car.dimensions.wheelbaseM,99.6*.0254);assert.equal(car.dimensions.trackFrontM,58.1*.0254);assert.equal(car.dimensions.trackRearM,58.3*.0254);assert.equal(p.groundClearanceM,6.3*.0254);assert.equal(t.frontWeightDistribution,1644/2798);assert.equal(t.dragCoefficient,.35);assert.equal(t.revLimitRpm,6400);
 const notes=c.provenance.estimates.join(' ');assert.match(notes,/1680|1.680/);assert.match(notes,/not verified fuel-cut|not OEM fuel-cut/);assert.match(notes,/brake-based/);assert.equal(c.provenance.sources.length,3);assert.equal(t.frontDifferentialAccel,0);
});
test('Cubby native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Cubby production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Cubby failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});
