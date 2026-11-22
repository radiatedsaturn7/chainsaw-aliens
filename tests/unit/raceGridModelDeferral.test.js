import assert from 'node:assert/strict';
import test from 'node:test';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {upsertCachedProjectFile} from '../../src/ui/serverStorage.js';
import {createModelDocument,addPrimitive} from '../../src/model3d/ModelDocument.js';
import {modelAssets} from '../../src/model3d/ModelAssets.js';
import {selectCarVersion,CAR_VERSIONS_FILE} from '../../src/racing/CarVersions.js';

const write=(folder,name,data)=>upsertCachedProjectFile(folder,name,JSON.stringify({folder,name,savedAt:1,version:1,data}));
const make=(name,id,art)=>({kind:'race-car',schemaVersion:2,selectedCarId:id,car:{name,id,art}});
globalThis.fetch=async(url)=>String(url).includes('manifest.json')?Response.json({folders:{cars:{},models:{}}}):new Response('',{status:404});
test('roster defers all native assets, and prepared grid requests only its selected models',async()=>{
 const model=createModelDocument();addPrimitive(model,'box');
 let registry=null;
 for(const x of ['player','eligible','unrelated','missing']){
  const original='Grid '+x,variant=original+' native',body=original+' body',wheel=original+' wheel';
  write('cars',original,make(original,x,{body:'sprite-'+x}));
  write('cars',variant,make(variant,x+'-variant',{bodyModel:{ref:body},wheelModel:{ref:wheel}}));
  write('models',body,model);if(x!=='missing')write('models',wheel,model);
  registry=selectCarVersion(registry,original,variant);
 }
 write('cars',CAR_VERSIONS_FILE,registry);
 const calls=[],prepare=modelAssets.prepare.bind(modelAssets);
 modelAssets.prepare=(ref)=>{calls.push(ref);return prepare(ref);};
 try{
  const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'race'});
  const player=editor.withSavedRaceCarRuntimeIdentity({id:'player',name:'Grid player',art:{bodyModel:{ref:'Grid player body'}}},'Grid player');
  editor.upsertRaceProjectCar(player);
  const roster=await editor.hydrateSavedRaceCarsForTravel({deferModels:true,preserveCarId:'saved-car:Grid player'});
  assert.deepEqual(calls,[]);
  assert(roster.every(car=>!car.art.bodyModel));
  assert.equal(editor.findRaceProjectCarById('saved-car:Grid player'),player);
  const models=await editor.prepareRaceTravelGridCarVersions(['saved-car:Grid eligible native','saved-car:Grid eligible','saved-car:Grid missing']);
  assert.deepEqual(calls.sort(),['Grid eligible body','Grid eligible wheel','Grid missing body','Grid missing wheel']);
  assert.equal(models.length,2);
  assert.equal(editor.findRaceProjectCarById('saved-car:Grid eligible').art.wheelModel.ref,'Grid eligible wheel');
  assert.equal(editor.findRaceProjectCarById('saved-car:Grid missing').art.body,'sprite-missing');
  assert.equal(editor.findRaceProjectCarById('saved-car:Grid unrelated').art.body,'sprite-unrelated');
  assert.equal(editor.findRaceProjectCarById('saved-car:Grid player'),player);
 }finally{modelAssets.prepare=prepare;}
});
