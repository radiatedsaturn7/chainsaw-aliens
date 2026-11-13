import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Redbud V6 2007/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/redbud-v6-2007/import.json',import.meta.url)));
test('Redbud native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Redbud production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Redbud failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Redbud retains exact2007 OEM manual column with gear discrepancy disclosed',()=>{const{car}=c,t=car.tuning;assert.equal(t.weightKg,1495.94763626);assert.equal(t.powerHp,244);assert.equal(t.torqueLbFt,211);assert.equal(t.engineDisplacementL,2.997);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);assert.deepEqual(t.gearRatios,[3.933,2.487,1.7,1.25,.976,.771]);assert.equal(t.gearFinalDrive,3.286);assert.equal(t.reverseRatio,4.008);assert.deepEqual(car.transmissions.manual.gearRatios,t.gearRatios);assert.equal(car.transmissions.manual.label,'6MT');assert.equal(t.steeringRatio,15.22);assert.equal(car.dimensions.wheelbaseM,2.6695399999999996);assert.equal(car.dimensions.lengthM,4.77012);assert.equal(t.physics.bodyProfile.overallHeightM,1.41732);assert.deepEqual(car.setup.tireSize,{widthMm:215,aspectRatio:50,wheelDiameterIn:17});assert.equal(t.wheelRadiusM,.32339999999999997);assert.equal(car.mechanics.fuelLiters,64.7305415064);const notes=c.provenance.estimates.join(' ');assert.match(notes,/second gear2.487/);assert.match(notes,/2.478/);assert.match(notes,/6800redline\/7000limiter/);assert.match(notes,/3298lb/);assert.match(notes,/No verified factoryLSD/);assert.ok(d.car.art.interior.steeringWheel.anchorX<.3);});
