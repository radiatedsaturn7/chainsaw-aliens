// Frozen original cell normalization for parity checks.
import {clamp, quantizeTrackStateNumber} from '../../../src/racing/trackState/TrackStateMath.js';
const NON_NEGATIVE_FIELDS = [
  'moistureDepthMm',
  'standingWaterDepthMm',
  'rubber',
  'looseMarbles',
  'dust',
  'dirt',
  'mud',
  'oil',
  'snowDepthMm',
  'iceDepthMm',
  'roughness',
  'drainageRateMmPerS',
  'sunExposure',
  'windExposure',
  'debris',
  'compaction',
  'baselineMoistureDepthMm',
  'baselineStandingWaterDepthMm',
  'baselineLooseMarbles',
  'baselineDust',
  'baselineDirt',
  'baselineMud',
  'baselineOil',
  'baselineSnowDepthMm',
  'baselineIceDepthMm',
  'baselineRoughness',
  'baselineDebris'
];

export function clampTrackStateCell(cell = {}) {
  NON_NEGATIVE_FIELDS.forEach((field) => {
    cell[field] = quantizeTrackStateNumber(Math.max(0, Number(cell[field]) || 0));
  });
  ['rubber', 'looseMarbles', 'dust', 'dirt', 'mud', 'oil', 'roughness', 'sunExposure', 'windExposure', 'debris', 'compaction']
    .forEach((field) => {
      cell[field] = quantizeTrackStateNumber(clamp(cell[field], 0, 1));
    });
  cell.surfaceTemperatureC = quantizeTrackStateNumber(clamp(Number(cell.surfaceTemperatureC) || 0, -80, 120));
  cell.elevationM = quantizeTrackStateNumber(Number(cell.elevationM) || 0);
  cell.baseGrip = quantizeTrackStateNumber(clamp(Number(cell.baseGrip) || 0.7, 0.05, 2));
  cell.baseRollingResistance = quantizeTrackStateNumber(clamp(Number(cell.baseRollingResistance) || 1, 0.2, 5));
  cell.permeability = quantizeTrackStateNumber(clamp(Number(cell.permeability) || 0, 0, 1));
  cell.saturationDepthMm = quantizeTrackStateNumber(Math.max(0.01, Number(cell.saturationDepthMm) || 1));
  cell.heatResponse = quantizeTrackStateNumber(clamp(Number(cell.heatResponse) || 0.12, 0.01, 1));
  return cell;
}

