import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Buttoncap Turbo 2003/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/buttoncap-2003/import.json',import.meta.url)));
test('Buttoncap native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(d.car));assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Buttoncap production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Buttoncap failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Buttoncap German2003 export anchors retain market and source uncertainty',()=>{const {car}=c,t=car.tuning,p=t.physics.bodyProfile;assert.equal(t.weightKg,830);assert.equal(t.engineDisplacementL,.659);assert.equal(t.aspiration,'Turbocharged');assert.equal(car.mechanics.boostBar,.9);assert.equal(car.mechanics.fuelLiters,40);assert.equal(t.powerHp,50*1.3410220895950277);assert.equal(t.torqueLbFt,100*.737562149277);assert.equal(t.drivetrain,'fwd');assert.equal(car.dimensions.wheelbaseM,2.225);assert.equal(t.dragCoefficient,.382);assert.deepEqual(t.gearRatios,[3.181,1.842,1.25,.916,.707]);assert.equal(t.gearFinalDrive,5.545);assert.equal(t.reverseRatio,3.142);assert.deepEqual(car.transmissions.manual.gearRatios,t.gearRatios);assert.equal(car.transmissions.manual.label,'5MT');assert.equal(t.wheelRadiusM,.273);assert.deepEqual(car.setup.tireSize,{widthMm:165,aspectRatio:50,wheelDiameterIn:15});assert.equal(p.overallHeightM,1.245);const notes=c.provenance.estimates.join(' ');assert.match(notes,/homologation/);assert.match(notes,/165\/60/);assert.match(notes,/convention/);assert.match(c.provenance.inspiration,/German/);assert.ok(d.car.art.interior.steeringWheel.anchorX>.7);assert.equal(c.cockpitCalibration.wheelPivotAndWidthPixels[0],1460);});
