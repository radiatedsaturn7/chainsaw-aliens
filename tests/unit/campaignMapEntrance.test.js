import test from 'node:test';import assert from 'node:assert/strict';
import {campaignMapEntrance} from '../../src/menus/CampaignMapEntrance.js';
import {advanceMapCar} from '../../src/menus/MenuMapRoads.js';
import {normalizeMenuElement} from '../../src/menus/MenuDocument.js';
import {drawWorldMap} from '../../src/menus/MenuWorldMapRenderer.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
const a={id:'a',label:'1',raceRef:'A',x:.2,y:.5},b={id:'b',raceRef:'B',x:.7,y:.5};
const map={id:'map',type:'world-map',property:'campaign-path',mapEntrance:'auto',binding:'raceRef',nodes:[a,b],connections:[{from:'a',to:'b',fromPort:'right',toPort:'left'}],mapStyle:{cursor:'car'}};
test('entrance uses a free direction, extends offscreen, and persists in Screens documents',()=>{
 const entry=campaignMapEntrance(map,map.nodes,map.connections);assert.equal(entry.direction,'left');assert.ok(entry.end.x<0);
 assert.equal(normalizeMenuElement({...map,mapEntrance:'down'}).mapEntrance,'down');
 assert.equal(campaignMapEntrance({...map,mapEntrance:'none'},map.nodes,map.connections),null);
 assert.equal(campaignMapEntrance({...map,mapEntrance:'right'},map.nodes,map.connections).direction,'left','cannot reuse occupied race port');
});
test('car drives on and off the same entrance road without a race or unlock requirement',()=>{
 const entry=campaignMapEntrance(map,map.nodes,map.connections),nodes=[...map.nodes,entry.end],links=[...map.connections,entry.link];
 let state={node:entry.end.id,x:entry.end.x,y:entry.end.y,time:0};
 for(let i=0;i<=20;i++)state=advanceMapCar(state,nodes,links,'A',i*.1);
 assert.equal(state.node,'a');assert.equal(state.moving,false);
 for(let i=21;i<=40;i++)state=advanceMapCar(state,nodes,links,entry.end.raceRef,i*.1);
 assert.equal(state.node,'map-exit');assert.equal(state.moving,false);assert.ok(state.x<0);
});
test('direction away from the first node starts exit rather than changing race selection',async()=>{
 const p=Object.create(MenuPlayer.prototype);p.widgetStates=new Map();p.flow={time:0,document:{},parameters:{raceRef:'A'},setParameter(){assert.fail('exit must not select a race');}};p.resources={};
 await p.activate(map,-1,{mapDirection:'left'});
 assert.equal(p.widgetStates.get('map-car:map').campaignExiting,true);
});
test('regional car renders at twice its previous size and starts offscreen',()=>{
 const ctx=new Proxy({globalAlpha:1},{get:(o,k)=>k in o?o[k]:()=>{}}),states=new Map(),cars=[];
 drawWorldMap(ctx,{x:0,y:0,w:500,h:400},map,{}, {},{raceRef:'A'},'A',{drawText(){},widgetStates:states,drawCar:b=>cars.push(b),time:0});
 assert.ok(states.get('map-car:map').x<0);assert.equal(cars[0].w,110);
});
test('world overview opens only after the car finishes leaving the regional map',async()=>{
 const {createMenuRepeatState}=await import('../../src/ui/shared/menuRepeat.js');let target;
 const state={campaignExiting:true,node:'a',moving:true};
 const p=Object.assign(Object.create(MenuPlayer.prototype),{resources:{},widgetStates:new Map([['map-car:map',state]]),surface:{pressed:()=>()=>false,previous:{}},cutscene:{active:false},screenTransition:{active:false},navigationRepeat:createMenuRepeatState(),flow:{active:true,screen:{elements:[map]},document:{screens:[{id:'overview',elements:[{type:'world-map'}]}]},update(){},goTo:id=>{target=id;}}});
 p.update({},.1);assert.equal(target,undefined);
 Object.assign(state,{node:'map-exit',moving:false});p.update({},.1);assert.equal(target,'overview');
});
