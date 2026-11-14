import test from 'node:test';
import assert from 'node:assert/strict';
import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';

test('legacy expectation adds only explicit absent gauge defaults and keeps all authored values',()=>{
 const original={id:'legacy',tuning:{powerHp:120},art:{gauges:{interior:{widgets:[{id:'one',x:.21,opacity:.5,fuelIconScale:2,damageArtTint:true,highBeamArtRef:'beam'}]},exterior:{widgets:[{id:'two',fuelIconAngle:0}]}}}};
 const frozen=structuredClone(original),expected=withLegacyGaugeDefaults(original);
 assert.deepEqual(original,frozen,'does not mutate the source fixture');
 assert.equal(expected.art.gauges.interior.widgets[0].opacity,.5);
 assert.equal(expected.art.gauges.interior.widgets[0].fuelIconScale,2);
 assert.equal(expected.art.gauges.interior.widgets[0].damageArtTint,true);
 assert.equal(expected.art.gauges.interior.widgets[0].highBeamArtRef,'beam');
 assert.equal(expected.art.gauges.exterior.widgets[0].fuelIconAngle,0);
 assert.deepEqual(expected.tuning,original.tuning);
 const changed=structuredClone(expected);changed.art.gauges.interior.widgets[0].x=.3;
 assert.throws(()=>assert.deepEqual(changed,expected),'changed authored placement must still fail');
 changed.art.gauges.interior.widgets[0].x=.21;changed.tuning.powerHp=121;
 assert.throws(()=>assert.deepEqual(changed,expected),'changed physics must still fail');
 const unexpected=structuredClone(expected);unexpected.newRuntimeField=true;
 assert.throws(()=>assert.deepEqual(unexpected,expected),'unknown new defaults are not silently accepted');
});
