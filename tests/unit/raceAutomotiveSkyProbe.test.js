import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../src/vendorBridge/three.js';
import {raceAutomotiveSkyProbe,raceAutomotiveSkyUV} from '../../src/racing/RaceAutomotiveSkyProbe.js';
import {automotiveEnvironment} from '../../src/model3d/AutomotiveMaterials.js';

test('the authored panorama has fixed world azimuth, rotation sign and horizon',()=>{
 const mapping={anchor:.75,horizon:.56,angularHeight:.5};
 const north=raceAutomotiveSkyUV(Math.PI/2,0,mapping);
 assert.deepEqual(north,[.75,.56]);
 assert.deepEqual(raceAutomotiveSkyUV(0,0,mapping),[.5,.56]);
 assert.deepEqual(raceAutomotiveSkyUV(-Math.PI/2,0,mapping),[.25,.56]);
 assert.equal(raceAutomotiveSkyUV(Math.PI*.5,.2,mapping)[1]<north[1],true);
 assert.equal(raceAutomotiveSkyUV(Math.PI*.5,-.2,mapping)[1]>north[1],true);
 assert.equal(raceAutomotiveSkyUV(Math.PI/2,.1,{...mapping,anchor:.5})[0],.5);
});

test('an authored panorama uses one readback per profile and preserves scene exposure',()=>{
 const pixels=new Uint8ClampedArray(8*4*4);
 for(let i=0;i<pixels.length;i+=4){pixels[i]=i%128<56?77:182;pixels[i+1]=120;pixels[i+2]=221;pixels[i+3]=255;}
 let reads=0;
 const canvas={width:10,height:4,skyboxGutter:1,getContext:()=>({getImageData:(x,y,w,h)=>{
  reads++; assert.deepEqual([x,y,w,h],[1,0,8,4]);return{data:pixels};
 }})};
 const s={artRef:'a'},b={w:640,h:360};
 const p=raceAutomotiveSkyProbe(canvas,s,b);
 assert.equal(raceAutomotiveSkyProbe(canvas,s,b),p);assert.equal(reads,1);
 assert.equal(p.texture.type,THREE.HalfFloatType);
 assert.equal(p.texture.colorSpace,THREE.LinearSRGBColorSpace);
 assert.equal(p.texture.mapping,THREE.EquirectangularReflectionMapping);
 const previous=automotiveEnvironment('track-clear-rally').image;
 const f=THREE.DataUtils.fromHalfFloat;
 const l=({width,height,data})=>{
  let sum=0;
  for(let j=0;j<height;j++)for(let i=0;i<width;i++){
   const k=(j*width+i)*4;
   sum+=(.2126*f(data[k])+.7152*f(data[k+1])+.0722*f(data[k+2]))*Math.cos(Math.PI*((j+.5)/height-.5));
  }
  return sum;
 };
 assert(Math.abs(l(p.texture.image)/l(previous)-1)<.001);
 assert.notDeepEqual(p.texture.image.data,previous.data);
 assert.notEqual(raceAutomotiveSkyProbe(canvas,{...s,offsetXTurns:.22},b),p);
 assert.equal(reads,2);
 assert.equal(raceAutomotiveSkyProbe(null,s,b),null);
});
