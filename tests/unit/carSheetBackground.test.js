import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { hasBakedLightBackground, removeCarSheetLightBackground } from '../../src/racing/CarSheetBackground.js';
import { prepareCarSheet, carSheetDocument, assignCarTireSheet } from '../../src/racing/CarGraphicImport.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('saved rtgtires checkerboard separates safely and produces fitted tire surfaces', () => {
  const png=readFileSync(new URL('../fixtures/rtgtires.png',import.meta.url));
  const width=png.readUInt32BE(16),height=png.readUInt32BE(20),chunks=[];
  for(let pos=8;pos<png.length;) {
    const length=png.readUInt32BE(pos);
    if(png.toString('ascii',pos+4,pos+8)==='IDAT')chunks.push(png.subarray(pos+8,pos+8+length));
    pos+=length+12;
  }
  const raw=inflateSync(Buffer.concat(chunks)),data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++) {
    const offset=y*(width*4+1);assert.equal(raw[offset],0);
    data.set(raw.subarray(offset+1,offset+1+width*4),y*width*4);
  }
  const image={width,height,data},original=data.slice();
  assert.throws(()=>prepareCarSheet(image),/without cutting/);
  assert.equal(hasBakedLightBackground(image),true);
  const cleaned=removeCarSheetLightBackground(image),prepared=prepareCarSheet(cleaned);
  assert.equal(cleaned.removedPixels,131919);
  assert.equal(prepared.frames.length,8);
  assert.deepEqual(prepared.crops.map(c=>c.width),[67,106,143,106,66,108,144,107]);
  const e=new RaceEditor({isMobile:false,deviceIsMobile:false},{mode:'car'});
  assignCarTireSheet(e.selectedCar,'rtgtires processed',carSheetDocument(null,prepared));
  const reopened=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())).car);
  assert.equal(reopened.art.tireSurfaces.tread.region.width,53);
  assert.equal(reopened.art.tireSurfaces.tread.region.height,127);
  assert.ok(reopened.art.tireSurfaces.wheel.region.radius>67);
  assert.deepEqual(data,original);
});

test('background cleanup preserves enclosed bright artwork and does not suggest removal for transparent PNGs', () => {
  const width=9,height=9,data=new Uint8ClampedArray(width*height*4).fill(255);
  for(let y=2;y<7;y++)for(let x=2;x<7;x++) data.set([0,0,0,255],(y*width+x)*4);
  data.set([255,255,255,255],(4*width+4)*4);
  const result=removeCarSheetLightBackground({width,height,data});
  assert.equal(result.data[3],0);
  assert.equal(result.data[(4*width+4)*4+3],255);
  assert.equal(hasBakedLightBackground(result),false);
});

test('single-frame assignments select the requested animation frame and disable the cylinder only for that tire view', () => {
  const e=new RaceEditor({isMobile:false,deviceIsMobile:false},{mode:'car'});
  e.selectedCar.art.angleLayers={front:{tires:{artRef:'old',cylinder:true}},rear:{tires:{artRef:'old',cylinder:true}}};
  e.setCarAngleArt('tires','front','chosen',e.selectedCar,3);
  const car=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument().car);
  assert.equal(car.art.angleLayers.front.tires.frameIndex,3);
  assert.equal(car.art.angleLayers.front.tires.cylinder,false);
  assert.equal(car.art.angleLayers.rear.tires.cylinder,true);
});
