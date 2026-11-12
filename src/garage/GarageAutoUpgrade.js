import {calculateCarPerformance,CAR_PERFORMANCE_LIMITS} from '../racing/CarPerformance.js';
import {buildGarageCar,garageTuningRanges,partFits,safeGarageKey} from './CarPart.js';
import {fitGarageParts} from './GarageSetups.js';

export const AUTO_UPGRADE_CLASSES=CAR_PERFORMANCE_LIMITS;
// Select dry-tarmac parts with their supplied calibrations; never optimize sliders.
const slots=['ecu','intake','exhaust','ignition','camshaft','fuel-system','turbo','weight','flywheel','clutch','driveline','wheels','transmission','differential','brakes','suspension','alignment','aero','tires'];
export function garageCarPerformance(car,tuning){
 return calculateCarPerformance({...car,transmissions:{},tuning:{...car.tuning,...tuning,topSpeedMph:tuning.topSpeedMps!=null?tuning.topSpeedMps/0.44704:car.tuning?.topSpeedMph}});
}
export async function planAutoUpgrade(garage,ref,stock,target,catalog,evaluate,progress=garage.items.progress,{signal}={}){
 signal?.throwIfAborted();
 const limit=AUTO_UPGRADE_CLASSES.find(c=>c.label===target)?.limit;
 if(!safeGarageKey(ref)||limit===undefined)throw Error('Choose a car and target class');
 stock=await garage.stockBaseline(stock);
 signal?.throwIfAborted();
 const setup=garage.configuration(ref,progress),original=garage.installed(ref,progress),tires={};
 for(const item of [...original,...catalog.values()].filter(Boolean))if(item.carPart?.tireRef&&!tires[item.carPart.tireRef]){try{tires[item.carPart.tireRef]=await garage.loadTire(item.carPart.tireRef);}catch{}}
 signal?.throwIfAborted();
 const baseline=original.filter(item=>!slots.includes(item.carPart.slot));
 const retainedRanges=garageTuningRanges(baseline);
 const retainedTune=Object.fromEntries(Object.entries(setup.tune).filter(([id,value])=>retainedRanges[id]&&value>=retainedRanges[id].min&&value<=retainedRanges[id].max));
 const score=(parts,values=retainedTune)=>{
  const ranges=garageTuningRanges(parts),tune=Object.fromEntries(Object.entries(values).filter(([id,v])=>ranges[id]&&v>=ranges[id].min&&v<=ranges[id].max));
  return evaluate(buildGarageCar(stock,{parts,tires,tune}));
 };
 const initial=score(original,setup.tune),baseRating=score(baseline);
 if(baseRating.points>limit)throw Error(`This driving setup cannot fit within ${target} ${limit} PI.`);
 const ownedHere=id=>original.some(p=>p.id===id);
 const price=item=>ownedHere(item.id)||garage.availableCount(item.id,progress)>0?0:item.carPart.price;
 const eligible=[...catalog].filter(([,item])=>item?.carPart&&['street','sport','race'].includes(item.carPart.tier)&&(!item.carPart.tireRef||['stock','street','sport','tarmac'].includes(String(item.carPart.tireRef).replace('builtin:','').toLowerCase()))&&slots.includes(item.carPart.slot)&&partFits(item.carPart,ref,stock)&&
  (ownedHere(item.id)||garage.availableCount(item.id,progress)>0||(item.carPart.forSale&&(!item.carPart.unlockKey||progress.unlocks[item.carPart.unlockKey]))));
 const listPrice=state=>state.refs.reduce((sum,ref)=>sum+(catalog.get(ref)?.carPart.price||0),0);
 // Search ranking must not change merely because the previous plan was bought.
 const compare=(a,b)=>b.rating.points-a.rating.points||listPrice(a)-listPrice(b)||a.refs.slice().sort().join().localeCompare(b.refs.slice().sort().join());
 let beam=[{parts:baseline,refs:[],cost:0,rating:baseRating}];
 for(const slot of slots){
  await new Promise(resolve=>setTimeout(resolve,0));
  signal?.throwIfAborted();
  const options=eligible.filter(([,item])=>item.carPart.slot===slot),next=[...beam];
  for(const state of beam)for(const [partRef,item] of options){
   if(state.parts.some(p=>p.id===item.id))continue;
   const parts=[...state.parts.filter(p=>p.carPart.slot!==slot),item];
   if(parts.some(p=>p.carPart.requires.some(id=>!parts.some(q=>q.id===id))))continue;
   try{
    const rating=score(parts);
    if(rating.points<=state.rating.points||rating.points>limit)continue;
    next.push({parts,refs:[...state.refs,partRef],cost:state.cost+price(item),rating});
   }catch{/* Unsupported or conflicting custom parts are not auto-installed. */}
  }
  // Retain several PI levels so a smaller upgrade can leave room for a later one.
  const unique=new Map();
  for(const state of next.sort(compare))if(!unique.has(state.rating.points))unique.set(state.rating.points,state);
  const ranked=[...unique.values()];
  beam=ranked.length<=8?ranked:Array.from({length:8},(_,i)=>ranked[Math.floor(i*(ranked.length-1)/7)]);
 }
 const originalDefaults=score(original);
 if(originalDefaults.points<=limit){
  const refs=original.filter(p=>slots.includes(p.carPart.slot)).map(p=>[...catalog].find(([,item])=>item?.id===p.id)?.[0]);
  if(refs.every(Boolean))beam.push({parts:original,refs,cost:0,rating:originalDefaults});
 }
 let best=beam.sort(compare)[0];
 // Later parts can make an earlier slot worthwhile. Finish at a stable local
 // optimum so applying the same class again cannot sell another small upgrade.
 while(true){
  await new Promise(resolve=>setTimeout(resolve,0));
  signal?.throwIfAborted();
  let improved=best;
  for(const [partRef,item] of eligible){
   if(best.parts.some(p=>p.id===item.id))continue;
   const parts=[...best.parts.filter(p=>p.carPart.slot!==item.carPart.slot),item];
   if(parts.some(p=>p.carPart.requires.some(id=>!parts.some(q=>q.id===id))))continue;
   try{
    const rating=score(parts);if(rating.points<=best.rating.points||rating.points>limit)continue;
    const refs=best.refs.filter(r=>catalog.get(r).carPart.slot!==item.carPart.slot);
    refs.push(partRef);
    const cost=refs.reduce((sum,r)=>{const p=catalog.get(r);return sum+price(p);},0);
    const candidate={parts,refs,cost,rating};if(compare(candidate,improved)<0)improved=candidate;
   }catch{}
  }
  if(improved===best)break;best=improved;
 }
 const removed=original.filter(p=>slots.includes(p.carPart.slot)&&!best.parts.some(q=>q.id===p.id)).map(p=>p.id);
 const changes=slots.filter(slot=>original.find(p=>p.carPart.slot===slot)?.id!==best.parts.find(p=>p.carPart.slot===slot)?.id).length;
 return {target,limit,cost:best.cost,refs:best.refs,removed,changes,resetsTune:JSON.stringify(retainedTune)!==JSON.stringify(setup.tune),tune:retainedTune,rating:best.rating,initial,token:JSON.stringify([target,best.refs,removed,best.cost,best.rating.points,retainedTune])};
}
export async function applyAutoUpgrade(garage,ref,stock,target,catalog,evaluate,expectedToken){
 if(!expectedToken)throw Error('Review the auto-upgrade quote first');
 return garage.transaction(async next=>{
  const plan=await planAutoUpgrade(garage,ref,stock,target,catalog,evaluate,next);
  if(plan.token!==expectedToken)throw Error('Auto-upgrade quote changed. Review the new price and PI.');
  const setup=next.garage.cars[ref]||={installed:{},tune:{}};
  for(const slot of slots)delete setup.installed[slot];
  setup.tune=structuredClone(plan.tune);
  const receipt=fitGarageParts(garage,next,ref,stock,plan.refs,catalog);
  delete next.garage.cars[ref].setupId;
  if(receipt.cost!==plan.cost)throw Error('Auto-upgrade price changed');
  return {...receipt,debit:receipt.cost,rating:plan.rating};
 });
}
