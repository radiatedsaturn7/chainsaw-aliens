import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {carChaseClearanceLift,rearArtworkMiddleHeight} from '../../src/racing/CarChaseFraming.js';
import data from '../../src/racing/CarChaseFramingData.js';
const root='data/server-storage/files/';
const read=p=>{const d=JSON.parse(fs.readFileSync(p));return d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
const cars=Object.entries(read(root+'manifest.json').folders.cars).map(([name,p])=>({name,car:read(root+p).car}));
test('catalog chase framing keeps upright body middles at or below the RTG reference',()=>{
 const reference=rearArtworkMiddleHeight(data.reference);let corrected=0;
 for(const {name,car} of cars){const before=JSON.stringify(car),middle=rearArtworkMiddleHeight(car),lift=carChaseClearanceLift(car);
  assert.ok(Number.isFinite(lift)&&lift>=0,name);
  if(middle!==null)assert.ok(middle-lift<=reference+1e-9,name);
  if(lift>0)corrected++;
  assert.equal(JSON.stringify(car),before,'framing must not change car geometry or physics');
 }
 assert.ok(corrected>0);assert.equal(carChaseClearanceLift(data.reference),0);
});
test('missing artwork leaves existing framing intact',()=>assert.equal(carChaseClearanceLift({}),0));
test('every saved car now has interior gauges; catalog dials use their palette rather than fixed arc graphics',()=>{
 for(const {name,car} of cars){const layout=car.art.gauges.interior;assert.ok(layout?.enabled&&layout.widgets.length,name);
  const path=`assets/car-catalog/${car.id}/import.json`;if(!fs.existsSync(path))continue;
  const cal=read(path).cockpitCalibration;if(!cal)continue;
  assert.ok(layout.widgets.length>4,name);
  const rpm=layout.widgets.find(g=>g.source==='rpm');
  if(rpm){assert.equal(rpm.safeArcArtRef,'',name);assert.equal(rpm.dangerArcArtRef,'',name);assert.equal(rpm.tachometer.safeColor,cal.gaugeColor||layout.widgets.find(g=>g.source==='speed').color,name);}
  if(cal.gaugeColor)assert.equal(layout.widgets.find(g=>g.source==='speed').textColor,cal.gaugeColor,name);
 }
});

test('live chase camera applies clearance without moving the vehicle; RTG framing stays unchanged',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 const editor=new RaceEditor({});
 const pose={x:0,z:0,elevation:.05};
 editor.getRacePlayerRenderPose=()=>pose;
 editor.isCarExteriorArtPreview=()=>true;
 const tall=cars.reduce((a,b)=>carChaseClearanceLift(a.car)>carChaseClearanceLift(b.car)?a:b).car;
 editor.getRaceSessionCar=()=>data.reference;
 const original=editor.getRaceThirdPersonCameraEyeHeight({},0);
 editor.getRaceSessionCar=()=>tall;
 assert.ok(Math.abs((editor.getRaceThirdPersonCameraEyeHeight({},0)-original)*12-carChaseClearanceLift(tall))<1e-9);
 assert.deepEqual(pose,{x:0,z:0,elevation:.05});
});
