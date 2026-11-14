import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {selectLandmarkCity} from '../../tools/campaigns/landmarkCitySelector.mjs';
const {cities}=JSON.parse(fs.readFileSync(new URL('../../AI/last-on-the-grid/state-expansion-landmark-artwork.json',import.meta.url)));
for(const name of ['Portland','Charleston']){
 test(`${name} requires an exact route and resolves both states`,()=>{
  const pair=cities.filter(c=>c.city===name);
  assert.equal(pair.length,2);
  assert.throws(()=>selectLandmarkCity(cities,name),error=>error.message.includes('Ambiguous')&&pair.every(c=>error.message.includes(c.raceRef)));
  for(const city of pair)assert.equal(selectLandmarkCity(cities,city.raceRef),city);
 });
}
test('all existing unambiguous city calls and all exact route references resolve',()=>{
 for(const city of cities){
  assert.equal(selectLandmarkCity(cities,city.raceRef),city);
  if(cities.filter(c=>c.city===city.city).length===1)assert.equal(selectLandmarkCity(cities,city.city),city);
 }
});
test('unknown, missing and approximate selectors fail instead of choosing a route',()=>{
 for(const selector of ['',undefined,'portland','Providence ','Not a city'])assert.throws(()=>selectLandmarkCity(cities,selector));
});
