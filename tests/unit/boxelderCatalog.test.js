import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Boxelder 2005/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/boxelder-2005/import.json',import.meta.url)));
test('Boxelder native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Boxelder production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Boxelder failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Boxelder retains primary brochure anchors and explicitly provisional secondary gearing',()=>{const{car}=c,t=car.tuning;assert.equal(t.weightKg,1086.35372615);assert.equal(t.powerHp,108);assert.equal(t.torqueLbFt,105);assert.equal(t.engineDisplacementL,1.497);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);assert.deepEqual(t.gearRatios,[3.545,1.904,1.31,.969,.815]);assert.equal(t.gearFinalDrive,4.312);assert.equal(t.reverseRatio,3.25);assert.deepEqual(car.transmissions.manual.gearRatios,t.gearRatios);assert.equal(car.dimensions.wheelbaseM,2.4993600000000002);assert.equal(car.dimensions.lengthM,3.94462);assert.equal(t.physics.bodyProfile.overallHeightM,1.6408399999999999);assert.equal(t.physics.bodyProfile.groundClearanceM,6.1*.0254);assert.deepEqual(car.setup.tireSize,{widthMm:185,aspectRatio:60,wheelDiameterIn:15});assert.equal(t.wheelRadiusM,.3015);assert.equal(car.mechanics.fuelLiters,45.0464002296);const notes=c.provenance.estimates.join(' ');assert.match(notes,/secondary-corroborated provisional/);assert.match(notes,/NOT exact2005 primary verified/);assert.match(notes,/6500redline\/6700limiter/);assert.match(notes,/2395lb/);assert.match(notes,/OEM center-mounted/);assert.ok(d.car.art.interior.steeringWheel.anchorX<.3);});
