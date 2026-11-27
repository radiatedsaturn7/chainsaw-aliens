import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildFit12} from '../../tools/vehicle-validation/build-wrx-fit12.mjs';
import {garageEnvironmentProfile} from '../../src/menus/GarageModelPreview.js';
import {isWrxStudioDocument} from '../../src/model3d/WrxBundledModels.js';

const pack=(fit,part)=>JSON.parse(gunzipSync(readFileSync(new URL('../../src/model3d/wrx/'+fit+'-'+part+'.pack',import.meta.url))));
test('Fit 12: reproducible roster pair, original hubs, gold alloy and isolated functional optics',()=>{
 const body=pack('fit12','body'),wheel=pack('fit12','wheel'),baseBody=pack('fit10','body'),baseWheel=pack('fit10','wheel');
 assert.equal(JSON.stringify({body,wheel}),JSON.stringify(buildFit12()));
 assert.ok(body.faces.length+4*wheel.faces.length<=15000);
 assert.deepEqual(body.joints.filter(j=>j.name.startsWith('WheelMount_')).map(j=>j.position),
  baseBody.joints.filter(j=>j.name.startsWith('WheelMount_')).map(j=>j.position));
 assert.deepEqual(wheel.faces,baseWheel.faces);
 assert.deepEqual(wheel.vertices,baseWheel.vertices);
 assert.equal(wheel.materials.find(m=>m.id==='studio-mat-wheel').color,'#c6a464');
 assert.deepEqual(body.materials.find(m=>m.id==='studio-mat-paint'),baseBody.materials.find(m=>m.id==='studio-mat-paint'));
 for(const lamp of ['head','running','brake','reverse'])assert.ok(body.materials.some(m=>m.name.startsWith('[studio9:'+lamp+']')));
 assert.ok(body.faces.some(f=>f.component==='headlights'&&f.material==='studio-mat-opticSilver'));
 assert.ok(body.faces.some(f=>f.component==='headlights'&&f.material==='studio-mat-opticCover'));
 assert.ok(body.faces.some(f=>f.component==='frontBumper'&&f.material==='studio-mat-ductMatte'));
 const backing=body.materials.find(m=>m.id==='studio-mat-ductMatte');
 assert.equal(backing.automotive.roughness,.97);
 assert.equal(backing.automotive.metalness,0);
 assert.ok(isWrxStudioDocument(body,'body')&&isWrxStudioDocument(wheel,'wheel'));
 assert.equal(garageEnvironmentProfile(body,wheel),'garage-bay');
 assert.equal(garageEnvironmentProfile(body,baseWheel),'studio');
});
