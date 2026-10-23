import {worldMapNodes,worldMapConnections,worldMapRaceNodes,worldMapNodePoint,worldMapNodeRadius,normalizeWorldMapStyle,worldMapSelection} from './MenuWorldMap.js';
export function drawWorldMap(ctx,b,element,resources,document,parameters,value,{drawText,fontFamily='system-ui'}={}){
 const nodes=worldMapNodes(element,resources,document,parameters),style=normalizeWorldMapStyle(element.mapStyle);
 const selected=worldMapSelection(nodes,value)?.raceRef;
 const positions=new Map(nodes.map(n=>[n.id,worldMapNodePoint(n,b,element)]));
 for(const link of worldMapConnections(element,nodes)){
  const a=positions.get(link.from),c=positions.get(link.to),width=link.width??style.lineWidth,pattern=link.pattern||style.linePattern;
  if(!width)continue;
  ctx.save();ctx.strokeStyle=link.color||style.lineColor;ctx.lineWidth=width;ctx.lineCap='round';
  ctx.setLineDash?.(pattern==='dashed'?[width*4,width*3]:pattern==='dotted'?[width,width*2]:[]);
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.stroke();ctx.restore();
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
   if(!junction){ctx.fillStyle='#10212b';drawText(node.completed?'✓':String(raceIndex),p.x,p.y,radius*1.6);}
  }
  if(b.w>=600&&!junction){ctx.fillStyle=element.color;drawText(node.label,p.x,p.y+radius+17,b.w/4-8);}
  ctx.restore();
  if(active&&style.cursor!=='none'){
   ctx.save();ctx.strokeStyle=ctx.fillStyle=style.cursorColor;ctx.lineWidth=3;
   if(style.cursor==='ring'){ctx.beginPath();ctx.arc(p.x,p.y,radius+5,0,Math.PI*2);ctx.stroke();}
   else{
    const size=Math.max(8,element.cursorSize*b.w/720),x=Math.max(b.x,p.x-radius-size-5),y=Math.max(b.y,Math.min(b.y+b.h-size,p.y-size/2));
    const image=style.cursor==='image'?resources?.cursor?.(element):null;
    if(image){const scale=size/Math.max(image.width,image.height);ctx.drawImage(image,x,y,image.width*scale,image.height*scale);}
    else{ctx.font=`${size}px ${fontFamily}`;ctx.textAlign='left';ctx.textBaseline='middle';drawText(element.cursorText||'>',x,y+size/2,size);}
   }ctx.restore();
  }
 }
 const highlighted=worldMapSelection(nodes,selected);
 if(highlighted&&element.showSelectedLabel!==false){ctx.fillStyle=element.color;drawText(`${highlighted.label} · ${highlighted.locked?'Locked':highlighted.completed?'Completed':'Ready'}`,b.x+b.w/2,b.y+b.h-14,b.w-20);}
 if(!nodes.length)drawText('No races configured',b.x+b.w/2,b.y+b.h/2,b.w-12);
}
