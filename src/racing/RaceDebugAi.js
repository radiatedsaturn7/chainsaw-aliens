// Session-only controls: never edit the authored competition or its car pool.
export function changeRaceDebugAi(editor, delta) {
  const session = editor.playtestSession;
  if (!session || session.raceResults) return false;
  const cars = session.aiRuntime ||= [];
  const bridge = editor.vehicleDynamicsAuthority?.workerBridge;
  if (delta < 0) {
    const ai = cars.at(-1);
    if (!ai) return false;
    bridge?.removeDebugAiVehicle(ai);
    cars.pop();
    session.aiDrivers = (session.aiDrivers || []).filter(driver => driver.id !== ai.id);
    return true;
  }
  if (cars.length >= 29) return false;
  const car = cars.at(-1)?.runtimeCar
    || editor.getRaceSessionCar() || editor.selectedCar;
  const tuning = editor.getRaceCarTuning(car);
  const runtimeType = session.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const routeLength = session.routeLength || editor.getRaceRouteLength();
  const colliders = editor.vehicleDynamicsAuthority?.raceEnvironmentProviderContext?.staticColliderWorld;
  let spawn = null;
  for (let offset = 15; offset <= 450; offset += 10) {
    let distance = Number(session.distance || 0) - offset;
    if (runtimeType === 'circuit') distance = ((distance % routeLength) + routeLength) % routeLength;
    const pose = editor.getRaceWorldPoseAtDistance(distance, {runtimeType, allowVisualExtension:true});
    const x = pose.x, z = pose.z ?? pose.y;
    if ([session,...cars].some(other => Math.hypot(x-other.worldX,z-other.worldZ)<12)) continue;
    const contacts = editor.getRaceWheelContactState({car,tuning,session:{worldX:x,worldZ:z,carYaw:pose.yaw,speedMps:0,routeRuntimeType:runtimeType}});
    if (!Number.isFinite(contacts.averageHeightM) || !['fl','fr','rl','rr'].every(id=>contacts.contacts?.[id]?.valid && contacts.contacts[id].region==='road')) continue;
    const y=contacts.averageHeightM;
    if (colliders?.querySweptAabb({minX:x-4,maxX:x+4,minZ:z-4,maxZ:z+4,minY:y+.1,maxY:y+3}).length) continue;
    spawn={distance,x,z,yaw:pose.yaw};break;
  }
  if (!spawn) {
    editor.status='No clear road space to add an AI racer';
    editor.game?.showSystemToast?.(editor.status);
    return false;
  }
  session.debugAiSequence = (session.debugAiSequence || 0) + 1;
  const id=`debug-ai-${session.debugAiSequence}`;
  const driver={id,name:`Debug AI ${session.debugAiSequence}`,carId:editor.getRaceCarProjectIdentity(car),difficulty:'medium',enabled:true};
  const ai=editor.createRaceAiRuntime([driver],{routeLength})[0];
  Object.assign(ai,{runtimeCar:editor.materializeRaceRuntimeCar(car),distance:spawn.distance,projectedDistance:spawn.distance,
    worldX:spawn.x,worldZ:spawn.z,carYaw:spawn.yaw,lineOffset:0,lap:session.lap||1});
  // Initialize the same dynamics runner used by normal opponents, without
  // advancing time while the pause menu is open.
  editor.updateRaceAiVehiclePhysics(ai,{car:ai.runtimeCar,tuning,seconds:0});
  bridge?.addDebugAiVehicle(ai);
  cars.push(ai);
  (session.aiDrivers ||= []).push(driver);
  return true;
}
