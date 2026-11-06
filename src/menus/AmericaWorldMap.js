import {raceCompletionKey} from './MenuWorldMap.js';

// Ordered from east to west. Each branch has eight playable stages;
// Providence and LA are shared junctions, not extra races.
export function createAmericaWorldMap(catalog) {
 const nodes=[{id:'providence',kind:'junction',label:'Providence',x:.97,y:.5},
  {id:'los-angeles',kind:'junction',label:'Los Angeles',x:.03,y:.5}];
 const connections=[];
 const colors=['#7dd9ed','#efc36b','#f59987'];
 for(const [row,branch] of ['north','middle','south'].entries()){
  const stages=catalog.filter(s=>s.branch===branch).sort((a,b)=>a.stage-b.stage);
  let previous='providence';
  for(const [i,stage] of stages.entries()){
   nodes.push({id:stage.id,kind:'race',label:stage.name,raceRef:stage.name,
    x:.86-i*(.72/7),y:[.15,.5,.85][row],
    unlockParameter:i?raceCompletionKey(stages[i-1].name):'',unlockValue:true,
    completedParameter:raceCompletionKey(stage.name)});
   connections.push({id:`${branch}-${i}`,from:previous,to:stage.id,color:colors[row],width:3});
   previous=stage.id;
  }
  connections.push({id:`${branch}-finish`,from:previous,to:'los-angeles',color:colors[row],width:3});
 }
 return {nodes,connections,mapManual:true,mapStyle:{nodeScale:.68,lineWidth:3,
  selectedColor:'#fff0a8',unselectedColor:'#e2b454',disabledColor:'#728797',
  unselectedOpacity:.9,disabledOpacity:.75,cursor:'ring',cursorColor:'#ffffff'}};
}
