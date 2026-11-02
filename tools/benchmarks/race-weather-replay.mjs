// CPU-only paired catch-up benchmark; not a browser FPS test.
// Run: node tools/benchmarks/race-weather-replay.mjs
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { TrackState } from '../../src/racing/trackState/TrackState.js';

function run(disabled) {
  const state = new TrackState({
    sampleBaseSurface: () => ({ baseSurfaceId: 'asphalt', friction: 1 })
  });
  state.debugDisableWeatherReplayCache = disabled;
  const cells = Array.from({ length: 512 }, (_, x) =>
    state.getOrCreateCell({ x, z: 0 }, { coordinates: true }));
  state.recordWeatherTransition(1, {
    type: 'storm', precipitationRateMmPerS: .02, ambientTemperatureC: 13,
    sunIntensity: 0, windIntensity: 1, humidity: 1
  });
  state.stepIndex = 600;
  const start = performance.now();
  for (const cell of cells) state.catchUpCellWeather(cell);
  const ms = performance.now() - start;
  return { disabled, ms, checksum: state.getChecksum(),
    hits: state.performanceCounters.weatherReplayCacheHits,
    reusedSteps: state.performanceCounters.weatherReplayReusedSteps };
}

for (let round = 0; round < 4; round++) {
  const results = (round % 2 ? [false, true] : [true, false]).map(run);
  assert.equal(results[0].checksum, results[1].checksum);
  for (const result of results) console.log(JSON.stringify({ round, ...result }));
}
