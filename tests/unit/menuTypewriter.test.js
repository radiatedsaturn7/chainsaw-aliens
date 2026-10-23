import test from 'node:test';
import assert from 'node:assert/strict';
import {menuTypedText,typewriterLength} from '../../src/menus/MenuTypewriter.js';
import {normalizeMenuElement} from '../../src/menus/MenuDocument.js';
import {drawGarageDialogueText,drawCarDescription} from '../../src/menus/MenuRenderer.js';
import {drawGarageTuner} from '../../src/menus/MenuTuningRenderer.js';
import {drawUpgradeGrid} from '../../src/menus/MenuUpgradeRenderer.js';

test('typewriter reveals letters, pauses after periods, and holds the completed line',()=>{
 const opts={typewriterSpeed:10,typewriterPause:.5};
 assert.equal(typewriterLength('Hi. Yes',.3,opts),3);
 assert.equal(typewriterLength('Hi. Yes',.7,opts),3);
 assert.equal(typewriterLength('Hi. Yes',.9,opts),4);
 assert.equal(typewriterLength('Hi. Yes',5,opts),7);
 assert.equal(typewriterLength('Hi',1.3,{...opts,loop:true}),1);
});
test('new dialogue restarts typing; editor static mode shows the full line; settings persist',()=>{
 const e=normalizeMenuElement({animation:'typewriter',typewriterSpeed:20,typewriterPause:.6,loop:false});
 assert.equal(menuTypedText(e,'Hello.',10),'');assert.equal(menuTypedText(e,'Hello.',10.1),'He');
 assert.equal(menuTypedText(e,'New line',10.2),'');assert.equal(menuTypedText(e,'New line',10.3),'Ne');
 assert.equal(menuTypedText(e,'New line',0),'');assert.equal(menuTypedText(e,'New line',0,true),'New line');
 const saved=normalizeMenuElement(JSON.parse(JSON.stringify(e)));assert.equal(saved.animation,'typewriter');assert.equal(saved.typewriterSpeed,20);assert.equal(saved.typewriterPause,.6);
});
test('dialogue wraps and sizes against the full line throughout the animation',()=>{
 const e=normalizeMenuElement({animation:'typewriter',loop:false,fontSize:34}),draws=[];
 const ctx={font:'',measureText(text){return {width:text.length*parseFloat(this.font)*.5};},fillText(text,x,y){draws.push({text,x,y,font:this.font});}};
 const b={x:0,y:0,w:320,h:60},line='We could get a little more power out of it. Or lose some weight.';
 drawGarageDialogueText(ctx,b,line,'sans-serif',e,{time:0});const initial=draws.map(({text,...rest})=>rest);draws.length=0;
 drawGarageDialogueText(ctx,b,line,'sans-serif',e,{time:1});assert.deepEqual(draws.map(({text,...rest})=>rest),initial);assert.ok(draws.some(d=>d.text));
});
function context(){
 const draws=[],stack=[],ctx=new Proxy({filter:'none',save(){stack.push(this.filter);},restore(){this.filter=stack.pop();},fillText(text){draws.push({text,filter:this.filter});},measureText:()=>({width:20})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 return {ctx,draws};
}
test('tuning labels and values share selected, unselected and disabled panel brightness',()=>{
 const {ctx,draws}=context();
 const tuner={mode:'grid',index:0,enabled:i=>i<2};drawGarageTuner(ctx,{x:0,y:0,w:900,h:460},tuner);
 assert.equal(draws.find(d=>d.text==='Tire'&&d.filter==='none')?.filter,'none');
 assert.ok(draws.some(d=>d.text==='type'&&d.filter==='brightness(0.55)'));
 assert.ok(draws.some(d=>d.text==='Suspension'&&d.filter==='grayscale(1) brightness(0.5)'));
});
test('upgrade titles and prices share their panel brightness',()=>{
 const {ctx,draws}=context(),resources={garageCatalog:()=>['Tires','Engine'].map(section=>({item:{carPart:{section,slot:section,compatibleCars:[],forSale:true}}}))};
 drawUpgradeGrid(ctx,{x:0,y:0,w:900,h:460},{color:'#fff'},resources,{}, {index:0});
 assert.equal(draws.find(d=>d.text==='Tires').filter,'none');assert.equal(draws.find(d=>d.text==='Engine').filter,'brightness(0.55)');assert.equal(ctx.filter,'none');
});


test('race descriptions type with punctuation pauses, stable wrapping, and restart on selection',()=>{
 const e=normalizeMenuElement({type:'race-description',animation:'typewriter',typewriterSpeed:10,typewriterPause:.5,loop:false}),draws=[];
 const ctx={font:'',measureText(text){return {width:text.length*6};},fillText(text,x,y){draws.push({text,x,y});}};
 const render=(text,time,editing=false)=>{draws.length=0;drawCarDescription(ctx,{x:0,y:0,w:140,h:160},text,'sans-serif',e,{time,editing});return draws.map(d=>({...d}));};
 const text='Go. Take the road through the city.';
 const start=render(text,0);assert.ok(start.every(d=>d.text===''));
 const paused=render(text,.6);assert.equal(paused.map(d=>d.text).join(''),'Go.');
 const full=render(text,20);assert.equal(full.map(d=>d.text).join(' '),text);
 assert.deepEqual(full.map(({text,...rest})=>rest),start.map(({text,...rest})=>rest));
 assert.ok(render('A different race.',21).every(d=>d.text===''));
 assert.equal(render('A different race.',22,true).map(d=>d.text).join(' '),'A different race.');
});

test('full first-route description fits the original world-map panel without changing during typing',()=>{
 const text="North to 90, or south on 95. Either way, I... I guess we're actually leaving.";
 for(const width of [320,360,960,1280]){
  const b={x:width*.3,y:width*9/16*.76,w:width*.66,h:width*9/16*.22};
  const e=normalizeMenuElement({type:'race-description',animation:'typewriter',loop:false}),draws=[];
  const ctx={font:'',measureText(t){return {width:t.length*parseFloat(this.font)*.8};},fillText(t,x,y){draws.push({text:t,x,y,font:this.font});}};
  drawCarDescription(ctx,b,text,'sans-serif',e,{time:0});const positions=draws.map(({text,...rest})=>rest);draws.length=0;
  drawCarDescription(ctx,b,text,'sans-serif',e,{time:100});
  assert.equal(draws.map(d=>d.text).join(' '),text);
  assert.deepEqual(draws.map(({text,...rest})=>rest),positions);
  for(const d of draws){assert.ok(d.y>=b.y);assert.ok(d.y+parseFloat(d.font)*1.4<=b.y+b.h);assert.ok(ctx.measureText(d.text).width<=b.w-16);}
 }
});
