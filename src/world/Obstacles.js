export const OBSTACLES = {
  W: {
    id: 'wood-barricade',
    label: 'Wood Barricade',
    material: 'wood',
    interactions: {
      chainsaw: { hits: 2, noise: 0.15, verb: 'cut' },
      flame: { hits: 1, noise: 0.5, verb: 'burn' }
    }
  },
  X: {
    id: 'welded-metal-plate',
    label: 'Welded Metal Plate',
    material: 'metal',
    interactions: {
      flame: { hits: 1, noise: 0.55, verb: 'melt' }
    }
  },
  C: {
    id: 'brittle-wall',
    label: 'Brittle Wall',
    material: 'brittle',
    interactions: {
      resonance: { hits: 1, noise: 0.3, verb: 'shatter' },
      explosive: { hits: 1, noise: 0.4, verb: 'blast' }
    }
  },
  N: {
    id: 'snow-block',
    label: 'Snow Block',
    material: 'snow',
    interactions: {
      flamethrower: { hits: 1, noise: 0.15, verb: 'melt' },
      ignitir: { hits: 1, noise: 0.25, verb: 'evaporate' }
    }
  },
  P: {
    id: 'lead-block',
    label: 'Lead Block',
    material: 'lead',
    interactions: {
      ignitir: { hits: 1, noise: 0.3, verb: 'evaporate' }
    }
  },
  U: {
    id: 'heavy-debris',
    label: 'Heavy Debris',
    material: 'debris',
    interactions: {
      switch: { hits: 1, noise: 0.05, verb: 'lift' }
    }
  },
  B: {
    id: 'rift-seal',
    label: 'Rift Seal',
    material: 'rift',
    interactions: {
      resonance: { hits: 2, noise: 0.35, verb: 'rupture' }
    }
  }
};

export const OBSTACLE_TILES = new Set(Object.keys(OBSTACLES));

export const SWITCH_TILE = 'T';
