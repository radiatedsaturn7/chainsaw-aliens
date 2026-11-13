const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const DIGITAL_THROTTLE_MODES=['off','progressive','adaptive'];
export const DRIVING_INTENT_STYLES=['grip','rally','drift'];

// Pedal translation only: no tire slip, friction, racing line or intent labels
// enter this function. Held input always reaches 100%; TC remains independent.
export function advanceDigitalThrottle(previous={}, {mode='off',raw=0,legacy=0,
 analog=false,brake=0,staging=false,launchEnabled=false,dt=0,tuning={},gear=1}={}) {
 raw=clamp(Number(raw)||0,0,1);
 const seconds=clamp(Number(dt)||0,0,.1);
 if(mode==='off'||analog||staging)return {output:legacy,staging,bypassed:true,riseSeconds:0};
 const ratio=gear<0 ? Number(tuning.reverseRatio)||3 : gear>0 ? Number(tuning.gearRatios?.[gear-1])||1 : 0;
 const wheelForce=(Number(tuning.torqueLbFt)||200)*1.35582*ratio*(Number(tuning.finalDrive??tuning.gearFinalDrive)||4)
   *clamp(Number(tuning.drivetrainEfficiency)||.85,.35,1)/Math.max(.1,Number(tuning.wheelRadiusM)||.33);
 const potentialG=wheelForce/(Math.max(100,Number(tuning.weightKg)||1450)*9.81);
 const riseSeconds=mode==='adaptive'?clamp(.3+.25*potentialG,.4,1.2):.65;
 let output=clamp(Number(previous.output)||0,0,1);
 if(previous.staging&&!launchEnabled)output=0;
 if(brake>.1)output=0;
 else if(raw>output)output=Math.min(raw,output+seconds/riseSeconds);
 else output=Math.max(raw,output-seconds*10);
 return {output,staging:false,bypassed:false,riseSeconds};
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
