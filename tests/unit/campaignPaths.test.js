import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CAMPAIGN_PATHS,CAMPAIGN_BRANCHES,campaignPathScreen,authorCampaignPath} from '../../src/menus/CampaignPaths.js';
import {normalizeMenuDocument} from '../../src/menus/MenuDocument.js';
import {worldMapNodes,campaignPathEntrySelection,raceCompletionKey,worldMapNodePoint,worldMapNodeRadius,worldMapRaceNodes} from '../../src/menus/MenuWorldMap.js';
import {campaignRaceAccess} from '../../src/menus/CampaignProgression.js';
import {drawRegionalMapRoad} from '../../src/menus/MenuWorldMapRenderer.js';
import {mapRoadPixels,mapRoadRoute,campaignRoadNeighbors} from '../../src/menus/MenuMapRoads.js';
import {drawMenuScreen,menuElementBounds} from '../../src/menus/MenuRenderer.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
const menu=JSON.parse(fs.readFileSync('data/server-storage/files/menus/Game Menu/document.json'));
const config=menu.parameters.campaignProgression;
const geo=JSON.parse(fs.readFileSync('tools/campaigns/regional-map-gps.json')).regions;
const art=JSON.parse(fs.readFileSync('data/server-storage/files/manifest.json')).folders.art;
test('all eleven installed regions have five distinct main races, two branches, a boss, and retained extra events',()=>{
 assert.equal(config.version,2);
 const manifest=JSON.parse(fs.readFileSync('data/server-storage/files/manifest.json')).folders.races;
 for(const r of config.regions){
  assert.deepEqual(r.mainPath,CAMPAIGN_PATHS[r.stage-1]);assert.equal(new Set(r.mainPath).size,5);
  assert.deepEqual(r.branches.map(b=>b.raceRef),CAMPAIGN_BRANCHES[r.stage-1]);
  for(const ref of [...r.events,r.bossRef])assert.ok(manifest[ref],ref);
  const s=menu.screens.find(s=>s.id===`campaign-hub-${r.stage}`),map=s.elements.find(e=>e.property==='campaign-path');
  const races=worldMapRaceNodes(map.nodes);assert.equal(races.length,8);
  assert.ok(map.connections.length>=7);
  assert.ok(art[map.artRef],map.artRef);
  assert.equal(map.imageFit,'stretch');
  assert.equal(map.action.target,'garage');
  assert.deepEqual(new Set(races.map(n=>n.raceRef)),new Set([...r.mainPath,r.bossRef,...r.branches.map(b=>b.raceRef)]));
  for(const node of races){
   const source=geo[r.bossRef].nodesByRace[node.raceRef];
   assert.ok(Number.isFinite(source.lat)&&Number.isFinite(source.lon));
   assert.equal(node.x,source.x);
   assert.equal(node.y,source.y);
  }
  assert.ok(menu.screens.some(s=>s.id===`campaign-hub-${r.stage}-events`));
  assert.deepEqual(normalizeMenuDocument({...menu,screens:menu.screens.map(old=>old.id===s.id?s:old)}).screens.find(e=>e.id===s.id).elements.find(e=>e.id===map.id).nodes,map.nodes);
 }
});
test('regional nodes use the authored links, not a count or a fixed list',()=>{
 const r=config.regions[0],map=menu.screens.find(s=>s.id==='campaign-hub-1').elements.find(e=>e.property==='campaign-path');
 const p={},draw=()=>worldMapNodes(map,{},menu,p);
 const start=map.nodes.find(n=>n.raceRef===r.mainPath[0]);
 const boss=map.nodes.find(n=>n.raceRef===r.bossRef);
 assert.ok(draw().find(n=>n.id===start.id&&!n.locked));
 assert.ok(!campaignRaceAccess(config,config.regions[1].mainPath[0],p,{}, {},menu).allowed);
 const byId=new Map(map.nodes.map(n=>[n.id,n]));
 const journey=mapRoadRoute(map.nodes,map.connections,start.id,boss.id);
 assert.ok(journey?.length);
 const races=journey.map(step=>byId.get(step.previous)).filter(n=>n.kind!=='junction');
 // Availability is driven by connectivity: stop at the first accessible
 // parent of the boss, without clearing that frontier race itself.
 for(const race of races.slice(0,-1))p[raceCompletionKey(race.raceRef)]=true;
 assert.equal(campaignRaceAccess(config,r.bossRef,p,{}, {},menu).allowed,true);
 assert.ok(draw().find(n=>n.id===boss.id&&!n.locked));
 p[raceCompletionKey(r.bossRef)]=true;
 assert.ok(draw().every(n=>!n.locked));
 assert.ok(campaignRaceAccess(config,config.regions[1].mainPath[0],p,{}, {},menu).allowed);
});
test('regional boss confirm enters garage instead of reopening its map; Back does not quit to title',async()=>{
 const r=config.regions[0],p=Object.fromEntries(r.mainPath.map(ref=>[raceCompletionKey(ref),true]));p.raceRef=r.bossRef;
 const screen=menu.screens.find(s=>s.id==='campaign-hub-1'),map=screen.elements.find(e=>e.type==='world-map');
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
  assert.ok(labels.includes('Boston'));
  const map=screen.elements.find(e=>e.type==='world-map'),b=menuElementBounds(map,bounds);
  assert.ok(b.h>bounds.h*(bounds.w>bounds.h?.80:.36));
  for(const n of map.nodes){const p=worldMapNodePoint(n,b,map),radius=worldMapNodeRadius(b,map)+5;assert.ok(p.x-radius>=b.x&&p.x+radius<=b.x+b.w);}
 }
});
test('partial or custom catalogs retain their existing progression',()=>{
 const r={stage:1,events:['custom']};assert.equal(authorCampaignPath(r),r);
});
test('regional maps use the car cursor and omit More Races',()=>{
 for(const r of config.regions){const screen=campaignPathScreen(r,'Region');assert.ok(!screen.elements.some(e=>e.id==='more-races'));const map=screen.elements.find(e=>e.type==='world-map');assert.equal(map.mapStyle.cursor,'car');assert.ok(map.connections.every(c=>c.curve==='bezier'));}
});

test('world pins keep real geography and gate Ohio → St. Louis → Ozarks → Route 66',()=>{
 const world=menu.screens.find(s=>s.id==='world-map').elements.find(e=>e.type==='world-map');
 assert.deepEqual(config.regions.map(r=>r.stage),[1,2,3,4,6,5,7,8,9,10,11]);
 assert.deepEqual(world.nodes.map(n=>n.raceRef),config.regions.map(r=>r.bossRef));
 assert.ok(world.nodes[1].y<world.nodes[0].y,'Mount Washington north of Providence');
 for(let i=1;i<world.nodes.length;i++){
  const prev=world.nodes[i-1],curr=world.nodes[i];
  assert.equal(curr.unlockParameter,raceCompletionKey(prev.raceRef));
  assert.ok(world.connections.some(link=>link.from===prev.id&&link.to===curr.id));
  if(i>1)assert.ok(curr.x<prev.x,curr.label);
 }
 const p={[raceCompletionKey(config.regions[3].bossRef)]:true};
 const ready=()=>worldMapNodes(world,{},menu,p);
 assert.equal(ready()[4].locked,false);assert.equal(ready()[5].locked,true);
 p[raceCompletionKey(config.regions[4].bossRef)]=true;
 assert.equal(ready()[5].locked,false);assert.equal(ready()[6].locked,true);
});
test('all eleven road graphs are connected and their boss is not a transit stop',()=>{
 for(const r of config.regions){
  const map=menu.screens.find(s=>s.id===`campaign-hub-${r.stage}`).elements.find(e=>e.property==='campaign-path');
  const first=map.nodes.find(n=>n.raceRef===r.mainPath[0]);
  const boss=map.nodes.find(n=>n.raceRef===r.bossRef);
  for(const n of worldMapRaceNodes(map.nodes)){
   assert.ok(mapRoadRoute(map.nodes,map.connections,first.id,n.id),n.raceRef);
  }
  assert.equal(campaignRoadNeighbors(map.nodes,map.connections,boss.id).size,1,r.bossRef);
 }
});

test('pavement and dirt paint the exact animation curve with visible road surfaces',()=>{
 const a={x:.15,y:.27},c={x:.83,y:.75},bounds={x:31,y:12,w:550,h:310};
 const link={curve:'bezier',control1:{x:.41,y:.2},control2:{x:.6,y:.9}};
 const pixel=(p)=>Object.values(mapRoadPixels(p,bounds));
 for(const [pattern,surface] of [['','#3c434b'],['dashed','#a17b56'],['dotted','#a17b56']]){
  const paths=[],strokes=[];
  const ctx={globalAlpha:1,save(){},restore(){},beginPath(){},moveTo(...x){paths.push(x)},
   bezierCurveTo(...x){paths.push(x)},setLineDash(x){this.dash=x},stroke(){strokes.push([this.strokeStyle,this.lineWidth,this.dash]);}};
  drawRegionalMapRoad(ctx,link,a,c,bounds,pattern?3:5,pattern);
  assert.deepEqual(paths,[pixel(a),[...pixel(link.control1),...pixel(link.control2),...pixel(c)]]);
  assert.equal(strokes[2][0],surface);
  assert.ok(strokes[3][2].length>0);
 }
});
