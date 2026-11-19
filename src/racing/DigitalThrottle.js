const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const smoothstep=v=>{const t=clamp(v,0,1);return t*t*(3-2*t);};
// Limit restoration of remembered demand; ordinary pedal travel is slower.
const PEDAL_REAPPLICATION_RATE=3.5;
export const DIGITAL_THROTTLE_MODES=['off','on'];
export const DRIVING_INTENT_STYLES=['grip','rally','drift'];

// Power lifts immediately. Only pedal-position memory survives a release.
// Re-pressing resumes at the decayed position and continuously adds pedal travel.
// Ease that travel rate up instead of freezing it during each correction.
export function advanceAggressiveDigitalThrottle(previous={}, {mode='off',raw=0,legacy=0,
 analog=false,brake=0,staging=false,launchEnabled=false,dt=0,spin=0,feedbackValid=false,speedMps=0,handbrake=false,revLimiterActive=false}={}) {
 raw=clamp(Number(raw)||0,0,1);
 const seconds=clamp(Number(dt)||0,0,.1);
 if(mode==='off'||analog||staging)return {output:legacy,staging,bypassed:true,pedalPosition:legacy,wasPressed:raw>0,settleSeconds:0};
 let output=clamp(previous.output||0,0,1);
 let pedalPosition=clamp(previous.pedalPosition??output,0,1);
 let settleSeconds=Math.max(0,previous.settleSeconds||0);
 let recoveryStrength=clamp(previous.recoveryStrength||0,0,1);
 let correctionStrength=clamp(previous.correctionStrength??1,0,1);
 let reapplyDuration=Math.max(.5,previous.reapplyDuration||.5);
 const releaseSeconds=raw===0?(previous.releaseSeconds||0)+seconds:0;
 const holdSeconds=raw>0 && brake<=.1?(previous.holdSeconds||0)+seconds:0;
 const slideSeconds=handbrake?2:Math.max(0,(previous.slideSeconds||0)-seconds);
 const filteredSpin=feedbackValid?Math.max(0,previous.filteredSpin||0)+(Math.max(0,Number(spin)||0)-Math.max(0,previous.filteredSpin||0))*(1-Math.exp(-seconds/.12)):0;
 const speedBlend=clamp((Math.abs(speedMps)-2)/8,0,1);
 const slipAllowance=.25+.35*slideSeconds/2;
 const insistence=clamp((holdSeconds-1)/.5,0,1);
 // Only soften new pedal travel. Never reduce requested pedal position or
 // remember a grip ceiling. Ordinary feedback relaxes during a long hold,
 // but sustained excessive spin still slows additional travel at any speed.
 const spinSeverity=clamp((filteredSpin-slipAllowance)/.75,0,1);
 // Bridge brief limiter pulses, then ease back into pedal travel. Holding
 // cannot override this gate: only simultaneous spin + limiter can set it.
 const limiterSpinActive=feedbackValid && filteredSpin>slipAllowance
   && revLimiterActive===true && raw>0 && brake<=.1;
 const limiterHoldSeconds=raw===0 || brake>.1 || !feedbackValid ? 0
   : limiterSpinActive ? .18 : Math.max(0,(previous.limiterHoldSeconds||0)-seconds);
 const limiterResistance=raw===0 || brake>.1 || !feedbackValid ? 0 : limiterHoldSeconds>0 ? 1
   : Math.max(0,(previous.limiterResistance||0)-seconds/.25);
 let limiterPedalCeiling=previous.limiterPedalCeiling??output;
 if(limiterResistance>0 && !(previous.limiterResistance>0)){
  limiterPedalCeiling=previous.wasPressed===false ? pedalPosition : output;
 }
 // Small/brief slip keeps the existing response. Sustained excessive tread
 // speed gives the driver a wider partial-pedal window, even when sideways
 // movement makes longitudinal speed small. This cannot cut existing power.
 const spinTravelTarget=feedbackValid
   ? .65*smoothstep((filteredSpin-slipAllowance-.25)/.75) : 0;
 const spinTravelResistance=feedbackValid
   ? (previous.spinTravelResistance||0)+(spinTravelTarget-(previous.spinTravelResistance||0))
     *(1-Math.exp(-seconds/(spinTravelTarget>(previous.spinTravelResistance||0)?.12:.08))) : 0;
 const pressRate=Math.min(1-.5*speedBlend*spinSeverity*(1-insistence),
   1-spinTravelResistance)*(1-limiterResistance);
 if(previous.staging&&!launchEnabled){output=0;pedalPosition=0;settleSeconds=0;}
 if(brake>.1){output=0;pedalPosition=0;settleSeconds=0;}
 else if(raw===0){
  if(previous.wasPressed)pedalPosition=output;
  pedalPosition*=Math.exp(-seconds/.35);
  if(releaseSeconds>=1.2 || pedalPosition<.015)pedalPosition=0;
  output=0;settleSeconds=0;
 }else{
  if(previous.wasPressed===false)recoveryStrength=0;
  if(previous.wasPressed===false && pedalPosition>0){
   // Rolling corrections need a longer useful partial-pedal window. Capture
   // the duration at the press edge so changing speed cannot jump the ramp.
   // A long lift or almost-empty memory is a new acceleration request,
   // not fine adjustment of an established pedal position.
   correctionStrength=(1-smoothstep(((previous.releaseSeconds||0)-.25)/.7))
     *smoothstep((pedalPosition-.02)/.13);
   recoveryStrength=(1-speedBlend)*spinSeverity*correctionStrength;
   reapplyDuration=.5+.7*Math.max(speedBlend,recoveryStrength);
   settleSeconds=reapplyDuration;
  }
  const easedTime=Math.min(seconds,settleSeconds);
  const remaining=Math.max(0,settleSeconds-seconds);
  // Integrate the easing rate over this step (20% -> 100%),
  // including any time after easing ends, so frame rate does not alter travel.
  const easedTravel=easedTime*(1-.8*correctionStrength*(settleSeconds+remaining)/(2*reapplyDuration));
  settleSeconds=remaining;
  // Avoid storing undelivered pedal travel while already on the limiter.
  // Preserve decayed reapplication memory, but never bank new travel.
  if(limiterResistance>0)pedalPosition=Math.min(pedalPosition,Math.max(output,limiterPedalCeiling));
  pedalPosition=Math.min(raw,pedalPosition+(seconds-easedTime+easedTravel)*pressRate);
  // Restore a high remembered position over roughly 0.2–0.3 seconds,
  // rather than snapping back within 80ms. Release still cuts immediately.
  output=Math.min(pedalPosition,output+seconds*(PEDAL_REAPPLICATION_RATE-1.5*recoveryStrength*(1-insistence)));
 }
 return {output,staging:false,bypassed:false,responseProfile:'pedal-spin-travel-v10',
  pedalPosition,settleSeconds,reapplyDuration,correctionStrength,recoveryStrength,limiterResistance,limiterHoldSeconds,limiterPedalCeiling,releaseSeconds,holdSeconds,filteredSpin,spinTravelResistance,slideSeconds,pressRate,slipAllowance,wasPressed:raw>0 && brake<=.1};
}

// Two distinct presses within 300ms select aggressive throttle for that hold.
// No delay on the first press. Release/brake/bypass always end the aggressive hold.
export function advanceDigitalThrottle(previous={},input={}) {
 const dt=clamp(Number(input.dt)||0,0,.1);
 const pressed=Number(input.raw)>0 && !(Number(input.brake)>.1);
 const bypass=input.mode!=='on'||input.analog||input.staging;
 let tapAge=Number.isFinite(previous.tapAge)?previous.tapAge+dt:null;
 let aggressiveHold=pressed&&previous.aggressiveHold===true;
 if(!pressed||bypass)aggressiveHold=false;
 if(pressed&&!previous.gesturePressed&&!bypass){
  aggressiveHold=tapAge!==null&&tapAge<=.3;
  tapAge=aggressiveHold?null:0;
 }
 if(tapAge!==null&&tapAge>.3)tapAge=null;
 if(bypass||Number(input.brake)>.1)tapAge=null;
 const next=advanceAggressiveDigitalThrottle(previous,input);
 // Feedback uses supported driven wheels and a low-speed-safe tread-speed
 // metric. Allow useful slip instead of chasing a mathematically locked tire.
 // Ordinary holds should permit some wheelspin, rather than acting like
 // another tight traction-control loop. Keep the tire-derived allowance,
 // with a modest extra margin for deliberate digital-pedal driving.
 const allowance=clamp((Number(input.throttleSlipAllowance)||.16)+.04,.16,.34);
 const tractionValid=input.throttleFeedbackValid??input.feedbackValid;
 const measuredSpin=Math.max(0,Number(input.spin)||0);
 const oldSpin=Math.max(0,previous.tractionFilteredSpin||0);
 const tractionFilteredSpin=tractionValid?oldSpin+(measuredSpin-oldSpin)
  *(1-Math.exp(-dt/(measuredSpin>oldSpin?.07:.035))):0;
 const excess=Math.max(0,tractionFilteredSpin-allowance);
 const engineRpm=Number(input.engineRpm),maxRpm=Number(input.maxRpm);
 const rpmValid=Number.isFinite(engineRpm)&&engineRpm>0
  &&Number.isFinite(maxRpm)&&maxRpm>=1000&&Number.isFinite(input.gear)&&input.gear!==0;
 const rpmTarget=rpmValid?maxRpm*.5:0;
 // A soft engine-speed target, not a fixed minimum pedal. Below half redline,
 // progressively return authority to the driver's existing ramp. Severe wheel
 // overspeed, shifting, and the limiter still retain their protection. Fade
 // recovery out as delivered pedal rises from 15% to 35%; low RPM alone must
 // not keep adding power through an already powered slide. Sideways slip
 // also fades recovery out between about 2 and 7 degrees of body slip.
 const lateralSlip=Math.abs(Math.atan2(Number(input.lateralSpeedMps)||0,Math.max(2,Math.abs(Number(input.speedMps)||0))));
 const rpmRecovery=!bypass&&pressed&&!aggressiveHold&&tractionValid&&rpmValid
  &&!input.shifting&&!input.revLimiterActive
  ?smoothstep((.5-engineRpm/maxRpm)/.12)*(1-smoothstep((excess-.5)/1.5))
   *(1-smoothstep((Math.max(0,Number(previous.output)||0)-.15)/.2))
   *(1-smoothstep((lateralSlip-.03)/.09)):0;
 // Once wheelspin is falling, let the existing cut take effect instead of
 // repeatedly digging the pedal lower. Hold delivered demand; do not add
 // power merely because slip is recovering, including during a deliberate slide.
 const spinFallRate=dt>0?(oldSpin-tractionFilteredSpin)/dt:0;
 const settlingRelief=!bypass&&pressed&&!aggressiveHold&&tractionValid
  &&!input.revLimiterActive&&!(next.limiterResistance>0)
  ?smoothstep((spinFallRate-.15)/.75)*(1-smoothstep((excess-.8)/1.2)):0;
 if(!bypass&&pressed&&!aggressiveHold&&tractionValid&&excess>0){
  // Reduce delivered demand, not just its rate of growth. Remember only what
  // was delivered so grip recovery cannot dump accumulated throttle at once.
  // Soften ordinary corrections, retaining firm relief for runaway spin.
  const reliefGain=1+.5*smoothstep((excess-.35)/.65);
  const reduction=1-Math.exp(-dt*Math.min(2.5,excess*reliefGain));
  const reduced=Math.min(next.output,Math.max(0,Number(previous.output)||0)*(1-reduction*(1-settlingRelief)));
  // Blend in relief over a slip band: crossing the threshold must not
  // abruptly switch a rising pedal into a held/cutting pedal.
  // Preserve the core ramp near zero: multiplying a released (zero)
  // pedal by relief must not trap the next press at zero. Fade this
  // restart allowance out by 8% delivered pedal; limiter still caps next.output.
  const cutAuthority=smoothstep(Math.max(0,Number(previous.output)||0)/.08);
  next.output+=(reduced-next.output)*smoothstep(excess/.12)*(1-rpmRecovery)*cutAuthority;
  next.pedalPosition=next.output;
 }
 return {...next,responseProfile:bypass?next.responseProfile:'pedal-reapply-direction-v15',
  throttleStyle:aggressiveHold?'aggressive':'traction',aggressiveHold,
  gesturePressed:!bypass&&pressed,tapAge,tractionFilteredSpin,tractionSlipAllowance:allowance,rpmTarget,rpmRecovery,spinFallRate,settlingRelief};
}

// Advisory classification only. Countersteering/sideways motion alone never
// establishes deliberate drift intent. Hysteresis avoids rapidly flashing labels.
export function observeDrivingIntent(previous={}, {throttle=0,brake=0,handbrake=0,
 steering=0,longitudinalSpeed=0,lateralSpeed=0,yawRate=0,style='rally',dt=0,staging=false}={}) {
 const seconds=clamp(Number(dt)||0,0,.1);
 const handbrakeAge=handbrake>.1?0:Math.min(10,(previous.handbrakeAge??10)+seconds);
 const beta=Math.atan2(lateralSpeed,Math.max(2,Math.abs(longitudinalSpeed)));
 const angle=Math.abs(beta);
 const growing=angle-(previous.angle??angle) > seconds*.12;
 const threshold=style==='grip'?.07:style==='drift'?.15:.1;
 let candidate='Coasting',confidence=.8;
 if(staging||Math.abs(longitudinalSpeed)<2){candidate='Starting';confidence=1;}
 else if(angle>threshold){
  if(throttle<.1||brake>.15||(growing&&angle>.35)){candidate='Recovery';confidence=.8;}
  else if(handbrakeAge<2 && Math.abs(steering)>.08 && !growing){candidate='Slide likely';confidence=.75;}
  else {candidate='Uncertain slide';confidence=.35;}
 }else if(brake>.15){candidate='Braking';confidence=.95;}
 else if(Math.abs(steering)>.12||Math.abs(yawRate)>.12){candidate='Cornering';confidence=.8;}
 else if(throttle>.1){candidate='Accelerating';confidence=.9;}
 const candidateSeconds=previous.candidate===candidate?(previous.candidateSeconds||0)+seconds:seconds;
 const confirmed=candidateSeconds>=.15||!previous.label;
 return {label:confirmed?candidate:previous.label,confidence:confirmed?confidence:previous.confidence,
   candidate,candidateSeconds,angle,handbrakeAge,style};
}
