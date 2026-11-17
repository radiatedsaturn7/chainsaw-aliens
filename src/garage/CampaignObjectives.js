import {campaignCourse,campaignTargets} from './CampaignChallenges.js';
import {MECHANICAL_COMPONENTS} from '../racing/simulation/MechanicalModel.js';
// Optional goals: finishing and progression never depend on these bonuses.
export const OPENING_MISSIONS = {
 'Tower Hill Road': {bonus:150,brief:'Get through the storm. Snow tires won here will help on Mount Washington.',maxDamage:15},
 'Mount Washington Auto Road — point-to-point': {bonus:250,brief:'Climb steadily. Fit your snow tires in Upgrade; rally suspension is the prize for Laurel Highlands.',maxDamage:10},
 'Laurel Highlands Scenic Byway': {bonus:250,brief:'Manage the broken pavement. Rally suspension helps; rain tires prepare you for Ohio.',maxDamage:10},
 'Ohio River Crossing': {bonus:300,brief:'Keep it tidy on the wet crossing.',maxDamage:8},
 'Ozark Backroads': {bonus:300,brief:'Protect the suspension on the broken backroads.',maxDamage:20,componentPrefix:'damper_',componentLimit:8},
 'Data Center City': {bonus:350,brief:'Thread the industrial streets without a recovery.',maxDamage:12},
 'Historic Route 66': {bonus:350,brief:'Keep a steady pace through the long haul.',maxDamage:15,timed:true},
 'Pikes Peak Highway': {bonus:400,brief:'Make the summit without a recovery.',maxDamage:20},
 'Moki Dugway': {bonus:400,brief:'Protect the brakes on the descent.',maxDamage:20,componentPrefix:'pads_',componentLimit:8},
 'Oak Creek Canyon': {bonus:400,brief:'Link the canyon corners cleanly and keep moving.',maxDamage:12,timed:true},
 'Angeles Crest Highway': {bonus:500,brief:'Bring the car home in one piece at a steady pace.',maxDamage:10,timed:true}
};
export function campaignConditionSnapshot(mechanical){
 return Object.fromEntries(Object.entries(mechanical?.components||{}).map(([id,c])=>[id,Math.max(0,Math.min(100,Number(c.damage)||0))]));
}
export function campaignRunSummary(session){
 const before=session.campaignStartCondition;
 const after=campaignConditionSnapshot(session.mechanical);
 const measured=!!before&&Object.keys(before).length>0&&Object.keys(before).every(id=>Number.isFinite(after[id]));
 let worstDamage=0,worstPart='';const componentDamage={};
 if(measured)for(const [id,value] of Object.entries(before)){
  const delta=Math.max(0,after[id]-value);componentDamage[id]=delta;
  if(delta>worstDamage){worstDamage=delta;worstPart=id;}
 }
 return {elapsedMs:Number(session.elapsedMs),carRef:session.carId,finished:session.finishReason!=='time-limit',
  eligible:!session.debugCarOverride&&!session.debugEnvironment,measured,
  recoveries:Number(session.campaignRecoveries||0),worstDamage,worstPart,componentDamage,
  pi:session.campaignChallenge?.pi,sectors:session.campaignChallenge?.sectors,driftScore:Number(session.driftScore?.points)||0};
}
export function openingObjective(ref,prior={},race={},pi=500){
 const scoring=race.campaign?.scoring;
 const fallback=(race.campaign?.optional||race.road?.nodes?.length>1)?{bonus:150,brief:scoring==='drift'?'Link controlled slides through the course.':'Finish cleanly and keep the repair bill down.',maxDamage:15,...(scoring==='drift'?{driftTarget:Math.round(campaignCourse(race).lengthM)}:{})}:null;
 const mission=OPENING_MISSIONS[ref]||fallback;
 if(!mission)return null;
 const target=mission.timed?campaignTargets(race,pi).bronzeMs:null;
 const extra=mission.componentPrefix?`; at most ${mission.componentLimit}% new ${mission.componentPrefix==='damper_'?'damper':'brake pad'} damage`:mission.driftTarget?`; score ${mission.driftTarget} drift points`:target?`; finish within ${Math.floor(target/60000)}:${String(Math.floor(target/1000)%60).padStart(2,'0')} (class target)`:'';
 return {...mission,targetMs:target,earned:prior.objectiveEarned===true,
  label:`No recoveries; at most ${mission.maxDamage}% new damage to any component${extra}`};
}
export function evaluateCampaignRun(ref,run,prior={},race={}){
 const objective=openingObjective(ref,prior,race,run?.pi);
 const valid=run?.eligible===true&&run?.measured===true&&Number.isFinite(run.worstDamage)&&Number.isFinite(run.recoveries);
 const achieved=!!(objective&&valid&&run.recoveries===0&&run.worstDamage<=objective.maxDamage
  &&(run.finished===true||ref==='Tower Hill Road')
  &&(!objective.targetMs||run.elapsedMs>0&&run.elapsedMs<=objective.targetMs)
  &&(!objective.driftTarget||run.driftScore>=objective.driftTarget)
  &&(!objective.componentPrefix||Object.entries(run.componentDamage||{}).some(([id])=>id.startsWith(objective.componentPrefix))&&Object.entries(run.componentDamage||{}).filter(([id])=>id.startsWith(objective.componentPrefix)).every(([,damage])=>Number.isFinite(damage)&&damage<=objective.componentLimit)));
 const bonus=achieved&&!objective.earned?objective.bonus:0;
 const timed=valid&&run.finished===true&&run.recoveries===0&&Number.isFinite(run.elapsedMs)&&run.elapsedMs>0;
 const previous=prior.bestTimes?.[run?.carRef];
 const personalBest=timed&&(!previous||run.elapsedMs<previous);
 let feedback='';
 if(valid){
  if(run.worstDamage>5){
   const part=MECHANICAL_COMPONENTS.find(c=>c.id===run.worstPart)?.label||String(run.worstPart||'a component').replaceAll('_',' ');
   feedback=`We added ${Math.round(run.worstDamage)}% damage to ${part}. Check it under Repair before the next run.`;
  }else if(run.recoveries>0)feedback='We needed a recovery. Try leaving more margin before the next difficult section.';
  else feedback='We got through with little new component damage. That leaves more scrap for the next leg.';
 }
 return {objectiveBonus:bonus,objectiveEarned:!!prior.objectiveEarned||achieved,
  objectiveStatus:objective?(achieved?'Objective met':valid?'Objective missed':'Objective not measured'):'',
  personalBest,bestTimeMs:timed?Math.min(previous||Infinity,run.elapsedMs):previous||null,feedback};
}
