export function normalizeModelBinding(value){
  if(typeof value==='string')value={ref:value};
  if(!value?.ref)return null;
  const vector=(v,fallback)=>fallback.map((n,i)=>Number.isFinite(Number(v?.[i]))?Number(v[i]):n);
  const scales=value.axleScale;
  const readScale=key=>Array.isArray(scales?.[key])&&scales[key].length===3&&scales[key].every(n=>Number.isFinite(n)&&n>0)
    ?[...scales[key]]:null;
  const front=readScale('front'),rear=readScale('rear');
  return {ref:String(value.ref),clip:String(value.clip||''),speed:Number.isFinite(Number(value.speed))?Number(value.speed):1,
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
