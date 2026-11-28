import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCarVersions,selectCarVersion,CAR_VERSIONS_FILE} from '../../src/racing/CarVersions.js';
import {carAvailabilityLabel,openCarAvailability,planCarAvailability,verifyPaired3DCar} from '../../src/ui/CarAvailabilityEditor.js';

const empty=()=>normalizeCarVersions(null),
 names=new Set(['Original','3D','Other']),
 old={id:'stock',tuning:{weightKg:1300},dimensions:{widthM:1.83},setup:{tyres:[]},transmissions:{}},
 variant={...old,id:'clone',art:{bodyModel:{ref:'Model'}}};
const scene=()=>({
  kind:'rtg-model',schemaVersion:1,
  materials:[{id:'material'}],animations:[],
  vertices:[{id:'v1',position:[0,0,0]},{id:'v2',position:[.5,.5,0]},{id:'v3',position:[.25,0,.25]}],
  faces:[{id:'face',vertices:['v1','v2','v3'],uv:[[0,0],[.5,.5],[.2,.8]],material:'material'}],
  joints:['WheelMount_FL','WheelMount_FR','WheelMount_RL','WheelMount_RR','HeadlightMount_L','HeadlightMount_R','TaillightMount_L','TaillightMount_R']
    .map((name,i)=>({name,id:'joint-'+i,position:[i%2,1,i/2],scale:[1,1,1],rotation:[0,0,0,1]}))
});
test('unregistered original activates the validated replacement; from replacement draft the original stays active',()=>{
  assert.deepEqual(planCarAvailability(empty(),'Original',old,'disabled','3D',names),
    {canonical:'Original',active:'3D',alternates:['3D'],verify:'3D'});
  assert.deepEqual(planCarAvailability(empty(),'3D',variant,'disabled','Original',names),
    {canonical:'Original',active:'Original',alternates:['3D'],verify:'3D'});
});
test('cannot turn off the only playable version or connect a pre-existing car from another family',()=>{
  assert.throws(()=>planCarAvailability(empty(),'Original',old,'disabled','',names),/keep this family playable/);
  const registry=selectCarVersion(empty(),'Other','3D',['3D']);
  assert.throws(()=>planCarAvailability(registry,'Original',old,'disabled','3D',names),/already paired/);
});
test('restoring the original and disabled labels preserve authored alternate membership',()=>{
  const registry=selectCarVersion(empty(),'Original','3D',['3D']);
  assert.equal(carAvailabilityLabel({currentCarDocumentName:'Original'},registry),'Availability: Disabled');
  assert.equal(carAvailabilityLabel({currentCarDocumentName:'3D'},registry),'Availability: Enabled');
  assert.deepEqual(planCarAvailability(registry,'Original',old,'enabled','',names),
    {canonical:'Original',active:'Original',alternates:['3D'],verify:null});
  const disabled=selectCarVersion(registry,'Original',null,['3D']);
  assert.equal(carAvailabilityLabel({currentCarDocumentName:'Original'},disabled),'Availability: Disabled');
  assert.equal(carAvailabilityLabel({},registry),'Availability (Save First)');
});
test('replacement checks every authored hub and lamp socket, nondegenerate geometry, and unchanged authoritative tuning',()=>{
  assert(verifyPaired3DCar(old,variant,scene()));
  const bad=scene();bad.joints.pop();
  assert.throws(()=>verifyPaired3DCar(old,variant,bad),/TaillightMount_R/);
  const dup=scene();dup.joints[0].name='WheelMount_FR';
  assert.throws(()=>verifyPaired3DCar(old,variant,dup),/WheelMount_FL/);
  const flat=scene();flat.vertices[2].position=[1,1,0];
  assert.throws(()=>verifyPaired3DCar(old,variant,flat),/non-degenerate/);
  assert.throws(()=>verifyPaired3DCar(old,{...variant,tuning:{weightKg:1200}},scene()),/matching handling/);
});
function fixture(){
  const editor={mode:'car',selectedCar:old,currentCarDocumentName:'Original'};
  let registry=empty();
  const saves=[];
  const wrap=car=>({data:{kind:'race-car',car},storageSource:'server'});
  const options={
    showForm:async(title,fields,opts)=>{
      assert.equal(title,'Car Availability');
      assert.equal(fields[0].value,'enabled');
      assert.equal(opts.validate({availability:'disabled',peer:'3D'}),null);
      assert.match(opts.description,/Disabled versions stay saved and editable/);
      return {availability:'disabled',peer:'3D'};
    },
    hydrate:async(folder,ref)=>folder==='models'?{data:scene()}:ref===CAR_VERSIONS_FILE?{data:registry}:wrap(ref==='Original'?old:variant),
    list:()=>[...names].map(name=>({name})),
    save:async(folder,ref,next)=>{saves.push([folder,ref,next]);registry=next;return {persisted:true};},
    readOnly:()=>false,refresh:async()=>registry
  };
  return {editor,options,saves};
}
test('manual toggle writes the registry only, after verification, leaving both files and the open car intact',async()=>{
  const {editor,options,saves}=fixture();
  assert(await openCarAvailability(editor,options));
  assert.equal(editor.selectedCar,old);
  assert.equal(saves.length,1);
  assert.deepEqual(saves[0],['cars',CAR_VERSIONS_FILE,selectCarVersion(empty(),'Original','3D',['3D'])]);
  assert.match(editor.status,/Original disabled/);
});
test('cancelled, switched, or failed local changes do not report success',async()=>{
  const {editor,options,saves}=fixture();
  assert.equal(await openCarAvailability(editor,{...options,showForm:async()=>null}),false);
  assert.equal(await openCarAvailability(editor,{...options,showForm:async()=>{
    editor.currentCarDocumentName='Other';return {availability:'disabled',peer:'3D'};
  }}),false);
  assert.equal(saves.length,0);
  editor.currentCarDocumentName='Original';
  await assert.rejects(openCarAvailability(editor,{...options,save:async()=>({persisted:false,reason:'offline'})}),/not saved: offline/);
  assert.equal(editor.carAvailabilityBusy,false);
  assert.notEqual(editor.status,'Original disabled · 3D is playable');
});
test('a changed registry aborts instead of overwriting another editor change',async()=>{
  const {editor,options,saves}=fixture();
  const hydrate=options.hydrate;
  let reads=0;
  options.hydrate=async(folder,ref)=>{
    if(ref===CAR_VERSIONS_FILE&&++reads===2)
      return {data:selectCarVersion(empty(),'Remote Original','Remote 3D',['Remote 3D'])};
    return hydrate(folder,ref);
  };
  await assert.rejects(openCarAvailability(editor,options),/availability changed/i);
  assert.equal(saves.length,0);
});
