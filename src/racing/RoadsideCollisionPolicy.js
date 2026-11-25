// Authoring policy for small plants and breakaway delineators, not rigid hazards.
export function roadsideKind(ref = '') {
 if (/^expanded-(grass|fern)-/.test(ref)) return 'grass';
 if (/^(expanded-bush-|frozen-bush-|dry-scrub-bush-)/.test(ref) || ref === 'frozenbush') return 'shrub';
 if (['roadside-snow-depth-marker-pole', 'ohio-river-crossing-flood-marker'].includes(ref)) return 'marker';
 return null;
}

export function softenRoadsideDefinition(definition, ref, trackChanges = true) {
 const kind = roadsideKind(ref);
 if (!kind || definition.isFence) return false;
 const before = trackChanges ? JSON.stringify(definition) : null;
 definition.weightKg = kind === 'marker' ? 3 : kind === 'shrub' ? 5 : 1;
 definition.defaultRule = {
  behavior: kind === 'marker' ? 'fly-off' : 'flatten',
  speedDrainPercent: kind === 'marker' ? .5 : kind === 'shrub' ? .2 : 0,
  damage: {panels: kind === 'marker' ? .05 : 0, suspension: 0, engine: 0}
 };
 definition.rules = [];
 return !trackChanges || before !== JSON.stringify(definition);
}
