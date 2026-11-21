import { RACE_TIRE_COMPOUNDS, RACE_CAR_SHELL_FRAME_SLOTS } from './raceData.js';

const clamp = (value, fallback, min, max) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));
const copy = value => JSON.parse(JSON.stringify(value));
export const TIRE_GRIP_FIELDS = [
  ['asphalt', 'Dry asphalt grip', 'Traction on dry paved roads.'],
  ['wet-asphalt', 'Wet asphalt grip', 'Traction as paved roads become wet.'],
  ['dirt', 'Dirt grip', 'Traction on dry dirt.'],
  ['gravel', 'Dry gravel grip', 'Traction on dry gravel.'],
  ['mud', 'Mud grip', 'Traction on mud, including dirt that becomes wet.'],
  ['wet-gravel', 'Wet gravel grip', 'Traction as gravel becomes wet.'],
  ['snow', 'Snow grip', 'Traction on snow-covered ground. More snow shifts grip toward this value. Ice also uses this tire response, with additional surface effects.'],
  ['slush', 'Slush grip', 'Traction on wet snow and slush. More moisture shifts snow grip toward this value.']
].map(([key,label,description])=>({path:`compound.surfaceGrip.${key}`,label,description,group:'Surface grip',min:0.05,max:2,step:0.01}));
const BEHAVIOR_DEFAULTS = {
  slidingFrictionRatio:0.66, postPeakFalloff:1.8, recoveryHysteresis:0.04,
  abrasionResistance:1, casingStrength:1, stoneResistance:1
};
export const TIRE_PROPERTY_FIELDS = [
  ...TIRE_GRIP_FIELDS,
  {path:'compound.wetEvacuationFactor',label:'Water evacuation',min:0.05,max:3,step:0.01},
  {path:'compound.treadDepthMm',label:'Tread depth (mm)',min:0.4,max:14,step:0.1},
  {path:'compound.wearRate',label:'Wear rate',min:0.7,max:1.6,step:0.01},
  {path:'compound.slidingFrictionRatio',label:'Sliding grip fraction',description:'Fraction of peak grip retained in a sustained slide. Higher values make sliding less abrupt.',min:0.35,max:1,step:0.01},
  {path:'compound.postPeakFalloff',label:'Slide falloff',description:'How quickly grip falls after its peak. Lower values give a broader, gentler transition.',min:0.1,max:8,step:0.05},
  {path:'compound.recoveryHysteresis',label:'Slide recovery margin',description:'How far slip must fall below its peak before the tire recovers. Smaller values recover sooner.',min:0,max:0.3,step:0.005},
  {path:'compound.abrasionResistance',label:'Abrasion resistance',description:'Higher values reduce tread wear from friction and rolling contact. 1 is standard.',min:0.5,max:3,step:0.05},
  {path:'compound.casingStrength',label:'Casing strength',description:'Higher values raise the load threshold for stone damage. Does not strengthen the suspension.',min:0.5,max:3,step:0.05},
  {path:'compound.stoneResistance',label:'Stone cut resistance',description:'Reduces stone damage after the casing load threshold is exceeded. 1 is standard.',min:0.5,max:3,step:0.05},
  {path:'size.widthMm',label:'Width (mm)',min:125,max:405,step:1},
  {path:'size.aspectRatio',label:'Sidewall aspect (%)',min:20,max:85,step:1},
  {path:'size.wheelDiameterIn',label:'Wheel diameter (in)',min:10,max:26,step:1},
  {path:'pressurePsi',label:'Cold pressure (PSI)',min:18,max:52,step:0.5}
];
export function createTireDefinition(baseCompound = 'tarmac') {
  const base = RACE_TIRE_COMPOUNDS.find(tire=>tire.id===baseCompound) || RACE_TIRE_COMPOUNDS.find(tire=>tire.id==='tarmac');
  return { kind:'race-tire',schemaVersion:2,name:base.label,baseCompound:base.id,compound:{...BEHAVIOR_DEFAULTS,...copy(base)},
    size:{widthMm:245,aspectRatio:40,wheelDiameterIn:18},pressurePsi:32,graphics:{} };
}
export function normalizeTireDefinition(value = {}) {
  const source=value.tire || value;
  const tire=createTireDefinition(source.baseCompound);
  tire.name=String(source.name || tire.name).trim().slice(0,100) || tire.name;
  for(const field of TIRE_PROPERTY_FIELDS) {
    const keys=field.path.split('.');
    let target=tire,input=source;
    for(const key of keys.slice(0,-1)) {target=target[key];input=input?.[key];}
    const key=keys.at(-1);
    target[key]=clamp(input?.[key],target[key],field.min,field.max);
  }
  tire.compound.label=tire.name;
  const art=source.graphics || {};
  // Keep placement and visibility when a tire document is round-tripped.
  for (const key of ['tireScale', 'tireScaleX', 'tireScaleY', 'tireSpacingScale',
    'frontTireOffsetX', 'frontTireOffsetY', 'rearTireOffsetX', 'rearTireOffsetY',
    'mirrorAngleEdits', 'layerVisibility']) {
    if (art[key] !== undefined) tire.graphics[key] = copy(art[key]);
  }
  if(art.tireSurfaces?.tread?.artRef && art.tireSurfaces?.wheel?.artRef) tire.graphics.tireSurfaces=copy(art.tireSurfaces);
  if(art.tireTreads && typeof art.tireTreads==='object') tire.graphics.tireTreads=copy(art.tireTreads);
  if(art.tires) tire.graphics.tires=copy(art.tires);
  tire.graphics.angleLayers={};
  for(const slot of RACE_CAR_SHELL_FRAME_SLOTS) {
    const entry=art.angleLayers?.[slot]?.tires;
    if(entry) tire.graphics.angleLayers[slot]={tires:copy(entry)};
  }
  return tire;
}
export function applyTireDefinition(car, definition, ref = '', {keepArt=false} = {}) {
  const tire=normalizeTireDefinition(definition);
  car.setup ||= {};
  car.setup.tireDefinition={ref:String(ref),tire};
  car.setup.defaultTireCompound=tire.baseCompound;
  car.setup.tireCompoundByWheel=Object.fromEntries(['fl','fr','rl','rr'].map(w=>[w,tire.baseCompound]));
  car.setup.tireSize=copy(tire.size);
  delete car.setup.tireSizeByAxle;
  car.setup.tirePressurePsi=Object.fromEntries(['fl','fr','rl','rr'].map(w=>[w,tire.pressurePsi]));
  if(keepArt)return tire;
  car.art ||= {};
  for(const key of ['tireSurfaces','tireTreads','tires']) {
    if(tire.graphics[key]) car.art[key]=copy(tire.graphics[key]);
    else delete car.art[key];
  }
  car.art.angleLayers ||= {};
  for(const slot of RACE_CAR_SHELL_FRAME_SLOTS) {
    const previous=car.art.angleLayers[slot]?.tires || {};
    const graphic=tire.graphics.angleLayers?.[slot]?.tires || {artRef:null,frameIndex:0,cylinder:false};
    car.art.angleLayers[slot] ||= {};
    car.art.angleLayers[slot].tires={...copy(graphic),
      ...(previous.transforms?{transforms:previous.transforms}:{}),
      ...(typeof previous.visible==='boolean'?{visible:previous.visible}:{}),
      ...(previous.tireMode?{tireMode:previous.tireMode}:{})};
  }
  return tire;
}
export function resolveTireCompound(car, id, fallback) {
  const tire=car?.setup?.tireDefinition?.tire;
  return tire?.baseCompound===id && tire.compound ? tire.compound : fallback;
}

export function getTireArtRefs(tire) {
  const art=tire?.graphics || {};
  return [...new Set([
    ...(Array.isArray(art.tires)?art.tires:[]),
    ...Object.values(art.tireSurfaces || {}).map(entry=>entry?.artRef),
    ...Object.values(art.tireTreads || {}).map(entry=>typeof entry==='string'?entry:entry?.artRef),
    ...Object.values(art.angleLayers || {}).map(layer=>layer?.tires?.artRef)
  ].filter(ref=>typeof ref==='string' && ref))];
}
