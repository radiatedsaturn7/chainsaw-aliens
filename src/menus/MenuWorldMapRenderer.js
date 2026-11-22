import {drawMapRoad,advanceMapCar,mapRoadPixels} from './MenuMapRoads.js';
import {drawCampaignMapLandscape} from './CampaignMapLandscape.js';
import {worldMapNodes,worldMapConnections,worldMapRaceNodes,worldMapNodePoint,worldMapNodeRadius,normalizeWorldMapStyle,worldMapSelection} from './MenuWorldMap.js';
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

export function drawWorldMap(ctx,b,element,resources,document,parameters,value,{drawText,fontFamily='system-ui',time=0,widgetStates=new Map(),drawCar=null,editing=false,mapBackground=null}={}){
 const nodes=worldMapNodes(element,resources,document,parameters),style=normalizeWorldMapStyle(element.mapStyle);
 const regional=element.property==='campaign-path';
 if(regional&&!mapBackground){const region=document?.parameters?.campaignProgression?.regions?.find(r=>r.bossRef===element.assetRef);drawCampaignMapLandscape(ctx,{...b,h:Math.max(1,b.h-36)},region?.stage||1);}
 const selected=worldMapSelection(nodes,value)?.raceRef;
 const roadNodes=nodes.map(n=>{const p=worldMapNodePoint(n,b,element);return {...n,x:(p.x-b.x)/b.w,y:(p.y-b.y)/Math.max(1,b.h-36)};});
 const positions=new Map(nodes.map(n=>[n.id,worldMapNodePoint(n,b,element)]));
 const roadById=new Map(roadNodes.map(n=>[n.id,n]));
 const links=worldMapConnections(element,nodes);
 for(const link of links){
  const width=link.width??style.lineWidth,pattern=link.pattern||style.linePattern;
  if(!width)continue;
  const a=roadById.get(link.from),c=roadById.get(link.to);
  if(regional){drawRegionalMapRoad(ctx,link,a,c,b,width,pattern);continue;}
  ctx.save();ctx.strokeStyle=link.color||style.lineColor;ctx.lineWidth=width;ctx.lineCap='round';
  ctx.setLineDash?.(pattern==='dashed'?[width*4,width*3]:pattern==='dotted'?[width,width*2]:[]);
  drawMapRoad(ctx,link,a,c,b);
  ctx.stroke();ctx.restore();
 }
 let raceIndex=0;
 for(const node of nodes){
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
  if(junction||(style.labels!=='selected'&&b.w>=600&&nodes.length<=16)){
   const labelWidth=junction?Math.min(100,b.w*.18):b.w/4-8;
   const labelX=Math.max(b.x+labelWidth/2,Math.min(b.x+b.w-labelWidth/2,p.x));
   ctx.fillStyle=element.color;drawText(node.label,labelX,p.y+radius+17,labelWidth);
  }
  ctx.restore();
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
  const key=`map-car:${element.id}`,previous=editing?null:widgetStates.get(key);
  const state=advanceMapCar(previous,roadNodes,links,selected,time);
  if(state){widgetStates.set(key,state);const p=mapRoadPixels(state,b),size=Math.max(28,Math.min(64,b.w*.11));
   ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();
   drawCar?.({x:p.x-size/2,y:p.y-size*.55,w:size,h:size*.7},state.angle);ctx.restore();}
 }
 const highlighted=worldMapSelection(nodes,selected);
 if(highlighted&&element.showSelectedLabel!==false){ctx.fillStyle=element.color;drawText(`${highlighted.label} · ${highlighted.locked?'Locked':highlighted.completed?'Completed':'Ready'}`,b.x+b.w/2,b.y+b.h-14,b.w-20);}
 if(!nodes.length)drawText('No races configured',b.x+b.w/2,b.y+b.h/2,b.w-12);
}
