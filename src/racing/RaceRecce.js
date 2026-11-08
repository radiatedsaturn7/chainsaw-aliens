// WRC-style vocabulary; thresholds below are our reference-car calibration,
// not claimed to be WRC Generations' proprietary note-generation algorithm.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
const DEG=180/Math.PI;
export const RECCE_VERSION='steering-recce-v3';
export function steeringSeverity(steerDegrees) {
  return steerDegrees < .65 ? 6 : steerDegrees < 1.25 ? 5 : steerDegrees < 2.3 ? 4 : steerDegrees < 4 ? 3 : steerDegrees < 7 ? 2 : 1;
}

export function analyzeRaceRecce(editor) {
  return editor.withRaceGeometryReadCache ? editor.withRaceGeometryReadCache(()=>buildRecce(editor)) : buildRecce(editor);
}

function buildRecce(editor) {
  const length=Math.max(1,Number(editor.getRaceRouteLength())||1);
  const count=Math.ceil(length/4)+1;
  if(count>131072)return [];
  const step=length/(count-1),runtimeType=editor.getSelectedRaceRuntimeType(),circuit=runtimeType==='circuit';
  const roadbed=editor.getRaceRoadbedProfile?.({runtimeType});
  const poses=Array.from({length:count},(_,i)=>{
    const pose=editor.getRaceWorldPoseAtDistance(i*step,{runtimeType});
    const deck=roadbed?editor.sampleRaceRoadbedProfileAtDistance(i*step,roadbed):null;
    return Number.isFinite(deck?.elevation)?{...pose,elevation:deck.elevation}:pose;
  });
  const tuning=editor.getRaceCarTuning?.(editor.selectedCar)||{};
  const wheelbase=clamp(Number(tuning.wheelbaseM)||2.65,1.8,4);
  const mass=Math.max(450,Number(tuning.weightKg)||1200);
  const powerW=Math.max(50,Number(tuning.powerHp)||200)*745.7*.8;
  const accelerationAt=speed=>clamp(powerW/(mass*Math.max(12,speed)),.5,4);
  const decel=Math.min(5.2,Number(tuning.brakeForceN)>0? tuning.brakeForceN/Math.max(450,Number(tuning.weightKg)||1200):5.2);
  const at=i=>poses[circuit?((i%(count-1))+(count-1))%(count-1):clamp(i,0,count-1)];
  const signed=[],speed=[],grade=[];
  for(let i=0;i<count;i++) {
    // A 16 m steering observation rejects isolated GPS heading spikes while
    // preserving an S-bend's change of sign. Never classify from one peak.
    let turn=0,span=0;
    for(let j=-2;j<2;j++) {
      if(!circuit&&(i+j<0||i+j+1>=count))continue;
      turn+=angle(at(i+j+1).yaw-at(i+j).yaw);span+=step;
    }
    signed[i]=turn/Math.max(step,span);
    grade[i]=((at(i+1).elevation||0)-(at(i-1).elevation||0))*12/(2*step);
    speed[i]=Math.min(55,Math.sqrt(6/Math.max(.0001,Math.abs(signed[i]))));
  }
  // Virtual recce: cornering demand, backward braking envelope, then forward
  // acceleration. Keep geometry grades stable; weather/live grip affects the
  // driving guide rather than renumbering familiar corners mid-race.
  const limit=[...speed];
  for(let pass=0;pass<(circuit?2:1);pass++){
    if(circuit)speed[count-1]=speed[0];
    for(let i=count-2;i>=0;i--)speed[i]=Math.min(speed[i],Math.sqrt(speed[i+1]**2+2*Math.max(1,decel+9.81*grade[i])*step));
  }
  if(!circuit)speed[0]=Math.min(speed[0],12);
  for(let pass=0;pass<(circuit?2:1);pass++){
    if(circuit)speed[0]=Math.min(speed[0],Math.sqrt(speed[count-2]**2+2*accelerationAt(speed[count-2])*step));
    for(let i=1;i<count;i++)speed[i]=Math.min(speed[i],Math.sqrt(speed[i-1]**2+2*Math.max(.5,accelerationAt(speed[i-1])-9.81*grade[i])*step));
  }
  const observations=poses.map((p,i)=>({at:i*step,pose:p,curvature:signed[i],
    steeringDeg:Math.atan(wheelbase*signed[i])*DEG,speedMps:speed[i],limitMps:limit[i],
    accelerationMps2:i?(speed[i]**2-speed[i-1]**2)/(2*step):0}));
  const groups=[];let group=null;
  const flush=()=>{if(group){groups.push(group);group=null;}};
  for(let i=0;i<count;i++) {
    const k=signed[i],sign=Math.sign(k);
    if(Math.abs(k)>=.0015) {
      if(group&&(group.sign!==sign||i-group.end>4))flush();
      group ||= {start:i,end:i,sign};group.end=i;
    } else if(group&&i-group.end>4)flush();
  }
  flush();
  // Combine a single turn that crosses a circuit's start/finish line.
  if(circuit&&groups.length>1&&groups[0].start<4&&groups.at(-1).end>count-5&&groups[0].sign===groups.at(-1).sign){
    const first=groups.shift();groups.at(-1).end=first.end+count-1;
  }
  const obs=i=>observations[((i%(count-1))+(count-1))%(count-1)];
  const scenery=(editor.selectedRace?.scenery||[]).filter(s=>s&&s.visible!==false&&(s.presetId==='doodad'||s.doodadRef||s.previewDoodad));
  const hazards=scenery.map(s=>({sprite:s,definition:editor.getRaceDoodadForScenery?.(s)||s.previewDoodad||s}));
  const calls=[];
  for(const g of groups) {
    const samples=[];for(let i=g.start;i<=g.end;i++)samples.push(i<count?observations[i]:obs(i));
    const totalAngle=samples.reduce((sum,s)=>sum+Math.abs(s.curvature)*step,0)*DEG;
    if(totalAngle<10)continue;
    const ordered=samples.map(s=>Math.abs(s.steeringDeg)).sort((a,b)=>a-b);
    const demand=ordered[Math.floor((ordered.length-1)*.8)];
    const severity=steeringSeverity(demand);
    const apexCandidates=samples.filter(s=>Math.abs(s.steeringDeg)>=demand*.9);
    const apex=apexCandidates[Math.floor(apexCandidates.length/2)];
    const span=(g.end-g.start)*step;
    const shape=totalAngle>=150&&demand>=2.3?'Hairpin':totalAngle>=75&&totalAngle<=110&&span<65&&demand>=4?'Square':null;
    // With Three's +Y up and forward +Z, increasing yaw bends screen-left.
    const direction=g.sign>0?'Left':'Right';
    const modifiers=[];
    if(span>=100)modifiers.push('long');
    const third=Math.max(1,Math.floor(samples.length/3));
    const mean=values=>values.reduce((s,v)=>s+Math.abs(v.steeringDeg),0)/values.length;
    const entry=mean(samples.slice(0,third)),exit=mean(samples.slice(-third));
    if(exit>entry*1.5&&exit-entry>.7)modifiers.push(steeringSeverity(exit)<severity?`tightens ${steeringSeverity(exit)}`:'tightens');
    else if(entry>exit*1.5&&entry-exit>.7)modifiers.push('opens');
    // Inspect only the inside cutting corridor near the apex, accounting for
    // object width; an outside tree, distant building or harmless grass is not
    // evidence for "don't cut". Do not invent a safe "cut" from missing data.
    const hazardIds=[];
    for(const {sprite:s,definition:def} of hazards) {
      const rule=def.defaultRule||{};
      if(rule.behavior==='flatten'&&Number(rule.speedDrainPercent||0)<=0&&!Object.values(rule.damage||{}).some(v=>v>0))continue;
      const p=apex.pose,dx=Number(s.x)-p.x,dz=Number(s.z??s.y)-p.z;
      const along=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw);
      const lateral=(dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw))*g.sign;
      const half=Math.max(.1,Number(def.hitboxWidthM||def.widthM||s.widthM)||1.5)/2;
      const roadHalf=editor.getRaceRoadHalfWidthWorld(p.segment);
      if(Math.abs(along)<=Math.min(20,Math.max(8,span*.25))+half&&lateral>0&&lateral+half>=roadHalf-1.5&&lateral-half<=roadHalf+4)
        hazardIds.push(String(s.id||s.doodadRef||'apex obstacle'));
    }
    if(hazardIds.length)modifiers.push("don't cut");
    const start=samples[0].at,approach=observations[Math.max(0,g.start-Math.ceil(80/step))];
    const minSpeed=samples.reduce((v,s)=>Math.min(v,s.speedMps),Infinity);
    const braking=samples[0].speedMps>minSpeed+4||approach.speedMps>minSpeed+6;
    const body=`${shape?`${shape} ${direction.toLowerCase()}`:`${direction} ${severity}`}${modifiers.length?' '+modifiers.join(', '):''}`;
    calls.push({at:Math.round(start),endAt:Math.round(circuit?(g.end*step)%length:g.end*step),apexAt:Math.round(apex.at),direction,severity,shape,
      modifiers,hazardIds,body,text:body,generated:RECCE_VERSION,
      recce:{steeringDeg:Number(demand.toFixed(2)),turnDegrees:Math.round(totalAngle),entrySpeedMps:Number(samples[0].speedMps.toFixed(1)),
        apexSpeedMps:Number(apex.speedMps.toFixed(1)),minimumSpeedMps:Number(minSpeed.toFixed(1)),exitSpeedMps:Number(samples.at(-1).speedMps.toFixed(1)),
        braking,peakBrakingMps2:Number(observations.slice(Math.max(0,g.start-30),Math.min(count,g.end+1)).reduce((v,s)=>Math.max(v,-s.accelerationMps2),0).toFixed(2)),exitAccelerationMps2:Number(samples.at(-1).accelerationMps2.toFixed(2)),wheelbaseM:wheelbase},spanM:span});
  }
  let lastVertical=-Infinity;
  for(let i=5;i<count-5;i++) {
    const incoming=((at(i).elevation||0)-(at(i-5).elevation||0))*12/(5*step);
    const outgoing=((at(i+5).elevation||0)-(at(i).elevation||0))*12/(5*step);
    const feature=incoming>.06&&outgoing<-.06?'Crest':incoming<-.06&&outgoing>.06?'Dip':null;
    if(!feature||i*step-lastVertical<60)continue;
    lastVertical=i*step;
    const turn=calls.find(c=>i*step>=c.at-15&&i*step<=c.at+c.spanM+15);
    if(turn){turn.modifiers.push(`over ${feature.toLowerCase()}`);turn.body+=`, over ${feature.toLowerCase()}`;turn.text+=`, over ${feature.toLowerCase()}`;}
    else calls.push({at:Math.round(i*step),endAt:Math.round(i*step),spanM:0,body:feature,text:feature,kind:feature.toLowerCase(),generated:RECCE_VERSION});
  }
  calls.sort((a,b)=>a.at-b.at);
  for(let i=0;i<calls.length;i++) {
    const next=calls[i+1]||(circuit?calls[0]:null);if(!next||next===calls[i])continue;
    const gap=((next.at-(calls[i].at+calls[i].spanM))%length+length)%length;
    calls[i].distanceToNextM=Math.round(gap/10)*10;
    if(gap<50){calls[i].link=gap<20?'into':'and';calls[i].text+=`, ${calls[i].link} ${next.body}`;calls[i].linkedAt=next.at;}
  }
  return calls;
}
