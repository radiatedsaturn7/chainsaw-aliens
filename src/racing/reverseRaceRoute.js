// Reverse an editable linear route while preserving segment artwork and surfaces.
export function reverseRaceRoute(race){
 const road=race?.road;
 if(road?.network)throw Error('Reverse Start / End currently requires a linear route, not a junction network.');
 if(!Array.isArray(road?.nodes)||road.nodes.length<2||road.segments?.length!==road.nodes.length-1)throw Error('The route needs connected road nodes before it can be reversed.');
 const nodes=road.nodes.map(n=>({...n})).reverse();
 nodes.forEach((n,i)=>{delete n.role;delete n.locked;if(i===0){n.role='start';n.locked=true;}else if(i===nodes.length-1)n.role='finish';});
 const segments=road.segments.map(s=>({...s})).reverse().map((s,i)=>{
  const a=nodes[i],b=nodes[i+1],previous=i?nodes[i-1]:race.type==='circuit'?nodes.at(-2):null;
  const yaw=Math.atan2(b.x-a.x,b.y-a.y),prior=previous?Math.atan2(a.x-previous.x,a.y-previous.y):yaw;
  return {...s,length:Math.hypot(b.x-a.x,b.y-a.y),elevation:b.elevation,curve:Math.max(-1,Math.min(1,Math.atan2(Math.sin(yaw-prior),Math.cos(yaw-prior))/.78)),banking:-(Number(s.banking)||0),...(s.bankingDegrees!==undefined?{bankingDegrees:-Number(s.bankingDegrees)}:{})};
 });
 road.nodes=nodes;road.segments=segments;
 if(race.source)race.source.reversed=!race.source.reversed;
 return race;
}
