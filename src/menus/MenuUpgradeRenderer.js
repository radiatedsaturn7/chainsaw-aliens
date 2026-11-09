import {upgradeHeading} from '../garage/GarageLabels.js';
import {drawMenuPanelArt} from './MenuPanelArtwork.js';
import {menuControlFilter} from './MenuControlStyle.js';
import {drawMenuText} from './MenuAppearance.js';
import {garageBrowserRows,garageGridBounds,upgradeGridArea} from './MenuGarageWidgets.js';
export function drawUpgradeGrid(ctx,b,element,resources,parameters,state={},fontFamily='system-ui'){
 const rows=resources?garageBrowserRows(resources,parameters,state):[],index=Math.max(0,Math.min(rows.length-1,state.index||0));
 const panel=element.artRef?resources?.art?.(element.artRef,0):null;
 const size=Math.max(10,Math.min(20,b.w/36));ctx.font=`${size}px ${fontFamily}`;ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillStyle=element.color;drawMenuText(ctx,element,[upgradeHeading(state),...(state.breadcrumbs||[])].filter(Boolean).join(' / '),b.x+b.w*.35,b.y+12,b.w*.68-12);
 const status=(state.slot||rows[index]?.package)&&!rows[index]?.children?rows[index]?.description?.split(' · ')[0]:'';
 if(status){ctx.fillStyle='#e5bd67';ctx.textAlign='right';drawMenuText(ctx,element,status,b.x+b.w-6,b.y+12,b.w*.3);ctx.textAlign='center';}
 if(!rows.length)drawMenuText(ctx,element,state.slot==='auto'?'No class upgrades available':'No compatible parts available',b.x+b.w/2,b.y+b.h/2,b.w-12);
 rows.forEach((row,i)=>{
  const card=garageGridBounds(upgradeGridArea(b),i),selected=i===index,locked=row.disabled===true||row.label.endsWith(' · Locked');
  ctx.save();ctx.filter=menuControlFilter(selected,!locked);
  if(panel)drawMenuPanelArt(ctx,panel,card);
  else{ctx.fillStyle=locked?'#101318':'#17212b';ctx.fillRect(card.x,card.y,card.w,card.h);}
  const [name,...statusParts]=row.label.split(' · '),status=statusParts.join(' · ').replace(/(\d+) scrap/,(_,n)=>Number(n).toLocaleString('en-US')+' scrap');
  const width=card.w-8,measure=text=>ctx.measureText?.(text)?.width??text.length*size*.5,lines=[];let line='';
  for(const word of name.split(' ')){if(line&&measure(line+' '+word)>width){lines.push(line);line=word;}else line=line?line+' '+word:word;}
  if(line)lines.push(line);
  const visible=row.labelLines||lines.slice(0,2);if(!row.labelLines&&lines.length>2)visible[1]+='…';
  const lineHeight=Math.max(11,Math.min(size*1.2,card.h/(visible.length+(status?1:0)+.5))),total=visible.length+(status?1:0);
  ctx.fillStyle=locked?'#73808b':element.color;
  visible.forEach((text,j)=>drawMenuText(ctx,element,text,card.x+card.w/2,card.y+card.h/2+(j-(total-1)/2)*lineHeight,width));
  if(status){ctx.fillStyle=locked?'#73808b':'#e5bd67';drawMenuText(ctx,element,status,card.x+card.w/2,card.y+card.h/2+(visible.length-(total-1)/2)*lineHeight,width);}
  ctx.restore();
  // Installed equipment stays identifiable independently of keyboard/touch focus.
  if(row.installed){ctx.save();ctx.strokeStyle='#54df86';ctx.lineWidth=3;ctx.strokeRect(card.x+2,card.y+2,Math.max(0,card.w-4),Math.max(0,card.h-4));ctx.restore();}
 });
}
