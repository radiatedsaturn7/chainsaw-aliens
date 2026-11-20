import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {drawRouteConditions,buildCampaignRoutePreview,previewPoints,campaignCompletionMark,selectedCampaignPreview,routeSurfaceLabels} from '../../src/menus/CampaignRoutePreview.js';
import {drawMenuScreen} from '../../src/menus/MenuRenderer.js';
const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
const race={campaign:{optional:true},road:{nodes:[{x:0,y:0,elevation:0},{x:100,y:0,elevation:1},{x:100,y:300,elevation:.5}],segments:[{surface:'gravel'},{surface:'wet-asphalt'}]}};
test('surface mix is length-weighted, height uses world scale, and snow cover remains separate',()=>{
 const s=buildCampaignRoutePreview('test',{...race,snowDepthIn:1,weather:'snow'});
 assert.deepEqual(s.surfaces,{dirt:0,snow:0,gravel:25,asphalt:75});
 assert.equal(buildCampaignRoutePreview('snow',{...race,weather:'snow',trackState:{surfaceProfiles:{snow:{snowDepthMm:25.4}}}}).snowDepthIn,1);
 assert.equal(buildCampaignRoutePreview('storm',{...race,weather:'snow'}).snowBuilds,true);
 assert.equal(s.distanceM,400);assert.equal(s.climbM,12);assert.equal(s.snowDepthIn,1);
 assert.deepEqual(previewPoints(s),[[0,0],[.333,0],[.333,1]]);assert.equal(previewPoints(s),previewPoints(s),'decode once');
 const bare=buildCampaignRoutePreview('empty',{});assert.equal(bare.climbM,0);assert.deepEqual(previewPoints(bare),[]);
});
test('previews retain endpoints, bound vertex count and round surface percentages to exactly 100',()=>{
 const r={road:{nodes:Array.from({length:10000},(_,i)=>({x:i,y:Math.sin(i/100)*20})),segments:Array.from({length:9999},(_,i)=>({surface:['gravel','asphalt','dirt'][i%3]}))}};
 const s=buildCampaignRoutePreview('long',r),p=previewPoints(s);assert.ok(p.length<=385);assert.equal(p[0][0],0);assert.equal(p.at(-1)[0],1);assert.equal(Object.values(s.surfaces).reduce((a,b)=>a+b),100);
});
test('green means cleared, gold requires bonus objective and gold medal in the active save',()=>{
 const progress={rewards:{A:{clears:1,objectiveEarned:false,medalRank:3}}};
 assert.equal(campaignCompletionMark('A',{},progress),'green');progress.rewards.A.objectiveEarned=true;
 assert.equal(campaignCompletionMark('A',{},progress),'gold');assert.equal(campaignCompletionMark('A',{},{}),'');
 assert.equal(campaignCompletionMark('A',{'raceCompleted.A':true},{}),'green');
});
test('all installed campaign choices have compact previews and nonoverlapping eight-control layouts',()=>{
 for(const screen of menu.screens.filter(s=>s.id.startsWith('campaign-hub-'))){
  const panel=screen.elements.find(e=>e.property==='route-preview');assert.ok(panel);
  const buttons=screen.elements.filter(e=>e.type==='button');assert.ok(buttons.length<=8);
  for(const b of buttons){assert.ok(b.x+b.w<panel.x);if(b.action?.parameter==='raceRef'){const p=menu.parameters.campaignRoutePreviews[b.action.value];assert.ok(p,b.action.value);assert.ok(p.distanceM>0);assert.equal(Object.values(p.surfaces).reduce((a,b)=>a+b),100);}}
 }
});
test('highlight changes preview without selecting a race; navigation retains previous preview',()=>{
 const screen=menu.screens.find(s=>s.id==='campaign-hub-1-detours'),state=new Map(),rows=screen.elements.filter(e=>e.action?.parameter==='raceRef');
 assert.ok(rows.length>1);assert.equal(selectedCampaignPreview(screen,rows[1].id,state),rows[1].action.value);
 assert.equal(selectedCampaignPreview(screen,screen.elements.find(e=>e.action?.type==='back').id,state),rows[1].action.value);
});
test('route selection draws with standard menu font and never hydrates a race or its artwork',()=>{
 const texts=[],strokes=[];
 const ctx=new Proxy({measureText:s=>({width:s.length*7}),fillText:s=>texts.push(s),stroke(){strokes.push(this.strokeStyle);}}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const screen=menu.screens.find(s=>s.id==='campaign-hub-1-detours'),e=screen.elements.find(e=>e.action?.parameter==='raceRef'),ref=e.action.value;
 const resources={font:()=> 'Existing Game Font',art:()=>null,race(){throw Error('Should not hydrate a race');},garage:{progress:{rewards:{[ref]:{clears:1,objectiveEarned:true,medalRank:3}}}}};
 drawMenuScreen(ctx,{x:0,y:0,w:960,h:540},menu,screen,{}, {resources,focus:e.id});
 assert.ok(!texts.some(s=>/Rewards:|Asphalt|span/.test(s)));for(const label of routeSurfaceLabels(menu.parameters.campaignRoutePreviews[ref]))assert.ok(texts.some(s=>s.includes(label)));assert.ok(!texts.some(s=>/(?:^|\s)0%/.test(s)));assert.ok(!texts.some(s=>s.includes('Climb')));assert.ok(texts.some(s=>/^\d+ ft$/.test(s)));assert.ok(texts.some(s=>s==='1 lap'));assert.ok(strokes.includes('#ffcf40'));
});

test('surface labels omit absent surfaces and use the requested names',()=>{assert.deepEqual(routeSurfaceLabels({surfaces:{asphalt:75,dirt:0,gravel:25,snow:0}}),['Tarmac 75%','Gravel 25%']);assert.deepEqual(routeSurfaceLabels({surfaces:{snow:100}}),['Snow 100%']);});


test('conditions occupy one icon and clouds change shade at night',()=>{
 for(const weather of ['rain','cloudy','snow','clear'])for(const time of ['day','night']){
  const shifts=[],fills=[];let arcs=0;
  const ctx=new Proxy({translate:(...v)=>shifts.push(v),fill(){fills.push(this.fillStyle);},arc(){arcs++;}},{get:(o,k)=>k in o?o[k]:()=>{}});
  drawRouteConditions(ctx,12,12,30,time,weather);
  assert.deepEqual(shifts,[[12,12]]);
  if(weather!=='clear'){assert.equal(arcs,0);assert.ok(fills.includes(time==='night'?'#60656d':'#d8e3ed'));}
  else assert.equal(arcs,1);
 }
});
