import {openingObjective,evaluateCampaignRun} from './CampaignObjectives.js';
import {normalizeItemDocument} from '../items/ItemDocument.js';
import {safeGarageKey} from './CarPart.js';

// Main missions award equipment for the following leg. These are inventory
// grants, never automatic installations or prerequisites for entering a race.
export const CAMPAIGN_PART_REWARDS={
 'Tower Hill Road':'snow-tires',
 'Mount Washington Auto Road — point-to-point':'rally-suspension',
 'Laurel Highlands Scenic Byway':'rain-tires',
 'Ohio River Crossing':'rally-tires',
 'Ozark Backroads':'street-brakes',
 'Data Center City':'race-tires',
 'Historic Route 66':'race-brakes',
 'Pikes Peak Highway':'offroad-suspension',
 'Moki Dugway':'sport-tires',
 'Oak Creek Canyon':'race-suspension',
 'Angeles Crest Highway':'race-transmission'
};
export function raceRewardQuote(ref,race={},progress={}){
 race ||= {};progress ||= {};
 const nodes=race.road?.nodes||[];
 let length=Number(race.campaign?.lengthM)||0;
 if(!length)for(let i=1;i<nodes.length;i++)length+=Math.hypot(nodes[i].x-nodes[i-1].x,nodes[i].y-nodes[i-1].y);
 const km=Math.max(1,Math.min(60,length/1000));
 const main=Object.hasOwn(CAMPAIGN_PART_REWARDS,ref);
 const scrap=Math.round((150+km*25+(main?150:0))/25)*25;
 const first=!progress.rewards?.[ref]?.clears;
 const surfaces=[race.surface,race.road?.surface,race.campaign?.surface,...new Set((race.road?.segments||[]).map(s=>s.surface))].filter(Boolean).join(' ');
 const conditions=surfaces+' '+race.weather;
 const scoring=race.campaign?.scoring||race.type||'';
 const pool=/drift/i.test(scoring)?['drift-tires','drift-suspension','drift-differential']:
  /drag/i.test(scoring)?['street-clutch','sport-flywheel','drag-transmission']:
  /snow|ice/i.test(conditions)?['snow-tires','rally-suspension','rally-differential']:
  /gravel|dirt|sand/i.test(conditions)?['rally-tires','offroad-suspension','street-skid-plates','rally-differential']:
  /rain|wet/i.test(conditions)?['rain-tires','sport-brakes','street-differential']:
  ['street-brakes','sport-tires','street-suspension','sport-intake','street-exhaust','street-cooling'];
 const hash=Array.from(String(ref)).reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);
 const part=CAMPAIGN_PART_REWARDS[ref]||pool[hash%pool.length];
 return {objective:openingObjective(ref,progress.rewards?.[ref]),scrap,firstBonus:first?scrap:0,part:first?part:null,first,total:scrap*(first?2:1),surfaces,weather:String(race.weather||'clear'),distanceKm:km};
}
export function ownedCampaignCars(garage,selected=''){
 return [...new Set([...(garage.ownedCars||[]),selected].filter(safeGarageKey))];
}
export function campaignCarPrice(pi=500){return Math.round((1500+Math.max(0,Math.min(1000,Number(pi)||500))**2/40)/100)*100;}
export async function awardCampaignRace(garage,{ref,race,runId,success=true,run=null}){
 if(!success||!safeGarageKey(ref)||!runId)return null;
 const result=await garage.transaction(async next=>{
  const prior=next.garage.rewards[ref];
  if(prior?.lastRun===runId)return {...prior.lastReward,duplicate:true};
  const quote=raceRewardQuote(ref,race,next.garage);
  let partName='',salvage=0;
  if(quote.part){
   const item=normalizeItemDocument(await garage.items.library.load(quote.part));
   if(next.bags.items[item.id]>0){salvage=Math.max(50,Math.round(item.carPart.price*.25));}
   else{
    next.garage.parts[item.id]=item;next.bags.items[item.id]=1;next.inventory[item.id]=1;next.contentNames[item.id]=item.name;partName=item.name;
   }
  }
  const evaluation=evaluateCampaignRun(ref,run,prior);
  const reward={scrap:quote.total+salvage+evaluation.objectiveBonus,base:quote.scrap,firstBonus:quote.firstBonus,salvage,partName,...evaluation};
  const bestTimes={...prior?.bestTimes};
  if(evaluation.personalBest&&safeGarageKey(run?.carRef))bestTimes[run.carRef]=run.elapsedMs;
  next.garage.rewards[ref]={clears:(prior?.clears||0)+1,lastRun:runId,lastReward:reward,objectiveEarned:evaluation.objectiveEarned,bestTimes};
  return {credit:reward.scrap,...reward};
 });
 // Travel restores the pre-race player snapshot, then replays item events.
 // Register the earned currency once so returning cannot erase the payout.
 if(!result.duplicate){
  garage.items.events.push({revision:++garage.items.revision,item:{id:'race-scrap',name:'Race scrap',effects:[{type:'currency',amount:result.scrap}]}});
 }
 return result;
}
