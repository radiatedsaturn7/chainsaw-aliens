const opposite={left:'right',right:'left',up:'down',down:'up'};
// The entrance is a road endpoint, not a race or progression prerequisite.
export function campaignMapEntrance(element,nodes,links){
 if(element.property!=='campaign-path'||!element.mapEntrance||element.mapEntrance==='none')return null;
 const first=nodes.find(n=>n.kind!=='junction'&&n.label==='1')||nodes.find(n=>n.raceRef);
 if(!first)return null;
 const used=new Set(links.flatMap(l=>l.from===first.id?[l.fromPort]:l.to===first.id?[l.toPort]:[]));
 const distances={left:first.x,right:1-first.x,up:first.y,down:1-first.y};
 const direction=opposite[element.mapEntrance]&&!used.has(element.mapEntrance)?element.mapEntrance:Object.keys(opposite).filter(d=>!used.has(d)).sort((a,b)=>distances[a]-distances[b])[0];
 if(!direction)return null;
 const end={...first,id:'map-exit',raceRef:'@world-map',label:'',locked:false,disabled:false};
 if(direction==='left')end.x=-.25;if(direction==='right')end.x=1.25;
 if(direction==='up')end.y=-.25;if(direction==='down')end.y=1.25;
 return {first,direction,end,link:{id:'map-entrance',from:first.id,to:end.id,curve:'bezier',fromPort:direction,toPort:opposite[direction]}};
}
