// Rebuild only this roster appearance; the editable genome does not replace a car document.
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {exportVehicle,GAMEPLAY_TRIANGLE_BUDGET} from '../../src/ui/vehicleStudio/export.mjs';
import {loadVehicle} from '../../src/ui/vehicleStudio/genome.mjs';

const pack=(fit,part)=>new URL('../../src/model3d/wrx/'+fit+'-'+part+'.pack',import.meta.url);
const readBaseline=part=>JSON.parse(gunzipSync(readFileSync(pack('fit10',part))));
const genome=loadVehicle(readFileSync(new URL('./wrx-fit12-genome.json',import.meta.url),'utf8'));
// Positions locked from the approved pre-bumper Fit12 build, not recomputed
// from micro-adjustments to the fascia under the visible lamp.
const fit12HeadlampPositions={
  HeadlightMount_R:[-0.5898652633888343,0.5234587853050632,2.0889925668069136],
  HeadlightMount_L:[0.5898652633888313,0.5234587853050635,2.0889925668069145],
};
export function buildFit12(){
 const baseline=readBaseline('body'),wheel=readBaseline('wheel');
 const {models}=exportVehicle(genome);
 const [body]=Object.values(models);
 // Preserve stock physical wheel centers and unmodified tail light origins.
 for(const joint of body.joints){
  if(fit12HeadlampPositions[joint.name]){joint.position=fit12HeadlampPositions[joint.name].slice();continue;}
  const old=baseline.joints.find(j=>j.name===joint.name);
  if(old){joint.position=old.position;joint.rotation=old.rotation;}
 }
 body.name=genome.name+' body';wheel.name=genome.name+' wheel';
 wheel.materials.find(m=>m.id==='studio-mat-wheel').color=genome.materials.wheel;
 assert.ok(body.faces.length+4*wheel.faces.length<=GAMEPLAY_TRIANGLE_BUDGET);
 return {body,wheel};
}
if(process.argv.includes('--write')){
 for(const [part,doc] of Object.entries(buildFit12()))
  writeFileSync(pack('fit12',part),gzipSync(JSON.stringify(doc),{level:9}));
}
