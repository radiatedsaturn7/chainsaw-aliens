import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createCampaignHubMenus,campaignEventCategory} from '../../src/menus/CampaignHubMenus.js';
import {MenuFlow} from '../../src/menus/MenuFlow.js';
import {createAmericaWorldMap} from '../../src/menus/AmericaWorldMap.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../../'+p,import.meta.url)));
const catalog=read('data/campaigns/america/catalog.json');
const research=read('AI/last-on-the-grid/last_on_the_grid_99_side_races.json');
const candidates=research.hubs.flatMap(h=>h.races);
const installed=candidates.map(r=>({...r,status:'installed',raceRef:r.name}));

test('99 unique side missions are grouped beneath 11 existing campaign locations',()=>{
 assert.equal(candidates.length,99);assert.equal(new Set(candidates.map(r=>r.id)).size,99);
 const {screens,hubs}=createCampaignHubMenus(catalog,research,installed);
 assert.equal(Object.keys(hubs).length,11);assert.ok(screens.length>=44);
 for(const screen of screens)assert.ok(screen.elements.filter(e=>e.type==='button').length<=8);
 const choices=screens.flatMap(s=>s.elements).filter(e=>e.action?.type==='set-param');
 assert.equal(choices.length,110);
 assert.equal(new Set(choices.map(e=>e.action.value)).size,110);
 for(const entry of installed)assert.ok(choices.some(e=>e.action.value===entry.raceRef));
 assert.equal(createAmericaWorldMap(catalog).nodes.length,11);
});

test('choosing a side event carries its race into the existing garage and preserves the car',async()=>{
 const {screens,hubs}=createCampaignHubMenus(catalog,research,installed);
 const flow=new MenuFlow({screens:[...screens,{id:'garage',elements:[]}],startScreen:hubs[catalog[0].name],parameters:{carRef:'RTG-001'}});
 const side=screens.find(s=>s.id==='campaign-hub-1-roads').elements.find(e=>e.action?.type==='set-param');
 await flow.run(side.action);
 assert.equal(flow.screenId,'garage');assert.equal(flow.parameters.raceRef,installed[0].raceRef);
 assert.equal(flow.parameters.carRef,'RTG-001');
 await flow.run({type:'back'});assert.equal(flow.screenId,hubs[catalog[0].name]);
});

test('unimported candidates cannot launch an unrelated race',()=>{
 const {screens}=createCampaignHubMenus(catalog,research,[]);
 const entries=screens.filter(s=>s.id.endsWith('-roads')||s.id.endsWith('-detours')||s.id.endsWith('-raceways')).flatMap(s=>s.elements.filter(e=>e.type==='button'&&e.label!=='Back'));
 assert.equal(entries.length,99);
 for(const e of entries){assert.equal(e.disabled,true);assert.equal(e.action,null);}
 const bosses=screens.filter(s=>/^campaign-hub-\d+$/.test(s.id)).map(s=>s.elements.find(e=>e.label==='Main Mission'));
 assert.deepEqual(bosses.map(e=>e.action.value),catalog.map(e=>e.name));
});

test('confirming a campaign map location opens its hub rather than immediately selecting its main race',async()=>{
 const {default:MenuPlayer}=await import('../../src/menus/MenuPlayer.js');
 let destination=null,runs=0;
 const player=Object.create(MenuPlayer.prototype);
 player.flow={busy:false,parameters:{raceRef:catalog[0].name},document:{parameters:{campaignHubs:{[catalog[0].name]:'campaign-hub-1'}}},setParameter(k,v){this.parameters[k]=v},goTo:id=>destination=id,run:()=>runs++};
 player.resources={};
 const map={type:'world-map',binding:'raceRef',mapManual:true,nodes:createAmericaWorldMap(catalog).nodes};
 await player.activate(map,1,{choose:true});
 assert.equal(destination,'campaign-hub-1');assert.equal(runs,0);
});

test('Tower Hill side pages stay gated until the mandatory opener is complete',async()=>{
 const {default:MenuPlayer}=await import('../../src/menus/MenuPlayer.js');
 const {raceCompletionKey}=await import('../../src/menus/MenuWorldMap.js');
 let runs=0;const player=Object.create(MenuPlayer.prototype);
 player.flow={busy:false,parameters:{},document:{parameters:{campaignSideGates:{'campaign-hub-1-roads':catalog[0].name}}},run:()=>runs++};
 const button={type:'button',action:{type:'screen',target:'campaign-hub-1-roads'}};
 await player.activate(button);assert.equal(runs,0);
 player.flow.parameters[raceCompletionKey(catalog[0].name)]=true;
 await player.activate(button);assert.equal(runs,1);
 delete player.flow.parameters[raceCompletionKey(catalog[0].name)];
 player.resources={garage:{items:{progress:{unlocks:{'cheat.travel':true}}}}};
 await player.activate(button);assert.equal(runs,2,'TRAVEL also opens side events');
});


test('installed surfaces classify detours, while dirt ovals remain raceways',()=>{
 assert.equal(campaignEventCategory({installedSurfaces:['asphalt','gravel']}),'detours');
 assert.equal(campaignEventCategory({installedSurfaces:['asphalt'],priority:'wildcard'}),'roads');
 assert.equal(campaignEventCategory({installedSurfaces:['dirt'],event_type:'Dirt oval'}),'raceways');
 assert.equal(campaignEventCategory({installedSurfaces:['snow']}),'detours');
 assert.equal(campaignEventCategory({installedSurfaces:['wet-asphalt']}),'roads');
});

test('venue layouts paginate with eight controls and Back returns to venue parent',async()=>{
 const extra=Array.from({length:12},(_,i)=>({id:`extra-${i}`,hubStage:1,status:'installed',raceRef:`Course ${i}`,venueKey:'example',venueName:'Example Raceway',layoutLabel:`Layout ${i}`}));
 const {screens,sideGates}=createCampaignHubMenus(catalog,research,[...installed,...extra]);
 for(const s of screens)assert.ok(s.elements.filter(e=>e.type==='button').length<=8);
 const flow=new MenuFlow({screens:[...screens,{id:'garage',elements:[]}],startScreen:'campaign-hub-1-raceways'});
 await flow.run({type:'screen',target:'campaign-hub-1-venue-example'});
 const next=()=>flow.screen.elements.find(e=>e.label==='Next');
 await flow.run(next().action);await flow.run(next().action);
 assert.equal(flow.screenId,'campaign-hub-1-venue-example-page-3');
 assert.equal(sideGates[flow.screenId],catalog[0].name);
 await flow.run({type:'back'});assert.equal(flow.screenId,'campaign-hub-1-raceways');
 const choices=screens.flatMap(s=>s.elements).filter(e=>e.action?.parameter==='raceRef');
 for(const e of extra)assert.equal(choices.filter(c=>c.action.value===e.raceRef).length,1);
});
