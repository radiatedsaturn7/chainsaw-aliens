import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {fitTireTextureRegions} from '../../src/racing/CarTireTextureFit.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url)));
const cases=[
  {
    "name": "Street",
    "ref": "catalog-street-road",
    "width": 675,
    "height": 686,
    "physical": {
      "kind": "race-tire",
      "schemaVersion": 2,
      "name": "Street",
      "baseCompound": "street",
      "compound": {
        "id": "street",
        "label": "Street",
        "surfaceGrip": {
          "asphalt": 1.02,
          "wet-asphalt": 0.92,
          "dirt": 0.68,
          "gravel": 0.6,
          "mud": 0.4,
          "wet-gravel": 0.46,
          "snow": 0.25,
          "slush": 0.32
        },
        "wetEvacuationFactor": 1,
        "treadDepthMm": 7,
        "wearRate": 1
      },
      "size": {
        "widthMm": 245,
        "aspectRatio": 40,
        "wheelDiameterIn": 18
      },
      "pressurePsi": 32
    }
  },
  {
    "name": "Drift",
    "ref": "catalog-drift-worn",
    "width": 667,
    "height": 684,
    "physical": {
      "kind": "race-tire",
      "schemaVersion": 2,
      "name": "Drift",
      "baseCompound": "drift",
      "compound": {
        "id": "drift",
        "label": "Drift",
        "surfaceGrip": {
          "asphalt": 0.88,
          "wet-asphalt": 0.78,
          "dirt": 0.62,
          "gravel": 0.58,
          "mud": 0.38,
          "wet-gravel": 0.48,
          "snow": 0.24,
          "slush": 0.3
        },
        "wetEvacuationFactor": 0.68,
        "treadDepthMm": 5,
        "wearRate": 1.42
      },
      "size": {
        "widthMm": 245,
        "aspectRatio": 40,
        "wheelDiameterIn": 18
      },
      "pressurePsi": 32
    }
  },
  {
    "name": "Offroad",
    "ref": "catalog-offroad-allterrain",
    "width": 706,
    "height": 715,
    "physical": {
      "kind": "race-tire",
      "schemaVersion": 2,
      "name": "Offroad",
      "baseCompound": "offroad",
      "compound": {
        "id": "offroad",
        "label": "Offroad",
        "surfaceGrip": {
          "asphalt": 0.7,
          "wet-asphalt": 0.68,
          "dirt": 1,
          "gravel": 1.08,
          "mud": 1.02,
          "wet-gravel": 1.04,
          "snow": 0.66,
          "slush": 0.76
        },
        "wetEvacuationFactor": 1.16,
        "treadDepthMm": 11,
        "wearRate": 1.08
      },
      "size": {
        "widthMm": 245,
        "aspectRatio": 40,
        "wheelDiameterIn": 18
      },
      "pressurePsi": 32
    }
  }
];
for(const c of cases)test('catalog '+c.name+' distinct tire graphics preserve all non-graphics fields',()=>{
const tire=read('data/server-storage/files/tires/'+c.name+'/document.json');
const {graphics,...physical}=tire;assert.deepEqual(physical,c.physical);
const packed=read('data/server-storage/files/art/'+c.ref+'/document.json');const art=JSON.parse(zlib.gunzipSync(Buffer.from(packed.data,'base64')));
assert.equal(art.frames.length,2);assert.equal(art.width,c.width);assert.equal(art.height,c.height);for(const f of art.frames)assert.equal(f.length,art.width*art.height);assert.notDeepEqual(art.frames[0],art.frames[1]);
const fit=fitTireTextureRegions(art.frames,art.width,art.height,{treadFrame:0,wheelFrame:1});assert.ok(fit.wheel.region.radius>art.height*.4);assert.ok(fit.wheel.region.radius<art.width/2);
assert.deepEqual(graphics.tireSurfaces.tread,{artRef:c.ref,frameIndex:0,...fit.tread});assert.deepEqual(graphics.tireSurfaces.wheel,{artRef:c.ref,frameIndex:1,...fit.wheel});assert.equal(Object.keys(graphics.angleLayers).length,8);
for(const [angle,layers]of Object.entries(graphics.angleLayers)){assert.equal(layers.tires.artRef,c.ref);assert.equal(layers.tires.frameIndex,['left','right'].includes(angle)?1:0);assert.equal(layers.tires.cylinder,true);}
});
