const freeze = (value) => Object.freeze(value);

// Collision friction is deliberately independent from tire surface grip. These
// values describe painted/metal/composite vehicle surfaces scraping scenery.
export const COLLISION_MATERIALS = freeze({
  underfloor: freeze({ staticFriction: 0.65, kineticFriction: 0.65 }),
  rocker: freeze({ staticFriction: 0.55, kineticFriction: 0.4 }),
  bumper: freeze({ staticFriction: 0.55, kineticFriction: 0.32 }),
  roof: freeze({ staticFriction: 0.44, kineticFriction: 0.25 }),
  body: freeze({ staticFriction: 0.5, kineticFriction: 0.29 }),
  wheelSidewall: freeze({ staticFriction: 0.78, kineticFriction: 0.58 }),
  asphalt: freeze({ staticFriction: 0.68, kineticFriction: 0.68 }),
  dirt: freeze({ staticFriction: 0.72, kineticFriction: 0.72 }),
  gravel: freeze({ staticFriction: 0.68, kineticFriction: 0.68 }),
  mud: freeze({ staticFriction: 0.38, kineticFriction: 0.25 }),
  snow: freeze({ staticFriction: 0.24, kineticFriction: 0.16 }),
  ice: freeze({ staticFriction: 0.1, kineticFriction: 0.06 }),
  staticWall: freeze({ staticFriction: 0.62, kineticFriction: 0.42 }),
  barrier: freeze({ staticFriction: 0.58, kineticFriction: 0.4 })
});

export const BODY_STATIC_CAPTURE_SPEED_MPS = 0.18;
export const BODY_KINETIC_ENTRY_SPEED_MPS = 0.35;
export const BODY_STATIC_CAPTURE_STEPS = 3;

export function bodyCollisionMaterial(pieceId = '', contactType = '') {
  const id = `${pieceId} ${contactType}`.toLowerCase();
  if (id.includes('sidewall')) return COLLISION_MATERIALS.wheelSidewall;
  if (id.includes('rocker')) return COLLISION_MATERIALS.rocker;
  if (id.includes('underfloor') || id.includes('subframe') || id.includes('lower')) {
    return COLLISION_MATERIALS.underfloor;
  }
  if (id.includes('bumper')) return COLLISION_MATERIALS.bumper;
  if (id.includes('roof') || id.includes('cabin')) return COLLISION_MATERIALS.roof;
  return COLLISION_MATERIALS.body;
}

export function terrainCollisionMaterial(sample = {}) {
  const id = `${sample.material ?? ''} ${sample.surfaceType ?? ''} ${sample.region ?? ''} ${sample.source ?? ''}`.toLowerCase();
  if (id.includes('ice')) return COLLISION_MATERIALS.ice;
  if (id.includes('snow')) return COLLISION_MATERIALS.snow;
  if (id.includes('mud')) return COLLISION_MATERIALS.mud;
  if (id.includes('gravel')) return COLLISION_MATERIALS.gravel;
  if (id.includes('dirt') || id.includes('soil')) return COLLISION_MATERIALS.dirt;
  return COLLISION_MATERIALS.asphalt;
}

export function staticObstacleCollisionMaterial(collider = {}) {
  const id = `${collider.material ?? ''} ${collider.type ?? ''} ${collider.source ?? ''} ${collider.id ?? ''}`.toLowerCase();
  const base = id.includes('barrier') ? COLLISION_MATERIALS.barrier : COLLISION_MATERIALS.staticWall;
  return {
    staticFriction: Number.isFinite(Number(collider.staticFriction))
      ? Number(collider.staticFriction) : base.staticFriction,
    kineticFriction: Number.isFinite(Number(collider.kineticFriction))
      ? Number(collider.kineticFriction) : base.kineticFriction
  };
}

export function combineCollisionMaterials(first, second) {
  return {
    staticFriction: Math.sqrt(first.staticFriction * second.staticFriction),
    kineticFriction: Math.sqrt(first.kineticFriction * second.kineticFriction)
  };
}
