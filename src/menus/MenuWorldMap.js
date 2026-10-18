export const raceCompletionKey=ref=>'raceCompleted.'+String(ref).replace(/[^a-zA-Z0-9_-]/g,'_');
export function worldMapNodes(element,resources,document,parameters){
 const nodes=element.nodes?.length?element.nodes:(resources?.choices('races',document,parameters)||[]).map((race,i,races)=>({id:race.value,label:race.label,raceRef:race.value,x:.14+(i%4)*.24,y:.22+Math.floor(i/4)*.28,unlockParameter:i?raceCompletionKey(races[i-1].value):'',unlockValue:true,completedParameter:raceCompletionKey(race.value)}));
 const rows=Math.max(1,Math.ceil(nodes.length/4));
 return nodes.map((node,i)=>({...node,x:node.x??(.14+i%4*.24),y:element.nodes?.length?node.y:(Math.floor(i/4)+.5)/rows,locked:!!node.unlockParameter&&JSON.stringify(parameters[node.unlockParameter])!==JSON.stringify(node.unlockValue??true),completed:!!parameters[node.completedParameter||raceCompletionKey(node.raceRef)]}));
}
export function worldMapNodePoint(node,b){return {x:b.x+node.x*b.w,y:b.y+node.y*b.h};}
