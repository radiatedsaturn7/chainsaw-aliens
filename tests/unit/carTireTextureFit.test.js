import test from 'node:test';
import assert from 'node:assert/strict';
import { largestOpaqueRectangle, largestOpaqueCircle, fitTireTextureRegions, normalizeTireSheetOpacity } from '../../src/racing/CarTireTextureFit.js';
import { prepareCarSheet } from '../../src/racing/CarGraphicImport.js';
import { buildWheelCylinder } from '../../src/racing/CarWheelCylinder.js';

test('largest tread rectangle avoids transparent holes and finds the maximum area', () => {
  const width=9,height=8, mask=new Uint8Array(width*height);
  for(let y=1;y<7;y++) for(let x=1;x<8;x++) mask[y*width+x]=1;
  mask[3*width+4]=0;
  const rect=largestOpaqueRectangle(mask,width,height);
  let best=0;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) for(let h=1;y+h<=height;h++) for(let w=1;x+w<=width;w++) {
    let safe=true;
    for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) if(!mask[yy*width+xx]) safe=false;
    if(safe) best=Math.max(best,w*h);
  }
  assert.equal(rect.width*rect.height,best);
});

function bruteRadius(mask,width,height,cx,cy) {
  let radius=Math.min(cx,cy,width-cx,height-cy);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) if(!mask[y*width+x]) {
    const dx=Math.max(x-cx,0,cx-x-1),dy=Math.max(y-cy,0,cy-y-1);
    radius=Math.min(radius,Math.hypot(dx,dy));
  }
  return radius;
}
test('largest wheel circle matches exhaustive distance-to-transparent-squares search', () => {
  for(let seed=1;seed<16;seed++) {
    const width=11,height=9, mask=new Uint8Array(width*height);
    for(let i=0;i<mask.length;i++) mask[i]=(i*17+seed*23)%29<24?1:0;
    const circle=largestOpaqueCircle(mask,width,height);
    let best=0;
    for(let y=0.5;y<height;y+=0.5) for(let x=0.5;x<width;x+=0.5) best=Math.max(best,bruteRadius(mask,width,height,x,y));
    assert.ok(Math.abs(circle.radius-best)<1e-8,`${seed}: ${circle.radius} vs ${best}`);
    assert.ok(Math.abs(circle.radius-bruteRadius(mask,width,height,circle.x,circle.y))<1e-8);
  }
  const circle=largestOpaqueCircle(new Uint8Array(64).fill(1),8,8);
  assert.deepEqual(circle,{x:4,y:4,radius:4});
});

test('all fitted UV samples for tread and rim remain fully opaque while the wheel rotates', () => {
  const width=21,height=21;
  const tread=Array(width*height).fill(null),wheel=[...tread];
  for(let y=2;y<19;y++) for(let x=3;x<18;x++) tread[y*width+x]='#123456';
  tread[8*width+9]=null;
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) if(Math.hypot(x-10,y-10)<=9) wheel[y*width+x]='#abcdef';
  wheel[10*width+10]='#abcdef80'; // Semi-transparent holes also disqualify a region.
  const fit=fitTireTextureRegions([tread,wheel],width,height);
  for(const bearing of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.75]) for(const spin of [0,0.13,2]) {
    for(const triangle of buildWheelCylinder({bearing,spin})) {
      const bounds=fit[triangle.surface].bounds;
      const frame=triangle.surface==='tread'?tread:wheel;
      for(let a=0;a<=10;a++) for(let b=0;b<=10-a;b++) {
        const weights=[a/10,b/10,1-(a+b)/10];
        const u=triangle.uv.reduce((n,p,i)=>n+p[0]*weights[i],0),v=triangle.uv.reduce((n,p,i)=>n+p[1]*weights[i],0);
        const x=Math.floor(bounds.x+u*bounds.width),y=Math.floor(bounds.y+v*bounds.height);
        assert.ok(frame[y*width+x]?.length===7,`${triangle.surface} samples transparency at ${x},${y}`);
      }
    }
  }
  assert.throws(()=>fitTireTextureRegions([Array(4).fill(null),Array(4).fill('#ff000080')],2,2),/fully opaque/);
});

test('tires cannot silently fall back to cuts through visible pixels', () => {
  assert.throws(()=>prepareCarSheet({width:16,height:8,data:new Uint8ClampedArray(16*8*4).fill(255)}, {columns:2,rows:1,tireSheet:true}), /without cutting/);
  const width=40,height=20,data=new Uint8ClampedArray(width*height*4);
  for(const [x,w] of [[2,22],[28,10]]) for(let y=2;y<18;y++) for(let dx=0;dx<w;dx++) data.set([255,20,10,255],(y*width+x+dx)*4);
  const result=prepareCarSheet({width,height,data},{columns:2,rows:1});
  assert.deepEqual(result.crops,[{x:2,y:2,width:22,height:16},{x:28,y:2,width:10,height:16}]);
  assert.equal(result.frames.reduce((n,f)=>n+f.filter((v,i)=>i%4===3&&v===255).length,0),32*16);
});


test('near-opaque tire sheets import without altering source pixels or transparent gaps', () => {
  const width=40,height=20,data=new Uint8ClampedArray(width*height*4);
  for(let row=0;row<2;row++)for(let col=0;col<4;col++)
    for(let y=2;y<8;y++)for(let x=2;x<8;x++)data.set([60,70,80,252+col%2],((row*10+y)*width+col*10+x)*4);
  data[3]=249;
  const original=data.slice();
  const image={width,height,data};
  const raw=prepareCarSheet(image);
  assert.throws(()=>fitTireTextureRegions(raw.frames,raw.width,raw.height),/fully opaque/);
  const cleaned=normalizeTireSheetOpacity(image);
  assert.equal(cleaned.solidifiedPixels,8*36);
  assert.equal(cleaned.data[3],249);
  assert.equal(cleaned.data[7],0);
  assert.deepEqual(data,original);
  const prepared=prepareCarSheet(cleaned);
  assert.equal(prepared.frames.length,8);
  const fit=fitTireTextureRegions(prepared.frames,prepared.width,prepared.height);
  assert.equal(fit.tread.region.width,6);
  assert.equal(fit.tread.region.height,6);
  assert.ok(fit.wheel.region.radius>=3);
});


test('tire opacity cleanup retains canvas ImageData dimensions exposed as getters', () => {
  class CanvasImageData {
    constructor() { this.data = new Uint8ClampedArray(40*20*4); }
    get width() { return 40; }
    get height() { return 20; }
  }
  const image = new CanvasImageData();
  for(let row=0;row<2;row++)for(let col=0;col<4;col++)
    for(let y=2;y<8;y++)for(let x=2;x<8;x++)image.data.set([60,70,80,252],((row*10+y)*40+col*10+x)*4);
  assert.deepEqual(Object.keys(image), ['data']);
  const cleaned = normalizeTireSheetOpacity(image);
  assert.equal(cleaned.width,40);
  assert.equal(cleaned.height,20);
  const prepared = prepareCarSheet(cleaned);
  assert.equal(prepared.frames.length,8);
  assert.doesNotThrow(()=>fitTireTextureRegions(prepared.frames,prepared.width,prepared.height));
});
