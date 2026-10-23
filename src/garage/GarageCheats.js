import {partFits,garageTuningRanges,isGarageUpgrade} from './CarPart.js';

// Rank authored upgrade tiers, then price within a tier. Dependencies and car
// restrictions still apply; the cheat grants parts rather than bypassing physics.
export function bestCheatParts(catalog,ref,stock){
 const rank={custom:0,street:1,sport:2,race:3};
 const candidates=catalog.filter(i=>isGarageUpgrade(i)&&partFits(i.carPart,ref,stock)).sort((a,b)=>(rank[b.carPart.tier]-rank[a.carPart.tier])||b.carPart.price-a.carPart.price||a.id.localeCompare(b.id));
 const byId=new Map(candidates.map(i=>[i.id,i])),chosen=new Map();
 function add(item,plan,visiting=new Set()){
  const slot=item.carPart.slot,existing=plan.get(slot);
  if(existing)return existing.id===item.id;
  if(visiting.has(item.id))return false;
  visiting.add(item.id);plan.set(slot,item);
  for(const id of item.carPart.requires){const dependency=byId.get(id);if(!dependency||!add(dependency,plan,visiting))return false;}
  visiting.delete(item.id);return true;
 }
 for(const item of candidates){
  if(chosen.has(item.carPart.slot))continue;
  const plan=new Map(chosen);
  if(add(item,plan)){try{garageTuningRanges([...plan.values()]);}catch{continue;}for(const [slot,part] of plan)chosen.set(slot,part);}
 }
 return [...chosen.values()];
}
export async function unlockBestUpgrades(garage,ref,stock){
 const entries=await garage.items.library.list();
 const catalog=(await Promise.all(entries.map(e=>garage.items.library.load(e.name)))).filter(isGarageUpgrade);
 return garage.transaction(next=>{
  next.unlocks['cheat.lonely']=true;
  for(const item of catalog){
   next.garage.parts[item.id]=item;next.contentNames[item.id]=item.name;
   if(item.carPart.unlockKey)next.unlocks[item.carPart.unlockKey]=true;
   next.bags.items[item.id]=Math.max(1,Number(next.bags.items[item.id])||0);
   next.inventory[item.id]=next.bags.items[item.id];
  }
  if(ref&&stock){
   const best=bestCheatParts(catalog,ref,stock),setup=next.garage.cars[ref]||={installed:{},tune:{}};
   setup.installed=Object.fromEntries(best.map(i=>[i.carPart.slot,i.id]));
   for(const item of best){const used=Object.values(next.garage.cars).filter(c=>Object.values(c.installed).includes(item.id)).length;next.bags.items[item.id]=Math.max(next.bags.items[item.id],used);next.inventory[item.id]=next.bags.items[item.id];}
   garage.validateSetup(ref,next);garage.pruneTune(ref,next);
   next.unlocks[`cheat.lonely.equipped.${ref}`]=true;
  }
 });
}
export async function redeemGarageCheat(garage,code,{carRef='',stock=null}={}){
 const normalized=String(code).toUpperCase();
 if(normalized==='NOLOVE'){await garage.transaction(()=>({debit:-1000000}));return 'NOLOVE — 1,000,000 scrap added';}
 if(normalized==='LONELY'){await unlockBestUpgrades(garage,carRef,stock);return carRef&&stock?'LONELY — Upgrades unlocked and best compatible parts equipped':'LONELY — Upgrades unlocked; best parts equip when you choose a car';}
 if(normalized==='IGNORE'){await garage.transaction(next=>{next.unlocks['cheat.ignore']=true;});return 'IGNORE — Damage disabled';}
 throw Error('Invalid cheat code');
}
