import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCarSheet, carSheetDocument, assignCarTireSheet } from '../../src/racing/CarGraphicImport.js';
import { buildWheelCylinder, drawWheelCylinder } from '../../src/racing/CarWheelCylinder.js';
import { getCarViewCameraYaw } from '../../src/racing/CarDirectionalArt.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

for (const [columns, rows] of [[2,1],[1,2],[2,2],[4,2]]) test(`tire ${columns}x${rows} extracts cells and defaults to tread 1 and wheel ${columns*rows===8?3:2}`, () => {
  const width=columns*8, height=rows*8, data=new Uint8ClampedArray(width*height*4);
  // Sprites have transparent gutters; fixed grid cuts are never allowed.
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) if(x%8>0 && x%8<7 && y%8>0 && y%8<7) data.set([Math.floor(y/8)*columns+Math.floor(x/8)+1,0,0,255],(y*width+x)*4);
  const prepared=prepareCarSheet({width,height,data},{columns,rows,tireSheet:true});
  const doc=carSheetDocument(null,prepared);
  assert.equal(doc.frames.length,columns*rows);
  const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
  assignCarTireSheet(editor.selectedCar,'wheel-sheet',doc);
  const car=editor.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(editor.serializeSelectedCarDocument())).car);
  assert.equal(car.art.tireSurfaces.tread.frameIndex,0);
  assert.equal(car.art.tireSurfaces.wheel.frameIndex,columns*rows===8?2:1);
  assert.equal(car.art.angleLayers.right.tires.frameIndex,columns*rows===8?2:1);
  assert.equal(car.art.angleLayers.front.tires.frameIndex,0);
  assert.deepEqual(car.art.tireSurfaces.tread.bounds,{x:1.5,y:1.5,width:5,height:5});
  assert.ok(editor.collectRaceCarArtRefs(car).includes('wheel-sheet'));
  assert.equal(doc.frames[car.art.tireSurfaces.wheel.frameIndex][9],columns*rows===8?'#030000':'#020000');
});

test('wheel is a cylinder: front exposes tread, side exposes cap, diagonal exposes both; spin rotates vertices', () => {
  const front=buildWheelCylinder({bearing:0}), side=buildWheelCylinder({bearing:Math.PI/2}), diagonal=buildWheelCylinder({bearing:Math.PI/4});
  assert.ok(front.every(t=>t.surface==='tread'));
  assert.ok(side.every(t=>t.surface==='wheel'));
  assert.deepEqual(new Set(diagonal.map(t=>t.surface)),new Set(['tread','wheel']));
  assert.notDeepEqual(buildWheelCylinder({bearing:0,spin:0.2}),front);
  for(const triangle of diagonal) for(const p of triangle.points) assert.ok(Number.isFinite(p.x+p.y+p.z));
  const textures=[];
  const ctx=new Proxy({imageSmoothingEnabled:true,drawImage:t=>textures.push(t.role)}, { get:(o,k)=>k in o?o[k]:()=>{} });
  assert.equal(drawWheelCylinder(ctx,{tread:{role:'tread',width:8,height:16},wheel:{role:'wheel',width:16,height:16},bearing:Math.PI/4}),true);
  assert.deepEqual(new Set(textures),new Set(['tread','wheel']));
  assert.equal(ctx.imageSmoothingEnabled,true);
});

test('live car renderer uses tread and rim textures at diagonals and respects hidden wheels', () => {
  const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
  const doc={width:2,height:2,frames:Array.from({length:8},()=>Array(4).fill('#ffffff'))};
  assignCarTireSheet(e.selectedCar,'tires',doc);
  const images=[];
  e.getRaceArtSpriteCanvas=(ref,{frameIndex=0}={})=>({ref,frameIndex,width:2,height:2});
  const ctx=new Proxy({imageSmoothingEnabled:true,drawImage:t=>images.push(t.frameIndex)}, {get:(o,k)=>k in o?o[k]:()=>{}});
  const choice=e.getRaceCarProjectedArtRef(e.selectedCar,0,getCarViewCameraYaw('frontRight'));
  e.drawRaceCarBillboardLayers(ctx,{car:e.selectedCar,artChoice:choice,drawBodyLayer:false,drawShadowLayer:false,tireScroll:0.1});
  assert.ok(images.includes(0)); assert.ok(images.includes(2));
  images.length=0;
  e.selectedCar.art.angleLayers.frontRight.tires.tireMode='hidden';
  e.drawRaceCarBillboardLayers(ctx,{car:e.selectedCar,artChoice:choice,drawBodyLayer:false,drawShadowLayer:false});
  assert.equal(images.length,0);
});

test('diagonal cylinder rim faces the correct side of the tread in the car camera basis', () => {
  const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
  for(const degrees of [45,135,225,315]) {
    const bearing=degrees*Math.PI/180;
    const triangles=buildWheelCylinder({width:20,height:50,bearing});
    const cap=triangles.find(t=>t.surface==='wheel');
    const center=cap.points[0];
    // The axle points along world X for yaw=0. Pick the end closest to
    // the camera, then compare its screen displacement to the car projector.
    const cameraYaw=bearing-Math.PI;
    const visibleAxleEnd=Math.sign(Math.sin(bearing))*10;
    const cameraPoint=e.transformRaceWorldPointToCameraSpace({x:visibleAxleEnd,z:0,elevation:0},{},cameraYaw);
    assert.ok(Math.abs(center.x-cameraPoint.cameraX)<1e-9, `${degrees}° rim on wrong side`);
    assert.ok(Math.abs(center.z+cameraPoint.cameraZ)<1e-9, `${degrees}° rim depth is reversed`);
    assert.ok(center.z>0);
  }
});

test('cardinal cylinder views retain their shape and texture roles after the diagonal facing fix', () => {
  for(const degrees of [0,90,180,270]) {
    const bearing=degrees*Math.PI/180;
    const triangles=buildWheelCylinder({width:20,height:50,bearing});
    const points=triangles.flatMap(t=>t.points);
    const span=Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x));
    assert.ok(Math.abs(span-(degrees%180===0?20:50))<1e-8);
    assert.ok(triangles.every(t=>t.surface===(degrees%180===0?'tread':'wheel')));
    if(degrees%180!==0) {
      // Preserve the upright rim's horizontal texture direction at each side.
      for(const t of triangles) t.points.forEach((p,i)=>{
        assert.ok(Math.abs(p.x-(t.uv[i][0]-0.5)*50*Math.sin(bearing))<1e-8);
        assert.ok(Math.abs(p.y-(t.uv[i][1]-0.5)*50)<1e-8);
      });
    }
  }
});
