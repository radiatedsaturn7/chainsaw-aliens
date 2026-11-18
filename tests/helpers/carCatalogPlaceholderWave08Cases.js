import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';import {withLegacyGaugeDefaults} from './catalogRoundtrip.js';import {runClimb} from '../../tools/vehicle-validation/low-speed-traction-audit.mjs';import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
const root=new URL('../../',import.meta.url),read=p=>{const d=JSON.parse(fs.readFileSync(new URL(p,root)));return d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
const records=read('data/vehicle-catalog/phases/wave-08-research.json').vehicles,starter=read('data/server-storage/files/cars/RTG-001/document.json').car;
const refs=o=>{const out=new Set;const walk=v=>{if(!v||typeof v!=='object')return;if(v.artRef)out.add(v.artRef);Object.values(v).forEach(walk);};walk(o);return [...out].sort();};
for(const r of records){const d=read('data/server-storage/files/cars/'+r.name+'/document.json'),c=d.car;
 test(r.name+' preserves distinct provenance and shared art references without copied physics',()=>{assert.deepEqual(refs(c.art),refs(starter.art));assert.notDeepEqual(c.tuning,starter.tuning);assert.equal(c.tuning.physicalVehicleProfile,undefined);assert.equal(c.catalogProvenance.candidateId,r.candidateId);assert.deepEqual(c.catalogProvenance.verifiedFacts,r.facts);assert.equal(c.catalogProvenance.phaseStatus.originalArtFinished,false);assert.equal(c.catalogProvenance.phaseStatus.independentDriveVerified,false);assert.ok(Math.abs(c.tuning.weightKg-(r.facts.curbKg??r.simulationEstimates.curbKg))<1e-8);assert.equal(c.tuning.cvt,undefined);for(const ref of refs(c.art))assert.ok(fs.existsSync(new URL('data/server-storage/files/art/'+ref+'/document.json',root)));});
 test(r.name+' full native roundtrip retains powertrain and instruments',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:r.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(c));});
 test(r.name+' production drivetrain accelerates with traction control on/off',()=>{for(const tc of [true,false]){const x=runClimb({carName:r.name,surface:'asphalt',snowMm:0,slope:0,throttle:1,seconds:5,temperatureC:20,tc});assert.ok(x.travelM>5,JSON.stringify(x));assert.ok(x.mph>5,JSON.stringify(x));assert.ok(x.mu>0);}});
}

test('wave08 keeps historical ratings, variant anchors and estimated masses distinct',()=>{
 const cars=Object.fromEntries(records.map(r=>[r.id,read('data/server-storage/files/cars/'+r.name+'/document.json').car]));
 const old=cars['moschatel-1973'];assert.equal(old.catalogProvenance.verifiedFacts.powerKw,undefined);assert.equal(old.catalogProvenance.verifiedFacts.publishedReferencePowerKw,118);assert.equal(old.tuning.powerHp,140);assert.equal(old.tuning.weightKg,1145);
 const modern=cars['quaking-grass-2003'];assert.equal(modern.tuning.drivetrain,'awd');assert.equal(modern.transmissions.manual.gearRatios.length,6);assert.equal(modern.catalogProvenance.verifiedFacts.powerKw,177);assert.equal(modern.catalogProvenance.verifiedFacts.referenceZeroTo100KmhSec,6.6);assert.equal(modern.catalogProvenance.verifiedFacts.curbKg,undefined);
 for(const id of ['fumitory-1983','sandwort-1988','water-avens-1995']){const c=cars[id];assert.equal(c.tuning.drivetrain,'fwd');assert.equal(c.catalogProvenance.verifiedFacts.curbKg,undefined);assert.ok(c.catalogProvenance.estimates.parameters.curbKg>0);}
 assert.equal(cars['brooklime-1994'].catalogProvenance.verifiedFacts.curbKg,1220);
 assert.equal(new Set(Object.values(cars).map(c=>JSON.stringify(c.tuning))).size,6);
});
