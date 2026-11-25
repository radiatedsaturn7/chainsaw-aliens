import test from 'node:test';
import assert from 'node:assert/strict';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {drawWorldMap} from '../../src/menus/MenuWorldMapRenderer.js';
import {worldMapNodes,worldMapConnections,raceCompletionKey} from '../../src/menus/MenuWorldMap.js';
import {campaignWorldPresentation,campaignWorldRevealKey,captureCampaignWorldReturn,WORLD_ROAD_REVEAL_SECONDS,WORLD_PIN_POP_SECONDS} from '../../src/menus/CampaignWorldReveal.js';
globalThis.window ||= {location:{search:''}};
const {default:Game}=await import('../../src/game/GameCore.js');

const nodes=['P','Q','R'].map((raceRef,i)=>({raceRef,id:raceRef.toLowerCase(),label:raceRef,x:.15+i*.3,y:.4+i*.1}));
const links=[{from:'p',to:'q',curve:'bezier',control1:{x:.2,y:.7},control2:{x:.3,y:.35}},{from:'q',to:'r'}];
const map={id:'event',type:'world-map',property:'name',mapManual:true,binding:'raceRef',nodes,connections:links,mapStyle:{cursor:'ring'}};
const screen={id:'world-map',elements:[map]};
const doc={parameters:{campaignProgression:{regions:['P','Q','R'].map(bossRef=>({bossRef,events:[]}))}},screens:[screen]};
const won={raceRef:'P',[raceCompletionKey('P')]:true};
const fresh=captureCampaignWorldReturn(doc,'P',{},{});
const getNodes=p=>worldMapNodes(map,{},doc,p);

test('snapshot selects only the newly reachable next region (not preview history or replays)',()=>{
 assert.deepEqual(fresh,{bossRef:'P',binding:'raceRef',reveal:{from:'p',to:'q',toRef:'Q',elapsed:0}});
 assert.deepEqual(captureCampaignWorldReturn(doc,'P',{},won),{...fresh,reveal:null});
 assert.equal(captureCampaignWorldReturn(doc,'not-a-boss',{},{}),null);
 assert.equal(captureCampaignWorldReturn(doc,'R',{},{}).reveal,null);
 assert.equal(captureCampaignWorldReturn(doc,'P',{garage:{progress:{rewards:{P:{clears:1}}}}},{}).reveal,null);
});

test('only accessible pins are presented; a new pin and link wait until paving ends',()=>{
 const initial=campaignWorldPresentation(getNodes({}),links,null);
 assert.deepEqual(initial.visible.map(n=>n.id),['p']);
 assert.deepEqual(initial.links,[]);
 const middle=campaignWorldPresentation(getNodes(won),links,{...fresh.reveal,elapsed:.35});
 assert.equal(middle.paving,true);
 assert.deepEqual(middle.visible.map(n=>n.id),['p']);assert.deepEqual(middle.links,[]);
 const after=campaignWorldPresentation(getNodes(won),links,{...fresh.reveal,elapsed:WORLD_ROAD_REVEAL_SECONDS});
 assert.deepEqual(after.visible.map(n=>n.id),['p','q']);assert.deepEqual(after.links,[links[0]]);
 assert.equal(worldMapConnections(map,getNodes(won)).length,2,'authored roads stay visible to the editor');
});

test('canvas draws a growing route but not its locked or not-yet-revealed destination',()=>{
 const draw=(params,elapsed,editing=false)=>{
  const labels=[],paths=[];
  const ctx=new Proxy({globalAlpha:1,moveTo(x,y){paths.push([x,y]);},lineTo(x,y){paths.push([x,y]);}}, {get:(o,k)=>k in o?o[k]:()=>{}});
  const widgetStates=new Map();
  if(elapsed!==null)widgetStates.set(campaignWorldRevealKey(map.id),{...fresh.reveal,elapsed});
  drawWorldMap(ctx,{x:0,y:0,w:500,h:300},map,{},doc,params,'P',{editing,campaignOverview:true,widgetStates,drawText:text=>labels.push(text)});
  return {paths,labels};
 };
 assert.deepEqual(draw({},null).paths,[]);
 assert.equal(draw({},null).labels.filter(t=>/^\d$/.test(t)).length,1);
 const partial=draw(won,.55);
 assert.ok(partial.paths.length>2);
 assert.ok(partial.paths.at(-1)[0]<225);
 assert.equal(partial.labels.includes('2'),false);
 assert.equal(draw(won,WORLD_ROAD_REVEAL_SECONDS).labels.includes('2'),true);
 assert.equal(draw({},null,true).labels.includes('3'),true);
});

test('player blocks navigation during reveal and selects the next pin exactly once',()=>{
 const picks=[];
 const p=Object.assign(Object.create(MenuPlayer.prototype),{flow:{screen,document:doc,setParameter:(key,value)=>picks.push([key,value])},
  widgetStates:new Map([[campaignWorldRevealKey(map.id),{...fresh.reveal}]])});
 assert.equal(p.advanceCampaignWorldReveal(.5),true);
 assert.deepEqual(picks,[]);
 p.advanceCampaignWorldReveal(.61);
 assert.deepEqual(picks,[['raceRef','Q']]);
 p.advanceCampaignWorldReveal(WORLD_PIN_POP_SECONDS);
 assert.equal(p.advanceCampaignWorldReveal(.01),false);
 assert.equal(picks.length,1);
});

test('successful campaign boss returns to overview with launch snapshot, even if results already saved',()=>{
 const flow={active:true,parameters:won},game=Object.create(Game.prototype);
 game.menuPlayer={flow};game.ensureRaceTravelSession=()=>({menuFlow:flow,campaignWorldReturn:fresh});
 game.openMenuDestination=x=>x;
 const result=game.completeRaceTravel({type:'menu',menuScreen:'garage',progressSaved:true},{raceDocumentName:'P'});
 assert.equal(result.menuScreen,'world-map');assert.deepEqual(result.campaignWorldReturn,fresh);
 const loss=game.completeRaceTravel({type:'menu',menuScreen:'garage',mechanicalMissionSuccess:false},{raceDocumentName:'P'});
 assert.equal(loss.menuScreen,'garage');assert.equal(loss.campaignWorldReturn,undefined);
 const other=game.completeRaceTravel({type:'menu',menuScreen:'garage'},{raceDocumentName:'different'});
 assert.equal(other.menuScreen,'garage');
});

test('invisible future pins cannot intercept a nearby open pin tap',()=>{
 const open=map.nodes[0],locked=map.nodes[1];
 const overlap={...map,x:0,y:0,w:1,h:1,nodes:[open,{...locked,x:open.x+.025,y:open.y}]};
 const activeScreen={id:'world-map',elements:[overlap]};
 const parameters={raceRef:'P'},b={x:0,y:0,w:400,h:300};
 let activations=0;
 const p=Object.assign(Object.create(MenuPlayer.prototype),{preview:false,bounds:b,screenTransition:{active:false},
  flow:{screen:activeScreen,document:doc,parameters,setParameter:(key,value)=>parameters[key]=value},resources:{},
  cutscene:{active:false},widgetStates:new Map(),videos:new Map(),interactive:()=>[overlap],
  hitElement:()=>overlap,activate(){activations++;}});
 p.handlePointerDown({x:(open.x+.023)*b.w,y:open.y*(b.h-36)});
 assert.equal(activations,1);
 assert.equal(parameters.raceRef,'P');
 p.widgetStates.set(campaignWorldRevealKey(map.id),{...fresh.reveal,elapsed:.3});
 p.handlePointerDown({x:(open.x+.023)*b.w,y:open.y*(b.h-36)});
 assert.equal(activations,1);
});

test('alternate regional finale plays its exit movie and reveals the original world pin route',()=>{
 const revised=structuredClone(doc);
 revised.parameters.campaignProgression.regions[0].finaleRef='P Forest';
 const snapshot=captureCampaignWorldReturn(revised,'P Forest',{},{});
 const flow={active:true},game=Object.create(Game.prototype);
 game.menuPlayer={flow};
 game.ensureRaceTravelSession=()=>({menuFlow:flow,campaignWorldReturn:snapshot});
 game.playRaceFinishCutscene=destination=>destination;
 const result=game.completeRaceTravel({type:'menu',menuScreen:'campaign-hub-1',cutsceneRef:'r1-pachaug-exit'},{raceDocumentName:'P Forest'});
 assert.equal(result.menuScreen,'world-map');
 assert.equal(result.cutsceneRef,'r1-pachaug-exit');
 assert.equal(result.campaignWorldReturn.bossRef,'P');
 assert.equal(result.campaignWorldReturn.reveal.toRef,'Q');
 assert.equal(result.variables[raceCompletionKey('P Forest')],true);
 assert.equal(result.variables[raceCompletionKey('P')],undefined);
});
