import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSceneryArtRefs,hydrateSceneryDefinitions} from '../../src/racing/RaceSceneryAssets.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
test('preload resolves direct, preview and referenced art once per definition',()=>{
 let calls=0;const race={scenery:[{artRef:'direct'},{previewDoodad:{artRef:'preview'}},...Array.from({length:100},()=>({doodadRef:'oak'}))]};
 assert.deepEqual(collectSceneryArtRefs(race,()=>{calls++;return{artRef:'oak-image'};}),['direct','preview','oak-image']);assert.equal(calls,1);
});
test('a transferred race resolves doodads without local project storage',async()=>{
 const race={scenery:[{doodadRef:'oak'},{doodadRef:'oak'},{doodadRef:'missing'}]};let calls=0;
 assert.deepEqual(await hydrateSceneryDefinitions(race,async ref=>{calls++;return ref==='missing'?null:{data:{doodad:{name:'oak',artRef:'oak-image',widthM:5,heightM:8}}};}),['missing']);
 assert.equal(calls,2);assert.equal(race.sceneryDefinitions.length,1);
 const e=new RaceEditor({});Object.assign(e.selectedRace,JSON.parse(JSON.stringify(race)));e.hydrateRaceArt=async()=>null;
 assert.equal(e.getRaceDoodadForScenery(race.scenery[0]).artRef,'oak-image');
 assert.ok(e.collectSelectedRaceArtRefs().includes('oak-image'));assert.ok(e.collectSelectedRaceTextureArtRefs().includes('oak-image'));
 assert.equal(e.loadRaceDoodadDocument('not-saved'),null);
});
