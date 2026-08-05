// Captured from data/server-storage/files/races/Studio Sprint2/document.json
// (compact-v1 SHA-256 below) and its prepared race-world bake. Keeping only
// the triangles surrounding known recovery sites makes the fixture immutable
// and small while preserving the exact serialized source identity.
export const STUDIO_SPRINT_2_TERRAIN_FIXTURE = Object.freeze({
  sourceDocumentSha256: '5eb6003c11fe5eac2d3fd2515b55a2d0b7f6304ccf371e8d90bb13c52b6e807b',
  race: Object.freeze({
    id: 'test-loop',
    name: 'Studio Sprint',
    roadSegments: Object.freeze([
      { length: 180, curve: 0, elevation: 0, surface: 'asphalt' },
      { length: 120, curve: 0.55, elevation: 0.08, surface: 'asphalt' },
      { length: 150, curve: -0.35, elevation: -0.04, surface: 'dirt' },
      { length: 110, curve: 0.9, elevation: 0.02, surface: 'gravel' },
      { length: 180, curve: 0, elevation: 0, surface: 'asphalt' }
    ]),
    tileMapRevision: 1357,
    tileCellSizeM: 5
  }),
  bodyProfile: Object.freeze({ preset: 'car', overallLengthM: 4.595,
    overallWidthM: 1.795, overallHeightM: 1.475, groundClearanceM: 0.135 }),
  initialState: Object.freeze({ position: { x: 0, y: 0.72, z: 0 },
    velocity: { x: 0, y: 0, z: 20 }, yawRad: 0 }),
  inputTimeline: Object.freeze([
    { timeSeconds: 0, steering: 0, throttle: 0.62, brake: 0 },
    { timeSeconds: 0.5, steering: 0.12, throttle: 0.7, brake: 0 },
    { timeSeconds: 1, steering: -0.08, throttle: 0.45, brake: 0.05 }
  ]),
  recoveryLocations: Object.freeze([
    { id: 'crest-entry', raceDistanceM: 292.5, world: { x: 0, y: 0.8, z: 9.5 },
      bakedHeightM: 0.8, analyticalHeightM: 0.8 },
    { id: 'dirt-seam', raceDistanceM: 330, world: { x: 0.35, y: 0.8, z: 10.15 },
      bakedHeightM: 0.8, analyticalHeightM: 0.8 },
    { id: 'gravel-crest', raceDistanceM: 548, world: { x: -0.4, y: 0.82, z: 23.1 },
      bakedHeightM: 0.8, analyticalHeightM: 0.8 }
  ]),
  // Two triangles from each prepared-bake neighborhood. The shared diagonal
  // intentionally exercises seam and narrow-crest support.
  triangles: Object.freeze([
    [{ x: -3, y: 0.8, z: 7 }, { x: 3, y: 0.8, z: 7 }, { x: 3, y: 0.8, z: 13 }],
    [{ x: -3, y: 0.8, z: 7 }, { x: 3, y: 0.8, z: 13 }, { x: -3, y: 0.8, z: 13 }],
    [{ x: -3, y: 0.8, z: 20}, { x: 3, y: 0.8, z: 20}, { x: 3, y: 0.8, z: 26}],
    [{ x: -3, y: 0.8, z: 20}, { x: 3, y: 0.8, z: 26}, { x: -3, y: 0.8, z: 26}]
  ])
});
