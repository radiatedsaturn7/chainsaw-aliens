import test from 'node:test';
import assert from 'node:assert/strict';
import {addPrimitive,createModelDocument} from '../../src/model3d/ModelDocument.js';
import {hasRenderableModelGeometry} from '../../src/model3d/ModelGeometryReady.js';
import {usesGarageModelPreview, GarageModelPreview,menuModelWheelPoses} from '../../src/menus/GarageModelPreview.js';
import {verifyPaired3DCar} from '../../src/ui/CarAvailabilityEditor.js';

const socketNames=['WheelMount_FL','WheelMount_FR','WheelMount_RL','WheelMount_RR',
 'HeadlightMount_L','HeadlightMount_R','TaillightMount_L','TaillightMount_R'];
const build=()=>{
 const body=createModelDocument('Native body');addPrimitive(body,'box');
 const wheel=createModelDocument('Native wheel');addPrimitive(wheel,'cylinder');
 for(const [i,name] of socketNames.entries())body.joints.push({id:'mount-'+i,name,parent:null,
  position:[i%2===0?.76:-.76,i<4?.337:.65,i<2?1.3:-1.3],rotation:[0,0,0,1],scale:[1,1,1]});
 const original={tuning:{powerHp:100},art:{body:'2d'}};
 const replacement={...original,art:{bodyModel:{ref:'Body'},wheelModel:{ref:'Wheel'}}};
 return {body,wheel,original,replacement};
};

test('a declared separate 3D wheel must exist and contain non-degenerate model geometry',()=>{
 const {body,wheel,original,replacement}=build();
 assert.throws(()=>verifyPaired3DCar(original,replacement,body),/wheel model first/);
 const bad={...wheel,vertices:wheel.vertices.map((vertex,i)=>({...vertex,position:[i,0,0]}))};
 assert.equal(hasRenderableModelGeometry(bad),false);
 assert.throws(()=>verifyPaired3DCar(original,replacement,body,bad),/wheel has no non-degenerate geometry/);
 assert(verifyPaired3DCar(original,replacement,body,wheel));
 assert.throws(()=>verifyPaired3DCar(original,{...replacement,art:{...replacement.art,wheelModel:{ref:'Body'}}},body,wheel),/separate saved model/);
});

test('native wheel reference selects four authored instances in garage and yields four selector hubs',()=>{
 const {body,wheel,replacement}=build();
 let available=false;
 const preview=new GarageModelPreview({library:{get:ref=>ref==='Body'?body:available?wheel:null}});
 assert(usesGarageModelPreview({id:'garage-preview'},replacement));
 assert.equal(preview.prepare(replacement),false,'never bake a provisional rim for a declared wheel asset');
 available=true;assert(preview.prepare(replacement));
 assert.equal(preview.wheelInstances.length,4);
 assert(preview.wheelInstances.every(instance=>instance.model===wheel));
 const poses=menuModelWheelPoses(body,replacement);
 assert.deepEqual(Object.keys(poses).sort(),['fl','fr','rl','rr']);
 assert.equal(poses.fl.position.y,.337);
 preview.dispose();
 assert.equal(preview.wheels.children.length,0);
});

test('a native wheel can retain exact staggered widths and radii without changing source tuning', async () => {
 const {normalizeModelBinding,modelWheelBindingForAxle}=await import('../../src/model3d/ModelBinding.js');
 const input=normalizeModelBinding({ref:'Local Wheel',scale:[2,1,1],
   axleScale:{front:[.9,.97,.97],rear:[1.1,1.03,1.03]}});
 assert.deepEqual(modelWheelBindingForAxle(input,'fl').scale,[1.8,.97,.97]);
 assert.deepEqual(modelWheelBindingForAxle(input,'rr').scale,[2.2,1.03,1.03]);
 assert.deepEqual(input.scale,[2,1,1]);
 assert.equal(normalizeModelBinding({...input,axleScale:{front:[0,.97,.97],rear:[1.1,1.03,1.03]}}).axleScale,undefined);
});
