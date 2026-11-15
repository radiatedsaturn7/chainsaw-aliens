import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import dialogue from '../../src/content/campaign-region-dialogue.json' with {type:'json'};
import {campaignRegionDialogue,configureCampaignRegionMap} from '../../src/menus/CampaignRegionDialogue.js';
import {normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import {drawMenuScreen} from '../../src/menus/MenuRenderer.js';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url),'utf8'));
const catalog=read('../../data/campaigns/america/catalog.json');
const menu=read('../../data/server-storage/files/menus/Game Menu/document.json');
test('all eleven campaign regions have distinct editable dialogue, including the supplied lines',()=>{
 assert.equal(catalog.length,11);
 for(const region of catalog)assert.ok(dialogue[region.name]);
 assert.equal(new Set(catalog.map(r=>campaignRegionDialogue(r.name))).size,11);
 assert.equal(campaignRegionDialogue('Tower Hill Road'),'Well... This is your journey. Where we going next?');
 assert.equal(campaignRegionDialogue('Mount Washington Auto Road — point-to-point'),'Are you really gonna drag my ass up that mountain?');
 assert.equal(campaignRegionDialogue('Data Center City'),"...So this is heaven, huh? I guess... I'm kinda glad I didn't take the plunge...");
});
test('saved map and older campaign menu migration remove headings/status without changing connections or navigation',()=>{
 const doc=structuredClone(menu),screen=doc.screens.find(s=>s.id==='world-map'),map=screen.elements.find(e=>e.type==='world-map');
 const before=structuredClone({nodes:map.nodes,connections:map.connections,action:map.action});
 assert.equal(map.showSelectedLabel,false);assert.ok(!screen.elements.some(e=>e.id==='america-heading'));
 screen.elements.push({id:'america-heading',type:'text',label:'MIDDLE ROUTE · 11 LOCATIONS'});map.showSelectedLabel=true;
 configureCampaignRegionMap(doc);configureCampaignRegionMap(doc);
 assert.ok(!screen.elements.some(e=>e.id==='america-heading'));assert.equal(map.showSelectedLabel,false);
 assert.deepEqual({nodes:map.nodes,connections:map.connections,action:map.action},before);
 assert.equal(screen.elements.find(e=>e.type==='race-description').property,'region-dialogue');
 assert.doesNotThrow(()=>normalizeMenuDocument(doc));
});
test('region dialogue follows selection without loading tracks or displaying economy paragraphs',()=>{
 const doc=normalizeMenuDocument(menu),screen=doc.screens.find(s=>s.id==='world-map');
 const panel=screen.elements.find(e=>e.type==='race-description');
 const labels=[],ctx=new Proxy({measureText:t=>({width:t.length*6}),fillText:t=>labels.push(t)},{get:(o,k)=>k in o?o[k]:(()=>{})});
 const resources={art:()=>null,race(){throw Error('Region map must not fetch race descriptions');},raceReward(){throw Error('No race payouts on region map');}};
 for(const region of catalog){
  labels.length=0;
  drawMenuScreen(ctx,{x:0,y:0,w:1280,h:900},doc,{...screen,elements:[panel]},{raceRef:region.name},{resources,editing:true});
  assert.equal(labels.join(' '),dialogue[region.name]);
 }
});
