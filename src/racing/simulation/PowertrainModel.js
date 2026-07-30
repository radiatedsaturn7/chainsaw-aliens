import { RACE_WHEEL_IDS, clamp } from './SimulationMath.js';

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

  getGearRatio(tuning = {}, gear = 1) {
    if (gear < 0) return tuning.reverseRatio;
    if (gear <= 0) return 0;
    return tuning.gearRatios[clamp(gear - 1, 0, tuning.gearRatios.length - 1)]
      || tuning.gearRatios[tuning.gearRatios.length - 1]
      || 1;
  }

  getTorqueNmAtRpm(rpm, tuning = {}) {
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

  getAutomaticUpshiftRpm(tuning = {}) {
    const idleRpm = Math.max(500, Number(tuning?.idleRpm) || 850);
    const redlineRpm = Math.max(idleRpm + 500, Number(tuning?.redlineRpm || tuning?.revLimitRpm) || 6200);
    const revLimitRpm = Math.max(redlineRpm, Number(tuning?.revLimitRpm || redlineRpm) || redlineRpm);
    const configured = Number(tuning?.autoUpshiftRpm);
    const preferred = Number.isFinite(configured) && configured > 0 ? configured : redlineRpm * 0.94;
    const upper = Math.max(idleRpm + 500, Math.min(redlineRpm * 0.985, revLimitRpm - 120));
    return clamp(preferred, idleRpm + 500, upper);
  }

  getAutomaticDownshiftRpm(tuning = {}) {
    const idleRpm = Math.max(500, Number(tuning?.idleRpm) || 850);
    const upshiftRpm = this.getAutomaticUpshiftRpm(tuning);
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
    const redlineRpm = Math.max(idleRpm + 1, Number(tuning?.redlineRpm || tuning?.revLimitRpm) || 6200);
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
