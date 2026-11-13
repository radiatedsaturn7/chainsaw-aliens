import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Clover Sport 2007/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/clover-2007/import.json',import.meta.url)));
test('Clover native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Clover production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Clover failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Clover US Sport5MT uses production OEM ratings, not preview/base/AT',()=>{const{car}=c,t=car.tuning;assert.equal(t.weightKg,1120.82674627);assert.equal(t.powerHp,109);assert.equal(t.torqueLbFt,105);assert.equal(t.engineDisplacementL,1.497);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);assert.equal(t.redlineRpm,6500);assert.equal(t.steeringRatio,12.8);assert.equal(t.frontWeightDistribution,.62);assert.deepEqual(t.gearRatios,[3.462,1.87,1.321,.97,.757]);assert.equal(t.gearFinalDrive,4.29);assert.equal(t.reverseRatio,3.231);assert.deepEqual(car.transmissions.manual.gearRatios,t.gearRatios);assert.equal(car.transmissions.manual.label,'5MT');assert.equal(car.dimensions.wheelbaseM,2.4511);assert.equal(car.dimensions.lengthM,3.99796);assert.equal(car.dimensions.widthM,1.68148);assert.equal(t.physics.bodyProfile.overallHeightM,1.524);assert.deepEqual(car.setup.tireSize,{widthMm:195,aspectRatio:55,wheelDiameterIn:15});assert.equal(t.wheelRadiusM,.29775);assert.equal(car.mechanics.fuelLiters,40.8824472672);const notes=c.provenance.estimates.join(' ');assert.match(notes,/4.294/);assert.match(notes,/2471lb/);assert.match(notes,/not verified exact fuel-cut/);assert.ok(d.car.art.interior.steeringWheel.anchorX<.3);assert.equal(c.cockpitCalibration.wheelPivotAndWidthPixels[0],500);});
