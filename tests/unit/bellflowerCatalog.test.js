import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Bellflower 2006/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/bellflower-2006/import.json',import.meta.url)));
test('Bellflower native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Bellflower production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Bellflower failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Bellflower preserves US Sport5MT anchors and Canadian conflicts',()=>{const{car}=c,t=car.tuning;assert.equal(t.weightKg,1511.82336921);assert.equal(t.powerHp,157);assert.equal(t.torqueLbFt,148);assert.equal(t.torquePeakStartRpm,3500);assert.equal(t.engineDisplacementL,2.26);assert.equal(t.redlineRpm,6500);assert.equal(t.revLimitRpm,6800);assert.equal(t.frontWeightDistribution,.556);assert.equal(t.dragCoefficient,.29);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);assert.deepEqual(t.gearRatios,[3.31,1.84,1.31,.97,.76]);assert.equal(t.gearFinalDrive,4.39);assert.equal(t.reverseRatio,3.17);assert.deepEqual(car.transmissions.manual.gearRatios,t.gearRatios);assert.equal(car.transmissions.manual.label,'5MT');assert.equal(t.steeringRatio,16.2);assert.equal(car.dimensions.wheelbaseM,2.751);assert.equal(car.dimensions.lengthM,4.61);assert.equal(t.physics.bodyProfile.overallHeightM,1.631);assert.equal(t.physics.bodyProfile.groundClearanceM,.14);assert.deepEqual(car.setup.tireSize,{widthMm:205,aspectRatio:50,wheelDiameterIn:17});assert.equal(t.wheelRadiusM,.31839999999999996);assert.equal(car.mechanics.fuelLiters,60.1880473656);const notes=c.provenance.estimates.join(' ');assert.match(notes,/4500rpm/);assert.match(notes,/two decimals/);assert.match(notes,/6800limiter and750idle are estimates/);assert.match(notes,/3333lb/);assert.match(notes,/LADEN/);assert.ok(d.car.art.interior.steeringWheel.anchorX<.3);});
