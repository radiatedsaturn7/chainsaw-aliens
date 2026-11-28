import assert from 'node:assert/strict';
import test from 'node:test';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {upsertCachedProjectFile} from '../../src/ui/serverStorage.js';
import {createModelDocument,addPrimitive} from '../../src/model3d/ModelDocument.js';
import {selectCarVersion,CAR_VERSIONS_FILE} from '../../src/racing/CarVersions.js';

const write=(folder,name,data)=>upsertCachedProjectFile(folder,name,JSON.stringify({folder,name,savedAt:1,version:1,data}));
const make=(name,id,body)=>({kind:'race-car',schemaVersion:2,selectedCarId:id,car:{name,id,art:body?{bodyModel:{ref:body}}:{body:'sprite-original'}}});
globalThis.fetch=async(url)=>String(url).includes('manifest.json')?Response.json({folders:{cars:{},models:{}}}):new Response('',{status:404});
test('shared raw starter-rwd preserves baseline fallback; filename and alternate IDs stay distinct',async()=>{
 const model=createModelDocument();addPrimitive(model,'box');write('models','body',model);
 const originals=['Raw ID Family A','Raw ID Family B'];
 const aliases=['Raw ID Test 3D','Another 3D'];
 let registry=null;
 for(const [i,original] of originals.entries()){
  write('cars',original,make(original,'starter-rwd'));
  write('cars',aliases[i],make(aliases[i],'unrelated-authoring-'+i,'body'));
  registry=selectCarVersion(registry,original,aliases[i]);
 }
 write('cars',CAR_VERSIONS_FILE,registry);
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'race'});
 await editor.hydrateSavedRaceCarsForTravel();
 assert.equal(editor.raceCarVersionRawIDs.get('starter-rwd').size,2);
 const baseline=editor.project.cars.find(car=>editor.getRaceCarProjectIdentity(car)==='starter-rwd')
  ||editor.project.cars.find(car=>car.id==='starter-rwd');
 assert.equal(editor.findRaceProjectCarById('starter-rwd'),baseline);
 for(const [i,name] of originals.entries()){
  assert.equal(editor.findRaceProjectCarById('saved-car:'+name).__playtestDocumentName,name);
  assert.equal(editor.findRaceProjectCarById('saved-car:'+aliases[i]).__playtestDocumentName,name);
 }
 assert.equal(editor.findRaceProjectCarById('raw-id-test-3d').__playtestDocumentName,originals[0]);
 editor.raceCarVersionRawIDs=null;
 assert.equal(editor.findRaceProjectCarById('starter-rwd'),baseline);
 assert.equal(editor.findRaceProjectCarById('raw-id-test-3d'),null);
});
