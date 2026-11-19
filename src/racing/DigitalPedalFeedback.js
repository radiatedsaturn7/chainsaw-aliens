// Feedback changes driver pedal demand only; tire forces and ABS/TC are untouched.
export function digitalPedalFeedback(chassis = {}, tuning = {}) {
 const speed = Number(chassis.bodyLongitudinalSpeedMps) || 0;
 const direction = Math.sign(speed) || 1;
 // Powered slip follows the engaged gear, even when momentum carries the
 // car backward. Braking slip still follows actual travel direction.
 const gear=Number(chassis.gear ?? chassis.powertrainState?.gear);
 const driveDirection=Number.isFinite(gear)&&gear!==0?Math.sign(gear):direction;
 let spin = 0, lock = 0, contacts = 0, brakeLoad = 0, weightedLock = 0;
 let frontLoad = 0, rearLoad = 0, frontLockSum = 0, rearLockSum = 0;
 let rearContacts = 0, rearPairLock = 1;
 let controlLockSum=0, rearPairControlLock=1, peakSlipSum=0;
 let drivenLoad=0, drivenPeakSum=0;
 for (const id of ['fl','fr','rl','rr']) {
  const p = chassis.contactPatches?.[id];
  if (!p || p.validTreadContact === false || !(Number(p.normalLoadN) > 100)) continue;
  const slip = Number(p.rawSlipRatio ?? p.slipRatio);
  if (!Number.isFinite(slip)) continue;
  contacts++;
  lock = Math.max(lock, -slip * direction);
  const load = Number(p.normalLoadN);
  brakeLoad += load;
  const weightedSlip = load * Math.max(0, Math.min(1, -slip * direction));
  weightedLock += weightedSlip;
  // The production tire model reports different peak slip on loose surfaces.
  // Normalize only the pedal feedback, never the tire forces or diagnostic slip.
  const peak=Number(p.peakLongitudinalSlipRatio);
  peakSlipSum+=load*(Number.isFinite(peak)&&peak>0?Math.max(.03,Math.min(.3,peak)):.18);
  const scale=Number.isFinite(peak)&&peak>0 ? Math.max(1,.18/Math.max(.03,peak)) : 1;
  const controlLock=Math.max(0,Math.min(1,-slip*direction*scale));
  controlLockSum+=load*controlLock;
  if(id[0]==='r')rearPairControlLock=Math.min(rearPairControlLock,controlLock);
  if (id[0] === 'f') { frontLoad += load; frontLockSum += weightedSlip; }
  else { rearLoad += load; rearLockSum += weightedSlip; rearContacts++;
   rearPairLock = Math.min(rearPairLock, Math.max(0, Math.min(1, -slip * direction))); }
  const driven = tuning.drivetrain === 'fwd' ? id[0] === 'f' : tuning.drivetrain === 'rwd' ? id[0] === 'r' : true;
  if (driven) {
   drivenLoad+=load;
   drivenPeakSum+=load*(Number.isFinite(peak)&&peak>0?peak:.18);
   // At low speed, use excess tread speed with a smooth 3 m/s reference.
   // Raw slip ratios become very large near a stop and while moving sideways.
   const longitudinal=Number(p.longitudinalVelocityMps ?? speed);
   const omega=Number(p.wheelAngularVelocityRadps ?? chassis.wheelAngularVelocityRadps?.[id]);
   const radius=Number(p.effectiveRollingRadiusM ?? tuning.wheelRadiusM);
   const reference=Math.hypot(longitudinal,3);
   const excess=Number.isFinite(omega) && radius>0
     ? (omega*radius-longitudinal)*driveDirection/reference
     : slip*driveDirection*Math.abs(longitudinal)/reference;
   spin=Math.max(spin,excess);
  }
 }
 // Normalize within each axle so braking weight transfer cannot hide both
 // rear wheels locking. An almost unsupported axle should not dominate.
 const supportReference = Math.max(1, brakeLoad * .15);
 const frontBrakeLock = frontLockSum / Math.max(frontLoad, supportReference);
 const rearBrakeLock = rearLockSum / Math.max(rearLoad, supportReference);
 // Activate normalization only when the supported tires collectively have a
 // narrow peak-slip range. Otherwise an unloaded rear tire can overrule the
 // useful front braking force on dry pavement.
 const brakePeakSlip=brakeLoad>0?peakSlipSum/brakeLoad:.18;
 const looseBlend=Math.max(0,Math.min(1,(.12-brakePeakSlip)/.04));
 const rawBrakeLock=brakeLoad>0?weightedLock/brakeLoad:0;
 const normalizedLock=brakeLoad>0?controlLockSum/brakeLoad:0;
 const brakeControlLock=rawBrakeLock+(normalizedLock-rawBrakeLock)*looseBlend;
 const rearControl=rearPairLock+(rearPairControlLock-rearPairLock)*looseBlend;
 return {throttleFeedbackValid:drivenLoad>0,throttleSlipAllowance:Math.max(.12,Math.min(.3,drivenLoad>0?drivenPeakSum/drivenLoad:.18)),brakePeakSlip,brakeControlLock,rearPairControlLock:rearContacts===2?rearControl:0,spin,lock,frontBrakeLock,rearBrakeLock,rearPairLock:rearContacts===2?rearPairLock:0,brakeLock:brakeLoad>0?weightedLock/brakeLoad:0,feedbackValid:contacts > 0, brakeFeedbackValid:contacts > 0 && Math.abs(speed) > 1.5};
}
