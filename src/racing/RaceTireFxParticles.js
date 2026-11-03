// Visual particles are owned by one race session. Renderers consume them
// synchronously; they are never retained as physics or replay snapshots.
export const RACE_TIRE_FX_PARTICLE_LIMIT = 140;
const pools = new WeakMap();
function poolFor(session) {
  let pool = pools.get(session);
  if (!pool) { pool = []; pools.set(session, pool); }
  return pool;
}
export function acquireRaceTireFxParticle(session) {
  return poolFor(session).pop() || {};
}
function release(pool, particle) {
  if (pool.length < RACE_TIRE_FX_PARTICLE_LIMIT) pool.push(particle);
}
export function trimRaceTireFxParticles(session) {
  const particles = session.tireFxParticles;
  const excess = particles.length - RACE_TIRE_FX_PARTICLE_LIMIT;
  if (excess <= 0) return;
  const pool = poolFor(session);
  for (let i = 0; i < excess; i++) release(pool, particles[i]);
  particles.copyWithin(0, excess);
  particles.length = RACE_TIRE_FX_PARTICLE_LIMIT;
}
export function advanceRaceTireFxParticles(session, seconds) {
  const particles = session?.tireFxParticles;
  if (!particles?.length) return;
  const pool = poolFor(session);
  let kept = 0;
  for (let i = 0; i < particles.length; i++) {
    const particle = particles[i];
    particle.ageMs = Number(particle.ageMs || 0) + seconds * 1000;
    particle.x = Number(particle.x || 0) + Number(particle.vx || 0) * seconds;
    particle.z = Number(particle.z || 0) + Number(particle.vz || 0) * seconds;
    particle.elevation = Number(particle.elevation || 0) + Number(particle.vy || 0) * seconds;
    if (Number(particle.ageMs || 0) < Number(particle.lifetimeMs || 1)) particles[kept++] = particle;
    else release(pool, particle);
  }
  particles.length = kept;
}

const projections = new WeakMap();
const depthOrder = (a,b) => Number(b.point.cameraZ || 0) - Number(a.point.cameraZ || 0);
export function acquireRaceTireFxProjection(session) {
  let scratch = projections.get(session);
  if (!scratch) {
    scratch = {records:[],sorted:[],options:{},busy:false};
    projections.set(session,scratch);
  }
  if (scratch.busy) scratch = {records:[],sorted:[],options:{},busy:false};
  scratch.busy = true;
  return scratch;
}
// Records are borrowed until release, never stored in simulation snapshots.
export function projectRaceTireFxParticles(scratch, editor, particles, bounds, camera, cameraYaw, layer) {
  const options = scratch.options;
  options.camera=camera;options.cameraYaw=cameraYaw;options.bounds=bounds;
  const sorted=scratch.sorted;
  let count=0;
  for (const particle of particles) {
    if (layer !== 'all' && ((layer === 'ground') !== (particle.slotId === 'asphaltSkid'))) continue;
    const point=editor.projectRaceWorldVisualPoint(particle,options);
    if (!point?.visible || !(point.screenY >= bounds.y-40 && point.screenY <= bounds.y+bounds.h+60)) continue;
    const record=scratch.records[count] ||= {particle:null,point:null};
    record.particle=particle;record.point=point;
    sorted[count++]=record;
  }
  sorted.length=count;
  return sorted.sort(depthOrder);
}
export function releaseRaceTireFxProjection(scratch) {
  for (const record of scratch.records) {record.particle=null;record.point=null;}
  scratch.records.length=Math.min(scratch.records.length,RACE_TIRE_FX_PARTICLE_LIMIT);
  scratch.sorted.length=0;
  scratch.options.camera=null;scratch.options.bounds=null;
  scratch.busy=false;
}
