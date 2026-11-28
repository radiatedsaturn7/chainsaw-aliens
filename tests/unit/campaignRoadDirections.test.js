import test from 'node:test';
import assert from 'node:assert/strict';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {advanceMapCar,campaignRoadNeighbors,campaignRoadDirectionalNode,queueCampaignRoadMove} from '../../src/menus/MenuMapRoads.js';
import {createMenuRepeatState} from '../../src/ui/shared/menuRepeat.js';

const race=(id,x,y,extras={})=>({id,raceRef:id.toUpperCase(),x,y,...extras});
const join=(from,to)=>({from,to});
const compass=[
 race('a',.5,.5),race('u',.5,.22),race('d',.51,.8),race('l',.18,.48),race('r',.84,.51),race('trap',.56,.51),race('lock',.51,.49,{disabled:true})
];
const spokes=[join('a','u'),join('a','d'),join('a','l'),join('a','r'),join('a','lock'),join('r','trap')];

function playerFor({regional=true,nodes=compass,connections=spokes}={}){
 const map={id:'regional-path',type:'world-map',property:regional?'campaign-path':'',binding:'raceRef',x:0,y:0,w:1,h:1,nodes,connections,
  mapManual:true,mapStyle:{cursor:regional?'car':'ring'}};
 const button={id:'world-race-index',type:'button'};
 const screen={id:'path-test',elements:[map,button]};
 const p=Object.assign(Object.create(MenuPlayer.prototype),{
  resources:{},bounds:{x:0,y:0,w:960,h:540},focus:0,widgetStates:new Map(),interactive:()=>[map,button],
  surface:{pressed:()=>()=>false,previous:{}},
  paused:false,cutscene:{active:false},screenTransition:{active:false},navigationRepeat:createMenuRepeatState(),
  flow:{screen,document:{parameters:{}},active:true,busy:false,time:1,parameters:{raceRef:'A'},update(dt){this.time+=dt;},setParameter(k,v){this.parameters[k]=v;}}
 });
 return {p,map};
}
const Dpad={Up:'dpadUp',Down:'dpadDown',Left:'dpadLeft',Right:'dpadRight'};
const tests=[['Up','U',{leftY:-.9}],['Down','D',{leftY:.9}],['Left','L',{leftX:-.9}],['Right','R',{leftX:.9}]];
for(const [d,expected,axes] of tests)for(const device of ['keyboard','gamepad','stick']){
 test(`${device} ${d} selects only connected regional neighbor and keeps widget focus`,()=>{
  const {p}=playerFor(),input={
   wasPressedCode:k=>device==='keyboard'&&k==='Arrow'+d,
   wasGamepadPressed:k=>device==='gamepad'&&k===Dpad[d],
   getGamepadAxes:()=>device==='stick'?axes:{}
  };
  p.update(input,.02);
  assert.equal(p.flow.parameters.raceRef,expected);
  assert.equal(p.focus,0);
  assert.deepEqual(p.widgetStates.get('map-car:regional-path').campaignRoadMoves,[{from:'a',to:expected.toLowerCase()}]);
 });
}
test('no up edge keeps regional focus; generic world map still permits up category focus',()=>{
 const {p}=playerFor({connections:[join('a','d')]});
 p.update({wasPressedCode:k=>k==='ArrowUp'},.02);
 assert.equal(p.focus,0);assert.equal(p.flow.parameters.raceRef,'A');
 const {p:g}=playerFor({regional:false,nodes:[compass[0],compass[2]],connections:[join('a','d')]});
 g.update({wasPressedCode:k=>k==='ArrowUp'},.02);
 assert.equal(g.focus,1);assert.equal(g.flow.parameters.raceRef,'A');
});
test('connected selection does not cross locked nodes or skip a race; junctions are transparent',()=>{
 const ns=[race('a',.2,.5),race('b',.35,.55),race('c',.41,.5),race('v',.35,.65,{locked:true}),
  {id:'i',kind:'junction',x:.25,y:.3},{id:'j',kind:'junction',x:.45,y:.3},race('d',.6,.45)];
 const es=[join('a','b'),join('b','c'),join('a','v'),join('v','c'),join('a','i'),join('i','j'),join('j','d')];
 const result=campaignRoadNeighbors(ns,es,'a');
 assert.deepEqual([...result.keys()],['b','d']);assert.equal(result.get('d').length,3);
 assert.equal(campaignRoadDirectionalNode(ns,es,ns[0],'right',p=>p).id,'b');
 assert.equal(campaignRoadDirectionalNode(ns,es,ns[0],'up',p=>p).id,'d');
 assert.equal(campaignRoadNeighbors(ns.map(n=>n.id==='i'?{...n,locked:true}:n),es,'a').has('d'),false);
});
test('pre-draw input and rapid reversals drive the chosen junction chain without teleporting',()=>{
 const ns=[race('a',.1,.5),race('b',.8,.5),race('shortcut',.4,.5),
  {id:'j',kind:'junction',x:.25,y:.18},{id:'k',kind:'junction',x:.65,y:.18}];
 const es=[join('a','shortcut'),join('shortcut','b'),join('a','j'),join('j','k'),join('k','b')];
 const s={};queueCampaignRoadMove(s,'a','b');
 advanceMapCar(s,ns,es,'B',0);
 assert.equal(s.node,'a');assert.equal(s.x,.1);assert.equal(s.y,.5);
 advanceMapCar(s,ns,es,'B',.1);
 queueCampaignRoadMove(s,'b','a');
 let prev={...s},minY=1,visitedB=false;
 for(let i=2;i<65;i++){
  advanceMapCar(s,ns,es,'A',i*.1);
  const motion=Math.hypot(s.x-prev.x,s.y-prev.y);
  assert.ok(motion<=.050001,motion);
  minY=Math.min(minY,s.y);visitedB||=s.node==='b';
  prev={...s};
 }
 assert.ok(minY<.2);assert.ok(visitedB);assert.equal(s.node,'a');assert.equal(s.moving,false);
});
test('a junction locking after direction input cannot divert the car through another race',()=>{
 const ns=[race('a',.1,.5),race('b',.8,.5),race('shortcut',.4,.5),{id:'j',kind:'junction',x:.4,y:.2,locked:true}];
 const es=[join('a','shortcut'),join('shortcut','b'),join('a','j'),join('j','b')];
 const s={};queueCampaignRoadMove(s,'a','b');
 for(let i=0;i<20;i++)advanceMapCar(s,ns,es,'B',i*.1);
 assert.equal(s.node,'a');assert.equal(s.x,.1);assert.equal(s.campaignRoadBlocked,'b');
});
