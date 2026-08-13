import {
  clamp,
  getTrackStateCellCenter,
  getTrackStateCellKey,
  quantizeTrackStateNumber
} from './TrackStateMath.js';
import { getTrackStateSurfaceProfile } from './TrackStateProfiles.js';

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

export function createTrackStateCell({
  x = 0,
  z = 0,
  cellSizeM = 1,
  base = {},
  stepIndex = 0,
  profileOverrides = null
} = {}) {
  const center = getTrackStateCellCenter({ x, z }, cellSizeM);
  const baseSurfaceId = String(base.baseSurfaceId || base.surfaceId || 'generic');
  const materialId = String(base.materialId || baseSurfaceId);
  const profile = getTrackStateSurfaceProfile(baseSurfaceId, materialId, profileOverrides);
  const initial = {
    x: Math.trunc(Number(x) || 0),
    z: Math.trunc(Number(z) || 0),
    key: getTrackStateCellKey(x, z),
    worldX: center.x,
    worldZ: center.z,
    baseSurfaceId,
    materialId,
    region: String(base.region || 'terrain'),
    elevationM: Number(base.elevationM ?? base.elevation ?? 0),
    normal: {
      x: Number(base.normal?.x || 0),
      y: Number(base.normal?.y ?? 1),
      z: Number(base.normal?.z || 0)
    },
    baseGrip: Number(base.friction ?? base.grip ?? profile.grip),
    baseRollingResistance: Number(base.rollingResistance ?? profile.rollingResistance),
    surfaceTemperatureC: Number(base.surfaceTemperatureC ?? 20),
    moistureDepthMm: Number(base.moistureDepthMm ?? profile.moistureDepthMm ?? 0),
    standingWaterDepthMm: Number(base.standingWaterDepthMm ?? profile.standingWaterDepthMm ?? 0),
    rubber: Number(base.rubber ?? 0),
    looseMarbles: Number(base.looseMarbles ?? profile.looseMarbles ?? 0),
    dust: Number(base.dust ?? profile.dust ?? 0),
    dirt: Number(base.dirt ?? profile.dirt ?? 0),
    mud: Number(base.mud ?? profile.mud ?? 0),
    oil: Number(base.oil ?? 0),
    snowDepthMm: Number(base.snowDepthMm ?? profile.snowDepthMm ?? 0),
    iceDepthMm: Number(base.iceDepthMm ?? profile.iceDepthMm ?? 0),
    roughness: Number(base.roughness ?? profile.roughness),
    drainageRateMmPerS: Number(base.drainageRateMmPerS ?? profile.drainageRateMmPerS),
    sunExposure: Number(base.sunExposure ?? profile.sunExposure),
    windExposure: Number(base.windExposure ?? profile.windExposure),
    permeability: Number(base.permeability ?? profile.permeability),
    saturationDepthMm: Number(base.saturationDepthMm ?? profile.saturationDepthMm),
    heatResponse: Number(base.heatResponse ?? profile.heatResponse),
    rubberAcceptance: Number(base.rubberAcceptance ?? profile.rubberAcceptance ?? 0.25),
    debris: Number(base.debris ?? 0),
    compaction: Number(base.compaction ?? 0),
    initializedStep: Math.max(0, Math.trunc(Number(stepIndex) || 0)),
    lastUpdatedStep: Math.max(0, Math.trunc(Number(stepIndex) || 0))
  };
  return clampTrackStateCell({
    ...initial,
    baselineMoistureDepthMm: initial.moistureDepthMm,
    baselineStandingWaterDepthMm: initial.standingWaterDepthMm,
    baselineLooseMarbles: initial.looseMarbles,
    baselineDust: initial.dust,
    baselineDirt: initial.dirt,
    baselineMud: initial.mud,
    baselineOil: initial.oil,
    baselineSnowDepthMm: initial.snowDepthMm,
    baselineIceDepthMm: initial.iceDepthMm,
    baselineRoughness: initial.roughness,
    baselineDebris: initial.debris
  });
}

function calculateCellConditionInto(target, cell, baseline = false) {
    const water = Math.max(0, Number(
      baseline ? cell.baselineStandingWaterDepthMm : cell.standingWaterDepthMm
    ) || 0);
    const moisture = Math.max(0, Number(
      baseline ? cell.baselineMoistureDepthMm : cell.moistureDepthMm
    ) || 0);
    const looseMarbles = Math.max(0, Number(
      baseline ? cell.baselineLooseMarbles : cell.looseMarbles
    ) || 0);
    const dust = Math.max(0, Number(baseline ? cell.baselineDust : cell.dust) || 0);
    const dirt = Math.max(0, Number(baseline ? cell.baselineDirt : cell.dirt) || 0);
    const mud = Math.max(0, Number(baseline ? cell.baselineMud : cell.mud) || 0);
    const debris = Math.max(0, Number(baseline ? cell.baselineDebris : cell.debris) || 0);
    const oil = Math.max(0, Number(baseline ? cell.baselineOil : cell.oil) || 0);
    const iceDepthMm = Math.max(0, Number(
      baseline ? cell.baselineIceDepthMm : cell.iceDepthMm
    ) || 0);
    const snowDepthMm = Math.max(0, Number(
      baseline ? cell.baselineSnowDepthMm : cell.snowDepthMm
    ) || 0);
    const roughness = Math.max(0, Number(
      baseline ? cell.baselineRoughness : cell.roughness
    ) || 0);
    const wetness = clamp(moisture / Math.max(0.1, Number(cell.saturationDepthMm || 1)) + water / 4, 0, 1);
    const hydroplaningRisk = clamp((water - 0.6) / 5.4, 0, 1);
    const looseMaterialRisk = clamp(
      looseMarbles * 0.55
        + dust * 0.18
        + dirt * 0.26
        + mud * 0.7
        + debris * 0.4,
      0,
      1
    );
    const contaminationRisk = clamp(
      oil * 0.9
        + clamp(iceDepthMm / 2, 0, 1) * 0.78,
      0,
      1
    );
    const snowRisk = clamp(snowDepthMm / 35, 0, 1);
    const roughnessRisk = clamp(roughness, 0, 1);
    const rollingFactor = 1
      + water * 0.025
      + looseMarbles * 0.12
      + dust * 0.05
      + dirt * 0.16
      + mud * 0.55
      + oil * 0.08
      + snowRisk * 0.85
      + clamp(iceDepthMm / 2, 0, 1) * 0.1
      + debris * 0.24
      + roughnessRisk * 0.18;
    target.water = water;
    target.moisture = moisture;
    target.wetness = wetness;
    target.hydroplaningRisk = hydroplaningRisk;
    target.looseMaterialRisk = looseMaterialRisk;
    target.contaminationRisk = contaminationRisk;
    target.snowRisk = snowRisk;
    target.roughnessRisk = roughnessRisk;
    target.rollingFactor = rollingFactor;
    return target;
}

export function getTrackStateCellSample(
  cell = {}, stepIndex = 0, target = null, conditionScratch = null
) {
  const current = calculateCellConditionInto(conditionScratch?.current || {}, cell, false);
  const baseline = calculateCellConditionInto(conditionScratch?.baseline || {}, cell, true);
  const water = current.water;
  const wetness = current.wetness;
  const rubber = clamp(Number(cell.rubber || 0), 0, 1);
  const rubberEffect = rubber * (wetness < 0.18 ? 0.14 : -(0.08 + wetness * 0.16));
  const hydroplaningRisk = current.hydroplaningRisk;
  const looseMaterialRisk = current.looseMaterialRisk;
  const contaminationRisk = current.contaminationRisk;
  const snowRisk = current.snowRisk;
  const roughnessRisk = current.roughnessRisk;
  const gripMultiplier = clamp(
    1
      + rubberEffect
      - (wetness - baseline.wetness) * 0.18
      // Bulk water changes rolling resistance here, but aquaplaning lift and
      // tire-force loss are calculated per wheel from tire/load kinematics.
      - (looseMaterialRisk - baseline.looseMaterialRisk) * 0.38
      - (contaminationRisk - baseline.contaminationRisk) * 0.72
      - (snowRisk - baseline.snowRisk) * 0.42
      - (roughnessRisk - baseline.roughnessRisk) * 0.06,
    0.08,
    1.18
  );
  const rollingResistanceMultiplier = clamp(
    Number(cell.baseRollingResistance || 1)
      * current.rollingFactor / Math.max(0.1, baseline.rollingFactor),
    0.3,
    4
  );
  const effectiveSurfaceId = Number(cell.iceDepthMm || 0) > 0.25
    ? 'ice'
    : Number(cell.snowDepthMm || 0) > 2
      ? 'snow'
      : water > 0.1 && cell.baseSurfaceId === 'asphalt'
        ? 'wet-asphalt'
        : cell.baseSurfaceId;
  const output = target && typeof target === 'object' ? target : {};
  const visual = output.visual && typeof output.visual === 'object' ? output.visual : {};
  output.cellKey = cell.key;
  output.stepIndex = stepIndex;
  output.cell = cell;
  output.effectiveSurfaceId = effectiveSurfaceId;
  output.effectiveGripMultiplier = quantizeTrackStateNumber(gripMultiplier);
  output.effectiveGrip = quantizeTrackStateNumber(Number(cell.baseGrip || 1) * gripMultiplier);
  output.rollingResistanceMultiplier = quantizeTrackStateNumber(rollingResistanceMultiplier);
  output.wetness = quantizeTrackStateNumber(wetness);
  output.hydroplaningRisk = quantizeTrackStateNumber(hydroplaningRisk);
  output.looseMaterialRisk = quantizeTrackStateNumber(looseMaterialRisk);
  output.contaminationRisk = quantizeTrackStateNumber(contaminationRisk);
  output.risk = quantizeTrackStateNumber(clamp(
    Math.max(0, hydroplaningRisk - baseline.hydroplaningRisk) * 0.42
      + Math.max(0, looseMaterialRisk - baseline.looseMaterialRisk) * 0.35
      + Math.max(0, contaminationRisk - baseline.contaminationRisk) * 0.65
      + Math.max(0, snowRisk - baseline.snowRisk) * 0.38,
    0,
    1
  ));
  visual.wetness = quantizeTrackStateNumber(Math.max(0, wetness - baseline.wetness));
  visual.dampness = quantizeTrackStateNumber(clamp(
    Number(cell.moistureDepthMm || 0) / Math.max(0.1, Number(cell.saturationDepthMm || 1)), 0, 1
  ));
  visual.standingWater = quantizeTrackStateNumber(clamp(
    Number(cell.standingWaterDepthMm || 0) / 6, 0, 1
  ));
  visual.puddles = quantizeTrackStateNumber(clamp(
    (Number(cell.standingWaterDepthMm || 0) - 0.7) / 5.3, 0, 1
  ));
  visual.rubber = rubber;
  visual.loose = quantizeTrackStateNumber(Math.max(
    0, looseMaterialRisk - baseline.looseMaterialRisk
  ));
  visual.marbles = quantizeTrackStateNumber(clamp(Number(cell.looseMarbles || 0), 0, 1));
  visual.dirt = quantizeTrackStateNumber(clamp(Number(cell.dirt || 0), 0, 1));
  visual.mud = quantizeTrackStateNumber(clamp(Number(cell.mud || 0), 0, 1));
  visual.snow = quantizeTrackStateNumber(Math.max(0, snowRisk - baseline.snowRisk));
  visual.ice = quantizeTrackStateNumber(Math.max(
    0,
    clamp(Number(cell.iceDepthMm || 0) / 2, 0, 1)
      - clamp(Number(cell.baselineIceDepthMm || 0) / 2, 0, 1)
  ));
  visual.oil = quantizeTrackStateNumber(Math.max(
    0, Number(cell.oil || 0) - Number(cell.baselineOil || 0)
  ));
  visual.debris = quantizeTrackStateNumber(Math.max(
    0, Number(cell.debris || 0) - Number(cell.baselineDebris || 0)
  ));
  output.visual = visual;
  return output;
}
