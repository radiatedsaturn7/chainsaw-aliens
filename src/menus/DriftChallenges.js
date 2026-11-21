// Full imported circuits used for game-authored score attacks, not replicas of
// professional judged drift sections. Sources/layout caveats: tools/campaigns/drift_challenges.txt.
export const DRIFT_CHALLENGES = [
 {id:'horse-thief',name:'Horse Thief Slide',ref:'Willow Springs — Horse Thief Mile',heat:1,targets:[2000,4000,6500]},
 {id:'streets-sideways',name:'Sideways Streets',ref:'Willow Springs — Streets of Willow',heat:2,targets:[3500,7000,11000]},
 {id:'atlanta-angle',name:'Atlanta Angle',ref:'Road Atlanta — Short Course',heat:3,targets:[4000,8000,12000]},
 {id:'ebisu-school',name:'Ebisu School',ref:'Ebisu Circuit — School Course',heat:1,targets:[600,1400,2400]},
 {id:'ebisu-north',name:'Ebisu North',ref:'Ebisu Circuit — North Course',heat:2,targets:[1400,2800,4500]},
 {id:'ebisu-touge',name:'Ebisu Touge',ref:'Ebisu Circuit — Touge Course',heat:3,targets:[1200,2500,4000]},
 {id:'ebisu-west-drift',name:'Ebisu West Drift',ref:'Ebisu Circuit — West Drift Course',heat:1,targets:[900,1800,3000]},
 {id:'ebisu-west',name:'Ebisu West',ref:'Ebisu Circuit — West Course',heat:3,targets:[2600,5200,8000]},
 {id:'nikko',name:'Nikko Slide',ref:'Nikko Circuit — Main Course',heat:2,targets:[1500,3000,4800]},
 {id:'mobara-east',name:'Mobara East',ref:'Mobara Twin Circuit — East Course',heat:2,targets:[1600,3200,5000]},
 {id:'bihoku-a',name:'Bihoku A',ref:'Bihoku Highland Circuit — Course A',heat:1,targets:[900,1900,3100]},
 {id:'bihoku-b',name:'Bihoku B',ref:'Bihoku Highland Circuit — Course B',heat:2,targets:[1400,2900,4700]},
 {id:'tsukuba-reverse',name:'Tsukuba Reverse',ref:'Tsukuba — Course 1000 — Drift Reverse',heat:2,targets:[1300,2700,4400]}
];
export function driftChallengeCatalog(byRef){
 return DRIFT_CHALLENGES.filter(c=>byRef.get(c.ref)?.properCircuit).map(c=>({
  id:'drift-'+c.id,kind:'drift',name:c.name,heat:c.heat,targets:[...c.targets],
  rounds:[{ref:c.ref,laps:2}]
 }));
}
export function driftMedal(definition,points){
 const targets=definition.targets||[];
 return points>=targets[2]?'Gold':points>=targets[1]?'Silver':points>=targets[0]?'Bronze':'No medal';
}
export function driftBestKey(definition){return 'driftBest.'+definition.id;}
export function driftResultVariables(state,progress={}){
 if(state?.definition?.kind!=='drift'||state.phase!=='complete')return {};
 const result=state.results[0]?.classification?.find(r=>r.id==='player');
 if(!result||result.dnf)return {};
 const key=driftBestKey(state.definition);
 return {[key]:Math.max(Number(progress[key])||0,Number(result.score)||0)};
}
