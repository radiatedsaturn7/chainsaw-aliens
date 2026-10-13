import test from 'node:test';
import assert from 'node:assert/strict';
import {MenuResources} from '../../src/menus/MenuResources.js';
import {saveProjectFile} from '../../src/ui/projectFiles.js';

test('car selection refreshes a re-saved car without re-normalizing it every frame',()=>{
 let installs=0;const resources=new MenuResources({carEditor:{normalizeLoadedCarDocument(data){installs++;return structuredClone(data)},collectRaceCarArtRefs:()=>[],getRaceCarTuning:car=>({powerHp:car.powerHp})}});
 saveProjectFile('cars','Menu refresh fixture',{name:'Before',powerHp:100});const first=resources.car('Menu refresh fixture');assert.equal(first.name,'Before');assert.equal(resources.car('Menu refresh fixture'),first);assert.equal(installs,1);
 saveProjectFile('cars','Menu refresh fixture',{name:'After',powerHp:200});const second=resources.car('Menu refresh fixture');assert.equal(second.name,'After');assert.notEqual(second,first);assert.equal(resources.tuning(second).powerHp,200);assert.equal(installs,2);
});
