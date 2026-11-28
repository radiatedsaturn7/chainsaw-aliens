import {calculateCarPerformance, carCatalogId} from './CarPerformance.js';
import {isUserRaceCar} from './CarPresets.js';
import {buildGarageCar, normalizeCarPart} from '../garage/CarPart.js';

// Competition-only ECU preparation, using the same torque-curve transformation
// as garage parts. Never modify the saved car or copy the player's physics.
const ecu = {id:'competition-ecu',carPart:normalizeCarPart({slot:'ecu',forSale:false,
  tuning:[{field:'torqueScale',min:.75,max:1.25,step:.0001}]})};
export function matchRaceCarPI(car, target, resolveTuning) {
  const base=car;
  const rating=candidate=>calculateCarPerformance({...candidate,tuning:resolveTuning(candidate),transmissions:{}}).points;
  let best={car:base,points:rating(base),scale:1};
  if(best.points===target)return best;
  let lo=.75,hi=1.25;
  for(let i=0;i<22;i++){
    const scale=(lo+hi)/2;
    const candidate=buildGarageCar(base,{parts:[ecu],tune:{torqueScale:scale}});
    const points=rating(candidate);
    if(Math.abs(points-target)<Math.abs(best.points-target))best={car:candidate,points,scale};
    if(points===target)break;
    if(points<target)lo=scale;else hi=scale;
  }
  return best;
}
export function selectMatchedRaceGrid(cars, player, count, resolveTuning) {
  const playerRating=calculateCarPerformance({...player,tuning:resolveTuning(player),transmissions:{}});
  const target=playerRating.points;
  const unique=new Map();
  for(const car of cars||[]){
    const id=carCatalogId(car);
    if(!id||id===carCatalogId(player)||!isUserRaceCar(car)||!car.__playtestDocumentName||unique.has(id))continue;
    const points=calculateCarPerformance({...car,tuning:resolveTuning(car),transmissions:{}}).points;
    unique.set(id,{car,points});
  }
  const closest=[...unique.values()].sort((a,b)=>Math.abs(a.points-target)-Math.abs(b.points-target)
    ||carCatalogId(a.car).localeCompare(carCatalogId(b.car))).slice(0,24);
  const matched=closest.map(({car})=>{
    const match=matchRaceCarPI(car,target,resolveTuning);
    const rating=calculateCarPerformance({...match.car,tuning:resolveTuning(match.car),transmissions:{}});
    // Equal total PI can hide a large launch mismatch (heavy RWD versus AWD).
    // Prefer comparable acceleration among equal-PI builds; retain the actual
    // drivetrains and torque curves rather than granting a launch multiplier.
    return {...match,id:carCatalogId(car),launchMismatch:Math.abs(Math.log(rating.zeroToSixtySec/playerRating.zeroToSixtySec))};
  }).sort((a,b)=>Math.abs(a.points-target)-Math.abs(b.points-target)
    ||a.launchMismatch-b.launchMismatch||Math.abs(a.scale-1)-Math.abs(b.scale-1));
  if(!matched.length)return Array.from({length:count},()=>({car:player,id:carCatalogId(player),points:target,target,scale:1}));
  const pool=matched.slice(0,Math.min(count,Math.max(3,matched.filter(c=>c.points===target).length)));
  // A partially downloaded catalog may have fewer matches. Record the actual PI
  // instead of pretending a different car has the requested rating.
  return Array.from({length:pool.length?count:0},(_,i)=>({...pool[i%pool.length],target}));
}
