import {isRaceRouteLoopClosed} from '../racing/RaceRouteProgress.js';
import {calculateCarPerformance,carPerformanceClass} from '../racing/CarPerformance.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const cache=new WeakMap();
// Planning targets, not measured lap records. Uses the actual timed geometry,
// not stale pre-trim catalog lengths. No effect on vehicle physics.
export function campaignCourse(race={}){
 if(cache.has(race))return cache.get(race);
 const nodes=race.road?.nodes||[],segments=race.road?.segments||[];
 let lengthM=0,seconds=0,hash=2166136261;
 const signature=JSON.stringify([nodes.map(n=>[n.x,n.y,n.elevation]),segments.map(s=>[s.surface,s.bumpiness]),race.weather,race.weatherIntensity,race.snowDepthIn,race.snowDepth,race.snowCondition,race.laps,race.type,race.campaign?.scoring]);
 for(let i=0;i<signature.length;i++)hash=Math.imul(hash^signature.charCodeAt(i),16777619)>>>0;
 for(let i=1;i<nodes.length;i++){
  const a=nodes[i-1],b=nodes[i],d=Math.hypot(b.x-a.x,b.y-a.y);if(!Number.isFinite(d)||d<=0)continue;
  const surface=segments[i-1]?.surface||race.road?.surface||race.surface||'asphalt';
  let speed=/ice/.test(surface)?10:/snow/.test(surface)?18:/dirt|gravel|sand/.test(surface)?19:29;
  // Snow already limits the surface pace; do not penalize it twice merely
  // because the weather is also named snow. Targets assume suitable tires.
  if(/rain|snow|storm/.test(race.weather||'')&&!/snow|ice/.test(surface))speed*=.85;
  const c=nodes[i+1];
  if(c){const angle=Math.abs(Math.atan2(Math.sin(Math.atan2(c.y-b.y,c.x-b.x)-Math.atan2(b.y-a.y,b.x-a.x)),Math.cos(Math.atan2(c.y-b.y,c.x-b.x)-Math.atan2(b.y-a.y,b.x-a.x))));
   if(angle>.01)speed=Math.min(speed,Math.sqrt(3.2*Math.max(3,(d+Math.hypot(c.x-b.x,c.y-b.y))/2/angle)));}
  const grade=Math.max(0,(Number(b.elevation||0)-Number(a.elevation||0))*12/d);
  speed=Math.max(4,speed/(1+grade*2+Math.max(0,Number(segments[i-1]?.bumpiness)||0)));
  lengthM+=d;seconds+=d/speed;
 }
 if(!lengthM){lengthM=Math.max(1,Number(race.campaign?.lengthM)||1000);seconds=lengthM/22;}
 const laps=!race.road?.network&&isRaceRouteLoopClosed(nodes,{roadWidthM:race.road?.width})?Math.max(1,Math.round(Number(race.laps)||1)):1;
 const result={lengthM:lengthM*laps,lapLengthM:lengthM,laps,seconds:Math.max(15,seconds*laps+5),signature:hash.toString(16)};
 cache.set(race,result);return result;
}
export function campaignTargets(race={},pi=500){
 const course=campaignCourse(race),points=clamp(Number(pi)||500,1,1000),tier=carPerformanceClass(points);
 // All cars in a class race the same target (class midpoint), not a moving
 // personal target which becomes easier whenever the player removes a part.
 const midpoint=Math.ceil(points/100)*100-50;
 const factor=clamp(Math.sqrt(500/midpoint),.76,2.1);
 const goldMs=Math.round(course.seconds*factor)*1000;
 return {class:tier,...(race.campaign?.scoring==='drift'?{kind:'score',bronzeScore:Math.round(course.lengthM),silverScore:Math.round(course.lengthM*2),goldScore:Math.round(course.lengthM*3)}:{kind:'time'}),goldMs,silverMs:Math.round(goldMs*1.2/1000)*1000,bronzeMs:Math.round(goldMs*1.5/1000)*1000,estimated:true};
}
export const campaignRecordKey=(race,carRef,pi)=>`${carRef}|${campaignTargets(race,pi).class}|${campaignCourse(race).signature}`;
export function startCampaignChallenge(session,race,car,progress={}){
 cache.delete(race); // Authoring may have edited this object since its last run.
 const pi=calculateCarPerformance(car).points,course=campaignCourse(race),key=campaignRecordKey(race,session.carId,pi);
 const ref=session.raceDocumentName||session.raceId;
 session.campaignChallenge={pi,key,targets:campaignTargets(race,pi),lengthM:course.lengthM,
  previous:progress.rewards?.[ref]?.records?.[key]||null,sectors:[],lastDistance:0,lastTime:0};
}
export function updateCampaignSectors(session){
 const c=session.campaignChallenge;if(!c||session.countdownRemainingMs>0)return;
 const distance=(session.routeRuntimeType==='circuit'?Math.max(0,(session.lap||1)-1)*(session.routeLength||0):0)+Math.max(0,session.distance||0);
 const time=Number(session.elapsedMs)||0;
 if(distance>c.lastDistance){
  while(c.sectors.length<2&&distance>=c.lengthM*(c.sectors.length+1)/3){
   const at=c.lengthM*(c.sectors.length+1)/3;
   const crossed=c.lastTime+(time-c.lastTime)*clamp((at-c.lastDistance)/(distance-c.lastDistance),0,1);
   c.sectors.push(Math.round(crossed));
   const prior=c.previous?.sectors?.[c.sectors.length-1];
   c.split=Number.isFinite(prior)?{number:c.sectors.length,deltaMs:crossed-prior,untilMs:time+6000}:null;
  }
 }
 c.lastDistance=distance;c.lastTime=time;
}
export function evaluateCampaignChallenge(race,run,prior={}){
 const pi=run?.pi,key=Number.isFinite(pi)&&run?.carRef?campaignRecordKey(race,run.carRef,pi):null;
 const valid=!!key&&run.eligible===true&&run.measured===true&&run.finished===true&&run.recoveries===0&&Number.isFinite(run.elapsedMs)&&run.elapsedMs>0;
 const targets=campaignTargets(race,pi),previous=key?prior.records?.[key]:null;
 const scoreMode=targets.kind==='score',score=Math.max(0,Number(run?.driftScore)||0);
 const rank=valid?(scoreMode?(score>=targets.goldScore?3:score>=targets.silverScore?2:score>=targets.bronzeScore?1:0):(run.elapsedMs<=targets.goldMs?3:run.elapsedMs<=targets.silverMs?2:run.elapsedMs<=targets.bronzeMs?1:0)):0;
 // Medal cash is once per event, across all cars/classes, to avoid class farming.
 const oldRank=Math.max(0,Number(prior.medalRank)||0),medalBonus=Math.max(0,rank-oldRank)*100;
 const recordBest=valid&&(!previous||(scoreMode?score>(previous.score||0):run.elapsedMs<previous.timeMs));
 const sectors=Array.isArray(run?.sectors)&&run.sectors.length===2&&run.sectors.every((n,i)=>Number.isFinite(n)&&n>0&&n<run.elapsedMs&&(i===0||n>run.sectors[i-1]))?[...run.sectors,run.elapsedMs]:[];
 return {recordKey:key,recordBest,record:recordBest?{timeMs:run.elapsedMs,...(scoreMode?{score}:{}),sectors,medalRank:Math.max(rank,previous?.medalRank||0)}:previous,
  medalRank:Math.max(oldRank,rank),medal:valid?['Unranked','Bronze','Silver','Gold'][rank]:'',medalBonus,targets,
  sectorDeltas:valid&&!scoreMode&&sectors.length===3&&previous?.sectors?.length===3?sectors.map((n,i)=>n-previous.sectors[i]):[]};
}
export function normalizeCampaignRecords(records={}){
 return Object.fromEntries(Object.entries(records||{}).filter(([key,r])=>key.length<300&&!['__proto__','constructor','prototype'].includes(key)&&Number.isFinite(r?.timeMs)&&r.timeMs>0).slice(-100).map(([key,r])=>[key,{timeMs:r.timeMs,...(Number.isFinite(r.score)&&r.score>=0?{score:r.score}:{}),medalRank:clamp(Math.floor(Number(r.medalRank)||0),0,3),sectors:Array.isArray(r.sectors)&&r.sectors.length===3&&r.sectors.every((n,i)=>Number.isFinite(n)&&n>0&&(i===0||n>r.sectors[i-1]))&&r.sectors[2]===r.timeMs?r.sectors:[]}]));
}
