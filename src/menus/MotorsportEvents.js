import {isRaceRouteLoopClosed} from '../racing/RaceRouteProgress.js';
import {campaignCourse} from '../garage/CampaignChallenges.js';
import {normalizeCarCondition} from '../garage/GarageRepairs.js';
import {MECHANICAL_COMPONENTS,repairMechanicalComponent} from '../racing/simulation/MechanicalModel.js';

export const SERIES_SAVE_KEY='motorsportEvent';
export const SERIES_POINTS=[25,18,15,12,10,8];
export const SERIES_RIVALS=['Vera','Ash','Mica','Sol','Wren'];
export const SERIES_LEVELS=[{name:'Club',skill:.48,aggression:.3},{name:'Sport',skill:.67,aggression:.45},{name:'Expert',skill:.86,aggression:.6}];
const cups=[
 ['american-apex','American Apex',1,['WeatherTech Raceway Laguna Seca','Watkins Glen — Long Course','Road America — Full Course']],
 ['british-club','British Club',1,['Brands Hatch — Indy','Silverstone — National','Brands Hatch — Grand Prix']],
 ['continental','Continental Cup',2,['Red Bull Ring — Grand Prix','Monza — Grand Prix','Spa-Francorchamps — Grand Prix']],
 ['world-masters','World Masters',3,['Suzuka — East','Silverstone — Grand Prix','Spa-Francorchamps — Grand Prix']]
];
export function motorsportRaceMetadata(race){
 const closed=!race.road?.network&&isRaceRouteLoopClosed(race.road?.nodes||[],{roadWidthM:race.road?.width});
 return {properCircuit:race.type==='circuit'&&closed&&!!race.source?.layoutName&&!race.source?.rallyCollection,
  stageSeconds:Math.round(campaignCourse(race).seconds)};
}
export function motorsportCatalog(entries=[]){
 const byRef=new Map(entries.map(e=>[e.ref,e]));
 const championships=cups.filter(c=>c[3].every(ref=>byRef.get(ref)?.properCircuit)).map(([id,name,heat,refs])=>({id,kind:'championship',name,heat,rounds:refs.map(ref=>({ref,laps:3})),description:'Three circuits · 3 laps each · six drivers · points standings'}));
 const groups=new Map();
 for(const e of entries)if(e.rally?.id&&!e.location?.body){if(!groups.has(e.rally.id))groups.set(e.rally.id,[]);groups.get(e.rally.id).push(e);}
 const rallies=[];
 for(const [id,stages] of groups){
  stages.sort((a,b)=>a.ref.localeCompare(b.ref));
  for(const [format,count] of [['short',4],['full',12]]){
   const rounds=Array.from({length:count},(_,i)=>({ref:stages[i%stages.length].ref,seconds:Math.max(15,Number(stages[i%stages.length].stageSeconds)||300),pass:Math.floor(i/stages.length)+1}));
   rallies.push({id:`rally-${id}-${format}`,kind:'rally',name:`${stages[0].rally.name} · ${format==='short'?'Short':'Full'}`,heat:2,rounds,
    description:`${count} stages · ${stages.length} distinct roads · repeat passes · service after every ${format==='short'?2:3} stages`,serviceEvery:format==='short'?2:3});
  }
 }
 return {championships,rallies};
}
export function createMotorsportEvent(definition,carRef,configuration={},id=globalThis.crypto?.randomUUID?.()||String(Date.now())){
 if(!carRef||!definition?.rounds?.length)throw Error('Choose a car and event first.');
 return {version:1,id,definition:structuredClone(definition),carRef,setup:JSON.stringify({installed:configuration.installed||{},tune:configuration.tune||{}}),
  round:0,phase:'ready',results:[],condition:normalizeCarCondition(configuration.condition),serviceBudget:0,paid:false};
}
export function readMotorsportEvent(value){
 try{const s=typeof value==='string'?JSON.parse(value):value;
  return s?.version===1&&typeof s.id==='string'&&typeof s.carRef==='string'&&['championship','rally'].includes(s.definition?.kind)&&Array.isArray(s.definition.rounds)&&s.definition.rounds.length<=12&&s.definition.rounds.every(r=>typeof r.ref==='string')&&Number.isInteger(s.round)&&s.round>=0&&s.round<=s.definition.rounds.length&&Array.isArray(s.results)&&['ready','racing','between','complete'].includes(s.phase)?structuredClone(s):null;
 }catch{return null;}
}
export function seriesStandings(state){
 const rows=[{id:'player',name:'You'},...SERIES_RIVALS.map((name,i)=>({id:`series-ai-${i}`,name}))].map(r=>({...r,points:0,timeMs:0,wins:0,places:[],retired:false}));
 for(const result of state.results)for(const [place,finish] of result.classification.entries()){
  const row=rows.find(r=>r.id===finish.id);if(!row)continue;
  row.points+=finish.dnf?0:SERIES_POINTS[place]||0;row.timeMs+=finish.timeMs||0;row.retired ||= finish.dnf===true;row.wins+=!finish.dnf&&place===0?1:0;row.places.push(place);
 }
 return rows.sort((a,b)=>state.definition.kind==='rally'?(Number(a.retired)-Number(b.retired)||a.timeMs-b.timeMs||a.id.localeCompare(b.id)):
  b.points-a.points||b.wins-a.wins||comparePlaces(a.places,b.places)||a.id.localeCompare(b.id));
}
function comparePlaces(a,b){for(let p=0;p<6;p++){const delta=b.filter(v=>v===p).length-a.filter(v=>v===p).length;if(delta)return delta;}return 0;}
function variance(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967295;}
export function completeMotorsportRound(state,session,{dnf=false}={}){
 if(state.phase!=='racing')return state;
 const next=structuredClone(state),definition=next.definition,round=definition.rounds[next.round];
 const elapsed=Math.max(1,Number(session.elapsedMs)||1);
 let classification;
 if(definition.kind==='rally'){
  // Seeded stage-time competitors: independent of the player's result, never rubber-banded.
  classification=SERIES_RIVALS.map((name,i)=>({id:`series-ai-${i}`,timeMs:Math.round(round.seconds*1000*(1.08-i*.035+(variance(`${definition.id}:${next.round}:${i}`)-.5)*.06))}));
  classification.push({id:'player',timeMs:elapsed,dnf});classification.sort((a,b)=>Number(!!a.dnf)-Number(!!b.dnf)||a.timeMs-b.timeMs);
 }else{
  classification=(session.aiRuntime||[]).map(ai=>({id:ai.id,timeMs:ai.seriesFinishMs||0,distance:((ai.lap||1)-1)*(session.routeLength||0)+(ai.distance||0)}));
  // Finished cars keep their crossing order; trailing cars are classified at the flag by progress.
  classification.push({id:'player',timeMs:dnf?0:elapsed,dnf,distance:dnf?0:round.laps*(session.routeLength||0)});
  classification.sort((a,b)=>Number(!!a.dnf)-Number(!!b.dnf)||(a.timeMs&&b.timeMs?a.timeMs-b.timeMs:a.timeMs?-1:b.timeMs?1:b.distance-a.distance)||a.id.localeCompare(b.id));
 }
 next.results.push({ref:round.ref,classification});next.condition=normalizeCarCondition({damage:session.damage,mechanical:session.mechanical});next.round++;
 next.phase=dnf||next.round>=definition.rounds.length?'complete':'between';
 next.serviceBudget=next.phase==='between'&&definition.kind==='rally'&&next.round%definition.serviceEvery===0?(definition.serviceEvery===3&&next.round%6!==0?30:60):0;
 return next;
}
export const SERIES_SERVICE_GROUPS=[
 {id:'tires',name:'Tires',pattern:/^tire_/,cost:12},
 {id:'suspension',name:'Suspension',pattern:/^(damper_|spring_|alignment_)/,cost:25},
 {id:'brakes',name:'Brakes',pattern:/^(pads_|hydraulics_)/,cost:15},
 {id:'cooling',name:'Cooling',pattern:/^(radiator|thermostat|waterPump|fans)$/,cost:18},
 {id:'engine',name:'Engine',pattern:/^(ignition|pistons|bearings|oilPump|oilSeals|turbo|ecu)$/,cost:40},
 {id:'drivetrain',name:'Drivetrain',pattern:/^(clutch|gearbox|differential|axles)$/,cost:30},
 {id:'service',name:'Fluids / Electrical',pattern:/^(alternator|battery|starter|wiring|fuelTank|fuelPump|lights)$/,cost:15}
];
export function availableSeriesService(state){
 const scheduled=state?.definition?.kind==='rally'&&state.phase==='between'&&state.round%state.definition.serviceEvery===0;
 if(!scheduled)return [];
 const limited=state.definition.serviceEvery===3&&state.round%6!==0;
 return SERIES_SERVICE_GROUPS.filter(g=>!limited||!['engine','drivetrain'].includes(g.id));
}
export function seriesServiceHealth(state,group){
 const m=state.condition.mechanical;
 const values=MECHANICAL_COMPONENTS.filter(c=>group.pattern.test(c.id)).map(c=>m.components[c.id].failed?0:Math.min(100-m.components[c.id].damage,c.id.startsWith('tire_')?100*Math.min(m.tires[c.id.slice(5)].tread,m.tires[c.id.slice(5)].pressureRatio):100));
 return Math.round(values.reduce((a,b)=>a+b,0)/Math.max(1,values.length));
}
export function serviceMotorsportEvent(state,id){
 if(state.definition.kind!=='rally'||state.phase!=='between'||state.round%state.definition.serviceEvery!==0)throw Error('Repairs are only available at scheduled service stops.');
 const group=availableSeriesService(state).find(g=>g.id===id);if(!group)throw Error('That repair is unavailable at this service stop.');
 if(state.serviceBudget<group.cost)throw Error('Not enough service points.');
 const next=structuredClone(state),condition=normalizeCarCondition(next.condition),mechanical=condition.mechanical;
 const members=MECHANICAL_COMPONENTS.filter(c=>group.pattern.test(c.id));
 for(const c of members)repairMechanicalComponent(mechanical,c.id);
 for(const path of new Set(members.map(c=>c.damagePath))){
  const value=Math.max(...MECHANICAL_COMPONENTS.filter(c=>c.damagePath===path).map(c=>mechanical.components[c.id].damage));
  const keys=path.split('.');if(keys.length===1)condition.damage[path]=value;else condition.damage[keys[0]][keys[1]]=value;
  for(const c of MECHANICAL_COMPONENTS.filter(c=>c.damagePath===path))mechanical.observedDamage[c.id]=value;
 }
 if(id==='suspension')condition.damage.suspensionPull=0;
 if(id==='service')for(const key of ['fuel','oil','coolant','charge'])mechanical[key]=1;
 next.condition=condition;next.serviceBudget-=group.cost;return next;
}
export function applyMotorsportRace(race,state){
 if(!state)return race;
 const round=state.definition.rounds[state.round];if(!round)throw Error('Event is already complete.');
 if(state.definition.kind==='championship'&&!motorsportRaceMetadata(race).properCircuit)throw Error('Championship rounds require a closed, imported circuit.');
 const level=SERIES_LEVELS[state.definition.heat-1]||SERIES_LEVELS[1];
 const next={...race,laps:state.definition.kind==='championship'?round.laps:1,mechanicalMission:{},raceStart:{...race.raceStart,cutsceneRef:''},
  finishBehavior:{type:'menu',menuScreen:'motorsport-event'},competition:{...race.competition,mode:state.definition.kind==='championship'?'ai-race':'solo',trafficEnabled:false,
   aiDrivers:state.definition.kind==='championship'?SERIES_RIVALS.map((name,i)=>({id:`series-ai-${i}`,name,enabled:true,skill:level.skill+i*.008,aggression:level.aggression,rubberBanding:0,difficulty:state.definition.heat===3?'expert':state.definition.heat===2?'hard':'medium'})):[]}};
 // Authored node destinations must not leave the series or play campaign cutscenes.
 if(next.road?.network)next.road={...next.road,network:{...next.road.network,nodes:next.road.network.nodes.map(n=>({...n,finish:n.finish?{destination:next.finishBehavior,variables:{}}:n.finish}))}};
 return next;
}
