import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CAMPAIGN_PATHS,CAMPAIGN_BRANCHES,campaignPathScreen,authorCampaignPath} from '../../src/menus/CampaignPaths.js';
import {normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import {worldMapNodes,campaignPathEntrySelection,raceCompletionKey,worldMapNodePoint,worldMapNodeRadius} from '../../src/menus/MenuWorldMap.js';
import {campaignRaceAccess} from '../../src/menus/CampaignProgression.js';
import {drawMenuScreen} from '../../src/menus/MenuRenderer.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
const config=menu.parameters.campaignProgression;
test('all eleven installed regions have five distinct main races, two branches, a boss, and retained extra events',()=>{
 assert.equal(config.version,2);
 const manifest=JSON.parse(fs.readFileSync('data/server-storage/files/manifest.json')).folders.races;
 for(const r of config.regions){
  assert.deepEqual(r.mainPath,CAMPAIGN_PATHS[r.stage-1]);assert.equal(new Set(r.mainPath).size,5);
  assert.deepEqual(r.branches.map(b=>b.raceRef),CAMPAIGN_BRANCHES[r.stage-1]);
  for(const ref of [...r.events,r.bossRef])assert.ok(manifest[ref],ref);
  const s=menu.screens.find(s=>s.id===`campaign-hub-${r.stage}`),map=s.elements.find(e=>e.property==='campaign-path');
  assert.equal(map.nodes.length,8);assert.equal(map.connections.length,7);
  assert.ok(menu.screens.some(s=>s.id===`campaign-hub-${r.stage}-events`));
  assert.deepEqual(normalizeMenuDocument({...menu,screens:menu.screens.map(old=>old.id===s.id?s:old)}).screens.find(e=>e.id===s.id).elements.find(e=>e.id===map.id).nodes,map.nodes);
 }
});
test('regional nodes respect race gates while overview represents region access; branch clears cannot open boss',()=>{
 const r=config.regions[0],screen=campaignPathScreen(r,'Providence'),map=screen.elements.find(e=>e.type==='world-map'),p={};
 let nodes=worldMapNodes(map,{},menu,p);assert.equal(nodes.filter(n=>!n.locked).length,1);
 for(const ref of r.mainPath.slice(0,2))p[raceCompletionKey(ref)]=true;
 nodes=worldMapNodes(map,{},menu,p);
 assert.equal(nodes.find(n=>n.raceRef===r.branches[0].raceRef).locked,false);
 assert.equal(nodes.find(n=>n.raceRef===r.branches[1].raceRef).locked,true);
 assert.equal(campaignPathEntrySelection(nodes,r.bossRef).raceRef,r.mainPath[2]);
 p[raceCompletionKey(r.bossRef)]=true;
 assert.ok(worldMapNodes(map,{},menu,p).every(n=>!n.locked));
 assert.ok(campaignRaceAccess(config,config.regions[1].mainPath[0],p).allowed);
});
test('regional boss confirm enters garage instead of reopening its map; Back does not quit to title',async()=>{
 const r=config.regions[0],p=Object.fromEntries(r.mainPath.map(ref=>[raceCompletionKey(ref),true]));p.raceRef=r.bossRef;
 const screen=campaignPathScreen(r,'Providence'),map=screen.elements.find(e=>e.type==='world-map');
 let action;const player=Object.create(MenuPlayer.prototype);
 player.flow={busy:false,screen,document:menu,parameters:p,setParameter(k,v){p[k]=v},run:a=>action=a,goTo:()=>assert.fail('reopened region')};player.resources={};
 await player.activate(map,1,{choose:true});assert.equal(action.target,'garage');
 assert.equal(player.confirmWorldMapQuit(),false);
});
test('regional map drawing and selected previews work in portrait and landscape without loading a race',()=>{
 const r=config.regions[0],screen=normalizeMenuDocument(menu).screens.find(s=>s.id==='campaign-hub-1');
 for(const bounds of [{x:0,y:0,w:390,h:844},{x:0,y:0,w:844,h:390}]){
  const labels=[],ctx=new Proxy({globalAlpha:1,measureText:t=>({width:String(t).length*5}),fillText:t=>labels.push(t)},{get:(o,k)=>k in o?o[k]:(()=>{})});
  drawMenuScreen(ctx,bounds,menu,screen,{raceRef:r.mainPath[0]},{editing:true,resources:{art:()=>null,race:()=>assert.fail('map should not load race')}});
  assert.ok(labels.join(' ').includes('Tower Hill'));
  const map=screen.elements.find(e=>e.type==='world-map'),b={x:0,y:0,w:bounds.w*.57,h:bounds.h*.68};
  for(const n of map.nodes){const p=worldMapNodePoint(n,b,map),radius=worldMapNodeRadius(b,map)+5;assert.ok(p.x-radius>=0&&p.x+radius<=b.w);}
 }
});
test('partial or custom catalogs retain their existing progression',()=>{
 const r={stage:1,events:['custom']};assert.equal(authorCampaignPath(r),r);
});
test('regional maps use the car cursor and omit More Races',()=>{
 for(const r of config.regions){const screen=campaignPathScreen(r,'Region');assert.ok(!screen.elements.some(e=>e.id==='more-races'));const map=screen.elements.find(e=>e.type==='world-map');assert.equal(map.mapStyle.cursor,'car');assert.ok(map.connections.every(c=>c.curve==='bezier'));}
});
