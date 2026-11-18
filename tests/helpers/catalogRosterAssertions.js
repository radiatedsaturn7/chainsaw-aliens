import assert from 'node:assert/strict';
import fs from 'node:fs';

export function assertCanonicalRoster(names, runtimeIds, queue = JSON.parse(fs.readFileSync(new URL('../../data/vehicle-catalog/canonical-target-queue.json', import.meta.url)))) {
  assert.equal(queue.targetCount, 660);
  assert.equal(queue.targets.length, queue.targetCount);
  assert.equal(new Set(queue.targets.map(row => row.targetId)).size, queue.targetCount);
  const bound = queue.targets.filter(row => row.stableCarId);
  assert.equal(bound.length, queue.counts.implemented);
  assert.equal(queue.counts.openTargetPositions, queue.targetCount - bound.length);
  assert.equal(new Set(bound.map(row => row.stableCarId)).size, bound.length);
  assert.equal(new Set(bound.map(row => row.alias)).size, bound.length);
  assert.equal(new Set(runtimeIds).size, runtimeIds.length);
  assert.deepEqual([...names].sort(), bound.map(row => row.alias).sort());
  assert.deepEqual([...runtimeIds].sort(), bound.map(row => row.stableCarId).sort());
}

export function assertHistoricalOutputEvidence(record) {
  const facts = record.facts;
  const proof = facts.periodPublishedRatings ?? facts.secondaryPublishedRatings ?? (
    facts.publishedPeriodPowerPS != null && facts.publishedPeriodTorqueNm != null && facts.ratingBasis
      ? {publishedPeriodPowerPS: facts.publishedPeriodPowerPS, publishedPeriodTorqueNm: facts.publishedPeriodTorqueNm, ratingBasis: facts.ratingBasis}
      : null
  );
  assert.ok(proof, 'Explicit historical or secondary output evidence required');
  assert.ok(Object.entries(proof).some(([key, value]) => /power.*(?:hp|ps|kw|cv)|(?:hp|ps|kw|cv).*power|^publishedClaimedPeriodBhp$/i.test(key) && Number.isFinite(value) && value > 0), 'Positive published power evidence required');
  const basis = proof.ratingBasis ?? proof.basis;
  assert.ok(typeof basis === 'string' && basis.length > 10, 'Rating basis must be explicit');
  assert.ok([basis, ...record.limits].some(text => /gross|net/i.test(text)), 'Rating-standard caveat must be preserved');
  assert.ok(Number.isFinite(record.simulationEstimates.powerHp) && record.simulationEstimates.powerHp > 0, 'Installed power remains an explicit estimate');
  const torque = facts.torqueLbFt ?? facts.torqueNm ?? record.simulationEstimates.torqueLbFt ?? record.simulationEstimates.torqueNm;
  assert.ok(Number.isFinite(torque) && torque > 0, 'Positive verified or explicitly estimated installed torque required');
}

// Relationship references and explicit exclusions do not identify the modeled car.
export function primaryVehicleReference(provenance) {
  return (provenance?.referenceVehicle ?? "").split(/\b[Nn]ot(?=[\s\dA-Z])/)[0].trim();
}
