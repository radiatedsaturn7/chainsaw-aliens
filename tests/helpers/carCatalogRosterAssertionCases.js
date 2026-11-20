import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertCanonicalRoster, assertHistoricalOutputEvidence, primaryVehicleReference} from './catalogRosterAssertions.js';
const read = path => JSON.parse(fs.readFileSync(new URL('../../' + path, import.meta.url)));
const queue = read('data/vehicle-catalog/canonical-target-queue.json');
const names = queue.targets.map(row => row.alias);
const ids = queue.targets.map(row => row.stableCarId);

test('canonical roster requires exact identities, not merely a matching count', () => {
  assertCanonicalRoster(names, ids, queue);
  assert.throws(() => assertCanonicalRoster(names.slice(1), ids.slice(1), queue));
  assert.throws(() => assertCanonicalRoster([...names.slice(1), names[1]], ids, queue));
  assert.throws(() => assertCanonicalRoster(names, [...ids.slice(1), 'saved-car:unexpected'], queue));
  const broken = structuredClone(queue);
  broken.targets[1].targetId = broken.targets[0].targetId;
  assert.throws(() => assertCanonicalRoster(names, ids, broken));
});

test('historical evidence accepts verified torque and nested or flat rating bases without promoting estimated power', () => {
  for (const [wave, name] of [[38, 'Yellow Melilot 1966'], [44, 'Common Birdsfoot 1960'], [44, 'Kidney Vetch 1966'], [71, 'Cherry Clover 1967']]) {
    const record = read(`data/vehicle-catalog/phases/wave-${wave}-research.json`).vehicles.find(row => row.name === name);
    assertHistoricalOutputEvidence(record);
    const missingEvidence = structuredClone(record);
    delete missingEvidence.facts.periodPublishedRatings;
    delete missingEvidence.facts.secondaryPublishedRatings;
    delete missingEvidence.facts.ratingBasis;
    assert.throws(() => assertHistoricalOutputEvidence(missingEvidence));
    const missingEstimate = structuredClone(record);
    delete missingEstimate.simulationEstimates.powerHp;
    assert.throws(() => assertHistoricalOutputEvidence(missingEstimate));
    const invalidTorque = structuredClone(record);
    invalidTorque.facts.torqueLbFt = -1;
    assert.throws(() => assertHistoricalOutputEvidence(invalidTorque));
  }
});

test('Brooklime source identity excludes relationship-only mentions without hiding the Ranger itself', () => {
  const ranger = read('data/server-storage/files/cars/Brooklime 2003/document.json').car.catalogProvenance;
  const colorado = read('data/server-storage/files/cars/Coralberry Clover 2004/document.json').car.catalogProvenance;
  assert.match(ranger.referenceVehicle, /Ford Ranger/i);
  assert.equal(/Ford Ranger/i.test(colorado.referenceVehicle), false);
  assert.ok(colorado.relationshipAudit.existingRelated.some(row => /Ford Ranger/i.test(row.reference)));
  assert.equal(colorado.identity.make, 'Chevrolet');
  assert.equal(colorado.identity.model, 'Colorado');
});


test('primary vehicle matching excludes relationship references and negative variant qualifiers', () => {
  const dino = read('data/server-storage/files/cars/Hairy Tare 1969/document.json').car.catalogProvenance;
  const stratos = read('data/server-storage/files/cars/Storksbill 1977/document.json').car.catalogProvenance;
  assert.match(dino.referenceVehicle, /Stratos/);
  assert.doesNotMatch(primaryVehicleReference(dino), /Stratos/);
  assert.match(primaryVehicleReference(stratos), /Munari.*Monte Carlo/);
  assert.equal(primaryVehicleReference({referenceVehicle:'Actual car', relationshipAudit:{existingRelated:[{reference:'Other car'}]}}), 'Actual car');
});
