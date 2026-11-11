import {raceCompletionKey} from './MenuWorldMap.js';

export const AMERICA_OPENING_RACE = 'Tower Hill Road';
export const AMERICA_ROUTE_NAME = 'Middle Route';
// Geographic positions, with explicit ordered connections/unlocks. The catalog
// owns the itinerary; no fixed stage count or synthetic endpoint is required.
export function createAmericaWorldMap(catalog) {
 const stages=catalog.filter(s=>s.branch==='middle').sort((a,b)=>a.stage-b.stage);
 const lons=stages.map(s=>s.location.lon),lats=stages.map(s=>s.location.lat);
 const west=Math.min(...lons),east=Math.max(...lons),south=Math.min(...lats),north=Math.max(...lats);
 const nodes=stages.map((stage,i)=>({id:stage.id,kind:'race',label:stage.label||stage.name,raceRef:stage.name,
  x:.06+.88*(stage.location.lon-west)/Math.max(.01,east-west),
  y:.08+.78*(north-stage.location.lat)/Math.max(.01,north-south),
  ...(i?{unlockParameter:raceCompletionKey(stages[i-1].name),unlockValue:true}:{}),
  completedParameter:raceCompletionKey(stage.name)}));
 const connections=stages.slice(1).map((stage,i)=>({id:`middle-${stage.id}`,from:stages[i].id,to:stage.id,color:'#efc36b',width:3}));
 return {nodes,connections,mapManual:true,mapStyle:{labels:'selected',nodeScale:.35,lineWidth:3,
  selectedColor:'#fff0a8',unselectedColor:'#e2b454',disabledColor:'#728797',
  unselectedOpacity:.9,disabledOpacity:.75,cursor:'ring',cursorColor:'#ffffff'}};
}
