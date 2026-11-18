import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../helpers/carCatalogFittingPilotPickerCases.js',import.meta.url),'utf8');
test('fitting pilot selects installed Chrome while requiring Chromium sandbox',()=>{
 const launches=[...source.matchAll(/playwright\.chromium\.launch\((\{[^}]+\})\)/g)];
 assert.equal(launches.length,1);
 assert.match(launches[0][1],/channel:\s*['"]chrome['"]/);
 assert.match(launches[0][1],/chromiumSandbox:\s*true/);
 assert.doesNotMatch(launches[0][1],/args:|executablePath:|ignoreDefaultArgs:/);
 assert.doesNotMatch(source,/--no-sandbox|--disable-setuid-sandbox/);
});
test('three fitting targets retain both input modes and real motion assertions',()=>{
 const targets=JSON.parse(fs.readFileSync(new URL('../../data/vehicle-catalog/phases/three-car-fitting-pilot.json',import.meta.url))).vehicles;
 assert.equal(targets.length,3);assert.equal(new Set(targets.map(t=>t.id)).size,3);
 assert.match(source,/for\(const mobile of \[false,true\]\)/);
 for(const required of ['page.keyboard.down','Input.dispatchTouchEvent','moving.x-initial.x','moving.rpm','steeringAngleRad','fixed-rear'])assert.ok(source.includes(required),required);
});
