export const CAR_SMOKE_GROUPS = {
  road: {label:'Road & Water', slots:[['asphalt','Asphalt'],['wet-asphalt','Wet asphalt'],['water','Water']]},
  loose: {label:'Loose Surfaces', slots:[['dirt','Dirt'],['mud','Mud'],['gravel','Gravel'],['wet-gravel','Wet gravel'],['grass','Grass'],['sand','Sand'],['rock-solid','Rock']]},
  winter: {label:'Snow & Ice', slots:[['snow','Snow'],['slush','Slush'],['ice','Ice']]},
  effects: {label:'Effect Defaults', slots:[['skidSmoke','Skid / burnout'],['dirtDust','Dirt dust'],['gravelDust','Gravel dust'],['grassDust','Grass dust'],['snowDust','Snow dust'],['wetSpray','Water spray']]}
};
export const DEFAULT_CAR_SMOKE = Object.freeze({
  asphalt:'burnoutsmoke','wet-asphalt':'waterspray',water:'waterspray',
  dirt:'dirtsmoke',mud:'dirtsmoke',gravel:'gravelsmoke','wet-gravel':'gravelsmoke',grass:'dirtsmoke',sand:'dirtsmoke','rock-solid':'gravelsmoke',
  snow:'snowsmoke',slush:'snowsmoke',ice:'snowsmoke',
  skidSmoke:'burnoutsmoke',dirtDust:'dirtsmoke',gravelDust:'gravelsmoke',grassDust:'dirtsmoke',snowDust:'snowsmoke',wetSpray:'waterspray'
});
export function normalizeCarSmoke(value={}) {
  return Object.fromEntries(Object.keys(DEFAULT_CAR_SMOKE).map(key=>[key,typeof value?.[key]==='string'?value[key].trim().slice(0,200):'']));
}
export function carSmokeArtRef(car, surface, effect) {
  // Tire marks remain on the ground; only airborne particles use smoke art.
  if (effect==='asphaltSkid') return '';
  const smoke=car?.art?.smoke;
  return String(smoke?.[surface] || smoke?.[effect] || '').trim();
}
export function carSmokeArtRefs(car) {return [...new Set(Object.values(normalizeCarSmoke(car?.art?.smoke)).filter(Boolean))];}
export function smokeAnimationFrame(durations=[],ageMs=0) {
  const total=durations.reduce((sum,d)=>sum+Math.max(1,Number(d)||100),0);
  if (!total) return 0;
  let time=Math.max(0,Number(ageMs)||0)%total;
  for(let i=0;i<durations.length;i++){time-=Math.max(1,Number(durations[i])||100);if(time<0)return i;}
  return 0;
}
