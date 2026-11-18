import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogPickerPlan} from './carCatalogPickerPlan.js';
import {showroomPage} from '../../src/menus/MenuGarageWidgets.js';
test('bounded staging leaves target unselected and visible on all populated page shapes',()=>{
 for(let count=2;count<=17;count++)for(let maximum=1;maximum<=4;maximum++)for(let i=0;i<count;i++){
  const values=Array.from({length:count},(_,j)=>'Car '+j);
  if(maximum===1&&i===0){assert.throws(()=>catalogPickerPlan(values,values[i],maximum));continue;}
  const p=catalogPickerPlan(values,values[i],maximum);assert.notEqual(p.stageName,values[i]);
  if(p.selection==='card'){const shown=showroomPage(values.map(value=>({value})),p.stageName,maximum);assert.equal(shown.start,p.start);assert.ok(shown.entries.some(e=>e.value===values[i]));}
  else{assert.equal(values.indexOf(p.stageName)+1,i);assert.equal(p.selection,'next');}
 }
});
test('singleton final page uses one actual next input, not a click that launches selected car',()=>{
 assert.deepEqual(catalogPickerPlan(['a','b','c','d','e'],'e'),{targetName:'e',index:4,start:4,stageName:'d',selection:'next'});
});
test('missing, ambiguous and only-choice selections cannot silently pick another identity',()=>{
 assert.throws(()=>catalogPickerPlan(['a','b'],'c'),/not a showroom choice/);
 assert.throws(()=>catalogPickerPlan(['a','a'],'a'),/Ambiguous/);
 assert.throws(()=>catalogPickerPlan(['a'],'a'),/distinct staging/);
});
