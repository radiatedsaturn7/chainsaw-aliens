import { RACE_CAR_SHELL_FRAME_SLOTS } from './raceData.js';

export const CAR_EXTERIOR_COMPONENTS = ['body', 'tires', 'brakes', 'shadow'];
export const CAR_COMPONENT_ART_FIELDS = {
  body: ['bodyScaleX', 'bodyScaleY', 'bodyOffsetX', 'bodyOffsetY', 'bodyRotationDeg'],
  tires: ['tireScaleX', 'tireScaleY', 'tireSpacingScale', 'frontTireOffsetX', 'frontTireOffsetY', 'rearTireOffsetX', 'rearTireOffsetY'],
  brakes: ['brakeLightScaleX', 'brakeLightScaleY', 'brakeLightOffsetX', 'brakeLightOffsetY'],
  shadow: ['shadowScaleX', 'shadowScaleY', 'shadowOffsetX', 'shadowOffsetY']
};
export const CAR_ART_SLIDER_FIELDS = {
  'body-rotation': 'bodyRotationDeg',
  'body-x': 'bodyScaleX', 'body-y': 'bodyScaleY',
  'body-offset-x': 'bodyOffsetX', 'body-offset-y': 'bodyOffsetY',
  'tire-spacing': 'tireSpacingScale',
  'tire-x': 'tireScaleX', 'tire-y': 'tireScaleY',
  'front-offset-x': 'frontTireOffsetX', 'front-offset-y': 'frontTireOffsetY',
  'rear-offset-x': 'rearTireOffsetX', 'rear-offset-y': 'rearTireOffsetY',
  'brake-x': 'brakeLightScaleX', 'brake-y': 'brakeLightScaleY',
  'brake-offset-x': 'brakeLightOffsetX', 'brake-offset-y': 'brakeLightOffsetY',
  'shadow-x': 'shadowScaleX', 'shadow-y': 'shadowScaleY',
  'shadow-offset-x': 'shadowOffsetX', 'shadow-offset-y': 'shadowOffsetY'
};
export const hasCarAngleGraphic = (entry) => Boolean(entry && Object.hasOwn(entry, 'artRef'));

export const CAR_VIEW_LABELS = {
  front: 'Front', frontRight: 'Front Right', right: 'Right', rearRight: 'Rear Right',
  rear: 'Rear', rearLeft: 'Rear Left', left: 'Left', frontLeft: 'Front Left'
};

// Bearing of the camera from the car: zero is in front, positive is its right.
export function getCarViewSlot(yaw = 0, cameraYaw = 0) {
  const angle = Number(cameraYaw || 0) - Number(yaw || 0) + Math.PI;
  const index = ((Math.floor(angle / (Math.PI / 4) + 0.5) % 8) + 8) % 8;
  return RACE_CAR_SHELL_FRAME_SLOTS[index];
}

export function getCarViewCameraYaw(slot = 'front', yaw = 0) {
  return Number(yaw || 0) + Math.max(0, RACE_CAR_SHELL_FRAME_SLOTS.indexOf(slot)) * Math.PI / 4 - Math.PI;
}

export function normalizeCarAngleLayers(layers = {}) {
  return Object.fromEntries(RACE_CAR_SHELL_FRAME_SLOTS.flatMap((slot) => {
    if (!layers?.[slot] || typeof layers[slot] !== 'object') return [];
    const entries = CAR_EXTERIOR_COMPONENTS.flatMap((component) => {
      const entry = layers[slot][component];
      if (!entry || typeof entry !== 'object') return [];
      const normalized = {};
      if (hasCarAngleGraphic(entry)) {
        normalized.artRef = String(entry.artRef || '').trim() || null;
        normalized.frameIndex = Number.isFinite(Number(entry.frameIndex)) ? Math.max(0, Math.round(Number(entry.frameIndex))) : 0;
      }
      const transforms = {};
      for (const key of CAR_COMPONENT_ART_FIELDS[component]) {
        if (!Object.hasOwn(entry.transforms || {}, key)) continue;
        const value = Number(entry.transforms[key]);
        if (!Number.isFinite(value)) continue;
        transforms[key] = key.includes('Scale') ? Math.max(0.05, Math.min(12, value)) : key === 'bodyRotationDeg' ? Math.max(-45, Math.min(45, value)) : Math.max(-16, Math.min(16, value));
      }
      if (Object.keys(transforms).length) normalized.transforms = transforms;
      if (typeof entry.visible === 'boolean') normalized.visible = entry.visible;
      if (component === 'body' && typeof entry.fitToCar === 'boolean') normalized.fitToCar = entry.fitToCar;
      if (component === 'tires' && typeof entry.cylinder === 'boolean') normalized.cylinder = entry.cylinder;
      if (component === 'tires' && ['auto', 'hidden', 'front', 'rear', 'left', 'right', 'visible'].includes(entry.tireMode)) normalized.tireMode = entry.tireMode;
      return [[component, normalized]];
    });
    return [[slot, Object.fromEntries(entries)]];
  }));
}

// A missing entry inherits existing artwork. An explicit empty entry restores
// the procedural layer at this angle without clearing any other view.
export function resolveCarAngleLayers(car, slot = 'front') {
  const layers = car?.art?.angleLayers?.[slot] || {};
  const compound = car?.setup?.tireCompoundByWheel?.fl || car?.setup?.defaultTireCompound || 'tarmac';
  const hasTireArt = hasCarAngleGraphic(layers.tires) ? Boolean(layers.tires.artRef)
    : Boolean(car?.art?.tireTreads?.[compound]?.artRef
      || (Array.isArray(car?.art?.tires) ? car.art.tires.some(Boolean) : car?.art?.tires));
  if (!car?.art?.angleLayers?.[slot] && !hasTireArt) return car;
  const art = { ...car.art };
  if (hasCarAngleGraphic(layers.body)) {
    art.body = layers.body.artRef;
    art.artRef = layers.body.artRef;
    art.shell = layers.body.artRef;
    art.bodyFitToCar = layers.body.fitToCar === true;
  }
  if (hasCarAngleGraphic(layers.tires)) {
    art.tires = layers.tires.artRef ? [layers.tires.artRef] : [];
    art.tireTreads = Object.fromEntries(Object.keys(art.tireTreads || {}).map((key) => [key, layers.tires]));
    const compound = car.setup?.tireCompoundByWheel?.fl || car.setup?.defaultTireCompound || 'tarmac';
    art.tireTreads[compound] = layers.tires;
  }
  for (const [component, prefix] of [['brakes', 'brakeLight'], ['shadow', 'shadow']]) {
    if (hasCarAngleGraphic(layers[component])) {
      art[`${prefix}ArtRef`] = layers[component].artRef;
      art[`${prefix}FrameIndex`] = layers[component].frameIndex || 0;
    }
  }
  art.layerVisibility = { ...(car.art.layerVisibility || {}) };
  for (const component of CAR_EXTERIOR_COMPONENTS) {
    const entry = layers[component];
    if (!entry) continue;
    for (const key of CAR_COMPONENT_ART_FIELDS[component]) {
      if (Number.isFinite(entry.transforms?.[key])) art[key] = entry.transforms[key];
    }
    if (typeof entry.visible === 'boolean') art.layerVisibility[component] = entry.visible;
  }
  const tireMode = layers.tires?.tireMode || (hasTireArt ? 'auto' : null);
  if (tireMode) {
    const resolved = tireMode === 'auto'
      ? (slot === 'front' ? 'front' : slot === 'rear' ? 'rear' : slot.toLowerCase().includes('left') ? 'left' : 'right')
      : tireMode;
    art.layerVisibility.tireMode = tireMode;
    art.layerVisibility.tires = tireMode === 'auto'
      ? art.layerVisibility.tires !== false : resolved !== 'hidden';
    art.layerVisibility.leftWheels = resolved !== 'right';
    art.layerVisibility.rightWheels = resolved !== 'left';
    art.layerVisibility.frontWheels = ['front', 'left', 'right', 'visible'].includes(resolved);
    art.layerVisibility.rearWheels = ['rear', 'left', 'right', 'visible'].includes(resolved);
  }
  // Models are complete objects; their own depth hides the far wheels.
  // Directional sprite visibility must not remove model faces or wheels.
  if(art.bodyModel?.ref)art.layerVisibility.body=car.art.layerVisibility?.body!==false;
  if(art.wheelModel?.ref){
    for(const key of ['tires','frontWheels','rearWheels','leftWheels','rightWheels'])art.layerVisibility[key]=car.art.layerVisibility?.[key]!==false;
  }
  return { ...car, art };
}

export function getCarAngleArtRefs(car) {
  return Object.values(car?.art?.angleLayers || {}).flatMap((layers) =>
    CAR_EXTERIOR_COMPONENTS.map((component) => layers?.[component]?.artRef).filter(Boolean));
}

export const CAR_MIRROR_ANGLE_PAIRS = {
  front: 'rear', rear: 'front',
  frontRight: 'frontLeft', frontLeft: 'frontRight',
  right: 'left', left: 'right',
  rearRight: 'rearLeft', rearLeft: 'rearRight'
};

// Mirror editing links transforms only; each view retains its own artwork.
export function mirrorCarAngleTransforms(art, slot, component, transforms) {
  if (art.mirrorAngleEdits === false || !transforms) return;
  const partner = CAR_MIRROR_ANGLE_PAIRS[slot];
  if (!partner) return;
  art.angleLayers ||= {};
  art.angleLayers[partner] ||= {};
  const entry = art.angleLayers[partner][component] ||= {};
  entry.transforms ||= {};
  for (const [key, value] of Object.entries(transforms)) {
    if (!CAR_COMPONENT_ART_FIELDS[component]?.includes(key)) continue;
    entry.transforms[key] = key.endsWith('OffsetX') || key === 'bodyRotationDeg' ? -value : value;
  }
}

// Resource assignments affect preview preparation; image placement does not.
// Canonical empty containers keep the first slider edit from changing the key.
export function getCarArtResourceState(art = {}) {
  const state = { ...art };
  for (const key of [...Object.values(CAR_COMPONENT_ART_FIELDS).flat(),
    'bodyScale', 'tireScale', 'brakeLightScale', 'shadowScale',
    'angleLayers', 'interior', 'turnFrames', 'gauges', 'fx']) delete state[key];
  state.angleLayers = {};
  for (const [slot, layers] of Object.entries(art.angleLayers || {})) {
    const resources = {};
    for (const [component, entry] of Object.entries(layers || {})) {
      const { transforms, ...resource } = entry || {};
      if (Object.keys(resource).length) resources[component] = resource;
    }
    if (Object.keys(resources).length) state.angleLayers[slot] = resources;
  }
  state.interior = {};
  for (const [component, entry] of Object.entries(art.interior || {})) {
    if (!entry?.artRef) continue;
    const { scaleX, scaleY, offsetX, offsetY, centerX, centerY, ...resource } = entry;
    state.interior[component] = resource;
  }
  state.fx = (art.fx||[]).map(f=>({artRef:f.artRef||'',views:Object.fromEntries(Object.entries(f.views||{}).map(([slot,v])=>[slot,{artRef:v.artRef||'',frameIndex:v.frameIndex||0}]))}));
  const gaugeFields=['artRef','needleArtRef','overlayArtRef','markerArtRef','carMarkerArtRef','startMarkerArtRef','finishMarkerArtRef'];
  state.gauges = Object.fromEntries(Object.entries(art.gauges || {}).map(([side, layout]) => [side, (layout.widgets || []).filter(g => gaugeFields.some(key=>g[key])).map(g => ({...Object.fromEntries(gaugeFields.map(key=>[key,g[key]])),frameIndex:g.frameIndex}))]));
  state.turnFrames = Object.fromEntries(Object.entries(art.turnFrames || {}).filter(([, value]) => value));
  return state;
}
