import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const d=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/Glowmoth SC 1988/document.json',import.meta.url)));
const c=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/glowmoth-sc-1988/import.json',import.meta.url)));
test('Glowmoth native editor roundtrip retains fixedrear, dashboard gauges and tire visibility',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});assert.deepEqual(e.serializeSelectedCarDocument().car,d.car);assert.equal(d.car.camera.trackingMode,'fixed-rear');assert.equal(d.car.art.interior.steeringWheel.artRef,'steeringwheel');assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');for(const l of Object.values(d.car.art.angleLayers))assert.equal(l.tires.tireMode,'auto');assert.deepEqual(c.mapping,[0,1,2,5,4,3,6,7]);});

test('Glowmoth production editor preview launches on tire support, not an occluding body box',()=>{
 assert.equal(c.car.tuning.physics.bodyProfile.wheelWellAware,true);
 assert.equal(d.car.tuning.physics.bodyProfile.wheelWellAware,true);
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false,exitRaceEditor(){}},{mode:'car'});
 e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});
 const preview=e.ensureCarEditorPreviewPlaytestSession();assert.ok(preview?.session);
 preview.session.startupFramePending=false;
 const start={x:preview.session.worldX,z:preview.session.worldZ};
 for(let i=0;i<180;i++)e.updateCarEditorPreviewPlaytest(1/60);
 const s=e.carEditorPreviewPlaytest.session;
 assert.ok(s.speedMps>.25,`Glowmoth failed production launch: ${s.speedMps}m/s`);
 assert.ok(Math.hypot(s.worldX-start.x,s.worldZ-start.z)>.05);
 assert.equal(e.carEditorPreviewRuntimeFailureMessage,'');
 const patches=s.vehicleDynamicsRunner.state.contactPatches;
 assert.equal(Object.keys(patches).length,4);
 for(const patch of Object.values(patches))assert.notEqual(patch.invalidContactReason,'body-occluded');
 e.disposeRacePlaytestSession(s,'test-complete');
});

test('Glowmoth preserves OEM supercharged variant facts and secondary gearbox caveat',()=>{const {car}=c,t=car.tuning;assert.equal(t.powerHp,145);assert.equal(t.torqueLbFt,140);assert.equal(t.weightKg,2493*.45359237);assert.equal(t.engineDisplacementL,1.587);assert.equal(t.aspiration,'Supercharged');assert.equal(t.drivetrain,'rwd');assert.deepEqual(t.gearRatios,[3.23,1.913,1.258,.918,.731]);assert.equal(t.gearFinalDrive,4.285);assert.equal(t.reverseRatio,3.583);assert.equal(t.wheelRadiusM,.2888);assert.deepEqual(car.setup.tireSize,{widthMm:185,aspectRatio:60,wheelDiameterIn:14});assert.equal(car.dimensions.wheelbaseM,91.3*.0254);assert.equal(car.mechanics.fuelTankGallons,10.8);assert.equal(t.frontWeightDistribution,.42);assert.equal(t.dragCoefficient,.36);assert.equal(t.rearDifferentialAccel,0);const notes=c.provenance.estimates.join(' ');for(const pattern of [/SECONDARY gearing/,/NOT OEM numeric verification/,/simulation estimates/,/no driver mass adjustment/,/T-bar/,/DOES NOT physically simulate|does NOT physically simulate/,/not an unrelated body family/])assert.match(notes,pattern);assert.ok(d.car.art.interior.steeringWheel.anchorX<.4);assert.deepEqual(c.cockpitCalibration.wheelPivotAndWidthPixels,[525,755,250]);assert.equal(d.car.art.gauges.interior.coordinateSpace,'wheel-opening');});
test('Glowmoth conventional gearing remains editable through actual bounded editor fields',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:d.car.name});for(let i=0;i<5;i++){const ratio=c.car.tuning.gearRatios[i];assert.ok(ratio>=.35&&ratio<=5.5);assert.equal(e.setCarTuneNumericValue(`gearRatio-${i+1}`,ratio),true);}const saved=e.serializeSelectedCarDocument().car;assert.deepEqual(saved.tuning.gearRatios,c.car.tuning.gearRatios.map(x=>Math.round(x*1000)/1000));assert.equal(saved.transmissions.manual.gearFinalDrive,4.285);const second=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});second.applyLoadedCarDocument({kind:'race-car',car:saved},{name:saved.name});assert.deepEqual(second.serializeSelectedCarDocument().car,saved);});

test('Glowmoth diagonal graphical tires stay within native wheel wells and sill envelope',async()=>{
 const {decodePng}=await import('../../scripts/car-catalog-import.mjs');
 const {prepareCarSheet}=await import('../../src/racing/CarGraphicImport.js');
 const {gunzipSync}=await import('node:zlib');
 const root=new URL('../../',import.meta.url),source=decodePng(new URL('assets/car-catalog/glowmoth-sc-1988/body.png',root).pathname),prepared=prepareCarSheet(source);
 const packed=JSON.parse(fs.readFileSync(new URL('data/server-storage/files/art/catalog-glowmoth-sc-1988-body/document.json',root))),art=packed.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(packed.data,'base64'))):packed;
 const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'}),car=d.car;
 for(const [index,slot]of [[1,'frontRight'],[3,'rearRight'],[5,'rearLeft'],[7,'frontLeft']]){
  const layer=car.art.angleLayers[slot],crop=prepared.crops[c.mapping[index]],neutral=structuredClone(car);neutral.art.tireScaleX=neutral.art.tireScaleY=1;
  const rig=e.getRaceSpriteWheelRig({car:neutral,viewSlot:slot,bodyBaseWidth:100}),scale=100*layer.body.transforms.bodyScaleX/art.width;
  for(const a of c.authoredWheelAnchors[slot]){
   const radius=rig.wheels[a.wheel].height*layer.tires.transforms.tireScaleY/2/scale;
   assert.ok(radius<=55,`${slot}/${a.wheel}: no oversized diagonal truck tire`);
   assert.ok(a.y+radius<=crop.y+crop.height+15,`${slot}/${a.wheel}: lower tire edge stays near body sill`);
  }
 }
 assert.equal(car.tuning.wheelRadiusM,.2888);assert.deepEqual(car.setup.tireSize,{widthMm:185,aspectRatio:60,wheelDiameterIn:14});
});
