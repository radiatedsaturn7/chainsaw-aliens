// Authoring policy for small plants and breakaway delineators, not rigid hazards.
export function roadsideKind(ref = '') {
 if (/^expanded-(grass|fern)-/.test(ref)) return 'grass';
 if (/^(expanded-bush-|frozen-bush-|dry-scrub-bush-)/.test(ref) || ref === 'frozenbush') return 'shrub';
 if (['roadside-snow-depth-marker-pole', 'ohio-river-crossing-flood-marker'].includes(ref)) return 'marker';
 return null;
}

export function softenRoadsideDefinition(definition, ref) {
 const kind = roadsideKind(ref);
 if (!kind || definition.isFence) return false;
 const before = JSON.stringify(definition);
 definition.weightKg = kind === 'marker' ? 3 : kind === 'shrub' ? 5 : 1;
 definition.defaultRule = {
  behavior: kind === 'marker' ? 'fly-off' : 'flatten',
  speedDrainPercent: kind === 'marker' ? .5 : kind === 'shrub' ? .2 : 0,
  damage: {panels: kind === 'marker' ? .05 : 0, suspension: 0, engine: 0}
 };
 definition.rules = [];
 return before !== JSON.stringify(definition);
}

export function softenRaceRoadside(race, definition) {
 const result = {grassReplacements: 0, overridesUpdated: 0, embeddedDefinitionsUpdated: 0, markers: 0, softPlants: 0};
 // Saved tracks may carry their own definitions, which take priority over
 // the shared library even after its rules have been corrected.
 for (const def of race.sceneryDefinitions || []) {
  if (softenRoadsideDefinition(def, def.ref || def.name || def.artRef)) result.embeddedDefinitionsUpdated++;
 }
 const widths = (race.road?.segments || []).map(s => Number(s.roadWidthM)).filter(Number.isFinite);
 const roadWidth = Math.max(Number(race.road?.width) || 7, ...widths);
 for (const sprite of race.scenery || []) {
  const ref = sprite.doodadRef || sprite.previewDoodad?.artRef || sprite.artRef;
  const policyRef = roadsideKind(ref) ? ref : sprite.campaignAppearance?.originalRef;
  const kind = roadsideKind(policyRef);
  if (!kind || sprite.fenceId || sprite.ecologyLayer === 'apex-hazard' || sprite.previewDoodad?.isFence) continue;
  const def = definition(ref);
  if (!def || def.isFence) continue;
  // Existing placements carry the importer/authoring pass's road projection.
  // Use the closest edge of the sprite; keep the deeper shrub/forest layers.
  const lateral = Number(sprite.trackLateral);
  const near = sprite.trackLateral != null && Number.isFinite(lateral)
   && Math.abs(lateral) - roadWidth / 2 - Number(sprite.widthM || def.widthM || 1) / 2 <= 6;
  if (kind === 'shrub' && (near || sprite.ecologyLayer === 'verge')) {
   const grassRef = /frozen/.test(policyRef) ? 'expanded-grass-clump'
    : /dry-scrub/.test(policyRef) ? 'expanded-grass-little-bluestem-01' : 'expanded-grass-roadside-weeds-01';
   const grass = definition(grassRef);
   if (!grass) throw new Error(`Missing grass definition: ${grassRef}`);
   const height = Math.min(.45, Number(sprite.heightM || def.heightM) || .45);
   const width = grass.widthM * height / grass.heightM;
   sprite.doodadRef = grassRef;
   sprite.widthM = width; sprite.heightM = height;
   if (sprite.artRef != null) sprite.artRef = grass.artRef;
   if (sprite.previewDoodad) sprite.previewDoodad = {...grass, widthM: width, heightM: height, hitboxWidthM: width, hitboxHeightM: height};
   delete sprite.model;
   sprite.ecologyLayer = 'verge';
   result.grassReplacements++;
  } else if (sprite.previewDoodad && softenRoadsideDefinition(sprite.previewDoodad, policyRef)) result.overridesUpdated++;
  // An instance's old solid flag overrides even a corrected doodad definition.
  if (sprite.solid === true || sprite.collidable === true) result.overridesUpdated++;
  delete sprite.solid; delete sprite.collidable;
  if (sprite.behavior != null) sprite.behavior = kind === 'marker' ? 'fly-off' : 'flatten';
  if (sprite.weightKg != null) sprite.weightKg = kind === 'marker' ? 3 : 1;
  if (kind === 'marker') result.markers++; else result.softPlants++;
 }
 return result;
}
