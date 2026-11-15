import {MECHANICAL_COMPONENTS} from '../racing/simulation/MechanicalModel.js';
// Optional goals: finishing and progression never depend on these bonuses.
export const OPENING_MISSIONS = {
 'Tower Hill Road': {bonus:150,brief:'Get through the storm. Snow tires won here will help on Mount Washington.',maxDamage:15},
 'Mount Washington Auto Road — point-to-point': {bonus:250,brief:'Climb steadily. Fit your snow tires in Upgrade; rally suspension is the prize for Laurel Highlands.',maxDamage:10},
 'Laurel Highlands Scenic Byway': {bonus:250,brief:'Manage the broken pavement. Rally suspension helps; rain tires prepare you for Ohio.',maxDamage:10}
};
export function campaignConditionSnapshot(mechanical){
 return Object.fromEntries(Object.entries(mechanical?.components||{}).map(([id,c])=>[id,Math.max(0,Math.min(100,Number(c.damage)||0))]));
}
export function campaignRunSummary(session){
 const before=session.campaignStartCondition;
 const after=campaignConditionSnapshot(session.mechanical);
 const measured=!!before&&Object.keys(before).length>0&&Object.keys(before).every(id=>Number.isFinite(after[id]));
 let worstDamage=0,worstPart='';
 if(measured)for(const [id,value] of Object.entries(before)){
  const delta=Math.max(0,after[id]-value);
  if(delta>worstDamage){worstDamage=delta;worstPart=id;}
 }
 return {elapsedMs:Number(session.elapsedMs),carRef:session.carId,finished:session.finishReason!=='time-limit',
  eligible:!session.debugCarOverride&&!session.debugEnvironment,measured,
  recoveries:Number(session.campaignRecoveries||0),worstDamage,worstPart};
}
export function openingObjective(ref,prior={}){
 const mission=OPENING_MISSIONS[ref];
 return mission?{...mission,earned:prior.objectiveEarned===true,
  label:`No recoveries; at most ${mission.maxDamage}% new damage to any component`}:null;
}
export function evaluateCampaignRun(ref,run,prior={}){
 const objective=openingObjective(ref,prior);
 const valid=run?.eligible===true&&run?.measured===true&&Number.isFinite(run.worstDamage)&&Number.isFinite(run.recoveries);
 const achieved=!!(objective&&valid&&run.recoveries===0&&run.worstDamage<=objective.maxDamage);
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
