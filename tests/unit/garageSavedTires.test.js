import {savedTireForRef} from '../helpers/savedGarageTires.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import catalog from '../../src/content/garage-parts.json' with {type:'json'};
import {GARAGE_SAVED_TIRES} from '../../src/garage/GarageSavedTires.js';
import {garageTireChoices} from '../../src/garage/GarageTireChoices.js';
import {getTireArtRefs} from '../../src/racing/raceTires.js';
import {GarageSystem} from '../../src/garage/GarageSystem.js';
import {GARAGE_SETUP_PROFILES,garageSetupPartIds} from '../../src/garage/GarageSetupProfiles.js';
test('every shop/preset tire resolves to an actual saved tire with existing artwork',()=>{
 assert.equal(GARAGE_SAVED_TIRES.length,8);
 for(const item of catalog.items.filter(i=>i.carPart.tireRef&&i.carPart.forSale)){
  assert.ok(GARAGE_SAVED_TIRES.includes(item.carPart.tireRef));
  assert.ok(savedTireForRef(item.carPart.tireRef));
 }
 for(const name of GARAGE_SAVED_TIRES){
  const refs=getTireArtRefs(savedTireForRef(name));assert.ok(refs.length);
  for(const ref of refs)assert.ok(existsSync(new URL(`../../data/server-storage/files/art/${encodeURIComponent(ref)}/document.json`,import.meta.url)));
 }
 for(const profile of GARAGE_SETUP_PROFILES){
  const part=catalog.items.find(i=>garageSetupPartIds(profile).includes(i.id)&&i.carPart.slot==='tires');
  assert.ok(part&&GARAGE_SAVED_TIRES.includes(part.carPart.tireRef));
 }
});
test('saved road and loose-surface tire graphics match their groups while physics remain distinct',()=>{
 const road=savedTireForRef('Tarmac').graphics,offroad=savedTireForRef('Offroad').graphics;
 for(const name of ['Stock','Street','Drift','Rain'])assert.deepEqual(savedTireForRef(name).graphics,road);
 for(const name of ['Snow','Rally'])assert.deepEqual(savedTireForRef(name).graphics,offroad);
 assert.notDeepEqual(road,offroad);
 assert.notDeepEqual(savedTireForRef('Rain').compound,savedTireForRef('Tarmac').compound);
});
test('templates cannot reappear as shop options and legacy installed references load saved physics/art',async()=>{
 const entries=catalog.items.filter(i=>i.carPart.slot==='tires').map(item=>({ref:item.id,item}));
 const template={ref:'old-template',item:{id:'old-template',carPart:{slot:'tires',tireRef:'builtin:tarmac',forSale:true}}};
 const choices=garageTireChoices([...entries,template],{availableCount:()=>99},'old-template');
 assert.equal(choices.length,7);assert.ok(choices.every(c=>!c.item.carPart.tireRef.startsWith('builtin:')));
 const garage=new GarageSystem({});
 assert.deepEqual(await garage.loadTire('builtin:dirt'),await garage.loadTire('Rally'));
 assert.deepEqual(await garage.loadTire('builtin:sport'),await garage.loadTire('Street'));
});
