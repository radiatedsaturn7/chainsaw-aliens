import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import {raceIndexEntries,raceIndexScreen} from '../../src/menus/RaceIndex.js';
import MenuPlayer from '../../src/menus/MenuPlayer.js';
import {MotorsportMenu} from '../../src/menus/MotorsportMenu.js';
import {MenuFlow} from '../../src/menus/MenuFlow.js';
const root='data/server-storage/files';
const menu=JSON.parse(fs.readFileSync(`${root}/menus/Game Menu/document.json`));
const manifest=JSON.parse(fs.readFileSync(`${root}/manifest.json`));
const collections=JSON.parse(fs.readFileSync('data/campaigns/america/raceways/rally-collections.json'));

test('rally collection entries resolve to saved stages, sources and nonempty previews',()=>{
 const entries=raceIndexEntries(menu.parameters.raceIndex,'rallies').filter(e=>!Number.isInteger(e.rally.section));
 assert.equal(entries.length,66);assert.equal(new Set(entries.map(e=>e.rally.id)).size,30);
 assert.equal(entries.filter(e=>e.location.country==='US').length,9);
 for(const entry of entries){
  const stored=JSON.parse(fs.readFileSync(`${root}/${manifest.folders.races[entry.ref]}`));
  const doc=stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;
  assert.equal(doc.race.source.rallyCollection.id,entry.rally.id);
  assert.ok(doc.race.source.sourceSnapshot);assert.ok(doc.race.scenery.length>0);
  if(['sweden','sno-drift','norway'].includes(entry.rally.id)){
   assert.equal(doc.race.weather,'snow');
   assert.deepEqual([...new Set(doc.race.road.segments.map(s=>s.surface))],['snow']);
   assert.equal(entry.rally.year,null);
  }
  assert.ok(menu.parameters.campaignRoutePreviews[entry.ref].distanceM>2000);
  assert.ok(collections.collections.find(g=>g.id===entry.rally.id).stages.some(s=>s.raceRef===entry.ref));
 }
});

test('rally selection scrolls across country groups with at most eight controls',()=>{
 const entries=raceIndexEntries(menu.parameters.raceIndex,'rallies');let top=0;
 for(let index=0;index<entries.length;index++){
  const r=raceIndexScreen(entries,index,top,()=>({allowed:true}),'rallies');top=r.top;
  assert.equal(r.screen.elements.find(e=>e.id==='heading').label,'Rallies');
  assert.ok(r.screen.elements.some(e=>e.action?.value===entries[index].ref));
  assert.ok(r.screen.elements.filter(e=>e.type==='button').length<=8);
 }
});

test('world-map Rally opens staged events and returns to the map',async()=>{
 const player=Object.assign(Object.create(MenuPlayer.prototype),{screenFocus:new Map(),widgetStates:new Map(),campaignAccess:()=>({allowed:true})});
 player.flow=new MenuFlow({...menu,startScreen:'world-map'});player.flow.screenId='world-map';
 player.motorsport=new MotorsportMenu(player);
 await player.activate(player.flow.screen.elements.find(e=>e.id==='world-championships'));
 await player.activate(player.flow.screen.elements.find(e=>e.id==='motorsport-rallies'));
 assert.equal(player.flow.screenId,'motorsport-list');assert.equal(player.motorsport.kind,'rallies');
 const first=player.motorsport.catalog.rallyGroups.findIndex(g=>g.formats.length);
 await player.activate(player.flow.screen.elements.find(e=>e.id===`motorsport-pick-${first}`));
 assert.equal(player.flow.screenId,'motorsport-formats');
 await player.activate(player.flow.screen.elements.find(e=>e.id==='motorsport-format-4'));
 assert.equal(player.flow.screenId,'motorsport-preview');assert.equal(player.motorsport.selection.rounds.length,4);
 await player.activate(player.flow.screen.elements.find(e=>e.id==='motorsport-back'));
 await player.activate(player.flow.screen.elements.find(e=>e.id==='motorsport-back'));
 await player.activate(player.flow.screen.elements.find(e=>e.id==='motorsport-back'));
 await player.activate(player.flow.screen.elements.find(e=>e.id==='motorsport-back'));
 assert.equal(player.flow.screenId,'world-map');
});

test('requested rally regions are playable and fine gravel stays unpaved',()=>{
 const entries=raceIndexEntries(menu.parameters.raceIndex,'rallies');
 const countries=new Set(entries.map(e=>e.location.country));
 for(const country of ['NO','SE','MX','JP','GR','TR','CL','KE'])assert.ok(countries.has(country),country);
 const conuco=entries.find(e=>e.rally.id==='chile');
 const safari=entries.find(e=>e.rally.id==='safari-kenya');
 const conucoSurfaces=menu.parameters.campaignRoutePreviews[conuco.ref].surfaces;
 assert.ok(conucoSurfaces.gravel>50);
 assert.ok(conucoSurfaces.asphalt<2);
 assert.equal(menu.parameters.campaignRoutePreviews[safari.ref].surfaces.asphalt,0);
});

test('additional rally sections preserve mixed surfaces and the old Isegami tunnel',()=>{
 const entries=raceIndexEntries(menu.parameters.raceIndex,'rallies');
 for(const id of ['spain','wales','germany','japan-aichi','100-acre-wood','ojibwe']){
  const entry=entries.find(e=>e.rally.id===id);assert.ok(entry,id);
  assert.equal(entry.rally.year,null,'Partial current-road imports must not claim an exact historic edition');
 }
 const spain=entries.find(e=>e.rally.id==='spain');
 const mix=menu.parameters.campaignRoutePreviews[spain.ref].surfaces;
 assert.ok(mix.asphalt>0&&mix.gravel>0);
 const japan=entries.find(e=>e.rally.id==='japan-aichi');
 const stored=JSON.parse(fs.readFileSync(`${root}/${manifest.folders.races[japan.ref]}`));
 const race=JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))).race;
 const network=race.road.network;
 assert.equal(network.edges.filter(e=>e.structure==='tunnel').length,1);
 assert.equal(network.nodes[0].x,race.road.nodes[0].x);
 assert.equal(network.nodes.at(-1).z,race.road.nodes.at(-1).y);
 const tunnel=network.edges.find(e=>e.structure==='tunnel');
 const a=network.nodes.find(n=>n.id===tunnel.from),b=network.nodes.find(n=>n.id===tunnel.to);
 for(const p of tunnel.points){
  assert.ok(p.heightM>=Math.min(a.heightM,b.heightM)-.001);
  assert.ok(p.heightM<=Math.max(a.heightM,b.heightM)+.001);
 }
});
