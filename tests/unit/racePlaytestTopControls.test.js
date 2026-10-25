import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';

test('normal Play hides the top editor-return control while authoring previews retain it',()=>{
 const ctx=new Proxy({}, {get:()=>()=>{},set:()=>true});
 for(const [travel,expected] of [
  [{originState:'menu-player',originPlaytestActive:false},false],
  [{originState:'playing',originPlaytestActive:false},false],
  [{originState:'pause',originPlaytestActive:false},false],
  [{originState:'menu-player',originPlaytestActive:true},true],
  [{originState:'playing',originPlaytestActive:true},true],
  [{originState:'race-editor',originPlaytestActive:false},true],
  [null,true]
 ]){
  const e=new RaceEditor({raceTravelSession:travel});e.buttons=[];
  e.drawRacePlaytestTopControls(ctx,{x:0,y:0,w:960,h:540});
  assert.equal(e.buttons.some(b=>b.id==='race-pause-return-editor'),expected,JSON.stringify(travel));
 }
});
