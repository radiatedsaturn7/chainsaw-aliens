import assert from 'node:assert/strict';
import test from 'node:test';

import { TrackState } from '../../src/racing/trackState/TrackState.js';
import { evaluateRaceAiTrackStateCandidates } from '../../src/racing/trackState/TrackStateIntegration.js';

const createScenario = () => {
  const state = new TrackState({
    seed: 9,
    sampleBaseSurface: ({ x = 0, z = 0 } = {}) => ({
      baseSurfaceId: 'asphalt',
      materialId: 'asphalt',
      region: 'road',
      elevationM: 0,
      normal: { x: 0, y: 1, z: 0 },
      friction: 1,
      drainageRateMmPerS: 0.02,
      sunExposure: 0.8,
      windExposure: 0.5
    })
  });
  const getWorldPoint = (distance, lineOffset) => ({ x: lineOffset * 4, z: distance });
  return { state, getWorldPoint };
};

test('AI leaves a contaminated line for a safer reachable candidate and reduces risk speed', () => {
  const { state, getWorldPoint } = createScenario();
  [10, 20, 30, 40].forEach((distance) => {
    state.mutateCell(getWorldPoint(distance, 0), {
      standingWaterDepthMm: 5,
      oil: 0.4,
      looseMarbles: 0.3
    });
  });
  const decision = evaluateRaceAiTrackStateCandidates({
    trackState: state,
    getWorldPoint,
    distance: 0,
    currentOffset: 0,
    candidateOffsets: [-0.5, 0, 0.5],
    lookaheadDistances: [10, 20, 30, 40],
    stepIndex: 20,
    nextSwitchStep: 0
  });
  assert.notEqual(decision.chosenOffset, 0);
  assert.ok(decision.gripScale < 1.01);
  assert.ok(decision.risk > 0);
  assert.equal(decision.switched, true);
});

test('AI candidate scoring has no predefined line bonus and is symmetric', () => {
  const { state, getWorldPoint } = createScenario();
  const decision = evaluateRaceAiTrackStateCandidates({
    trackState: state,
    getWorldPoint,
    distance: 0,
    currentOffset: 0,
    candidateOffsets: [-0.5, 0.5],
    lookaheadDistances: [10, 20],
    stepIndex: 1,
    nextSwitchStep: 0
  });
  assert.equal(
    decision.candidates.find((candidate) => candidate.offset === -0.5).score,
    decision.candidates.find((candidate) => candidate.offset === 0.5).score
  );
});

test('AI hysteresis and cooldown prevent rapid oscillation between near-equal paths', () => {
  const { state, getWorldPoint } = createScenario();
  state.mutateCell(getWorldPoint(10, 0), { moistureDepthMm: 0.2 });
  const held = evaluateRaceAiTrackStateCandidates({
    trackState: state,
    getWorldPoint,
    distance: 0,
    currentOffset: 0,
    candidateOffsets: [-0.2, 0, 0.2],
    lookaheadDistances: [10],
    stepIndex: 5,
    nextSwitchStep: 15,
    hysteresis: 0.03
  });
  assert.equal(held.chosenOffset, 0);
  assert.equal(held.switched, false);
  assert.ok(held.nextSwitchStep >= 15);
});
