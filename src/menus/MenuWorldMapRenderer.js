import {campaignMapEntrance} from './CampaignMapEntrance.js';
import {campaignWorldPresentation,campaignWorldRevealKey,WORLD_ROAD_REVEAL_SECONDS,WORLD_PIN_POP_SECONDS} from './CampaignWorldReveal.js';
import {drawMapRoad,advanceMapCar,mapRoadPixels,mapRoadPoint} from './MenuMapRoads.js';
import {drawCampaignMapLandscape} from './CampaignMapLandscape.js';
import {worldMapNodes,worldMapConnections,worldMapRaceNodes,worldMapNodePoint,worldMapNodeRadius,worldMapCarSize,normalizeWorldMapStyle,worldMapSelection} from './MenuWorldMap.js';
// Road shoulders, surface, and lane marks share one path with the simulated
// car: never approximate the route with a second set of artwork coordinates.
export function drawRegionalMapRoad(ctx,link,a,c,b,width,pattern) {
 const paved=pattern!=='dashed'&&pattern!=='dotted';
 const open=!a.locked&&!c.locked;
 const w=Math.max(4,Math.min(18,Math.min(b.w,b.h)*(paved ? .033 : .022)*width/(paved ? 5 : 3)));
 ctx.save();
 ctx.globalAlpha*=open?1:.54;
 ctx.lineCap='round';
 ctx.lineJoin='round';
 drawMapRoad(ctx,link,a,c,b);
 const stroke=(color,weight,dash=[])=>{
  ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.setLineDash?.(dash);ctx.stroke();
 };
 stroke('#17202b',w+4);
 stroke(paved?'#b9c7bd':'#786452',w+1.6);
 stroke(paved?'#3c434b':'#a17b56',w-1.2);
 if(paved)stroke('#e0c684',Math.max(1,w*.105),[w*.55,w*.44]);
 else stroke('#c29f75',Math.max(.85,w*.11),[w*.36,w*.37]);
 ctx.restore();
}

export function drawWorldMap(ctx,b,element,resources,document,parameters,value,{drawText,fontFamily='system-ui',time=0,widgetStates=new Map(),drawCar=null,editing=false,mapBackground=null,campaignOverview=false,carViewport=b}={}){
 const nodes=worldMapNodes(element,resources,document,parameters),style=normalizeWorldMapStyle(element.mapStyle);
 const regional=element.property==='campaign-path';
 // Regional artwork excludes the footer strip. Keep the original bounds for
 // coordinate projection, but clip every overlay to the actual artwork.
 if(regional){ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,Math.max(1,b.h-36));ctx.clip();}
 if(regional&&!mapBackground){const region=document?.parameters?.campaignProgression?.regions?.find(r=>r.bossRef===element.assetRef);drawCampaignMapLandscape(ctx,{...b,h:Math.max(1,b.h-36)},region?.stage||1);}
 const selected=worldMapSelection(nodes,value)?.raceRef;
 const roadNodes=nodes.map(n=>{const p=worldMapNodePoint(n,b,element);return {...n,x:(p.x-b.x)/b.w,y:(p.y-b.y)/Math.max(1,b.h-36)};});
 const positions=new Map(nodes.map(n=>[n.id,worldMapNodePoint(n,b,element)]));
 const roadById=new Map(roadNodes.map(n=>[n.id,n]));
 const links=worldMapConnections(element,nodes);
 const entrance=campaignMapEntrance(element,roadNodes,links);
 if(entrance){ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();drawRegionalMapRoad(ctx,entrance.link,entrance.first,entrance.end,b,style.lineWidth,style.linePattern);ctx.restore();}
 const reveal=campaignOverview&&!editing?widgetStates.get(campaignWorldRevealKey(element.id)):null;
 const presentation=campaignOverview&&!editing?campaignWorldPresentation(nodes,links,reveal):{visible:nodes,links,paving:false};
 for(const link of presentation.links){
  const width=link.width??style.lineWidth,pattern=link.pattern||style.linePattern;
  if(!width)continue;
  const a=roadById.get(link.from),c=roadById.get(link.to);
  if(regional||campaignOverview){drawRegionalMapRoad(ctx,link,a,c,b,width,pattern);continue;}
  ctx.save();ctx.strokeStyle=link.color||style.lineColor;ctx.lineWidth=width;ctx.lineCap='round';
  ctx.setLineDash?.(pattern==='dashed'?[width*4,width*3]:pattern==='dotted'?[width,width*2]:[]);
  drawMapRoad(ctx,link,a,c,b);
  ctx.stroke();ctx.restore();
 }
 if(presentation.paving&&reveal.elapsed>0){
  const a=roadById.get(reveal.from),c=roadById.get(reveal.to);
  const link=links.find(l=>l.from===a?.id&&l.to===c?.id||l.to===a?.id&&l.from===c?.id);
  if(a&&c&&link)drawPavingRoad(ctx,b,link,a,c,reveal.elapsed/WORLD_ROAD_REVEAL_SECONDS);
 }
 let raceIndex=0;
 for(const node of presentation.visible){
  const junction=node.kind==='junction',p=positions.get(node.id),active=!junction&&!node.locked&&node.raceRef===selected;
  if(!junction)raceIndex++;
  const radius=worldMapNodeRadius(b,element)*(junction?.55:1);
  const artRef=(node.locked?node.disabledArtRef:active?node.selectedArtRef:'')||node.artRef;
  const art=artRef?resources?.art?.(artRef):null;
  ctx.save();ctx.globalAlpha*=node.locked?style.disabledOpacity:active?1:style.unselectedOpacity;
  if(node.locked)ctx.filter='grayscale(1)';
  if(art){const scale=radius*2/Math.max(art.width,art.height);ctx.drawImage(art,p.x-art.width*scale/2,p.y-art.height*scale/2,art.width*scale,art.height*scale);}
  else{
   ctx.fillStyle=node.locked?style.disabledColor:node.completed?'#4fb985':active?style.selectedColor:style.unselectedColor;
   ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();
   if(!junction){ctx.fillStyle='#10212b';drawText(node.completed?'✓':regional?(node.label==='Boss'?'⚑':node.label==='Detour'?'+':node.label):String(raceIndex),p.x,p.y,radius*1.6);}
  }
  if(!regional&&(junction||(style.labels!=='selected'&&b.w>=600&&nodes.length<=16))){
   const labelWidth=junction?Math.min(100,b.w*.18):b.w/4-8;
   const labelX=Math.max(b.x+labelWidth/2,Math.min(b.x+b.w-labelWidth/2,p.x));
   ctx.fillStyle=element.color;drawText(node.label,labelX,p.y+radius+17,labelWidth);
  }
  ctx.restore();
  if(reveal&&node.id===reveal.to&&!presentation.paving){
   const pop=Math.min(1,(reveal.elapsed-WORLD_ROAD_REVEAL_SECONDS)/WORLD_PIN_POP_SECONDS);
   ctx.save();ctx.globalAlpha*=1-pop;ctx.strokeStyle='#fff0a8';ctx.lineWidth=2;
   ctx.beginPath();ctx.arc(p.x,p.y,radius+7+pop*12,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  if(active&&style.cursor!=='none'&&style.cursor!=='car'){
   ctx.save();ctx.strokeStyle=ctx.fillStyle=style.cursorColor;ctx.lineWidth=3;
   if(style.cursor==='ring'){ctx.beginPath();ctx.arc(p.x,p.y,radius+5,0,Math.PI*2);ctx.stroke();}
   else{
    const size=Math.max(8,element.cursorSize*b.w/720),x=Math.max(b.x,p.x-radius-size-5),y=Math.max(b.y,Math.min(b.y+b.h-size,p.y-size/2));
    const image=style.cursor==='image'?resources?.cursor?.(element):null;
    if(image){const scale=size/Math.max(image.width,image.height);ctx.drawImage(image,x,y,image.width*scale,image.height*scale);}
    else{ctx.font=`${size}px ${fontFamily}`;ctx.textAlign='left';ctx.textBaseline='middle';drawText(element.cursorText||'>',x,y+size/2,size);}
   }
   ctx.restore();
  }
 }
 if(style.cursor==='car'&&selected){
  const key=`map-car:${element.id}`;let previous=editing?null:widgetStates.get(key);
  if(!editing&&!previous&&entrance&&selected===entrance.first.raceRef)previous={node:entrance.end.id,x:entrance.end.x,y:entrance.end.y,angle:135,time,moving:true};
  const travelNodes=entrance?[...roadNodes,entrance.end]:roadNodes,travelLinks=entrance?[...links,entrance.link]:links;
  const state=advanceMapCar(previous,travelNodes,travelLinks,previous?.campaignExiting?entrance?.end.raceRef:selected,time);
  if(state){widgetStates.set(key,state);const p=mapRoadPixels(state,b),size=worldMapCarSize(b);
   const anchor=(regional||campaignOverview)?.375:.55;
   const clip=regional?b:carViewport;
   // The world car may extend beyond its widget into the surrounding screen.
   // If even the screen edge is too close, fit the sprite around its road
   // anchor rather than moving the sprite away from the road.
   const drawSize=regional?size:Math.max(0,Math.min(size,
    2*(p.x-clip.x),2*(clip.x+clip.w-p.x),
    (p.y-clip.y)/anchor,(clip.y+clip.h-p.y)/(.7-anchor)));
   ctx.save();ctx.beginPath();ctx.rect(clip.x,clip.y,clip.w,clip.h);ctx.clip();
   const carBounds={x:p.x-drawSize/2,y:p.y-drawSize*anchor,w:drawSize,h:drawSize*.7};
   drawCar?.(carBounds,state.angle);ctx.restore();}
 }
 const highlighted=worldMapSelection(nodes,selected);
 if(!regional&&highlighted&&element.showSelectedLabel!==false){ctx.fillStyle=element.color;drawText(`${highlighted.label} · ${highlighted.locked?'Locked':highlighted.completed?'Completed':'Ready'}`,b.x+b.w/2,b.y+b.h-14,b.w-20);}
 if(!nodes.length)drawText('No races configured',b.x+b.w/2,b.y+b.h/2,b.w-12);
 if(regional)ctx.restore();
}

function drawPavingRoad(ctx,b,link,from,to,progress){
 const reverse=link.from!==from.id;
 const t=progress*progress*(3-2*progress);
 const point=s=>mapRoadPixels(mapRoadPoint(link,reverse?to:from,reverse?from:to,reverse?1-s:s),b);
 const a=point(0),head=point(t);
 ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.setLineDash?.([]);
 ctx.beginPath();ctx.moveTo(a.x,a.y);
 const steps=Math.max(1,Math.ceil(t*32));
 for(let i=1;i<=steps;i++){const p=point(t*i/steps);ctx.lineTo(p.x,p.y);}
 const w=Math.max(4,Math.min(18,Math.min(b.w,b.h)*.033*(link.width||5)/5));
 ctx.strokeStyle='#17202b';ctx.lineWidth=w+4;ctx.stroke();
 ctx.strokeStyle='#b9c7bd';ctx.lineWidth=w+1.6;ctx.stroke();
 ctx.strokeStyle='#3c434b';ctx.lineWidth=w-1.2;ctx.stroke();
 ctx.strokeStyle='#e0c684';ctx.lineWidth=Math.max(1,w*.105);ctx.setLineDash?.([w*.55,w*.44]);ctx.stroke();
 ctx.fillStyle='#fff0a8';ctx.beginPath();ctx.arc(head.x,head.y,3,0,Math.PI*2);ctx.fill();ctx.restore();
}
