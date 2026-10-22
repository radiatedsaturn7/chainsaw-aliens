export const raceCompletionKey=ref=>'raceCompleted.'+String(ref).replace(/[^a-zA-Z0-9_-]/g,'_');
export function worldMapNodes(element,resources,document,parameters){
 const nodes=(element.mapManual||element.nodes?.length)?element.nodes:(resources?.choices('races',document,parameters)||[]).map((race,i,races)=>({id:race.value,label:race.label,raceRef:race.value,x:.14+(i%4)*.24,y:.22+Math.floor(i/4)*.28,unlockParameter:i?raceCompletionKey(races[i-1].value):'',unlockValue:true,completedParameter:raceCompletionKey(race.value)}));
 const rows=Math.max(1,Math.ceil(nodes.length/4));
 return nodes.map((node,i)=>({...node,x:node.x??(.14+i%4*.24),y:(element.mapManual||element.nodes?.length)?node.y:(Math.floor(i/4)+.5)/rows,locked:node.disabled===true||(!!node.unlockParameter&&JSON.stringify(parameters[node.unlockParameter])!==JSON.stringify(node.unlockValue??true)),completed:!!parameters[node.completedParameter||raceCompletionKey(node.raceRef)]}));
}
export const worldMapNodeRadius=(b,element=null)=>Math.max(8,Math.min(b.w,b.h)*.035)*(element?.mapStyle?.nodeScale||1);
export function worldMapNodePoint(node,b,element=null){
 // Include the selected ring and its stroke inside the widget's clipping area.
 const padding=worldMapNodeRadius(b,element)+7,px=Math.min(b.w/2,padding),py=Math.min(b.h/2,padding);
 return {x:b.x+Math.max(px,Math.min(b.w-px,node.x*b.w)),y:b.y+Math.max(py,Math.min(b.h-py,node.y*Math.max(1,b.h-36)))};
}

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const num=(v,f,min,max)=>Number.isFinite(Number(v))?clamp(Number(v),min,max):f;
const color=(v,f)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:f;
export function normalizeWorldMapStyle(s={}){
 return {lineColor:color(s.lineColor,'#7893a1'),lineWidth:num(s.lineWidth,2,0,20),linePattern:['solid','dashed','dotted'].includes(s.linePattern)?s.linePattern:'solid',
  selectedColor:color(s.selectedColor,'#e2b454'),unselectedColor:color(s.unselectedColor,'#e2b454'),disabledColor:color(s.disabledColor,'#52616b'),
  unselectedOpacity:num(s.unselectedOpacity,.55,0,1),disabledOpacity:num(s.disabledOpacity,.5,0,1),nodeScale:num(s.nodeScale,1,.25,4),
  cursor:['ring','text','image','none'].includes(s.cursor)?s.cursor:'ring',cursorColor:color(s.cursorColor,'#ffffff')};
}
export function worldMapConnections(element,nodes){
 if(Array.isArray(element.connections))return element.connections.filter(c=>nodes.some(n=>n.id===c.from)&&nodes.some(n=>n.id===c.to)&&c.from!==c.to);
 return nodes.slice(1).map((n,i)=>({id:`auto-${i}`,from:nodes[i].id,to:n.id}));
}
export function normalizeWorldMapConnections(connections){
 if(!Array.isArray(connections))return null;
 return connections.slice(0,300).map((c,i)=>({id:String(c.id||`link-${i+1}`),from:String(c.from||''),to:String(c.to||''),
  color:color(c.color,''),width:c.width==null?null:num(c.width,2,0,20),pattern:['solid','dashed','dotted'].includes(c.pattern)?c.pattern:''})).filter(c=>c.from&&c.to&&c.from!==c.to);
}
export const worldMapRaceNodes=nodes=>nodes.filter(n=>n.kind!=='junction'&&n.raceRef);
export function worldMapLocalPoint(point,b){return {x:clamp((point.x-b.x)/Math.max(1,b.w),0,1),y:clamp((point.y-b.y)/Math.max(1,b.h-36),0,1)};}
export function materializeWorldMap(element,resources,document,parameters){
 const nodes=worldMapNodes(element,resources,document,parameters);
 const connections=worldMapConnections(element,nodes);
 element.nodes=nodes.map(({locked,completed,...node})=>node);
 element.connections=connections.map(c=>({...c}));
 return element.nodes;
}

export const worldMapSelectableNodes=nodes=>worldMapRaceNodes(nodes).filter(n=>!n.locked&&!n.disabled);
export function worldMapSelection(nodes,value){const available=worldMapSelectableNodes(nodes);return available.find(n=>n.raceRef===value)||available[0]||null;}
export function worldMapDirectionalNode(nodes,value,direction,bounds,element){
 const current=worldMapSelection(nodes,value);if(!current)return null;
 if(current.raceRef!==value)return current;
 const axis={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]}[direction];if(!axis)return current;
 const origin=worldMapNodePoint(current,bounds,element);let best=current,score=Infinity;
 for(const node of worldMapSelectableNodes(nodes)){
  if(node.id===current.id)continue;
  const point=worldMapNodePoint(node,bounds,element),dx=point.x-origin.x,dy=point.y-origin.y;
  const forward=dx*axis[0]+dy*axis[1],side=Math.abs(dx*axis[1]-dy*axis[0]);
  if(forward<=.01)continue;
  const distance=Math.hypot(dx,dy)+side*2;
  if(distance<score){score=distance;best=node;}
 }
 return best;
}
