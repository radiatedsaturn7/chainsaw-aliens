export function normalizeModelBinding(value){
  if(typeof value==='string')value={ref:value};
  if(!value?.ref)return null;
  const vector=(v,fallback)=>fallback.map((n,i)=>Number.isFinite(Number(v?.[i]))?Number(v[i]):n);
  return {ref:String(value.ref),clip:String(value.clip||''),speed:Number.isFinite(Number(value.speed))?Number(value.speed):1,
    position:vector(value.position,[0,0,0]),rotation:vector(value.rotation,[0,0,0]),scale:vector(value.scale,[1,1,1])};
}
