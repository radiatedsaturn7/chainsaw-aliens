import test from 'node:test';
import assert from 'node:assert/strict';
import {drawMenuScreen} from '../../src/menus/MenuRenderer.js';
import {normalizeMenuDocument} from '../../src/menus/MenuDocument.js';

test('unchanged menu buttons reuse artwork, font outlines and dimming; changes invalidate them',()=>{
  const previous=globalThis.document;let rasters=0,textDraws=0;
  const context=()=>new Proxy({measureText:()=>({width:40}),fillText(){textDraws++;},getTransform:()=>({a:2,d:2})},
    {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  globalThis.document={createElement(){rasters++;return {getContext:context};}};
  try{
    const doc=normalizeMenuDocument({screens:[{id:'splash',elements:[{id:'start',type:'button',label:'Start',animation:'none',artRef:'button',textOutlineWidth:2}]}]});
    const screen=doc.screens[0],element=screen.elements[0],ctx=context();
    let art={width:100,height:50},font='system-ui';
    const resources={art:ref=>ref?art:null,font:()=>font};
    const draw=(extra={})=>drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},doc,screen,{}, {resources,...extra});
    draw();assert.equal(rasters,1);const initial=textDraws;
    for(let i=0;i<60;i++)draw({time:i/60});
    assert.equal(rasters,1);assert.equal(textDraws,initial);
    draw({focus:'start'});assert.equal(rasters,2);
    font='LoadedFont';draw({focus:'start'});assert.equal(rasters,3);
    art={width:100,height:50};draw({focus:'start'});assert.equal(rasters,4);
    element.color='#ffaaaa';draw({focus:'start'});assert.equal(rasters,5);
    element.disabled=true;draw({focus:'start'});assert.equal(rasters,6);
    element.animation='typewriter';draw({time:1});draw({time:2});assert.equal(rasters,6,'animated text stays live');
    element.animation='none';element.keyframes=[{time:0,x:.2}];draw();assert.equal(rasters,6,'keyframed placement stays live');element.keyframes=[];draw({editing:true});assert.equal(rasters,6,'authoring stays live');
  }finally{globalThis.document=previous;}
});
