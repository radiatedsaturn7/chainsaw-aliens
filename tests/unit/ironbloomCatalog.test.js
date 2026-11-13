import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Ironbloom GT 2005/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/ironbloom-gt-2005/import.json',import.meta.url)));
test('Ironbloom native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Ironbloom production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Ironbloom failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Ironbloom selects later production transcription with explicit provenance limits',()=>{const{car}=c,t=car.tuning;assert.equal(t.weightKg,1582);assert.equal(t.powerHp,300);assert.equal(t.torqueLbFt,320);assert.equal(t.drivetrain,'rwd');assert.equal(t.frontWeightDistribution,850/1582);assert.equal(t.idleRpm,740);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);assert.deepEqual(t.gearRatios,[3.38,2,1.32,1,.675]);assert.equal(t.gearFinalDrive,3.55);assert.equal(t.reverseRatio,3.38);assert.deepEqual(car.transmissions.manual.gearRatios,t.gearRatios);assert.equal(car.transmissions.manual.label,'5MT');assert.equal(car.dimensions.wheelbaseM,2.72);assert.equal(car.dimensions.lengthM,4.775);assert.equal(car.dimensions.widthM,1.877);assert.equal(car.dimensions.trackFrontM,1.582);assert.equal(car.dimensions.trackRearM,1.588);assert.equal(t.physics.bodyProfile.overallHeightM,1.407);assert.deepEqual(car.setup.tireSize,{widthMm:235,aspectRatio:55,wheelDiameterIn:17});assert.equal(car.setup.tireSizeByAxle,undefined);assert.equal(t.wheelRadiusM,.34515);assert.equal(car.mechanics.fuelLiters,16*3.785411784);const notes=c.provenance.estimates.join(' ');assert.match(notes,/NOT authenticated original scan/);assert.match(notes,/SAE J1100/);assert.match(notes,/6200redline\/6500limiter/);assert.match(notes,/preliminary ratios/);assert.match(notes,/Differential preload/);assert.ok(d.car.art.interior.steeringWheel.anchorX<.3);});
