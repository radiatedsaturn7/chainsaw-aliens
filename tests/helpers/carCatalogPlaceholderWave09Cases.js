import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';import {withLegacyGaugeDefaults} from './catalogRoundtrip.js';import {runClimb} from '../../tools/vehicle-validation/low-speed-traction-audit.mjs';import {VehicleDynamicsRunner,createVehicleDynamicsConfigFromTuning} from '../../src/racing/simulation/VehicleDynamicsRunner.js';
const root=new URL('../../',import.meta.url),read=p=>{const d=JSON.parse(fs.readFileSync(new URL(p,root)));return d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;};
const records=read('data/vehicle-catalog/phases/wave-09-research.json').vehicles,starter=read('data/server-storage/files/cars/RTG-001/document.json').car;
const refs=o=>{const out=new Set;const walk=v=>{if(!v||typeof v!=='object')return;if(v.artRef)out.add(v.artRef);Object.values(v).forEach(walk);};walk(o);return [...out].sort();};
// An installed art pilot does not by itself mark the car's provenance/drive gate finished.
const alkanetArt = new Map([
  ["8296 tires 3", "catalog-alkanet-2015-tires"],
  ["8300 body", "catalog-alkanet-2015-body"],
  ["rtginterior", "catalog-alkanet-2015-dashboard"],
  ["steeringwheel", "buse-steeringwheel"]
]);
const views = ['front', 'frontRight', 'right', 'rearRight', 'rear', 'rearLeft', 'left', 'frontLeft'];
for(const r of records){const d=read('data/server-storage/files/cars/'+r.name+'/document.json'),c=d.car;
 const isAlkanet = r.name === 'Alkanet 2015';
 test(r.name+' preserves distinct provenance and '+(isAlkanet?'dedicated fitted':'shared')+' art references without copied physics',()=>{
   const expectedRefs = refs(starter.art).map(ref => isAlkanet ? (alkanetArt.get(ref) ?? ref) : ref).sort();
   assert.deepEqual(refs(c.art), expectedRefs);
   if (isAlkanet) {
     assert.equal(c.id, 'alkanet-2015');
     for (const view of views) {
       assert.equal(c.art.angleLayers[view].body.artRef, alkanetArt.get('8300 body'), view);
       assert.equal(c.art.angleLayers[view].tires.artRef, alkanetArt.get('8296 tires 3'), view);
     }
     assert.equal(c.art.interior.dashboard.artRef, alkanetArt.get('rtginterior'));
     assert.equal(c.art.interior.steeringWheel.artRef, alkanetArt.get('steeringwheel'));
   }
   assert.notDeepEqual(c.tuning,starter.tuning);assert.equal(c.tuning.physicalVehicleProfile,undefined);assert.equal(c.catalogProvenance.candidateId,r.candidateId);assert.deepEqual(c.catalogProvenance.verifiedFacts,r.facts);assert.equal(c.catalogProvenance.phaseStatus.originalArtFinished,false);assert.equal(c.catalogProvenance.phaseStatus.independentDriveVerified,false);assert.ok(Math.abs(c.tuning.weightKg-(r.facts.curbKg??r.simulationEstimates.curbKg))<1e-8);assert.equal(c.tuning.cvt,undefined);for(const ref of refs(c.art))assert.ok(fs.existsSync(new URL('data/server-storage/files/art/'+ref+'/document.json',root)));});
 test(r.name+' full native roundtrip retains powertrain and instruments',()=>{const e=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});e.applyLoadedCarDocument(structuredClone(d),{name:r.name});assert.deepEqual(e.serializeSelectedCarDocument().car,withLegacyGaugeDefaults(c));});
 test(r.name+' production drivetrain accelerates with traction control on/off',()=>{for(const tc of [true,false]){const x=runClimb({carName:r.name,surface:'asphalt',snowMm:0,slope:0,throttle:1,seconds:5,temperatureC:20,tc});assert.ok(x.travelM>5,JSON.stringify(x));assert.ok(x.mph>5,JSON.stringify(x));assert.ok(x.mu>0);}});
}

test('wave09 distinguishes driver-inclusive reference mass, PS, staggered tires and rear torque share',()=>{
 const cars=records.map(r=>read('data/server-storage/files/cars/'+r.name+'/document.json').car),[r,s,g]=cars;
 assert.equal(r.tuning.powerHp,525);assert.equal(r.tuning.centerDifferentialBalance,.85);assert.notEqual(r.tuning.wheelRadiusByWheelM.fl,r.tuning.wheelRadiusByWheelM.rl);assert.equal(r.catalogProvenance.verifiedFacts.curbKg,undefined);
 assert.equal(s.tuning.weightKg,1315);assert.ok(s.tuning.powerHp<230&&s.tuning.powerHp>227);assert.equal(s.tuning.centerDifferentialBalance,.5);assert.equal(s.catalogProvenance.verifiedFacts.publishedPowerPS,231);
 assert.equal(g.catalogProvenance.verifiedFacts.publishedKerbKg,1521);assert.equal(g.catalogProvenance.verifiedFacts.curbKg,undefined);assert.equal(g.tuning.weightKg,1446);assert.equal(g.transmissions.manual.gearRatios.length,6);
});
