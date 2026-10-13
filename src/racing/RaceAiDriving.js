import { clamp } from './simulation/SimulationMath.js';

// Shuffle bags keep small grids varied and large grids balanced. A new bag is
// drawn only after every available car has had a place on the grid.
export function selectRaceAiCars(cars = [], count = 0, random = Math.random) {
  const ids = [...new Set(cars.map((car) => car?.id).filter(Boolean))];
  const result = [];
  while (ids.length && result.length < count) {
    const bag = [...ids];
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.min(i, Math.floor(clamp(Number(random()) || 0, 0, 1) * (i + 1)));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    result.push(...bag.slice(0, count - result.length));
  }
  return result;
}

const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function planRaceAiDriving(editor, ai, tuning, {
  grip = 1, profile = {}, topSpeedMps = 60
} = {}) {
  const session = editor.playtestSession || {};
  const runtimeType = session.routeRuntimeType || editor.getSelectedRaceRuntimeType();
  const routeLength = Math.max(1, Number(session.routeLength || editor.getRaceRouteLength()));
  const distance = Number(ai.projectedDistance ?? ai.distance ?? 0);
  const speed = Math.abs(Number(ai.speedMps || 0));
  const samplePose = (ahead) => editor.getRaceWorldPoseAtDistance(distance + ahead, { runtimeType, allowVisualExtension: true });
  const lookahead = clamp(5 + speed * 0.65, 6, 30);
  const targetPose = samplePose(lookahead);
  const halfWidth = Math.max(1, editor.getRaceRoadHalfWidthWorld(targetPose.segment));
  const laneLimit = Math.max(0, halfWidth - Number(tuning.widthM || 1.8) / 2 - 0.45);
  const offset = clamp(Number(ai.lineOffset || 0) * halfWidth, -laneLimit, laneLimit);
  const right = editor.getRaceRightVector(targetPose.yaw);
  const dx = Number(targetPose.x || 0) + right.x * offset - Number(ai.worldX || 0);
  const dz = Number(targetPose.z ?? targetPose.y ?? 0) + right.z * offset - Number(ai.worldZ || 0);
  const yaw = Number(ai.carYaw || 0);
  const lateral = dx * Math.cos(yaw) - dz * Math.sin(yaw);
  const headingError = angleDifference(Math.atan2(dx, dz), yaw);
  const maxSteer = Number(ai.vehicleDynamicsRunner?.config?.maxSteerAngleRad || 0.52);
  const steeringAngleRad = clamp(Math.atan2(
    2 * Number(tuning.wheelbaseM || 2.65) * lateral,
    Math.max(4, dx * dx + dz * dz)
  ), -maxSteer, maxSteer);

  const lateralAcceleration = 9.81 * clamp(grip, 0.12, 1.2)
    * (0.48 + Number(profile.corner ?? 0.72) * 0.34);
  const deceleration = 9.81 * clamp(grip, 0.12, 1.2)
    * (0.35 + Number(profile.brake ?? 0.74) * 0.35);
  // Anticipate braking distance, including controller reaction time, using
  // actual route headings so imported node-based tracks work too.
  const horizon = clamp(speed * speed / (2 * deceleration) + speed + 35, 45, 320);
  let targetSpeedMps = Math.max(0, topSpeedMps);
  let a = samplePose(0);
  for (let ahead = 0; ahead <= horizon; ahead += 8) {
    const b = samplePose(ahead + 8);
    const curvature = Math.abs(angleDifference(b.yaw || 0, a.yaw || 0)) / 8;
    a = b; // Adjacent segments share their endpoint; avoid duplicate route queries.
    const cornerSpeed = Math.sqrt(lateralAcceleration / Math.max(0.00001, curvature));
    const brakingRoom = Math.max(0, ahead - speed * 0.45 - 3);
    targetSpeedMps = Math.min(targetSpeedMps,
      Math.sqrt(cornerSpeed * cornerSpeed + 2 * deceleration * brakingRoom));
  }
  // Slow down while recovering a missed line instead of accelerating off-road.
  targetSpeedMps *= clamp(1 - Math.abs(headingError) / 1.8, 0.12, 1);
  if (runtimeType !== 'circuit' && distance >= routeLength) targetSpeedMps = 0;
  // Leave braking room behind slower cars, including the player. Lateral
  // clearance means cars already alongside can continue their pass.
  const traffic = [...(session.aiRuntime || []), session];
  for (const other of traffic) {
    if (other === ai || !Number.isFinite(other.worldX) || !Number.isFinite(other.worldZ)) continue;
    const tx = other.worldX - Number(ai.worldX || 0);
    const tz = other.worldZ - Number(ai.worldZ || 0);
    const ahead = tx * Math.sin(yaw) + tz * Math.cos(yaw);
    const across = Math.abs(tx * Math.cos(yaw) - tz * Math.sin(yaw));
    if (ahead <= 0 || ahead > Math.max(15, speed * 2.5) || across > Number(tuning.widthM || 1.8) + 0.5) continue;
    const otherSpeed = Math.max(0, Number(other.speedMps || 0))
      * Math.max(0, Math.cos(angleDifference(Number(other.carYaw || 0), yaw)));
    const room = Math.max(0, ahead - 5 - speed * 0.5);
    targetSpeedMps = Math.min(targetSpeedMps, Math.sqrt(otherSpeed * otherSpeed + 2 * deceleration * room));
  }
  return { steeringAngleRad, targetSpeedMps, headingError, lookahead };
}
