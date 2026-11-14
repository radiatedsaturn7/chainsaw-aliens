import {withLegacyGaugeDefaults} from '../helpers/catalogRoundtrip.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
const config=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/flint-coupe-2005/import.json',import.meta.url)));
const document=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/cars/2005 Flint Coupe/document.json',import.meta.url)));
test('Flint preserves authored fractional torque instead of inflating the sourced peak',()=>{
 assert.equal(config.car.tuning.powerHp,174.3328717);
 assert.equal(document.car.tuning.powerHp,Math.round(config.car.tuning.powerHp));
 assert.deepEqual(document.car.tuning.engineCurve,config.car.tuning.engineCurve);
 const anchor=document.car.tuning.engineCurve.torquePoints.find(p=>p.rpm===7000);
 assert.ok(Math.abs(anchor.torqueLbFt*anchor.rpm/5252-config.car.tuning.powerHp)<1e-9);
 assert.equal(document.car.tuning.torqueLbFt,149);
});
test('Flint editor round trip retains corrected curve and every other serialized car field',()=>{
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
 editor.applyLoadedCarDocument(structuredClone(document),{name:document.car.name});
 const output=editor.serializeSelectedCarDocument();
 assert.deepEqual(output.car,withLegacyGaugeDefaults(document.car));
});
