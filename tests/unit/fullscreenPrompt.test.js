import test from 'node:test';
import assert from 'node:assert/strict';
import {FullscreenPrompt} from '../../src/ui/FullscreenPrompt.js';

function dom(){
 const previous=globalThis.document;
 const nodes=[];
 const createElement=tag=>{
  const handlers={};
  const node={tag,style:{},children:[],setAttribute(key,value){this[key]=value;},addEventListener(type,fn){(handlers[type]||=[]).push(fn);},
   appendChild(child){child.parent=this;this.children.push(child);return child;},
   insertBefore(child,before){this.children=this.children.filter(c=>c!==child);this.children.splice(this.children.indexOf(before),0,child);},
   remove(){this.parent.children=this.parent.children.filter(c=>c!==this);},
   focus(){document.activeElement=this;},
   fire(type,extra={}){for(const fn of handlers[type]||[])fn({target:this,preventDefault(){},stopPropagation(){},...extra});},
   click(){this.fire('click');}
  };nodes.push(node);return node;
 };
 globalThis.document={createElement,body:createElement('body'),getElementById:id=>nodes.find(n=>n.id===id),activeElement:null};
 return ()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;};
}
const input=(...actions)=>({wasGamepadPressed:action=>actions.includes(action)});

test('Full screen opens with OK first and focused; confirmation requests fullscreen synchronously',async()=>{
 const restore=dom();try{
  let calls=0;const prompt=new FullscreenPrompt(()=>calls++),result=prompt.show();
  const {okBtn,cancelBtn}=prompt.buttons;
  assert.equal(okBtn.textContent,'OK');assert.equal(cancelBtn.textContent,'Cancel');
  assert.equal(document.activeElement,okBtn);assert.equal(okBtn.parent.children[0],okBtn);
  assert.equal(prompt.buttons.overlay.children[0].children[0].textContent,'Full screen');
  assert.equal(prompt.show(),undefined);
  okBtn.click();assert.equal(calls,1);assert.equal(await result,true);assert.equal(prompt.active,false);
 }finally{restore();}
});

test('controller navigates to Cancel and confirms it without requesting fullscreen',async()=>{
 const restore=dom();try{
  let calls=0;const prompt=new FullscreenPrompt(()=>calls++),result=prompt.show();
  prompt.update(input('dpadRight'));assert.equal(document.activeElement,prompt.buttons.cancelBtn);
  prompt.update(input('jump'));assert.equal(await result,false);assert.equal(calls,0);
 }finally{restore();}
});

test('Enter respects selected Cancel and controller confirm accepts default OK',async()=>{
 const restore=dom();try{
  let calls=0;const prompt=new FullscreenPrompt(()=>calls++);let result=prompt.show();
  prompt.buttons.overlay.fire('keydown',{key:'ArrowRight'});
  prompt.buttons.overlay.fire('keydown',{key:'Enter'});
  assert.equal(await result,false);assert.equal(calls,0);
  result=prompt.show();prompt.update(input('gamepadStart'));
  assert.equal(await result,true);assert.equal(calls,1);
 }finally{restore();}
});

test('held controller OK cannot become a fresh Play action after closing the modal',async()=>{
 const restore=dom();try{
  const {default:Input}=await import('../../src/game/Input.js');
  const controls=Object.assign(Object.create(Input.prototype),{
   gamepadActions:{jump:true},virtualGamepadActions:{},keys:new Map(),virtualDown:new Map()
  });
  for(const key of ['pressed','commandPressed','released','virtualPressed','virtualReleased','gamepadPressed','gamepadReleased','virtualGamepadPressed','virtualGamepadReleased'])controls[key]=new Set();
  controls.gamepadPressed.add('jump');
  let calls=0;const prompt=new FullscreenPrompt(()=>calls++),result=prompt.show();
  prompt.update(controls);await result;
  assert.equal(calls,1);assert.equal(prompt.blocksInput,true);
  for(let frame=0;frame<30;frame++){
   prompt.update(controls);assert.equal(prompt.blocksInput,true);
   assert.equal(controls.wasPressed('jump'),false);
  }
  controls.gamepadActions.jump=false;prompt.update(controls);
  assert.equal(prompt.blocksInput,false);
  controls.setVirtual(controls.getGamepadActions());assert.equal(controls.wasPressed('jump'),false);
  controls.gamepadActions.jump=true;controls.setVirtual(controls.getGamepadActions());
  assert.equal(controls.wasPressed('jump'),true,'a separate press can select Play');
 }finally{restore();}
});

test('keyboard OK is consumed until Enter is released',async()=>{
 const restore=dom();try{
  const prompt=new FullscreenPrompt(()=>{}),result=prompt.show();
  prompt.buttons.overlay.fire('keydown',{key:'Enter'});await result;
  let held=true,flushes=0;
  const controls={isDownCode:code=>code==='Enter'&&held,flush:()=>flushes++};
  prompt.update(controls);assert.equal(prompt.blocksInput,true);
  held=false;prompt.update(controls);assert.equal(prompt.blocksInput,false);
  assert.equal(flushes,2);
 }finally{restore();}
});
