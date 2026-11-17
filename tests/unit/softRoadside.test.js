import test from 'node:test';
import assert from 'node:assert/strict';
import {softenRaceRoadside, softenRoadsideDefinition} from '../../tools/campaigns/soft_roadside.mjs';
import {getDoodadRuleForSpeed} from '../../src/racing/raceDoodads.js';
import {updateRaceSceneryCollisions} from '../../src/racing/simulation/DamageModel.js';

const solid = () => ({widthM: 2, heightM: 1, weightKg: 1000, defaultRule: {behavior: 'collide', speedDrainPercent: 45}, rules: []});
test('small plants and markers have safe rules at crawling and highway speeds; fences and hazards stay solid', () => {
 for (const [ref, behavior] of [['expanded-grass-clump', 'flatten'], ['frozen-bush-01', 'flatten'], ['roadside-snow-depth-marker-pole', 'fly-off']]) {
  const def = solid(); assert.equal(softenRoadsideDefinition(def, ref), true);
  for (const mph of [0, 5, 30, 100, 160]) {
   const rule = getDoodadRuleForSpeed(def, mph);
   assert.equal(rule.behavior, behavior); assert.ok(rule.speedDrainPercent <= .5);
   assert.equal(rule.damage.engine, 0); assert.equal(rule.damage.suspension, 0);
  }
  assert.equal(softenRoadsideDefinition(def, ref), false);
 }
 for (const ref of ['tree', 'alpine-rock-outcrop-01', 'fencebushes']) {
  const def = solid(); assert.equal(softenRoadsideDefinition(def, ref), false);
  assert.equal(def.defaultRule.behavior, 'collide');
 }
 const fence = {...solid(), isFence: true}; assert.equal(softenRoadsideDefinition(fence, 'frozen-bush-01'), false);
});

test('verge shrubs become low grass, distant shrubs retain art, cached marker definitions and solid flags are repaired', () => {
 const defs = new Map(['frozen-bush-01', 'expanded-grass-clump', 'roadside-snow-depth-marker-pole'].map(ref => {
  const def = {...solid(), artRef: ref}; softenRoadsideDefinition(def, ref); return [ref, def];
 }));
 const race = {road: {width: 8}, scenery: [
  {id: 'near', doodadRef: 'frozen-bush-01', trackLateral: 7, widthM: 2, heightM: 1, previewDoodad: solid()},
  {id: 'far', doodadRef: 'frozen-bush-01', trackLateral: 25, previewDoodad: solid()},
  {id: 'pole', doodadRef: 'roadside-snow-depth-marker-pole', solid: true, collidable: true, previewDoodad: solid()}
 ]};
 const result = softenRaceRoadside(race, ref => defs.get(ref));
 assert.equal(result.grassReplacements, 1);
 assert.equal(race.scenery[0].doodadRef, 'expanded-grass-clump'); assert.equal(race.scenery[0].heightM, .45);
 assert.equal(race.scenery[1].doodadRef, 'frozen-bush-01');
 assert.equal(race.scenery[2].previewDoodad.defaultRule.behavior, 'fly-off'); assert.equal(race.scenery[2].solid, undefined);
 const before = JSON.stringify(race); softenRaceRoadside(race, ref => defs.get(ref)); assert.equal(JSON.stringify(race), before);
});

test('zero-drag grass does not secretly invoke the old 18 percent slowdown, markers break only once', () => {
 for (const ref of ['expanded-grass-clump', 'roadside-snow-depth-marker-pole']) {
  const def = solid(); softenRoadsideDefinition(def, ref);
  const impulses = [], damage = [], sprite = {id: 'test', x: 0, z: 0};
  const session = {speedMps: 70, vehicleDynamicsRunner: {config: {massKg: 1500}, state: {velocity: {x: 0, z: 70}, position: {x: 0, y: 0, z: 0}}, queueCollisionImpulse: impulse => impulses.push(impulse)}};
  const editor = {playtestSession: session, ensureRaceScenery: () => [sprite], getRaceDoodadForScenery: () => def,
   getRaceSessionCar: () => ({}), getRaceCarTuning: () => ({}), getRaceVehicleCollisionContactPoints: () => [{x: 0, z: 0}], applyRaceDamage: (part, amount) => damage.push({part, amount})};
  updateRaceSceneryCollisions(editor, 1/60);
  assert.equal(impulses.length, 1);
  const lostSpeed = Math.abs(impulses[0].impulseWorldNs.z) / 1500;
  if (ref === 'expanded-grass-clump') {assert.equal(lostSpeed, 0); assert.deepEqual(session.flattenedSceneryIds, ['test']);}
  else {assert.ok(lostSpeed < 1); assert.deepEqual(session.removedSceneryIds, ['test']);}
  assert.ok(damage.filter(d => d.part !== 'panels').every(d => d.amount === 0));
  updateRaceSceneryCollisions(editor, 1/60); assert.equal(impulses.length, 1);
 }
});

test('breakaway markers and grass are excluded from rigid scenery colliders', async () => {
 const {createRaceStaticColliderWorld} = await import('../../src/racing/RaceSimulation.js');
 const refs = ['roadside-snow-depth-marker-pole','expanded-grass-clump','tree'];
 const defs = refs.map(ref => { const def = solid(); softenRoadsideDefinition(def,ref); return def; });
 const scenery = refs.map((doodadRef,i) => ({id:doodadRef,doodadRef,x:i*10,z:0}));
 const editor = {selectedRace:{scenery},ensureRaceScenery:()=>scenery,getRaceDoodadForScenery:s=>defs[refs.indexOf(s.doodadRef)],sampleRaceDoodadGroundPoint:()=>({elevation:0})};
 const authority = {};
 createRaceStaticColliderWorld(editor,{authority,worldBake:{},runtimeType:'destination',routeLength:100});
 assert.deepEqual(authority.staticColliderDefinitions.map(d=>d.source),['scenery:tree']);
});

test('embedded track definitions cannot override softened library collisions', () => {
 const race = {scenery:[], sceneryDefinitions:[{...solid(),ref:'roadside-snow-depth-marker-pole'},{...solid(),ref:'expanded-grass-clump'},{...solid(),ref:'tree'}]};
 const result=softenRaceRoadside(race,()=>null);
 assert.equal(result.embeddedDefinitionsUpdated,2);
 assert.equal(race.sceneryDefinitions[0].defaultRule.behavior,'fly-off');
 assert.equal(race.sceneryDefinitions[1].defaultRule.speedDrainPercent,0);
 assert.equal(race.sceneryDefinitions[2].defaultRule.behavior,'collide');
 assert.equal(softenRaceRoadside(race,()=>null).embeddedDefinitionsUpdated,0);
});
