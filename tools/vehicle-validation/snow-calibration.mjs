// Production-physics matrix: stop/hold/restart on four grades, three saved tires,
// ABS/TC enabled and disabled. No coefficient overrides except the authored
// Mount Washington fresh-snow surface; controls and temperatures are identical.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {runClimb} from './low-speed-traction-audit.mjs';
const results=[];
for(const slope of [0,.06,.12,.18])for(const tireName of ['Stock','Offroad','Snow'])for(const tc of [true,false]){
 const r=runClimb({carName:'RTG-001',tireName,surfaceGrip:.4,snowMm:25.4,temperatureC:-12,slope,tc,seconds:10,initialSpeedMps:3.13,sampleEverySeconds:.1,controlAt:t=>({throttle:t<3?0:.55,brake:t<3?1:0})});
 const held=r.samples.filter(s=>s.time>=2&&s.time<=3);
 const crossing=speed=>r.samples.find(s=>s.time>3&&s.mph>=speed/1.609344)?.time;
 const t8=crossing(8),t32=crossing(32);
 results.push({...r,holdMaximumMph:Math.max(...held.map(s=>Math.abs(s.mph))),acceleration8to32KmhSeconds:t8!=null&&t32!=null?t32-t8:null});
 console.log(JSON.stringify({grade:slope*100,tireName,tc,mph:r.mph,heldMph:results.at(-1).holdMaximumMph,t8to32:results.at(-1).acceleration8to32KmhSeconds}));
}
fs.mkdirSync('artifacts/traction-audit',{recursive:true});
fs.writeFileSync('artifacts/traction-audit/snow-calibration.json',JSON.stringify({limitations:['Straight synthetic slopes, not full mountain laps.','Engineering snow-curve fit; not an exact reproduction of the published tire test vehicle/conditions.','No 8–32 time means the upper speed was not reached in the seven-second restart window.'],results},null,2));

// Aids-off wheelspin can change heading; report it rather than imposing an
// artificial straight-line constraint. Aids-on runs must stay straight.
assert.equal(results.length, 24);
for (const result of results) {
 assert.ok(Number.isFinite(result.mph) && result.mph > 0, 'Every configuration must restart uphill');
 assert.ok(Number.isFinite(result.lateralM), 'Lateral position must remain finite');
 assert.ok(result.holdMaximumMph < .03, 'Braking must hold the supported slope');
 if (result.tc) assert.ok(Math.abs(result.lateralM) < .1, 'Aids-on restart must remain straight');
}
for (const grade of [0, 6, 12, 18]) for (const tc of [true, false]) {
 const speed = name => results.find(r => r.grade === grade && r.tc === tc && r.tireName === name).mph;
 assert.ok(speed('Snow') > speed('Offroad') && speed('Offroad') > speed('Stock'), 'Snow tire class ordering');
}
