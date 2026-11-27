import {wrxPilotPart} from './WrxVisualPilot.js';

export function normalizeModelBinding(value){
  if(typeof value==='string')value={ref:value};
  if(!value?.ref)return null;
  const vector=(v,fallback)=>fallback.map((n,i)=>Number.isFinite(Number(v?.[i]))?Number(v[i]):n);
  const scales=value.axleScale;
  const readScale=key=>Array.isArray(scales?.[key])&&scales[key].length===3&&scales[key].every(n=>Number.isFinite(n)&&n>0)
    ?[...scales[key]]:null;
  const front=readScale('front'),rear=readScale('rear');
  return {ref:String(value.ref),clip:String(value.clip||''),speed:Number.isFinite(Number(value.speed))?Number(value.speed):1,
    ...(value.ref==='Field-Forgetmenot-Wheel'&&(value.outboardFace==='+X'||wrxPilotPart(value.ref)==='wheel')?{outboardFace:'+X'}:{}),
    position:vector(value.position,[0,0,0]),rotation:vector(value.rotation,[0,0,0]),scale:vector(value.scale,[1,1,1]),...(front&&rear?{axleScale:{front,rear}}:{})};
}

// One authored wheel design can have the stock staggered dimensions by axle.
export function modelWheelBindingForAxle(binding, wheelID){
  const fit=String(wheelID).toLowerCase().startsWith('f')?binding?.axleScale?.front:binding?.axleScale?.rear;
  if(!fit)return binding;
  const standard=normalizeModelBinding(binding);
  const scale=standard?.axleScale&&standard.axleScale[String(wheelID).toLowerCase().startsWith('f')?'front':'rear'];
  return scale?{...standard,scale:standard.scale.map((n,i)=>n*scale[i]),axleScale:null}:binding;
}

// The labelled pilot wheel has a real outboard face only on local +X.
// Turn JUST the model at the mirrored wheel mounts, not the spin, tyre
// suspension or separately fitted stationary caliper. A proper rotation
// leaves lettering and material normals readable from outside both sides.
export function placeOutboardWheelFace(binding, side, studioRosterWheel=false){
  const wrxWheel=binding?.ref==='Field-Forgetmenot-Wheel'&&(binding.outboardFace==='+X'||wrxPilotPart(binding.ref)==='wheel');
  if(!(side<0)||!(studioRosterWheel||wrxWheel))return binding;
  const [x,y,z]=binding.rotation||[0,0,0];
  // Authored Three XYZ Euler: Rx(x) Ry(y) Rz(z) Ry(pi)
  // = Rx(x) Ry(y+pi) Rz(-z).
  return {...binding,rotation:[x,y+Math.PI,-z]};
}
