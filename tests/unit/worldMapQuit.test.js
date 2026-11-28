import test from 'node:test';
import assert from 'node:assert/strict';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {MenuFlow} from '../../src/menus/MenuFlow.js';
function fixture(){
 let stopped=0;
 const player=Object.assign(Object.create(MenuPlayer.prototype),{screenFocus:new Map()});
 player.flow=new MenuFlow({startScreen:'world-map',screens:[{id:'world-map',elements:[{id:'map',type:'world-map',binding:'raceRef'}]},{id:'region',elements:[]}]},{stop:()=>stopped++});
 player.flow.screenId='world-map';player.flow.parameters.raceRef='Mount Washington';
 return {player,stopped:()=>stopped};
}
test('world map Back opens standard confirmation, Cancel preserves selected region and history',async()=>{
 const {player,stopped}=fixture();
 assert.equal(player.confirmWorldMapQuit(),true);
 assert.equal(player.flow.screenId,'world-map-quit');assert.equal(stopped(),0);
 assert.equal(player.flow.screen.background,'#000000');
 const cancel=player.flow.screen.elements.find(e=>e.label==='Cancel');
 await player.activate(cancel,1,{choose:true});
 assert.equal(player.flow.screenId,'world-map');assert.equal(player.flow.parameters.raceRef,'Mount Washington');assert.deepEqual(player.flow.history,[]);assert.equal(stopped(),0);
});
test('Quit confirms through the existing title exit; Back on dialog cancels',async()=>{
 const {player,stopped}=fixture();player.confirmWorldMapQuit();player.flow.back();assert.equal(player.flow.screenId,'world-map');
 player.confirmWorldMapQuit();await player.activate(player.flow.screen.elements.find(e=>e.label==='Quit'),1,{choose:true});
 assert.equal(stopped(),1);assert.equal(player.flow.active,false);
});
test('region menus do not show a quit dialog and map Back buttons use it',async()=>{
 const {player}=fixture();player.flow.goTo('region');assert.equal(player.confirmWorldMapQuit(),false);player.flow.back();
 await player.activate({type:'button',action:{type:'back'}},1,{choose:true});assert.equal(player.flow.screenId,'world-map-quit');
});
