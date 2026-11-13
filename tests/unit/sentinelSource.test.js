import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/sentinel-sedan-2024/import.json',import.meta.url)));
test('Sentinel retains US S trim source figures and distinguishes estimates',()=>{
 const {car,provenance}=source,t=car.tuning;
 assert.equal(t.powerHp,149);assert.equal(t.torqueLbFt,146);assert.equal(t.weightKg,3036*.45359237);
 assert.equal(t.revLimitRpm,6600);assert.equal(t.gearFinalDrive,5.034);assert.equal(t.reverseRatio,1.797);
 assert.deepEqual(provenance.verifiedFacts.cvtRatioRange.value,[2.805,.357]);
 assert.equal(t.engineCurve.torquePoints.find(p=>p.rpm===4000).torqueLbFt,146);
 assert.equal(t.engineCurve.torquePoints.find(p=>p.rpm===6000).torqueLbFt,149*5252/6000);
 assert.equal(car.dimensions.wheelbaseM,106.6*.0254);
 assert.equal(t.wheelRadiusM,.3262);assert.equal(car.art.interior.steeringWheel.artRef,'steeringwheel');
 assert.equal(car.defaultTransmissionType,'automatic');assert.deepEqual(t.gearRatios,[2.805]);assert.equal(t.cvt.minRatio,.357);assert.equal(t.cvt.maxRatio,2.805);
 assert.ok(provenance.estimates.some(s=>s.includes('simulation estimates')));
});
