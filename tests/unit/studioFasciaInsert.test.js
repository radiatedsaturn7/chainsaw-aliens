import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {exportVehicle,materialDoc} from '../../src/ui/vehicleStudio/export.mjs';
import {createVehicle,loadVehicle,serializeVehicle,updateDesign} from '../../src/ui/vehicleStudio/genome.mjs';

const racemo=()=>loadVehicle(readFileSync(new URL('../../src/ui/vehicleStudio/examples/tamo-racemo.json',import.meta.url),'utf8'));

test('Racemo continuous fascia finish is editable, persistent and matches the original body geometry',()=>{
 const g=racemo();
 const b=exportVehicle(g,{quality:'drive'});
 const [body,wheel]=Object.values(b.models);
 const off=updateDesign(updateDesign(g,'fascia','front',0,'insertBand'),'fascia','rear',0,'insertBand');
 const [cleanBody,cleanWheel]=Object.values(exportVehicle(off,{quality:'drive'}).models);
 assert.deepEqual(body.vertices,cleanBody.vertices);
 assert.deepEqual(body.faces.map(({material,uv,...face})=>face),cleanBody.faces.map(({material,uv,...face})=>face));
 assert.deepEqual(body.joints,cleanBody.joints);
 assert.deepEqual(b.attachments,Object.fromEntries(body.joints.map(j=>[j.name,j.position])));
 assert.deepEqual(wheel,cleanWheel);
 assert.equal(b.metrics.carTriangles,body.faces.length+4*wheel.faces.length);
 assert.ok(b.metrics.carTriangles<=15000);
 assert.equal(loadVehicle(serializeVehicle(g)).fascia.front.insertBand,1);
 assert.equal(cleanBody.materials.some(m=>m.id.startsWith('studio-mat-fascia-')),false);
});

test('independent optional inserts remain continuous between apertures without changing ordinary paint',()=>{
 const g=racemo();
 const sample=({pixels,width,height},u,v)=>pixels[Math.floor((1-v)*height)*width+Math.floor(u*width)];
 for(const end of ['front','rear']){
  const shell=materialDoc(g,'fascia-'+end);
  assert.equal(shell.color,'#ffffff');
  assert.equal(shell.automotive.preset,'paint');
  assert.equal(shell.automotive.roughness,materialDoc(g,'paint').automotive.roughness);
  for(const u of [.40,.43,.50,.57,.60])assert.equal(sample(shell.texture,u,.45),g.materials.trim);
  for(const u of [.40,.50,.60])assert.equal(sample(shell.texture,u,.015),g.materials.paint);
 }
 assert.equal(createVehicle('sedan').fascia.front.insertBand,0);
 assert.equal(createVehicle('sedan').fascia.rear.insertBand,0);
});
