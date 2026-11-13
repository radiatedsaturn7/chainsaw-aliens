import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Sorrel 133 2008/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/sorrel-2008/import.json',import.meta.url)));
test('Sorrel native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,7,2,3,4,5,6,1]);});

test('Sorrel production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Sorrel failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Sorrel uses sourced Sport chassis and explicit effective gearing, not guessed tooth ratios',()=>{const{car}=c,t=car.tuning,g=c.calculatedSimulationGearing;assert.equal(t.weightKg,1049);assert.equal(t.aspiration,'Naturally Aspirated');assert.equal(car.mechanics.boostBar,0);assert.equal(t.powerHp,98*1.3410220895950277);assert.equal(t.torqueLbFt,160*.737562149277);assert.equal(t.engineDisplacementL,1.598);assert.equal(car.dimensions.wheelbaseM,2.368);assert.equal(car.dimensions.lengthM,3.607);assert.equal(car.dimensions.widthM,1.688);assert.equal(car.dimensions.trackFrontM,1.46);assert.equal(car.dimensions.trackRearM,1.445);assert.equal(t.physics.bodyProfile.overallHeightM,1.46);assert.deepEqual(car.setup.tireSize,{widthMm:195,aspectRatio:45,wheelDiameterIn:16});assert.equal(t.wheelRadiusM,.29095);assert.equal(t.gearFinalDrive,4);assert.equal(t.reverseRatio,3.5);assert.deepEqual(d.car.tuning.gearRatios,t.gearRatios);assert.deepEqual(d.car.transmissions.manual.gearRatios,t.gearRatios);for(let i=0;i<5;i++){const speed=2*Math.PI*.29095*60/(t.gearRatios[i]*t.gearFinalDrive);assert.ok(Math.abs(speed-g.publishedRoadSpeedKmhPer1000Rpm[i])<1e-10);}const notes=c.provenance.estimates.join(' ');assert.match(notes,/NOT real final drive/);assert.match(notes,/Reverse3.5/);assert.match(notes,/715\/375/);assert.match(notes,/MVODM/);assert.ok(d.car.art.interior.steeringWheel.anchorX>.7);});

test('Sorrel effective gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<5;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,4);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});
