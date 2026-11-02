import {rotateVectorByQuaternion} from './simulation/RigidBodyMath.js';
// Session-local placement history, not a vehicle/save rewind. Damage, fuel,
// elapsed race time and inventory remain authoritative during recovery.
const histories = new WeakMap();
export function recordRaceRecoveryPosition(editor, session, state, upDot, seconds) {
  if (!(Number(seconds) > 0)) return;
  let history = histories.get(session);
  if (!history) histories.set(session, history = {time:0, next:0, samples:[], accepted:0, rejected:{}, lastRejection:null, selection:null});
  history.time += Math.max(0, Number(seconds) || 0);

  if (history.time < history.next) return;
  if (!Number.isFinite(upDot) || upDot < .8) return rejectHistory(history, 'not-upright');
  if (state?.grounded !== true) return rejectHistory(history, 'not-grounded');
  if (state.supportedWheelCount != null && Number(state.supportedWheelCount) !== 4)
    return rejectHistory(history, 'wheel-support');
  if (session.pendingEdgeCenterReset) return rejectHistory(history, 'reset-pending');
  history.next = history.time + .25;
  const model=editor.getRaceSurfaceModel?.();
  if (!model?.samplePhysicsGeometry || !state.orientation) return rejectHistory(history, 'geometry-unavailable');
  const lateral=rotateVectorByQuaternion({x:1,y:0,z:0},state.orientation);
  const context={runtimeType:session.routeRuntimeType};
  // Support on grass, shoulders or a lower deck does not qualify. Verify the
  // whole loaded tire width against the authoritative road surface, at contact
  // height, rather than guessing from chassis distance to the centerline.
  for(const id of ['fl','fr','rl','rr']){
    const patch=state.contactPatches?.[id] || state.wheelPoses?.[id],point=patch?.contactPointWorld || patch?.contactPoint;
    if(patch?.validTreadContact !== true || !(patch.normalLoadN>1)
      || !point || ![point.x,point.y,point.z].every(Number.isFinite))return rejectHistory(history, 'invalid-contact');
    const halfWidth=Number(session.vehicleDynamicsRunner?.config?.tireByWheel?.[id]?.widthMm || 225)/2000;
    for(const offset of [-halfWidth,0,halfWidth]){
      const tireLateral=patch.wheelLateralWorld || lateral;
      const query={x:point.x+tireLateral.x*offset,y:point.y+tireLateral.y*offset,z:point.z+tireLateral.z*offset};
      const sample=model.samplePhysicsGeometry(query,context);
      if(sample?.valid !== true) return rejectHistory(history, 'invalid-surface');
      if(sample.region !== 'road') return rejectHistory(history, 'off-road');
      if(!Number.isFinite(sample.heightM) || Math.abs(sample.heightM-query.y)>.15)
        return rejectHistory(history, 'contact-height');
    }
  }
  const position = state.position;
  if (!position || ![position.x,position.y,position.z].every(Number.isFinite)) return rejectHistory(history, 'invalid-position');
  const projection = editor.getRaceRouteProjectionForWorldPoint({
    x:position.x,z:position.z,heightM:position.y,y:position.y
  });
  if (!Number.isFinite(projection?.distance)) return rejectHistory(history, 'invalid-projection');
  const pose = projection.edgeId ? projection : editor.getRaceWorldPoseAtDistance(projection.distance);
  if (![pose.x,pose.z,pose.yaw].every(Number.isFinite)) return rejectHistory(history, 'invalid-route-pose');
  history.accepted += 1;
  history.lastRejection = null;
  if(history.samples.length>=48)history.samples.shift();
  history.samples.push({time:history.time, lap:Number(session.lap || 1), projection:{
    distance:projection.distance, x:position.x,z:position.z,yaw:Number(state.yawRad ?? pose.yaw),
    verifiedRoadPose:{position:{...position},orientation:{...state.orientation},
      suspensionState:structuredClone(state.suspensionState || {})},
    heightM:pose.heightM ?? position.y - Number(session.vehicleDynamicsRunner?.config?.cgHeightM || .55),
    ...(projection.edgeId ? {edgeId:projection.edgeId} : {})
  }});
}

export function getRaceRecoveryHistoryCandidates(session) {
  const history = histories.get(session);
  if (!history) return [];
  const candidates = [];
  const selection = history.selection = {stored:history.samples.length, lap:0, nearby:0, traffic:0, selected:0};
  for (let i=history.samples.length-1;i>=0;i--) {
    const sample=history.samples[i],p=sample.projection;
    if (sample.lap !== Number(session.lap || 1)) { selection.lap++; continue; }
    // Keep the last verified road location even after a long tumble/off-road stop.
    if (candidates.some(other=>Math.hypot(p.x-other.x,p.z-other.z)<6)) { selection.nearby++; continue; }
    if ((session.aiRuntime||[]).some(ai=>Math.hypot(p.x-ai.worldX,p.z-ai.worldZ)<8)) { selection.traffic++; continue; }
    candidates.push({...p});
    selection.selected++;
    if(candidates.length===8)break;
  }
  return candidates;
}

export function clearRaceRecoveryHistory(session) {
  histories.delete(session);
}

// Counters only during gameplay; allocate a snapshot only when diagnostics ask.
function rejectHistory(history, reason) {
  history.rejected[reason] = (history.rejected[reason] || 0) + 1;
  history.lastRejection = reason;
}
export function getRaceRecoveryHistoryDiagnostics(session) {
  const history = histories.get(session);
  if (!history) return null;
  return {stored:history.samples.length, accepted:history.accepted,
    lastRejection:history.lastRejection, rejected:{...history.rejected},
    selection:history.selection ? {...history.selection} : null};
}
