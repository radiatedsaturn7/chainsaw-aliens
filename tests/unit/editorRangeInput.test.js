import test from 'node:test';
import assert from 'node:assert/strict';
import {protectRangeTouchScroll} from '../../src/ui/shared/editorRangeInput.js';
function fixture(){
 const input=new EventTarget();Object.assign(input,{style:{},value:'50',min:'0',max:'100',step:'1',getBoundingClientRect:()=>({width:200}),setPointerCapture:()=>{}});protectRangeTouchScroll(input);
 const pointer=(type,x,y)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,pointerType:'touch',clientX:x,clientY:y});input.dispatchEvent(e);};return {input,pointer};
}
test('vertical scrolling and touch taps do not change range values',()=>{
 const {input,pointer}=fixture();pointer('pointerdown',50,50);pointer('pointermove',52,80);assert.equal(input.value,'50');pointer('pointercancel',52,80);assert.equal(input.value,'50');
 pointer('pointerdown',100,50);pointer('pointerup',100,50);assert.equal(input.value,'50');assert.equal(input.style.touchAction,'pan-y');
});
test('horizontal touch drag adjusts from the original value and reports input',()=>{
 const {input,pointer}=fixture();let changes=0;input.addEventListener('input',()=>changes++);pointer('pointerdown',50,50);pointer('pointermove',90,51);assert.equal(Number(input.value),70);assert.equal(changes,1);pointer('pointerup',90,51);
});
