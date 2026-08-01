import assert from 'node:assert/strict';
import test from 'node:test';

import { TrackState } from '../../src/racing/trackState/TrackState.js';
import { createTrackStateVisualAtlas } from '../../src/racing/trackState/TrackStateVisualAtlas.js';

test('bounded visual atlas exposes authoritative channels without mutating simulation state', () => {
  const state = new TrackState({
    sampleBaseSurface: () => ({
      baseSurfaceId: 'asphalt',
      friction: 1,
      standingWaterDepthMm: 4,
      moistureDepthMm: 0.7
    })
  });
  state.sample({ x: 0.2, z: 0.2 });
  state.queueCrashContamination({ x: 0.2, z: 0.2, oil: 0.5, debris: 0.4, dirt: 0.3 });
  state.advance(0.1, { ambientTemperatureC: 20 });
  const checksum = state.getChecksum();
  const compact = createTrackStateVisualAtlas(state, { resolution: 32, worldSizeM: 32 });
  const detailed = createTrackStateVisualAtlas(state, { resolution: 128, worldSizeM: 64 });
  assert.equal(compact.pixels.length, 32 * 32 * 4);
  assert.equal(detailed.pixels.length, 128 * 128 * 4);
  assert.ok(compact.pixels.some((value) => value > 0));
  assert.equal(state.getChecksum(), checksum);
  assert.equal(state.stepIndex, compact.stepIndex);
});
