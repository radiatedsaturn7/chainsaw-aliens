import * as THREE from '../vendorBridge/three.js';

const params=typeof location==='undefined'?null:new URLSearchParams(location.search);
export const automotivePilotEnabled=Boolean(params)&&params.get('wrxFinish')!=='legacy'&&params.get('wrxLook')!=='off';
export const automotiveFleetEnabled=Boolean(params)&&params.get('automotive')!=='off';
export const automotivePaintCalibrated=Boolean(params)&&params.get('wrxPaint')!=='legacy';
const STANDARD=THREE.MeshStandardMaterial, PHYSICAL=THREE.MeshPhysicalMaterial;

// Select by explicit authored material preset. These are starting points for
// interchangeable assets, not a shader implementation per model.
const PRESETS=Object.freeze({
  // Automotive enamel is pigmented dielectric under a separate clearcoat.
  paint:      Object.freeze({ type:PHYSICAL, roughness:.44, metalness:0, clearcoat:1, clearcoatRoughness:.16, ior:1.5, crease:52 }),
  alloy:      Object.freeze({ type:STANDARD, roughness:.34, metalness:.92, crease:44 }),
  rubber:     Object.freeze({ type:STANDARD, roughness:.88, metalness:0, crease:54 }),
  glass:      Object.freeze({ type:PHYSICAL, roughness:.17, metalness:0, clearcoat:.28, clearcoatRoughness:.14, ior:1.5, crease:48 }),
  optic:      Object.freeze({ type:PHYSICAL, roughness:.31, metalness:0, clearcoat:.64, clearcoatRoughness:.18, ior:1.5, crease:52 }),
  'clear-cover':Object.freeze({ type:PHYSICAL, roughness:.12, metalness:0, clearcoat:0, ior:1.52, crease:55 }),
  trim:       Object.freeze({ type:STANDARD, roughness:.71, metalness:0, crease:38 }),
  machined:   Object.freeze({ type:STANDARD, roughness:.37, metalness:.85, crease:38 }),
  upholstery: Object.freeze({ type:STANDARD, roughness:.91, metalness:0, crease:0 }),
});
const validPreset=key=>Object.prototype.hasOwnProperty.call(PRESETS,key);
const bounded=(v,f,min=0,max=1)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,v)):f;

const PROFILES=new Set(['studio','studio-strips','track-clear','track-overcast','track-night']);
const probes=new Map();
const smooth=(a,b,v)=>{
 const t=Math.max(0,Math.min(1,(v-a)/(b-a)));
 return t*t*(3-2*t);
};
const gaussian=x=>Math.exp(-x*x);
const angularDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

function studioRadiance(phi,y) {
 // Large rectangular softboxes with finite corner / edge falloff. They
 // reveal curvature in a reflection instead of imposing a solid highlight.
 const p=angularDelta(phi,.82);
 const main=(1-smooth(.50,.57,Math.abs(p)))*smooth(.30,.37,y)*(1-smooth(.70,.75,y));
 const fill=(1-smooth(.30,.38,Math.abs(angularDelta(phi,-2.09))))*
   smooth(.06,.12,y)*(1-smooth(.46,.54,y));
 const rim=(1-smooth(.65,.69,Math.abs(angularDelta(phi,2.55))))*
   smooth(.62,.69,y)*(1-smooth(.81,.84,y));
 const base=.035+.14*smooth(-.08,.35,y);
 const v=base+3.0*main+1.22*fill+2.23*rim;
 return [v,v,v];
}

function stripBoothRadiance(phi,y){
 // Narrow neutral light banks with finite apertures. A different booth
 // deliberately changes what the surface reflects, not its paint gain.
 const panel=(az,span,lo,hi)=>{
  const d=Math.abs(angularDelta(phi,az));
  return (1-smooth(span*.90,span,d))*smooth(lo-.017,lo,y)*(1-smooth(hi,hi+.017,y));
 };
 const horizon=.042+.10*smooth(-.11,.25,y);
 const front=panel(1.71,.62,.338,.374)*2.25+panel(1.52,.48,.600,.626)*1.95;
 const rear=panel(-1.96,.55,.08,.137)*2.55+panel(-1.42,.68,.241,.292)*3.95+panel(-1.37,.61,.451,.503)*2.8;
 const side=panel(.10,.80,.12,.215)*3.65+panel(.20,.75,.42,.50)*3.5+panel(-2.94,.49,.22,.33)*2.6;
 const v=horizon+front*.58+rear*.70+side*.37;
 return [v*.975,v*.989,v];
}
function trackRadiance(phi,x,y,z,profile) {
 // A fixed, world-aligned HDR panorama approximation, not a dynamic probe.
 // Near-horizon features provide orientation: ground band, distant trees,
 // separate cloud layers and a directional sky opening.
 const above=smooth(.018,.085,y);
 const skyline=.039+.018*Math.sin(phi*9.0+1.8)+.011*Math.sin(phi*24-.5)+.006*Math.cos(phi*49+.3);
 const trees=smooth(-.048,-.013,y)*(1-smooth(skyline-.012,skyline+.016,y))*
   smooth(-.36,.16,Math.cos(phi+.24));
 const ground=1-smooth(-.12,.025,y);
 const cloudNoise=.55*Math.sin(phi*3.0+y*6)+.27*Math.sin(phi*7-y*23)+.18*Math.cos(phi*17+y*20);
 const cloud=smooth(-.36,.40,cloudNoise+.13)*gaussian((y-.41)/.34)*above;
 const sunDot=Math.max(0,x*.55+y*.716+z*.43);
 if(profile==='track-night') {
  const moon=.48*Math.pow(Math.max(0,-x*.29+y*.94-z*.18),170);
  const horizon=.028*gaussian((y-.040)/.093)*(1-trees);
  const a=.007+above*.016+.015*cloud;
  return [a*.45+horizon*.62+moon*.79,a*.64+horizon*.76+moon*.88,a+moon];
 }
 const overcast=profile==='track-overcast';
 const sun=overcast?.27*Math.pow(sunDot,25):3.6*Math.pow(sunDot,150)+.70*Math.pow(sunDot,17);
 const diffuse=overcast?.46*above:.43*above;
 const band=gaussian((y-.093)/.12)*(1-trees)*(.15+.24*Math.cos(phi-.42)**2);
 const groundRadiance=overcast?.081:.11;
 const c=cloud*(overcast?.42:.65);
 return [(.021+ground*groundRadiance*.85+trees*.036+band*.91+diffuse*.71+c+sun*.98),
   (.023+ground*groundRadiance*.90+trees*.053+band+diffuse*.91+c*1.03+sun*.91),
   (.025+ground*groundRadiance+trees*.047+band*1.08+diffuse+c*1.07+sun*.82)];
}

// One tiny immutable source per preset. Three r160 caches one PMREM CubeUV
// per texture per renderer. Half floats are in linear-light, not sRGB bytes.
export function automotiveEnvironment(profile='studio') {
 if(!PROFILES.has(profile))throw new RangeError('Unknown automotive environment: '+profile);
 if(probes.has(profile))return probes.get(profile);
 const w=128,h=64,data=new Uint16Array(w*h*4),half=THREE.DataUtils.toHalfFloat;
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){
   // Same longitude convention as Three's equirectangular reflection shader:
   // atan(z,x)/(2pi)+.5; vertical sample ~= asin(y)/pi+.5.
   const phi=((i+.5)/w-.5)*Math.PI*2, latitude=((j+.5)/h-.5)*Math.PI;
   const y=Math.sin(latitude),flat=Math.cos(latitude),x=Math.cos(phi)*flat,z=Math.sin(phi)*flat;
   const radiance=profile==='studio'?studioRadiance(phi,y):profile==='studio-strips'?stripBoothRadiance(phi,y):trackRadiance(phi,x,y,z,profile);
   const at=(j*w+i)*4;
   for(let k=0;k<3;k++)data[at+k]=half(radiance[k]);
   data[at+3]=half(1);
 }
 const t=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.HalfFloatType);
 t.name='automotive '+profile;
 t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.LinearSRGBColorSpace;
 t.minFilter=t.magFilter=THREE.LinearFilter;
 t.wrapS=THREE.RepeatWrapping;
 t.needsUpdate=true;probes.set(profile,t);
 return t;
}

const CLOUDY=new Set(['cloudy','overcast','fog','rain','storm','snow','blizzard']);
export function automotiveTrackProfile({night=false,weather='clear'}={}) {
 if(night)return 'track-night';
 return CLOUDY.has(weather)
   ?'track-overcast':'track-clear';
}

// The pigmented binder interface is *under* the coat, not exposed to air.
// Keep the outer coat's physical .04 F0 at IOR 1.5; approximate the weaker
// buried substrate reflection with the Fresnel ratio for n=1.50 -> 1.70,
// not a second .04 air interface. This is an unflaked enamel approximation.
const fresnelAtNormal=(from,to)=>((to-from)/(from+to))**2;
const buriedPaintRatio=fresnelAtNormal(1.50,1.70)/fresnelAtNormal(1,1.50);
export const calibratedPaintDefaults=Object.freeze({
  clearcoatRoughness:.12,
  baseSpecular:buriedPaintRatio,
});
const supportByRenderer=new WeakMap();
function supportsPrefilter(renderer) {
 if(!renderer)return true; // Preview/test caller can supply its own renderer later.
 if(supportByRenderer.has(renderer))return supportByRenderer.get(renderer);
 const get=name=>renderer.extensions?.has(name)===true;
 const supported=renderer.capabilities?.isWebGL2
   ?get('EXT_color_buffer_float')
   :get('EXT_color_buffer_half_float')&&get('OES_texture_half_float')&&get('OES_texture_half_float_linear');
 supportByRenderer.set(renderer,supported);
 return supported;
}

// Grade only participating materials after track lighting/fog, before Three's
// display conversion. A neutral shoulder protects bright RGB from channel
// clipping while leaving diffuse values below knee unchanged.
function installHighlightRollOff(material) {
 material.onBeforeCompile=shader=>{
   const chunk='#include <tonemapping_fragment>';
   shader.fragmentShader=shader.fragmentShader.replace(chunk,`#ifdef TONE_MAPPING
 ${chunk}
 #else
 float automotivePeak = max(max(gl_FragColor.r,gl_FragColor.g),gl_FragColor.b);
 float automotiveExcess = max(0.0,automotivePeak-0.78);
 float automotiveShoulder = 0.78 + 0.22*automotiveExcess/(automotiveExcess+0.22);
 if(automotiveExcess>0.0) gl_FragColor.rgb *= automotiveShoulder/automotivePeak;
 #endif`);
 };
 material.customProgramCacheKey=()=> 'automotive-neutral-shoulder-v1';
}

export function automotiveMaterial(options, spec, { ormMap=null, normalMap=null }={}) {
 if(!validPreset(spec?.preset))return null;
 const {type,crease, ...defaults}=PRESETS[spec.preset];
 const {roughness,metalness,...base}=defaults;
 const map=options.map || null;
 // Change only this owned texture, not color-space or sampling for sprites.
 if(map&&!spec.keepTextureSampling){
   map.magFilter=THREE.LinearFilter;
   const pot=THREE.MathUtils.isPowerOfTwo(map.image.width)&&THREE.MathUtils.isPowerOfTwo(map.image.height);
   map.minFilter=pot?THREE.LinearMipmapLinearFilter:THREE.LinearFilter;
   map.generateMipmaps=pot;map.needsUpdate=true;
 }
 const shell=spec.preset==='clear-cover';
 const calibratedPaint=spec.preset==='paint'&&(spec.paintCalibration===true||
   spec.paintCalibration!==false&&automotivePaintCalibrated);
 const calibrated=calibratedPaint?{
   specularIntensity:bounded(spec.paintBaseSpecular,calibratedPaintDefaults.baseSpecular),
   clearcoatRoughness:bounded(spec.paintClearcoatRoughness,calibratedPaintDefaults.clearcoatRoughness,.0525),
 }:{};
 const material=new type({...options,...base,...calibrated,
   ...(shell?{side:THREE.FrontSide,forceSinglePass:true}:{}),
   roughness:bounded(spec.roughness,ormMap?1:roughness,.035),
   metalness:bounded(spec.metalness,ormMap?1:metalness),
   depthWrite:(shell||spec.preset==='glass')&&options.transparent?false:options.depthWrite??true,
   ...(ormMap?{aoMap:ormMap,roughnessMap:ormMap,metalnessMap:ormMap,aoMapIntensity:bounded(spec.aoIntensity,1)}:{}),
   ...(normalMap?{normalMap,normalScale:new THREE.Vector2().setScalar(bounded(spec.normalStrength,1,0,2))}:{}),
 });
 material.userData.automotive={
   preset:spec.preset,crease:bounded(spec.creaseAngle,crease,0,89),
   reflection:bounded(spec.reflection, spec.preset==='upholstery'?.45:1),
   ...(calibratedPaint?{paintCalibration:'coated-dielectric-v2'}:{}),
 };
 installHighlightRollOff(material);
 return material;
}

// All native meshes in a single model share the selected renderer profile.
// Refresh only on changed profile, changed model, or different context.
export function applyAutomotiveEnvironment(root,profile,renderer=null) {
 const authored=root?.userData?.automotiveMaterials;
 if(!authored?.length)return false;
 const supported=supportsPrefilter(renderer);
 const custom=profile?.texture?.isDataTexture===true&&typeof profile?.key==='string';
 const key=supported?profile:'no-prefilter';
 if(root.userData.automotiveEnvironmentKey===key)return false;
 const texture=supported?(custom?profile.texture:automotiveEnvironment(profile)):null;
 for(const m of authored) {
   if(Boolean(m.envMap)!==Boolean(texture))m.needsUpdate=true;
   m.envMap=texture;
   m.envMapIntensity=m.userData.automotive.reflection;
 }
 root.userData.automotiveEnvironmentKey=key;
 return true;
}
