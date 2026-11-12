import {advanceRaceLaunchControl} from './RaceLaunchControl.js';
import { stepElectricPowertrain } from './ElectricPowertrainModel.js';
import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';

// Shape pedal travel without changing zero or full-throttle output.
export function mapThrottlePedal(throttle,response=1){
 return clamp(Number(throttle)||0,0,1)**(2-clamp(Number(response)||1,.5,1.5));
}

export class PowertrainModel {
  getDrivenWheelIds(tuning = {}) {
    if (tuning.drivetrain === 'fwd') return ['fl', 'fr'];
    if (tuning.drivetrain === 'rwd') return ['rl', 'rr'];
    return [...RACE_WHEEL_IDS];
  }

  getDifferentialLockForAxle(tuning = {}, axle = 'rear', mode = 'accel') {
    const cleanAxle = axle === 'front' ? 'front' : 'rear';
    const cleanMode = mode === 'decel' ? 'Decel' : 'Accel';
    const key = `${cleanAxle}Differential${cleanMode}`;
    const fallback = cleanMode === 'Accel' ? tuning.differentialAccel : tuning.differentialDecel;
    return clamp(Number(tuning?.[key] ?? fallback) || 0, 0, 1);
  }

  getCenterDifferentialLock(tuning = {}) {
    if (tuning?.drivetrain !== 'awd') return 0;
    return clamp(Number(tuning.centerDifferentialLock ?? 0.42) || 0, 0, 1);
  }

  getEffectiveCenterRearShare(tuning = {}, { frontCapacity = null, rearCapacity = null } = {}) {
    if (tuning?.drivetrain !== 'awd') return tuning?.drivetrain === 'rwd' ? 1 : 0;
    const baseRearBias = clamp(Number(tuning.centerDifferentialBalance) || 0.5, 0.1, 0.9);
    const front = Math.max(0, Number(frontCapacity) || 0);
    const rear = Math.max(0, Number(rearCapacity) || 0);
    const total = front + rear;
    if (total <= 0.001) return baseRearBias;
    const capacityRearBias = clamp(rear / total, 0.1, 0.9);
    return clamp(
      baseRearBias + (capacityRearBias - baseRearBias) * this.getCenterDifferentialLock(tuning),
      0.1,
      0.9
    );
  }

  allocateForceWithinCapacities(totalForceN = 0, capacityById = {}, nominalShareById = {}) {
    const ids = Object.keys(capacityById || {});
    // Axles and the center differential always allocate between two outputs.
    // Keep the generic path for other callers, but avoid its temporary maps,
    // entry arrays and callbacks in this high-frequency case.
    if (ids.length === 2) {
      const a = ids[0], b = ids[1];
      const ca = Math.max(0, Number(capacityById[a]) || 0);
      const cb = Math.max(0, Number(capacityById[b]) || 0);
      const target = clamp(Math.max(0, Number(totalForceN) || 0), 0, ca + cb);
      const na = Math.max(0, Number(nominalShareById?.[a]) || 0);
      const nb = Math.max(0, Number(nominalShareById?.[b]) || 0);
      const nominalTotal = na + nb;
      let va = Math.min(ca, target * (nominalTotal > 0 ? na / nominalTotal : 0.5));
      let vb = Math.min(cb, target * (nominalTotal > 0 ? nb / nominalTotal : 0.5));
      let remaining = target - (va + vb);
      for (let pass = 0; pass < 2 && remaining > 0.0001; pass++) {
        const aa = Math.max(0, ca - va), ab = Math.max(0, cb - vb);
        const availableTotal = aa + ab;
        if (availableTotal <= 0.0001) break;
        if (aa > 0) va += Math.min(aa, remaining * (aa / availableTotal));
        if (ab > 0) vb += Math.min(ab, remaining * (ab / availableTotal));
        remaining = target - (va + vb);
      }
      return {[a]: va, [b]: vb};
    }

    const capacities = Object.fromEntries(ids.map((id) => [id, Math.max(0, Number(capacityById[id]) || 0)]));
    const capacityTotal = ids.reduce((sum, id) => sum + capacities[id], 0);
    const target = clamp(Math.max(0, Number(totalForceN) || 0), 0, capacityTotal);
    const nominalTotal = ids.reduce((sum, id) => sum + Math.max(0, Number(nominalShareById?.[id]) || 0), 0);
    const allocations = Object.fromEntries(ids.map((id) => [
      id,
      Math.min(
        capacities[id],
        target * (nominalTotal > 0 ? Math.max(0, Number(nominalShareById?.[id]) || 0) / nominalTotal : 1 / Math.max(1, ids.length))
      )
    ]));
    let remaining = target - ids.reduce((sum, id) => sum + allocations[id], 0);
    for (let pass = 0; pass < ids.length && remaining > 0.0001; pass += 1) {
      const availableTotal = ids.reduce((sum, id) => sum + Math.max(0, capacities[id] - allocations[id]), 0);
      if (availableTotal <= 0.0001) break;
      ids.forEach((id) => {
        const available = Math.max(0, capacities[id] - allocations[id]);
        if (available <= 0) return;
        const addition = Math.min(available, remaining * (available / availableTotal));
        allocations[id] += addition;
      });
      remaining = target - ids.reduce((sum, id) => sum + allocations[id], 0);
    }
    return allocations;
  }

  resolveDifferentialCapacity({
    firstId = 'left',
    secondId = 'right',
    firstCapacityN = 0,
    secondCapacityN = 0,
    lock = 0,
    nominalSecondShare = 0.5
  } = {}) {
    const firstCapacity = Math.max(0, Number(firstCapacityN) || 0);
    const secondCapacity = Math.max(0, Number(secondCapacityN) || 0);
    const secondShare = clamp(Number(nominalSecondShare) || 0.5, 0.001, 0.999);
    const firstShare = 1 - secondShare;
    const openLimitN = Math.min(
      firstCapacity / Math.max(0.001, firstShare),
      secondCapacity / Math.max(0.001, secondShare)
    );
    const lockedLimitN = firstCapacity + secondCapacity;
    const resolvedLock = clamp(Number(lock) || 0, 0, 1);
    const interpolatedLimitN = openLimitN + (lockedLimitN - openLimitN) * resolvedLock;
    const forceById = this.allocateForceWithinCapacities(interpolatedLimitN, {
      [firstId]: firstCapacity,
      [secondId]: secondCapacity
    }, {
      [firstId]: firstShare,
      [secondId]: secondShare
    });
    const limitN = Object.values(forceById).reduce((sum, force) => sum + Number(force || 0), 0);
    return {
      limitN,
      openLimitN,
      lockedLimitN,
      interpolatedLimitN,
      shareLimitedN: limitN,
      forceById,
      shareById: {
        [firstId]: limitN > 0.0001 ? Number(forceById[firstId] || 0) / limitN : firstShare,
        [secondId]: limitN > 0.0001 ? Number(forceById[secondId] || 0) / limitN : secondShare
      },
      lock: resolvedLock
    };
  }

  resolveDrivetrainCapacity({
    tuning = {},
    drivenWheelIds = this.getDrivenWheelIds(tuning),
    capacityByWheel = {},
    mode = 'accel'
  } = {}) {
    const driven = new Set(drivenWheelIds || []);
    const resolveAxle = (leftId, rightId, axleName) => {
      const leftDriven = driven.has(leftId);
      const rightDriven = driven.has(rightId);
      if (!leftDriven && !rightDriven) {
        return {
          limitN: 0,
          openLimitN: 0,
          lockedLimitN: 0,
          interpolatedLimitN: 0,
          shareLimitedN: 0,
          forceById: { [leftId]: 0, [rightId]: 0 },
          shareByWheel: { [leftId]: 0, [rightId]: 0 },
          lock: 0
        };
      }
      if (!leftDriven || !rightDriven) {
        const drivenId = leftDriven ? leftId : rightId;
        const limitN = Math.max(0, Number(capacityByWheel?.[drivenId]) || 0);
        return {
          limitN,
          openLimitN: limitN,
          lockedLimitN: limitN,
          interpolatedLimitN: limitN,
          shareLimitedN: limitN,
          forceById: { [leftId]: leftDriven ? limitN : 0, [rightId]: rightDriven ? limitN : 0 },
          shareByWheel: { [leftId]: leftDriven ? 1 : 0, [rightId]: rightDriven ? 1 : 0 },
          lock: 1
        };
      }
      const resolved = this.resolveDifferentialCapacity({
        firstId: leftId,
        secondId: rightId,
        firstCapacityN: capacityByWheel?.[leftId],
        secondCapacityN: capacityByWheel?.[rightId],
        lock: this.getDifferentialLockForAxle(tuning, axleName, mode),
        nominalSecondShare: 0.5
      });
      return { ...resolved, shareByWheel: resolved.shareById };
    };
    const front = resolveAxle('fl', 'fr', 'front');
    const rear = resolveAxle('rl', 'rr', 'rear');
    let center = null;
    let axleForce = { front: 0, rear: 0 };
    if (tuning.drivetrain === 'awd') {
      center = this.resolveDifferentialCapacity({
        firstId: 'front',
        secondId: 'rear',
        firstCapacityN: front.limitN,
        secondCapacityN: rear.limitN,
        lock: this.getCenterDifferentialLock(tuning),
        nominalSecondShare: clamp(Number(tuning.centerDifferentialBalance) || 0.5, 0.1, 0.9)
      });
      axleForce = center.forceById;
    } else if (tuning.drivetrain === 'fwd') {
      axleForce.front = front.limitN;
    } else {
      axleForce.rear = rear.limitN;
    }
    const frontForce = this.allocateForceWithinCapacities(axleForce.front, {
      fl: driven.has('fl') ? capacityByWheel.fl : 0,
      fr: driven.has('fr') ? capacityByWheel.fr : 0
    }, { fl: 0.5, fr: 0.5 });
    const rearForce = this.allocateForceWithinCapacities(axleForce.rear, {
      rl: driven.has('rl') ? capacityByWheel.rl : 0,
      rr: driven.has('rr') ? capacityByWheel.rr : 0
    }, { rl: 0.5, rr: 0.5 });
    const forceByWheel = { ...frontForce, ...rearForce };
    const limitN = RACE_WHEEL_IDS.reduce((sum, wheelId) => sum + Number(forceByWheel[wheelId] || 0), 0);
    const fallbackShare = driven.size ? 1 / driven.size : 0;
    const forceShareByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      limitN > 0.0001 ? Number(forceByWheel[wheelId] || 0) / limitN : driven.has(wheelId) ? fallbackShare : 0
    ]));
    return {
      limitN,
      forceByWheel,
      forceShareByWheel,
      axleLimitByAxle: { front, rear },
      center,
      centerRearBias: limitN > 0.0001
        ? (Number(forceByWheel.rl || 0) + Number(forceByWheel.rr || 0)) / limitN
        : this.getEffectiveCenterRearShare(tuning),
      frontShare: limitN > 0.0001
        ? (Number(forceByWheel.fl || 0) + Number(forceByWheel.fr || 0)) / limitN
        : tuning.drivetrain === 'fwd' ? 1 : 0,
      rearShare: limitN > 0.0001
        ? (Number(forceByWheel.rl || 0) + Number(forceByWheel.rr || 0)) / limitN
        : tuning.drivetrain === 'rwd' ? 1 : 0
    };
  }

  getDriveForceShareByWheel(tuning = {}, drivenWheelIds = this.getDrivenWheelIds(tuning), {
    normalLoads = null,
    gripByWheel = null,
    driveForce = 0
  } = {}) {
    const driven = new Set(drivenWheelIds || []);
    if (normalLoads && gripByWheel) {
      const capacityByWheel = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
        wheelId,
        driven.has(wheelId)
          ? Math.max(0, Number(normalLoads?.[wheelId] || 0) * Math.max(0.1, Number(gripByWheel?.[wheelId] || 1)))
          : 0
      ]));
      const resolved = this.resolveDrivetrainCapacity({
        tuning,
        drivenWheelIds,
        capacityByWheel,
        mode: Number(driveForce) < 0 ? 'decel' : 'accel'
      });
      if (resolved.limitN > 0.0001) return resolved.forceShareByWheel;
    }
    if (tuning.drivetrain === 'awd') {
      const rearShare = clamp(Number(tuning.centerDifferentialBalance) || 0.5, 0.1, 0.9);
      return {
        fl: driven.has('fl') ? (1 - rearShare) * 0.5 : 0,
        fr: driven.has('fr') ? (1 - rearShare) * 0.5 : 0,
        rl: driven.has('rl') ? rearShare * 0.5 : 0,
        rr: driven.has('rr') ? rearShare * 0.5 : 0
      };
    }
    const fallbackShare = driven.size ? 1 / driven.size : 0;
    return Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [wheelId, driven.has(wheelId) ? fallbackShare : 0]));
  }

  getDrivenTractionLimit({
    tuning = {},
    drivenWheelIds = this.getDrivenWheelIds(tuning),
    wheelLimitByWheel = {},
    gripFactor = 1,
    setupModifiers = {}
  } = {}) {
    const resolved = this.resolveDrivetrainCapacity({
      tuning,
      drivenWheelIds,
      capacityByWheel: wheelLimitByWheel,
      mode: 'accel'
    });
    const tractionScale = Math.max(0.45, clamp(Number(gripFactor) || 1, 0.28, 1.35))
      * Number(setupModifiers?.driveTraction || 1);
    const tractionLimitN = resolved.limitN * tractionScale;
    return {
      tractionLimitN,
      wheelLimitByWheel,
      forceByWheel: Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
        wheelId,
        Number(resolved.forceByWheel[wheelId] || 0) * tractionScale
      ])),
      forceShareByWheel: resolved.forceShareByWheel,
      axleLimitByAxle: resolved.axleLimitByAxle,
      centerDifferential: resolved.center,
      centerRearBias: resolved.centerRearBias,
      frontShare: resolved.frontShare,
      rearShare: resolved.rearShare
    };
  }

  getGearRatio(tuning = {}, gear = 1, ratios = tuning.gearRatios || []) {
    if (gear < 0) return tuning.reverseRatio;
    if (gear <= 0) return 0;
    return ratios[clamp(gear - 1, 0, ratios.length - 1)]
      || ratios[ratios.length - 1]
      || 1;
  }

  getTorqueNmAtRpm(rpm, tuning = {}) {
    if (tuning.powertrainType === 'electric') {
      const e = tuning.electricPowertrain, omega = Math.max(0, Number(rpm) || 0) * 2 * Math.PI / 60;
      return rpm >= e.maxMotorRpm ? 0 : Math.min(e.peakTorqueNm, omega > 0 ? e.peakPowerKw * 1000 / omega : e.peakTorqueNm);
    }
    const curvePoints = Array.isArray(tuning?.engineCurve?.torquePoints)
      ? tuning.engineCurve.torquePoints
        .map((point) => ({ rpm: Number(point?.rpm) || 0, torqueLbFt: Number(point?.torqueLbFt) || 0 }))
        .filter((point) => point.rpm > 0 && point.torqueLbFt > 0)
        .sort((a, b) => a.rpm - b.rpm)
      : [];
    if (curvePoints.length >= 2) {
      const targetRpm = Math.max(0, Number(rpm) || 0);
      if (targetRpm <= curvePoints[0].rpm) return curvePoints[0].torqueLbFt * 1.35582;
      for (let index = 1; index < curvePoints.length; index += 1) {
        const previous = curvePoints[index - 1];
        const next = curvePoints[index];
        if (targetRpm > next.rpm) continue;
        const ratio = clamp((targetRpm - previous.rpm) / Math.max(1, next.rpm - previous.rpm), 0, 1);
        return (previous.torqueLbFt + (next.torqueLbFt - previous.torqueLbFt) * ratio) * 1.35582;
      }
      return curvePoints.at(-1).torqueLbFt * 1.35582;
    }
    const peakTorqueNm = tuning.torqueLbFt * 1.35582;
    const idle = tuning.idleRpm;
    const start = tuning.torquePeakStartRpm;
    const end = tuning.torquePeakEndRpm;
    const limit = tuning.torqueFalloffRpm || tuning.revLimitRpm;
    if (rpm <= idle) return peakTorqueNm * 0.42;
    if (rpm < start) {
      return peakTorqueNm * clamp(0.42 + ((rpm - idle) / Math.max(1, start - idle)) * 0.58, 0.42, 1);
    }
    if (rpm <= end) return peakTorqueNm;
    return peakTorqueNm * clamp(1 - ((rpm - end) / Math.max(1, limit - end)) * 0.42, 0.54, 1);
  }

  getRedlineSpeedMps(tuning = {}, gear = 1) {
    const ratio = this.getGearRatio(tuning, gear);
    if (!ratio) return 0;
    const wheelRpm = tuning.redlineRpm / Math.max(0.1, ratio * tuning.finalDrive);
    return (wheelRpm / 60) * (Math.PI * 2 * tuning.wheelRadiusM);
  }

  getProjectedEngineRpmForGear(tuning = {}, speedMps = 0, gear = 1) {
    const ratio = this.getGearRatio(tuning, gear);
    if (!ratio) return tuning?.idleRpm || 900;
    return Math.abs(Number(speedMps) || 0)
      / Math.max(0.01, tuning.wheelRadiusM)
      * ratio
      * tuning.finalDrive
      * (60 / (Math.PI * 2));
  }

  getAutomaticUpshiftRpm(tuning = {}, idleOverride = tuning?.idleRpm, limitOverride = tuning?.revLimitRpm) {
    const idleRpm = Math.max(500, Number(idleOverride) || 850);
    const redlineRpm = Math.max(idleRpm + 500, Number(tuning?.redlineRpm || limitOverride) || 6200);
    const revLimitRpm = Math.max(redlineRpm, Number(limitOverride || redlineRpm) || redlineRpm);
    const configured = Number(tuning?.autoUpshiftRpm);
    const preferred = Number.isFinite(configured) && configured > 0 ? configured : redlineRpm * 0.94;
    const upper = Math.max(idleRpm + 500, Math.min(redlineRpm * 0.985, revLimitRpm - 120));
    return clamp(preferred, idleRpm + 500, upper);
  }

  getAutomaticDownshiftRpm(tuning = {}, idleOverride = tuning?.idleRpm, limitOverride = tuning?.revLimitRpm) {
    const idleRpm = Math.max(500, Number(idleOverride) || 850);
    const upshiftRpm = this.getAutomaticUpshiftRpm(tuning, idleOverride, limitOverride);
    const configured = Number(tuning?.autoDownshiftRpm);
    const rpmBand = Math.max(1, upshiftRpm - idleRpm);
    const minimumShiftGapRpm = clamp(rpmBand * 0.28, 900, 1800);
    const upper = Math.max(idleRpm * 1.1, upshiftRpm - minimumShiftGapRpm);
    const configuredUsable = Number.isFinite(configured)
      && configured > idleRpm * 1.05
      && configured < upper;
    const preferred = configuredUsable ? configured : idleRpm + rpmBand * 0.42;
    return clamp(preferred, idleRpm * 1.05, upper);
  }

  canAutomaticDownshift(tuning = {}, speedMps = 0, targetGear = 1) {
    if (targetGear <= 0) return true;
    const projectedRpm = this.getProjectedEngineRpmForGear(tuning, speedMps, targetGear);
    const safeDownshiftRpm = Math.max(
      Math.max(500, Number(tuning?.idleRpm) || 850) + 500,
      this.getAutomaticUpshiftRpm(tuning) - 300
    );
    return projectedRpm <= safeDownshiftRpm;
  }

  getDriveForceComponents({
    tuning = {},
    gearRatio = 0,
    engineTorqueNm = 0,
    availablePowerW = 0,
    speedMps = 0
  } = {}) {
    const ratio = Math.max(0, Number(gearRatio) || 0);
    if (!ratio) return { torqueForceN: 0, powerForceN: 0, baseForceN: 0, limitingSource: 'neutral' };
    const wheelRadiusM = Math.max(0.05, Number(tuning?.wheelRadiusM) || 0.32);
    const efficiency = clamp(Number(tuning?.drivetrainEfficiency) || 0.86, 0.45, 1);
    const finalDrive = Math.max(0.1, Number(tuning?.finalDrive) || 1);
    const torqueForceN = Math.max(0, Number(engineTorqueNm) || 0) * ratio * finalDrive * efficiency / wheelRadiusM;
    const speed = Math.abs(Number(speedMps) || 0);
    const lowSpeedPowerTransition = clamp((speed - 3) / 5, 0, 1);
    const powerLimitedForceN = Math.max(0, Number(availablePowerW) || 0) * efficiency / Math.max(3, speed);
    const powerForceN = torqueForceN + (powerLimitedForceN - torqueForceN) * lowSpeedPowerTransition;
    const baseForceN = Math.min(torqueForceN, powerForceN);
    return {
      torqueForceN,
      powerForceN,
      baseForceN,
      powerLimitBlend: lowSpeedPowerTransition,
      limitingSource: powerForceN < torqueForceN ? 'power' : 'torque'
    };
  }

  stepAuthoritativeWheelTorques({
    tuning = {},
    config = {},
    controls = {},
    previous = {},
    kinematicsByWheel = {},
    capacityByWheel = {},
    driveShareByWheel = {},
    state = {},
    damage = {},
    externalWheelAccelerationRadps2 = 0,
    dt = 0
  } = {}) {
    const seconds = Math.max(0, Number(dt) || 0);
    const electric = tuning.powertrainType === 'electric';
    const idleRpm = electric ? 0 : Math.max(500, Number(config.idleRpm ?? tuning.idleRpm) || 800);
    const maxRpm = Math.max(idleRpm + 500, Number(config.maxRpm
      ?? tuning.revLimitRpm ?? tuning.redlineRpm) || 7000);
    let requestedGear = Math.trunc(Number(controls.requestedGear || 0));
    if (electric) requestedGear = Math.sign(requestedGear);
    let gear = Number.isInteger(previous.gear) ? previous.gear : requestedGear;
    let targetGear = Number.isInteger(previous.targetGear) ? previous.targetGear : gear;
    let shiftTimeRemainingSeconds = Math.max(0, Number(previous.shiftTimeRemainingSeconds || 0));
    let shiftRecoveryTimeRemainingSeconds = Math.max(
      0,
      Number(previous.shiftRecoveryTimeRemainingSeconds || 0) - seconds
    );
    const transmissionDamage = clamp(Number(damage.transmission || 0), 0, 100);
    const shiftDurationSeconds = Math.max(0.03, (
      Number(tuning.shiftTimeMs || 180) + Number(tuning.shiftDelayMs || 0)
    ) / 1000 * (1 + transmissionDamage * 0.012));
    const drivenIds = (config.drivenWheelIds || this.getDrivenWheelIds(tuning))
      .filter((wheelId) => RACE_WHEEL_IDS.includes(wheelId));
    // Shaft direction matters: reverse rotation in a forward gear cannot
    // back-drive positive engine RPM. Reverse gear reverses this relationship.
    const averageSignedDrivenOmega = drivenIds.length
      ? drivenIds.reduce((sum, wheelId) => (
        sum + Number(kinematicsByWheel[wheelId]?.wheelAngularVelocityRadps || 0)
      ), 0) / drivenIds.length
      : 0;
    if (!electric && controls.assists?.autoShift === true && requestedGear > 0 && gear > 0
      && shiftTimeRemainingSeconds <= 0) {
      const ratios = Array.isArray(tuning.gearRatios) ? tuning.gearRatios : [];
      const finalDriveForShift = Math.max(0.1, Math.abs(Number(
        tuning.gearFinalDrive ?? tuning.finalDrive ?? 1
      )));
      const projectedRpm = (candidateGear) => {
        const ratio = Math.abs(Number(this.getGearRatio(tuning, candidateGear, ratios)) || 0);
        return Math.max(0, averageSignedDrivenOmega) * ratio * finalDriveForShift * 60 / (Math.PI * 2);
      };
      const rollingContacts = drivenIds.filter(id=>Number.isFinite(kinematicsByWheel[id]?.longitudinalVelocityMps));
      const groundOmega = rollingContacts.length ? rollingContacts.reduce((sum,id)=>{
        const wheel=kinematicsByWheel[id];
        const radius=Math.max(.1,Number(wheel.effectiveRollingRadiusM??config.wheelRadiusM??tuning.wheelRadiusM)||.33);
        return sum+Math.max(0,wheel.longitudinalVelocityMps)/radius;
      },0)/rollingContacts.length : null;
      const roadRpm = groundOmega==null ? null : groundOmega
        * Math.abs(Number(this.getGearRatio(tuning,gear))||0)*finalDriveForShift*60/(Math.PI*2);
      const currentRpm = Number(previous.engineRpm ?? state.engineRpm ?? idleRpm);
      const upshiftRpm = this.getAutomaticUpshiftRpm(tuning, idleRpm, maxRpm);
      const downshiftRpm = this.getAutomaticDownshiftRpm(tuning, idleRpm, maxRpm);
      const throttle = clamp(Number(controls.throttle || 0), 0, 1);
      const brake = clamp(Number(controls.brake || 0), 0, 1);
      // Converter slip can keep engine RPM high after the car slows to a stop.
      // Use shaft speed as well so an automatic cannot remain stuck in a tall
      // gear. The lower-gear RPM guard still prevents wheelspin over-rev shifts.
      const converterRpmScale = 1 + clamp(Number(tuning.torqueConverterSlip || 0), 0, 0.35) * throttle;
      // Compare shift thresholds in engine RPM, including the same loaded
      // converter slip as the RPM model. Bare shaft RPM can never reach the
      // old upshift threshold once the engine hits its limiter with slip.
      const projectedEngineRpm = candidateGear => projectedRpm(candidateGear) * converterRpmScale;
      const downshiftReferenceRpm = Math.min(currentRpm, projectedEngineRpm(gear));
      // Demand a lower gear under acceleration before the engine starts lugging.
      // Leave headroom below the upshift point so the new gear is sustainable.
      const kickdownDemand = clamp((throttle - 0.45) / 0.55, 0, 1);
      const demandDownshiftRpm = downshiftRpm
        + (Math.max(downshiftRpm, upshiftRpm * 0.72) - downshiftRpm) * kickdownDemand;
      const lowerGearRpm = projectedEngineRpm(gear - 1);
      const safeLowerGearRpm = Math.min(maxRpm * 0.94, upshiftRpm - 300);
      // Engine flare through an unlocked converter is not road speed. Using
      // engine RPM alone here fights shaft-based kickdown under steady load.
      // Both directions must agree on shaft speed, with a 300 RPM gap.
      if (shiftRecoveryTimeRemainingSeconds > 0) {
        requestedGear = gear;
      } else if (gear < ratios.length && currentRpm >= upshiftRpm
        && projectedEngineRpm(gear) >= upshiftRpm
        && (roadRpm==null || roadRpm * converterRpmScale >= upshiftRpm * .85)
        && projectedRpm(gear + 1) >= idleRpm * (1.15 + throttle * 0.25)) {
        requestedGear = gear + 1;
      } else if (gear > 1
        && (downshiftReferenceRpm <= demandDownshiftRpm || brake > 0.2)
        && lowerGearRpm <= safeLowerGearRpm) {
        requestedGear = gear - 1;
      } else {
        requestedGear = gear;
      }
    }
    if (electric) {
      gear = requestedGear; targetGear = requestedGear;
      shiftTimeRemainingSeconds = 0; shiftRecoveryTimeRemainingSeconds = 0;
    }
    if (requestedGear !== targetGear && shiftTimeRemainingSeconds <= 0) {
      targetGear = requestedGear;
      shiftTimeRemainingSeconds = shiftDurationSeconds;
      shiftRecoveryTimeRemainingSeconds = 0;
    }
    let shiftTorqueScale = 1;
    if (shiftTimeRemainingSeconds > 0) {
      const shiftProgress = clamp(1 - shiftTimeRemainingSeconds / shiftDurationSeconds, 0, 1);
      if (shiftProgress >= 0.5) gear = targetGear;
      // Physical clutch/torque interruption. The smooth end ramps avoid an
      // instantaneous ratio swap under full transmitted torque.
      shiftTorqueScale = shiftProgress < 0.2
        ? 1 - shiftProgress / 0.2
        : shiftProgress > 0.8 ? (shiftProgress - 0.8) / 0.2 : 0;
      shiftTimeRemainingSeconds = Math.max(0, shiftTimeRemainingSeconds - seconds);
      if (shiftTimeRemainingSeconds <= 0) {
        gear = targetGear;
        shiftTorqueScale = 1;
        shiftRecoveryTimeRemainingSeconds = Math.max(
          shiftRecoveryTimeRemainingSeconds,
          Number(tuning.shiftRecoveryTimeMs ?? 160) / 1000
        );
      }
    }
    const gearRatio = Math.abs(Number(this.getGearRatio(tuning, gear, tuning.gearRatios || [])) || 0);
    const finalDrive = Math.max(0.1, Math.abs(Number(
      tuning.gearFinalDrive ?? tuning.finalDrive ?? 1
    )));
    const overallRatio = gearRatio * finalDrive;
    const coupledRpm = overallRatio > 0
      ? Math.max(0, averageSignedDrivenOmega * (gear < 0 ? -1 : 1)) * overallRatio * 60 / (Math.PI * 2)
      : idleRpm;
    const groundSpeedMps = Math.max(0, Number(state.groundSpeedMps
      ?? Math.hypot(Number(state.velocity?.x || 0), Number(state.velocity?.z || 0))) || 0);
    const launchRpm = clamp(Number(tuning.launchRpm || idleRpm), idleRpm, maxRpm);
    const launchControl = advanceRaceLaunchControl(previous.launchControl, {
      enabled:!electric && controls.assists?.launchControlEnabled === true,
      staging:controls.assists?.launchControlStaging === true,
      throttle:controls.throttle,brake:controls.brake,handbrake:controls.handbrake,
      gear,speedMps:groundSpeedMps,dt:seconds
    });
    const launchControlActive = launchControl.phase === 'launching';
    const freeRpmTarget = launchControl.phase === 'armed' ? launchRpm
      : idleRpm + (maxRpm - idleRpm) * clamp(Number(controls.throttle || 0), 0, 1);
    const driverClutchCoupling = electric ? 1 : clamp(1 - Number(controls.clutch || 0), 0, 1);
    const converterSlip = electric ? 0 : clamp(Number(tuning.torqueConverterSlip || 0), 0, 0.35);
    // A loaded converter approaches its stall RPM at zero shaft speed. Do not
    // feed previous engine flare back into coupling: that creates a stable
    // near-redline state even when the tires are barely moving.
    const throttleForConverter = clamp(Number(controls.throttle || 0), 0, 1);
    const converterStallRpm = clamp(Number(tuning.torqueConverterStallRpm
      ?? tuning.launchRpm ?? idleRpm + maxRpm * 0.25), idleRpm, maxRpm * 0.8);
    const converterRpmTarget = Math.max(
      coupledRpm * (1 + converterSlip * throttleForConverter),
      idleRpm + (converterStallRpm - idleRpm) * throttleForConverter
    );
    const converterCoupling = overallRatio > 0
      ? clamp(coupledRpm / Math.max(idleRpm, converterRpmTarget), 0.25, 1)
      : 0;
    const mechanical = state.mechanical?.config?.enabled ? state.mechanical : null;
    // Auto-shifted sequential/manual gearboxes still need clutch take-up.
    // Full engagement at zero shaft speed pinned high-strung engines at idle.
    // Use the authored launch RPM and slip the clutch; do not add engine power
    // or tire grip. Explicit manual clutch input retains authority.
    const automaticClutch = !electric && converterSlip === 0 && controls.assists?.autoShift === true
      && Math.abs(gear) === 1 && Number(controls.throttle || 0) > .02;
    const clutchTargetRpm = idleRpm + (launchRpm-idleRpm)*clamp(Number(controls.throttle)||0,0,1);
    const takeup = (automaticClutch || launchControlActive) ? clamp(coupledRpm / Math.max(idleRpm,clutchTargetRpm),.35,1) : 1;
    const launchTakeup = launchControlActive ? clamp(launchControl.elapsed/.6,0,1) : 1;
    const clutchCoupling = electric ? 1 : driverClutchCoupling * shiftTorqueScale * Math.min(takeup,launchTakeup)
      * (mechanical?.effects?.drive ?? 1);
    const rpmCoupling = clutchCoupling * (converterSlip > 0 ? converterCoupling : 1);
    const loadedRpmTarget = converterSlip > 0 ? converterRpmTarget
      : automaticClutch || launchControlActive ? Math.max(coupledRpm,clutchTargetRpm) : coupledRpm;
    const slipFreeRpmTarget = automaticClutch || launchControlActive ? clutchTargetRpm : freeRpmTarget;
    const rpmTarget = overallRatio > 0
      ? loadedRpmTarget * clutchCoupling
        + (driverClutchCoupling === 0 ? freeRpmTarget : slipFreeRpmTarget) * (1 - clutchCoupling)
      : freeRpmTarget;
    let engineRpm = clamp(Number(previous.engineRpm ?? state.engineRpm ?? idleRpm), idleRpm, maxRpm);
    // Calibrated rotational response: torque-equivalent response stays constant,
    // so a lower combined crank/flywheel inertia accelerates and decelerates RPM
    // faster. The 0.3 kg m² baseline preserves existing authored cars.
    const engineInertia = clamp(Number(tuning.engineInertiaKgM2) || 0.3, 0.05, 2);
    engineRpm += (clamp(rpmTarget, idleRpm, maxRpm) - engineRpm)
      * Math.min(1, seconds * (overallRatio > 0 ? 12 : 7.5) * 0.3 / engineInertia);
    if (electric) engineRpm = Math.min(maxRpm, Math.abs(averageSignedDrivenOmega) * tuning.electricPowertrain.reductionRatio * 60 / (2 * Math.PI));
    const limiterActive = !electric && engineRpm >= maxRpm - Math.max(40, Number(config.revLimiterDropRpm || 280) * 0.35)
      && controls.throttle > 0.05;
    const limiterPhase = Math.floor(Number(previous.limiterSequence || 0)) % 4;
    const limiterTorqueScale = limiterActive && limiterPhase < 2 ? 0 : 1;
    const engineDamage = clamp(Number(damage.engine || 0), 0, 100);
    const engineDamageScale = engineDamage >= 100 ? 0 : clamp(1 - engineDamage * 0.006, 0.25, 1);
    const transmissionEfficiency = clamp(Number(config.drivetrainEfficiency
      ?? tuning.drivetrainEfficiency ?? 0.85), 0.35, 1)
      * clamp(1 - transmissionDamage * 0.0045, 0.45, 1);
    const driveDirection = gear < 0 ? -1 : 1;
    const drivenSlip = drivenIds.length
      ? Math.max(0, ...drivenIds.map((wheelId) => {
        const wheel = kinematicsByWheel[wheelId] || {};
        // Torque opposing backward rolling is recovery/braking, not wheelspin.
        // Reverse burnouts use the opposite sign of the longitudinal slip.
        if (Number(wheel.wheelAngularVelocityRadps || 0) * driveDirection <= 0) return 0;
        return Math.max(0, Number(wheel.slipRatio || 0) * driveDirection);
      }))
      : 0;
    const handbrakeActive = Number(controls.handbrake || 0) > 0.001;
    const rearBrakeSlip = Math.max(0, ...['rl', 'rr'].map((wheelId) => {
      const wheel = kinematicsByWheel[wheelId] || {};
      const travelSign = Math.sign(Number(wheel.longitudinalVelocityMps || 0)) || 1;
      return -Number(wheel.slipRatio || 0) * travelSign;
    }));
    const handbrakeEscRecoverySlip = clamp(Number(
      tuning.handbrakeEscRecoverySlip ?? 0.08
    ), 0.02, 0.4);
    const handbrakeEscSuppressed = handbrakeActive
      || (previous.handbrakeEscSuppressed === true && rearBrakeSlip > handbrakeEscRecoverySlip);
    const tractionControlActive = !handbrakeActive
      && controls.assists?.tractionControlEnabled !== false
      && controls.throttle > 0.02
      && overallRatio > 0;
    const wheelSlipControlActive = tractionControlActive || launchControlActive;
    const targetDrivenSlip = launchControlActive
      ? clamp(Number(tuning.launchSlipTarget ?? 0.09), 0.04, 0.2)
      : clamp(Number(tuning.tractionControlSlipTarget ?? 0.12), 0.05, 0.3);
    // The brush peak moves with load and surface friction. A fixed 12% slip
    // target can be far beyond the snow peak and hold the wheels in sliding.
    const targetTractionScale = wheelSlipControlActive ? Math.min(1, ...drivenIds.map((wheelId) => {
      const wheel = kinematicsByWheel[wheelId] || {};
      if (Number(wheel.wheelAngularVelocityRadps || 0) * driveDirection <= 0) return 1;
      const peak = Number(wheel.peakLongitudinalSlipRatio);
      const target = Number.isFinite(peak) && peak > 0
        ? Math.min(targetDrivenSlip, Math.max(0.005, peak * 0.8)) : targetDrivenSlip;
      const travel = Number(wheel.longitudinalVelocityMps || 0) * driveDirection;
      const radius = Math.max(0.1, Number(wheel.effectiveRollingRadiusM || config.wheelRadiusM || .33));
      const poweredSpeed = Number(wheel.wheelAngularVelocityRadps || 0) * radius * driveDirection;
      // During rollback, torque first brakes the backward motion. Its slip
      // cannot approach the forward-driving target until travel crosses zero.
      // Still regulate actual powered wheelspin using a launch-speed reference.
      const slip = travel < 0
        ? Math.max(0, poweredSpeed) / Math.max(.5, Math.abs(travel))
        : Math.max(0, Number(wheel.slipRatio || 0) * driveDirection);
      return slip > target ? clamp(target / slip, 0.08, 1) : 1;
    })) : 1;
    const previousTractionScale = clamp(Number(previous.tractionTorqueScale ?? 1), 0.05, 1);
    const tractionRate = targetTractionScale < previousTractionScale ? 18 : 8;
    const tractionTorqueScale = wheelSlipControlActive
      ? previousTractionScale + (targetTractionScale - previousTractionScale)
        * Math.min(1, seconds * tractionRate)
      : 1;
    const launchTorqueScale = launchControlActive
      && drivenSlip > targetDrivenSlip
      && engineRpm > launchRpm
      ? clamp(1 - (engineRpm - launchRpm) / 1400, 0.22, 1)
      : 1;
    const converterTorqueMultiplier = converterSlip > 0 && overallRatio > 0
      ? 1 + (1 - converterCoupling) * clamp(Number(tuning.torqueConverterMultiplication ?? 0), 0, 1.5)
      : 1;
    const direction = gear < 0 ? -1 : gear > 0 ? 1 : 0;
    const curveTorqueNm = this.getTorqueNmAtRpm(engineRpm, tuning);
    const handbrakeCombustionScale = handbrakeActive
      ? clamp(Number(tuning.handbrakeCombustionTorqueScale ?? 0.05), 0, 0.25)
      : 1;
    const combustionTorqueNm = (electric ? 0 : curveTorqueNm) * clamp(Number(controls.throttle || 0), 0, 1)
      * engineDamageScale * limiterTorqueScale * launchTorqueScale * tractionTorqueScale
      * handbrakeCombustionScale * (mechanical?.effects?.torque ?? 1);
    const rpmRatio = clamp((engineRpm - idleRpm) / Math.max(1, maxRpm - idleRpm), 0, 1);
    const engineBrakeTorqueNm = !electric && overallRatio > 0 && groundSpeedMps > 0.65
      ? Math.max(0, Number(tuning.engineBrakeTorqueNm || curveTorqueNm * 0.185))
        * (1 - clamp(Number(controls.throttle || 0), 0, 1)) * (0.35 + rpmRatio * 0.65)
      : 0;
    const averageDrivenTravelMps = drivenIds.length
      ? drivenIds.reduce((sum, wheelId) => (
        sum + Number(kinematicsByWheel[wheelId]?.longitudinalVelocityMps || 0)
      ), 0) / drivenIds.length
      : 0;
    const travelDirection = Math.abs(averageDrivenTravelMps) > 0.1
      ? Math.sign(averageDrivenTravelMps)
      : direction;
    const awdCenterCouplingScale = handbrakeActive
      && String(tuning.drivetrain || '').toLowerCase() === 'awd'
      ? clamp(Number(tuning.handbrakeAwdCenterCouplingScale ?? 0.05), 0, 0.2)
      : 1;
    // Conservative lift-off regen only: friction braking remains unchanged.
    // Disable recovery during braking, handbrake, slip or missing contact so
    // regen cannot fight ABS. No inferred OEM regenerative calibration.
    const regenSafe = drivenIds.length > 0 && !handbrakeActive && Number(controls.brake || 0) === 0
      && drivenIds.every(id => Number(capacityByWheel[id]) > 0
        && Math.abs(Number(kinematicsByWheel[id]?.slipRatio || 0)) < .08);
    const signedOmega = drivenIds.reduce((sum, id) => sum
      + Number(kinematicsByWheel[id]?.wheelAngularVelocityRadps || 0)
        * Number(driveShareByWheel[id] || 0), 0);
    const electricStep = electric ? stepElectricPowertrain({
      config: tuning.electricPowertrain, previous: previous.electric || {},
      wheelOmegaRadps: signedOmega, direction,
      throttle: Number(controls.throttle || 0),
      regen: regenSafe ? (1 - clamp(Number(controls.throttle || 0), 0, 1))
        * clamp(Number(tuning.electricPowertrain.liftOffRegen ?? 0), 0, 1) : 0,
      torqueScale: engineDamageScale * tractionTorqueScale * handbrakeCombustionScale
        * awdCenterCouplingScale * clamp(1 - transmissionDamage * .0045, .45, 1),
      equivalentWheelInertiaKgM2: Math.max(.05, Number(config.wheelInertiaKgM2) || 1.35)
        / Math.max(.001, drivenIds.reduce((sum,id) => sum + Number(driveShareByWheel[id] || 0) ** 2, 0)),
      externalWheelAccelerationRadps2,
      dt: seconds
    }) : null;
    const wheelDriveTorqueTotalNm = electricStep ? electricStep.axleTorqueNm : (
      direction * combustionTorqueNm - travelDirection * engineBrakeTorqueNm
    ) * overallRatio * transmissionEfficiency * clutchCoupling * converterTorqueMultiplier
      * awdCenterCouplingScale;
    // Anticipate the current contact limit when traction control is enabled.
    // Feedback alone acts after a low-grip tire has already crossed its peak.
    // Preserve axle shares by reducing engine torque equally for all wheels.
    let contactTorqueScale = 1;
    if (wheelSlipControlActive && wheelDriveTorqueTotalNm * direction > 0) {
      for (const wheelId of drivenIds) {
        const share = Number(driveShareByWheel[wheelId] || 0);
        if (share <= 0) continue;
        const capacity = Number(capacityByWheel[wheelId]);
        const peak = Number(kinematicsByWheel[wheelId]?.peakLongitudinalSlipRatio);
        if (!Number.isFinite(capacity) || capacity <= 0 || !(peak > 0 && (peak < 0.08 || kinematicsByWheel[wheelId]?.snowResponseWeight > 0))) continue;
        const radius = Math.max(0.1, Number(kinematicsByWheel[wheelId]?.effectiveRollingRadiusM || config.wheelRadiusM || 0.33));
        // The broader snow response permits a smaller controller reserve.
        // This changes torque utilization, never the tire's friction limit.
        const contactReserve = kinematicsByWheel[wheelId]?.snowResponseWeight > 0 ? .95 : .9;
        contactTorqueScale = Math.min(contactTorqueScale,
          Math.max(0, capacity) * radius * contactReserve / Math.max(1e-6, Math.abs(wheelDriveTorqueTotalNm) * share));
      }
    }
    const wheelDriveTorqueNm = Object.fromEntries(RACE_WHEEL_IDS.map((wheelId) => [
      wheelId,
      drivenIds.includes(wheelId)
        ? wheelDriveTorqueTotalNm * contactTorqueScale * Number(driveShareByWheel[wheelId] || 0)
        : 0
    ]));

    const frontBias = clamp(Number(
      tuning.frontBrakeBias ?? tuning.brakeBalance ?? config.frontBrakeBias ?? 0.62
    ), 0.4, 0.85);
    const brakePressure = clamp(Number(tuning.brakePressure ?? config.brakePressure ?? 1), 0.2, 1.5);
    const serviceBrakeTorqueTotalNm = Math.max(0, Number(config.brakeForceN || 0))
      * Math.max(0.1, Number(config.wheelRadiusM || 0.33))
      * Math.pow(clamp(Number(controls.brake || 0), 0, 1), 0.82) * brakePressure;
    const handbrakeTorqueTotalNm = Math.max(0, Number(config.handbrakeForceN || 0))
      * Math.max(0.1, Number(config.wheelRadiusM || 0.33))
      * clamp(Number(controls.handbrake || 0), 0, 1);
    const requestedBrakeTorqueNm = {
      fl: serviceBrakeTorqueTotalNm * frontBias * 0.5,
      fr: serviceBrakeTorqueTotalNm * frontBias * 0.5,
      rl: serviceBrakeTorqueTotalNm * (1 - frontBias) * 0.5 + handbrakeTorqueTotalNm * 0.5,
      rr: serviceBrakeTorqueTotalNm * (1 - frontBias) * 0.5 + handbrakeTorqueTotalNm * 0.5
    };
    const stabilityEnabled = controls.assists?.stabilityControlEnabled !== false
      && !handbrakeEscSuppressed;
    const steeringAngle = Number(controls.centerSteeringAngleRad || 0);
    const requestedYawRate = groundSpeedMps * Math.tan(steeringAngle)
      / Math.max(0.5, Number(config.wheelbaseM || 2.65));
    // Lateral acceleration is speed * yaw rate. ESC cannot recover an
    // unreachable steering target by braking harder into the turn: its
    // reference must stay within the supported tires' force budget.
    const massKg = Number(config.massKg ?? tuning.weightKg);
    const lateralCapacityN = RACE_WHEEL_IDS.reduce((sum, id) => (
      sum + Math.max(0, Number(capacityByWheel[id]) || 0)
    ), 0);
    const maximumYawRate = massKg > 0 && groundSpeedMps > 0.1
      ? lateralCapacityN / (massKg * groundSpeedMps) : Infinity;
    const desiredYawRate = clamp(requestedYawRate, -maximumYawRate, maximumYawRate);
    const yawRate = Number(state.angularVelocityWorld?.y || state.yawRateRadps || 0);
    const yawError = desiredYawRate - yawRate;
    const bodySlipAngleRad = Math.atan2(
      Number(state.bodyLateralSpeedMps || 0),
      Math.max(0.5, Math.abs(Number(state.bodyLongitudinalSpeedMps || 0)))
    );
    let stabilityBrakeWheelId = null;
    let requestedStabilityBrakeTorqueNm = 0;
    let stabilityClassification = 'inactive';
    if (stabilityEnabled && groundSpeedMps > 4 && Math.abs(yawError) > 0.18) {
      const turnSign = Math.sign(steeringAngle || desiredYawRate || yawRate || 1);
      const countersteerRecovery = Math.sign(steeringAngle) !== 0
        && Math.sign(steeringAngle) !== Math.sign(yawRate)
        && Math.abs(bodySlipAngleRad) > 0.12;
      stabilityClassification = countersteerRecovery
        ? 'countersteer-recovery'
        : yawError * turnSign > 0 ? 'understeer' : 'oversteer';
      // Body +X is right and forward travel is +Z. Braking a right
      // wheel generates positive yaw; braking a left wheel generates
      // negative yaw. Choose from the requested correction, including
      // countersteer, rather than the steering direction.
      const candidates = stabilityClassification === 'understeer'
        ? (yawError > 0 ? ['rr', 'fr'] : ['rl', 'fl'])
        : (yawError > 0 ? ['fr', 'rr'] : ['fl', 'rl']);
      stabilityBrakeWheelId = candidates.reduce((best, wheelId) => (
        Number(capacityByWheel[wheelId] || 0) > Number(capacityByWheel[best] || 0)
          ? wheelId : best
      ), candidates[0]);
      requestedStabilityBrakeTorqueNm = Math.min(
        Number(capacityByWheel[stabilityBrakeWheelId] || 0) * Number(config.wheelRadiusM || 0.33) * 0.35,
        Math.abs(yawError) * 420
      );
      requestedBrakeTorqueNm[stabilityBrakeWheelId] += requestedStabilityBrakeTorqueNm;
    }
    const previousAbs = previous.absModulationByWheel || {};
    const absModulationByWheel = {};
    const absInterventionByWheel = {};
    const brakeDamageScaleByWheel = {};
    const wheelBrakeTorqueNm = {};
    RACE_WHEEL_IDS.forEach((wheelId) => {
      const wheel = kinematicsByWheel[wheelId] || {};
      const travelSign = Math.sign(Number(wheel.longitudinalVelocityMps || 0));
      const signedBrakeSlip = Math.max(0, -Number(wheel.slipRatio || 0) * travelSign);
      const rearHandbrakeWheel = handbrakeActive && (wheelId === 'rl' || wheelId === 'rr');
      // ABS releases are inappropriate at a standstill: permit brake hold.
      const absEnabled = controls.assists?.absEnabled !== false && !rearHandbrakeWheel
        && Math.abs(Number(wheel.longitudinalVelocityMps || 0)) > 1;
      const absTargetSlip = clamp(Number(tuning.absSlipTarget ?? 0.13), 0.06, 0.24);
      const targetModulation = absEnabled && signedBrakeSlip > absTargetSlip
        ? clamp(absTargetSlip / signedBrakeSlip, 0.05, 1)
        : 1;
      const previousModulation = clamp(Number(previousAbs[wheelId] ?? 1), 0.05, 1);
      const modulationRate = targetModulation < previousModulation ? 30 : 14;
      const modulation = absEnabled
        ? previousModulation + (targetModulation - previousModulation)
          * Math.min(1, seconds * modulationRate)
        : 1;
      const perWheelBrakeDamage = damage.brakes?.[wheelId];
      const brakeDamageValue = Number.isFinite(Number(perWheelBrakeDamage))
        ? Number(perWheelBrakeDamage)
        : Number.isFinite(Number(damage.brakes)) ? Number(damage.brakes) : 0;
      const damageScale = clamp(1 - brakeDamageValue / 125, 0.15, 1);
      brakeDamageScaleByWheel[wheelId] = damageScale;
      absModulationByWheel[wheelId] = modulation;
      wheelBrakeTorqueNm[wheelId] = requestedBrakeTorqueNm[wheelId] * modulation * damageScale * (mechanical?.effects?.brakes?.[wheelId] ?? 1);
      absInterventionByWheel[wheelId] = Math.max(
        0,
        requestedBrakeTorqueNm[wheelId] * damageScale - wheelBrakeTorqueNm[wheelId]
      );
    });

    const stabilityBrakeTorqueNm = stabilityBrakeWheelId
      ? requestedStabilityBrakeTorqueNm
        * Number(brakeDamageScaleByWheel[stabilityBrakeWheelId] || 0)
        * Number(absModulationByWheel[stabilityBrakeWheelId] || 0)
      : 0;
    return {
      wheelDriveTorqueNm,
      wheelBrakeTorqueNm,
      state: {
        ...(electricStep ? { electric: electricStep.state } : {}),
        engineRpm: !electric && mechanical?.engineRunning === false ? 0 : engineRpm,
        gear,
        targetGear,
        shiftTimeRemainingSeconds,
        shiftRecoveryTimeRemainingSeconds,
        shiftTorqueScale,
        clutchCoupling,
        rpmCoupling,
        revLimiterActive: limiterActive,
        limiterSequence: Number(previous.limiterSequence || 0) + (limiterActive ? 1 : 0),
        tractionTorqueScale,
        launchControl,
        handbrakeEscSuppressed,
        absModulationByWheel
      },
      telemetry: {
        ...(electricStep ? { electric: electricStep.telemetry } : {}),
        curveTorqueNm,
        combustionTorqueNm,
        engineBrakeTorqueNm,
        overallRatio,
        drivetrainEfficiency: transmissionEfficiency,
        shiftTorqueScale,
        clutchCoupling,
        rpmCoupling,
        converterTorqueMultiplier,
        revLimiterActive: limiterActive,
        tractionControlActive,
        contactTorqueScale,
        tractionTorqueScale,
        drivenSlip,
        launchControlActive,
        launchControlPhase:launchControl.phase,
        automaticClutch,
        handbrakeActive,
        handbrakeEscSuppressed,
        rearBrakeSlip,
        handbrakeEscRecoverySlip,
        handbrakeCombustionScale,
        awdCenterCouplingScale,
        absInterventionByWheel,
        requestedBrakeTorqueNm,
        wheelDriveTorqueNm: { ...wheelDriveTorqueNm },
        wheelBrakeTorqueNm: { ...wheelBrakeTorqueNm },
        appliedBrakeTorqueNm: { ...wheelBrakeTorqueNm },
        stabilityBrakeWheelId,
        stabilityClassification,
        desiredYawRate,
        yawError,
        requestedStabilityBrakeTorqueNm,
        stabilityBrakeTorqueNm
      }
    };
  }

  getEngineBrakingForce({
    tuning = {},
    gearRatio = 0,
    throttle = 0,
    speedMps = 0,
    engineRpm = tuning?.idleRpm || 900,
    drivenTractionLimit = Infinity,
    tireContactScale = 1,
    activePedalThreshold = 0.08
  } = {}) {
    const ratio = Math.abs(Number(gearRatio) || 0);
    const speed = Number(speedMps) || 0;
    const absSpeed = Math.abs(speed);
    const contact = clamp(Number(tireContactScale) || 0, 0, 1);
    const threshold = Math.max(0.001, Number(activePedalThreshold) || 0.08);
    const throttleLift = clamp((threshold * 1.8 - clamp(Number(throttle) || 0, 0, 1)) / (threshold * 1.8), 0, 1);
    if (ratio <= 0 || absSpeed < 0.65 || contact <= 0.001 || throttleLift <= 0.001) {
      return { force: 0, magnitude: 0, rawMagnitude: 0, tireLimited: false };
    }
    const idleRpm = Math.max(1, Number(tuning?.idleRpm) || 900);
    const redlineRpm = Math.max(idleRpm + 1, Number(tuning?.redlineRpm || limitOverride) || 6200);
    const rpmRatio = clamp((Number(engineRpm || idleRpm) - idleRpm) / Math.max(1, redlineRpm - idleRpm), 0, 1.15);
    const finalDrive = Math.max(0.1, Number(tuning?.finalDrive) || 1);
    const gearDragScale = clamp((ratio * finalDrive) / 11, 0.28, 1.42);
    const drivetrain = String(tuning?.drivetrain || 'rwd');
    const drivetrainDrag = 1 + (drivetrain === 'awd' ? 0.16 : drivetrain === 'fwd' ? 0.04 : 0.08);
    const mass = Math.max(450, Number(tuning?.weightKg) || 1400);
    const rawMagnitude = mass * 9.81 * (0.012 + Math.pow(rpmRatio, 1.35) * 0.115)
      * gearDragScale * drivetrainDrag * throttleLift * contact;
    const cap = Math.max(0, Number(drivenTractionLimit));
    const magnitude = Math.min(rawMagnitude, Number.isFinite(cap) ? cap * 0.58 : rawMagnitude);
    return {
      force: (speed >= 0 ? -1 : 1) * magnitude,
      magnitude,
      rawMagnitude,
      tireLimited: rawMagnitude > magnitude + 0.001
    };
  }
}
