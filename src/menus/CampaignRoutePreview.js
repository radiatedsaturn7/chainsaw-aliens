import {campaignCourse} from '../garage/CampaignChallenges.js';

// Generated from saved race geometry. No terrain bake, asset decoding or physics
// is needed when browsing an event. Coordinates remain in the same aspect ratio.
export function buildCampaignRoutePreview(ref,race){
 const nodes=(race.road?.nodes||[]).filter(n=>Number.isFinite(n.x)&&Number.isFinite(n.y));
 const segments=race.road?.segments||[],lengths={},course=campaignCourse(race);
 let total=0,gain=0;
 for(let i=0;i<nodes.length;i++){
  const z=(Number(nodes[i].elevation)||0)*12;
  if(!i)continue;
  const a=nodes[i-1],b=nodes[i],d=Math.hypot(b.x-a.x,b.y-a.y);
  const raw=String(segments[i-1]?.surface||race.road?.surface||race.surface||'asphalt');
  const kind=/snow|ice/.test(raw)?'snow':/gravel/.test(raw)?'gravel':/dirt|mud|sand|grass/.test(raw)?'dirt':/asphalt|concrete|paved|tarmac/.test(raw)?'asphalt':'other';
  lengths[kind]=(lengths[kind]||0)+d;total+=d;
  gain+=Math.max(0,z-(Number(a.elevation)||0)*12);
 }
 const keys=['dirt','snow','gravel','asphalt',...(lengths.other?['other']:[])];
 const percentages=keys.map(key=>({key,value:total?(lengths[key]||0)/total*100:0}));
 let remaining=total?100-percentages.reduce((s,p)=>s+Math.floor(p.value),0):0;
 const order=[...percentages].sort((a,b)=>(b.value%1)-(a.value%1));
 const surfaces=Object.fromEntries(percentages.map(p=>[p.key,Math.floor(p.value)]));
 for(const p of order)if(remaining-->0)surfaces[p.key]++;
 let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
 for(const n of nodes){x0=Math.min(x0,n.x);x1=Math.max(x1,n.x);y0=Math.min(y0,n.y);y1=Math.max(y1,n.y);}
 const span=Math.max(x1-x0,y1-y0,1),stride=Math.max(1,Math.ceil((nodes.length-1)/383));
 const points=nodes.filter((_,i)=>i%stride===0||i===nodes.length-1).map(n=>[Math.round((n.x-x0)/span*1000)/1000,Math.round((n.y-y0)/span*1000)/1000]);
 return {points:points.map(p=>p.map(v=>Math.round(v*1000)).join(',')).join(' '),surfaces,distanceM:Math.round(course.lengthM),laps:course.laps,
  climbM:Math.round(gain*course.laps),
  timeOfDay:race.timeOfDay||'day',weather:race.weather||'clear',snowDepthIn:Math.round(Number(race.trackState?.surfaceProfiles?.snow?.snowDepthMm!=null?race.trackState.surfaceProfiles.snow.snowDepthMm/25.4:race.snowDepthIn??race.snowDepth??0)*100)/100,
  snowBuilds:race.weather==='snow'&&race.trackState?.surfaceProfiles?.snow?.snowDepthMm==null&&race.snowDepthIn==null&&race.snowDepth==null};
}
export function campaignCompletionMark(ref,parameters={},progress={}){
 const prior=progress.rewards?.[ref];
 const cleared=prior?.clears>0||parameters['raceCompleted.'+String(ref).replace(/[^a-zA-Z0-9_-]/g,'_')]===true;
 return !cleared?'':prior?.objectiveEarned&&prior?.medalRank>=3?'gold':'green';
}
export function selectedCampaignPreview(screen,focus,widgetStates){
 const raceRef=e=>e?.action?.type==='set-param'&&e.action.parameter==='raceRef'?e.action.value:null;
 const key='route-preview:'+screen.id,ref=raceRef(screen.elements.find(e=>e.id===focus));
 if(ref)widgetStates.set(key,ref);
 return ref||widgetStates.get(key)||screen.elements.map(raceRef).find(Boolean)||'';
}
const decodedPaths=new WeakMap();
export function previewPoints(summary){
 if(!decodedPaths.has(summary))decodedPaths.set(summary,String(summary.points||'').split(' ').filter(Boolean).map(p=>p.split(',').map(v=>Number(v)/1000)));
 return decodedPaths.get(summary);
}
// Canvas symbols stay legible with the game's font and do not depend on emoji fonts.
export function drawRouteConditions(ctx,x,y,size,timeOfDay,weather){
 ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.lineWidth=.065;ctx.lineCap='round';
 const night=timeOfDay==='night',twilight=/dawn|dusk|sunrise|sunset/.test(timeOfDay);
 const rain=/rain|storm/.test(weather),snow=/snow|blizzard/.test(weather),fog=/fog|mist/.test(weather);
 if(weather&&weather!=='clear'){
  ctx.strokeStyle=ctx.fillStyle=night?'#60656d':'#d8e3ed';
  ctx.beginPath();ctx.moveTo(.18,.57);ctx.bezierCurveTo(-.02,.57,.03,.28,.24,.32);ctx.bezierCurveTo(.26,.03,.68,.06,.72,.32);ctx.bezierCurveTo(1,.23,1,.62,.78,.6);ctx.lineTo(.18,.6);ctx.closePath();ctx.fill();ctx.stroke();
  if(rain||snow)for(let i=0;i<3;i++){const a=.23+i*.26;ctx.beginPath();ctx.moveTo(a,.74);ctx.lineTo(a-.07,.91);if(snow){ctx.moveTo(a-.1,.79);ctx.lineTo(a+.04,.86);}ctx.stroke();}
  if(fog)for(let i=0;i<2;i++){ctx.beginPath();ctx.moveTo(.1,.75+i*.14);ctx.lineTo(.9,.75+i*.14);ctx.stroke();}
 }else{
  ctx.strokeStyle=ctx.fillStyle=night?'#b9d7ff':twilight?'#ffbd70':'#ffdb72';
  ctx.beginPath();
  if(night){ctx.arc(.5,.5,.32,.35*Math.PI,1.65*Math.PI);ctx.quadraticCurveTo(.35,.5,.5+Math.cos(.35*Math.PI)*.32,.5+Math.sin(.35*Math.PI)*.32);ctx.fill();}
  else{ctx.arc(.5,.5,.19,0,Math.PI*2);ctx.stroke();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.beginPath();ctx.moveTo(.5+Math.cos(a)*.27,.5+Math.sin(a)*.27);ctx.lineTo(.5+Math.cos(a)*.37,.5+Math.sin(a)*.37);ctx.stroke();}if(twilight){ctx.beginPath();ctx.moveTo(.08,.72);ctx.lineTo(.92,.72);ctx.stroke();}}
 }
 ctx.restore();
}
// Endpoint is the foot of the pole; opposite flags remain visible on circuits.
export function drawRouteFlag(ctx,x,y,finish=false,direction=1){
 ctx.save();ctx.translate(x,y);ctx.scale(direction,1);
 ctx.fillStyle='#111111';ctx.fillRect(-2,-17,17,12);
 ctx.fillStyle='#ffffff';ctx.fillRect(-1,-18,2,19);
 if(finish){for(let row=0;row<3;row++)for(let col=0;col<4;col++){
  ctx.fillStyle=(row+col)%2?'#111111':'#ffffff';ctx.fillRect(1+col*3,-17+row*3,3,3);
 }}else{ctx.fillStyle='#5cdb88';ctx.fillRect(1,-17,12,9);}
 ctx.restore();
}
export function routeSurfaceLabels(summary){
 return [['asphalt','Tarmac'],['dirt','Dirt'],['gravel','Gravel'],['snow','Snow']]
  .filter(([key])=>summary.surfaces[key]>0).map(([key,label])=>`${label} ${summary.surfaces[key]}%`);
}
export function drawCampaignRoutePreview(ctx,b,summary,ref,resources,drawText,fontFamily){
 ctx.strokeStyle='#6b7886';ctx.lineWidth=1;ctx.strokeRect(b.x+1,b.y+1,b.w-2,b.h-2);
 ctx.font=`${Math.max(10,Math.min(b.w/24,b.h/26))}px ${fontFamily}`;
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffffff';
 const text=(s,y)=>drawText(s,b.x+b.w/2,b.y+b.h*y,b.w-20);
 if(!summary){text(ref?'Route preview unavailable':'Select a race',.5);return;}
 drawRouteConditions(ctx,b.x+12,b.y+12,Math.min(b.w*.15,b.h*.13),summary.timeOfDay,summary.weather);
 ctx.fillStyle='#ffffff';ctx.textAlign='right';
 const stats=[`${(summary.distanceM/1609.344).toFixed(1)} mi`,`${summary.laps} ${summary.laps===1?'lap':'laps'}`,`${Math.round(summary.climbM*3.28084)} ft`];
 stats.forEach((s,i)=>drawText(s,b.x+b.w-12,b.y+b.h*(.06+i*.06),b.w*.58));
 ctx.textAlign='center';
 const points=previewPoints(summary),area={x:b.x+18,y:b.y+b.h*.26,w:b.w-36,h:b.h*.53};
 if(points.length){
  const maxX=Math.max(...points.map(p=>p[0])),maxY=Math.max(...points.map(p=>p[1]));
  const scale=Math.min(area.w/(maxX||1),area.h/(maxY||1)),ox=area.x+(area.w-maxX*scale)/2,oy=area.y+(area.h-maxY*scale)/2;
  ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.beginPath();points.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](ox+p[0]*scale,oy+p[1]*scale));ctx.stroke();
  const start=points[0],end=points.at(-1),near=Math.hypot(start[0]-end[0],start[1]-end[1])*scale<30;
  drawRouteFlag(ctx,ox+start[0]*scale,oy+start[1]*scale,false,near?-1:1);
  drawRouteFlag(ctx,ox+end[0]*scale,oy+end[1]*scale,true);
 }
 ctx.fillStyle='#ffffff';
 const labels=routeSurfaceLabels(summary);
 if(labels.length<=2)text(labels.join('   '),.9);
 else{ text(labels.slice(0,2).join('   '),.86);text(labels.slice(2).join('   '),.94); }
}
