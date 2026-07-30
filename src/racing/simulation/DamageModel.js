import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';
import { getDoodadRuleForSpeed } from '../raceDoodads.js';

const averageDamage = (damage = {}) => {
  const values = Object.values(damage || {}).map((value) => Number(value) || 0);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
};

export class DamageModel {
  createState() {
    return {
      panels: { front: 0, left: 0, right: 0, rear: 0 },
      engine: 0,
      transmission: 0,
      suspension: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, 0])),
      suspensionPull: 0,
      tires: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, 0]))
    };
  }

  normalizeState(damage = null) {
    const base = this.createState();
    const state = damage || base;
    if (typeof state.panels === 'number') {
      state.panels = Object.fromEntries(Object.keys(base.panels).map((key) => [key, state.panels]));
    }
    if (typeof state.suspension === 'number') {
      state.suspension = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, state.suspension]));
    }
    if (typeof state.tires === 'number') {
      state.tires = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, state.tires]));
    }
    state.panels = { ...base.panels, ...state.panels };
    state.suspension = { ...base.suspension, ...state.suspension };
    state.tires = { ...base.tires, ...state.tires };
    state.engine = Number(state.engine || 0);
    state.transmission = Number(state.transmission || 0);
    state.suspensionPull = Number(state.suspensionPull || 0);
    return state;
  }

  apply(damage, part, amount = 0, details = {}) {
    const state = this.normalizeState(damage);
    const value = Math.max(0, Number(amount) || 0);
    if (part === 'tires') {
      (details.keys || RACE_WHEEL_IDS).forEach((key) => {
        state.tires[key] = clamp(Number(state.tires[key] || 0) + value, 0, 100);
      });
    } else if (part === 'suspension') {
      (details.keys || RACE_WHEEL_IDS).forEach((key) => {
        state.suspension[key] = clamp(Number(state.suspension[key] || 0) + value, 0, 100);
      });
      state.suspensionPull = clamp(
        Number(state.suspensionPull || 0) + Number(details.pull || 0),
        -0.35,
        0.35
      );
    } else if (part === 'panels') {
      (details.keys || ['front', 'left', 'right', 'rear']).forEach((key) => {
        state.panels[key] = clamp(Number(state.panels[key] || 0) + value, 0, 100);
      });
    } else if (part in state) {
      state[part] = clamp(Number(state[part] || 0) + value, 0, 100);
    }
    return state;
  }

  getEffects(damage = {}) {
    const state = this.normalizeState(damage);
    const suspensionDamage = averageDamage(state.suspension);
    const panelDamage = averageDamage(state.panels);
    return {
      grip: clamp(1 - suspensionDamage * 0.0035, 0.58, 1),
      enginePower: clamp(1 - Number(state.engine || 0) * 0.006, 0.38, 1),
      engineJitter: Number(state.engine || 0) >= 45 ? 0.14 + Number(state.engine || 0) * 0.002 : 0,
      shiftDelayMs: Number(state.transmission || 0) * 7,
      suspensionPull: Number(state.suspensionPull || 0),
      panelDrag: 1 + panelDamage * 0.002
    };
  }
}

export function updateRaceSceneryCollisions(editor, seconds = 0) {
  const session = editor.playtestSession;
  if (!session) return;
  const scenery = editor.ensureRaceScenery();
  if (!scenery.length) return;
  session.triggeredSceneryIds = Array.isArray(session.triggeredSceneryIds) ? session.triggeredSceneryIds : [];
  session.flattenedSceneryIds = Array.isArray(session.flattenedSceneryIds) ? session.flattenedSceneryIds : [];
  session.removedSceneryIds = Array.isArray(session.removedSceneryIds) ? session.removedSceneryIds : [];
  const car = editor.getRaceSessionCar(session);
  const contactPoints = editor.getRaceVehicleCollisionContactPoints({
    session,
    car,
    tuning: editor.getRaceCarTuning(car)
  });
  const wheelProbeRadius = 0.34;
  const bodyProbeRadius = 0.18;
  const speed = Math.abs(Number(session.speedMps || 0));
  const speedMph = speed * 2.23694;
  scenery.forEach((sprite) => {
    if (!sprite?.id || session.removedSceneryIds.includes(sprite.id) || session.flattenedSceneryIds.includes(sprite.id) || session.triggeredSceneryIds.includes(sprite.id)) return;
    const doodad = editor.getRaceDoodadForScenery(sprite);
    const rule = getDoodadRuleForSpeed(doodad, speedMph);
    const spriteRadius = Math.max(0.35, Number(doodad.hitboxWidthM ?? doodad.widthM ?? sprite.widthM ?? 1.4) * 0.5);
    let hit = null;
    contactPoints.forEach((point) => {
      if (hit) return;
      const probeRadius = point.wheel ? wheelProbeRadius : bodyProbeRadius;
      const dx = Number(point.x || 0) - Number(sprite.x || 0);
      const dz = Number(point.z || 0) - Number(sprite.z || 0);
      const distance = Math.hypot(dx, dz);
      if (distance <= spriteRadius + probeRadius) {
        hit = { point, dx, dz, distance };
      }
    });
    if (!hit) return;
    const dx = hit.dx;
    const dz = hit.dz;
    const impactNormal = Math.atan2(dx, dz);
    const impactAngle = Math.atan2(
      Math.sin(Number(session.carYaw || 0) - impactNormal),
      Math.cos(Number(session.carYaw || 0) - impactNormal)
    );
    const severity = clamp(speed / 34, 0.08, 2.4) * (0.65 + Math.abs(Math.cos(impactAngle)) * 0.7);
    session.triggeredSceneryIds.push(sprite.id);
    if (rule.behavior === 'flatten') {
      session.flattenedSceneryIds.push(sprite.id);
      session.speedMps *= Math.max(0.15, 1 - severity * (Number(rule.speedDrainPercent || 18) / 100));
      editor.applyRaceDamage('panels', severity * Number(rule.damage?.panels || 0), { keys: ['front'], source: `scenery:${sprite.id}` });
      editor.applyRaceDamage('suspension', severity * Number(rule.damage?.suspension || 0), { keys: ['fl', 'fr'], source: `scenery:${sprite.id}` });
      editor.applyRaceDamage('engine', severity * Number(rule.damage?.engine || 0), { source: `scenery:${sprite.id}` });
      return;
    }
    if (rule.behavior === 'fly-off') {
      session.removedSceneryIds.push(sprite.id);
      const weightFactor = clamp(45 / Math.max(5, Number(doodad.weightKg || sprite.weightKg || 35)), 0.12, 1.4);
      session.speedMps *= Math.max(0.12, 1 - severity * (Number(rule.speedDrainPercent || 16) / 100) / weightFactor);
      session.yawVelocityRadps += Math.sin(impactAngle) * severity * 0.32;
      editor.applyRaceDamage('panels', severity * Number(rule.damage?.panels || 0), { keys: ['front'], source: `scenery:${sprite.id}` });
      editor.applyRaceDamage('suspension', severity * Number(rule.damage?.suspension || 0), { keys: ['fl', 'fr'], source: `scenery:${sprite.id}` });
      editor.applyRaceDamage('engine', severity * Number(rule.damage?.engine || 0), { source: `scenery:${sprite.id}` });
      return;
    }
    const bounce = clamp(severity * (Number(rule.speedDrainPercent || 45) / 132), 0.12, 0.82);
    session.speedMps *= -bounce;
    session.yawVelocityRadps += Math.sin(impactAngle) * severity * 1.35;
    session.carYaw += Math.sin(impactAngle) * severity * 0.18;
    session.worldX += Math.sin(impactNormal) * Math.max(0.2, speed * Number(seconds || 0.016));
    session.worldZ += Math.cos(impactNormal) * Math.max(0.2, speed * Number(seconds || 0.016));
    editor.applyRaceDamage('panels', severity * Number(rule.damage?.panels || 0), { keys: Math.abs(impactAngle) > 1.2 ? ['left', 'right'] : ['front'], source: `scenery:${sprite.id}` });
    editor.applyRaceDamage('suspension', severity * Number(rule.damage?.suspension || 0), { keys: ['fl', 'fr'], pull: Math.sin(impactAngle) * 0.04, source: `scenery:${sprite.id}` });
    editor.applyRaceDamage('engine', severity * Number(rule.damage?.engine || 0), { source: `scenery:${sprite.id}` });
  });
}

export function updateRaceWearAndDamage(editor, seconds = 0) {
  const session = editor.playtestSession;
  if (!session) return;
  const car = editor.getRaceSessionCar(session);
  const setup = editor.getRaceCarSetup(car);
  const tireTemperatureWear = editor.getRaceTireTemperatureWearMultipliers(session.diagnostics?.tireTemperature || {});
  const damage = editor.getRaceSessionDamage();
  const speed = Number(session.speedMps || 0);
  const steer = Number(editor.raceInput.steeringWheel || 0);
  const tireSlip = session.tireSlip || {};
  const drift = Math.max(
    Number(tireSlip.scrub || 0),
    Number(tireSlip.wheelSpin || 0),
    Number(tireSlip.brakeLock || 0),
    Number(tireSlip.audibleSlip || 0)
  ) + (editor.raceInput.handbrake ? 0.25 : 0);
  const baseWear = seconds * (0.006 + Math.abs(speed) * 0.00055);
  RACE_WHEEL_IDS.forEach((wheelId) => {
    const wheelSlip = Math.max(0, Number(tireSlip[wheelId] || 0));
    const contactLoadScale = clamp(Number(tireSlip.wheelContactScaleByWheel?.[wheelId] ?? 1) || 0, 0, 1);
    const compoundWear = clamp(Number(editor.getRaceTireCompound(setup.tireCompoundByWheel[wheelId]).wearRate) || 1, 0.7, 1.6);
    const axleWear = wheelId === 'rl' || wheelId === 'rr' ? 1.12 : 1;
    const surfaceWear = editor.getRaceTireSurfaceWearMultiplier(
      setup.tireCompoundByWheel[wheelId],
      tireSlip.wheelTerrains?.[wheelId] || 'road',
      tireSlip.wheelSurfaces?.[wheelId] || 'asphalt'
    );
    const pressureDynamics = editor.getRaceTirePressureDynamics({
      pressurePsi: setup.tirePressurePsi[wheelId],
      compoundId: setup.tireCompoundByWheel[wheelId],
      surfaceId: tireSlip.wheelSurfaces?.[wheelId] || 'asphalt',
      tireSize: setup.tireSize,
      temperatureF: session.diagnostics?.tireTemperature?.[wheelId]
    });
    const tempWear = Number(tireTemperatureWear[wheelId] || 1);
    const pressureWear = Number(pressureDynamics.wearMultiplier || 1);
    const slipWear = wheelSlip > 0.025
      ? seconds * wheelSlip * Math.max(wheelSlip, drift) * 0.24 * contactLoadScale
      : 0;
    const wear = (baseWear * contactLoadScale + slipWear) * compoundWear * axleWear * surfaceWear * tempWear * pressureWear;
    damage.tires[wheelId] = clamp(Number(damage.tires[wheelId] || 0) + wear, 0, 100);
  });

  const tuning = editor.getRaceCarTuning(car);
  if (session.rpm > 0.985 && editor.raceInput.throttle && editor.raceInput.gear < tuning.gearRatios.length) {
    editor.applyRaceDamage('engine', seconds * 2.8);
  }
  if (Math.abs(steer) > 0.72 && speed > 38 && editor.raceInput.handbrake) {
    editor.applyRaceDamage('transmission', seconds * 0.9);
  }

  const previous = Number(session.previousDistance || 0);
  const current = Number(session.distance || 0);
  const routeLength = Math.max(1, Number(session.routeLength || editor.getRaceRouteLength()));
  const crossed = (at) => (
    current >= previous
      ? at > previous && at <= current
      : at > previous || at <= current
  );
  const hazards = editor.selectedRace?.hazards || [];
  hazards.forEach((hazard) => {
    if (!hazard?.id || session.triggeredHazardIds.includes(hazard.id)) return;
    const at = ((Number(hazard.at) || 0) % routeLength + routeLength) % routeLength;
    if (!crossed(at)) return;
    session.triggeredHazardIds.push(hazard.id);
    if (hazard.type === 'jump') {
      const impact = Math.max(0, speed / 30 - Number(hazard.landingForgiveness || 0.35));
      editor.applyRaceDamage('suspension', impact * 10 + Number(hazard.height || 0) * 12, {
        pull: (Math.random() - 0.5) * 0.08,
        source: `hazard:${hazard.id}`
      });
    } else if (editor.didRaceHazardContactCar(hazard, session)) {
      const amount = Number(hazard.damage || 10);
      const panelKeys = hazard.side === 'left'
        ? ['left']
        : hazard.side === 'right'
          ? ['right']
          : hazard.side === 'rear'
            ? ['rear']
            : ['front'];
      editor.applyRaceDamage('panels', amount, { keys: panelKeys, source: `hazard:${hazard.id}` });
      if (hazard.side === 'left') editor.applyRaceDamage('suspension', amount * 0.15, { keys: ['fl', 'rl'], pull: 0.025, source: `hazard:${hazard.id}` });
      if (hazard.side === 'right') editor.applyRaceDamage('suspension', amount * 0.15, { keys: ['fr', 'rr'], pull: -0.025, source: `hazard:${hazard.id}` });
      if (!hazard.side || hazard.side === 'front') editor.applyRaceDamage('suspension', amount * 0.08, { keys: ['fl', 'fr'], source: `hazard:${hazard.id}` });
    }
  });
  editor.updateRaceSceneryCollisions(seconds);
}
