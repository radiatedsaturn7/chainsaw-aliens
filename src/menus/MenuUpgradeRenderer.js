import {selectableIndex} from './MenuSelection.js';
import {drawMenuPanelArt} from './MenuPanelArtwork.js';
import {menuControlFilter} from './MenuControlStyle.js';
import {drawMenuText} from './MenuAppearance.js';
import {garageBrowserRows,garageGridBounds} from './MenuGarageWidgets.js';
export function drawUpgradeGrid(ctx,b,element,resources,parameters,state={},fontFamily='system-ui'){
 const rows=resources?garageBrowserRows(resources,parameters,state):[],index=selectableIndex(rows,state.index||0),start=Math.floor(Math.max(0,index)/8)*8;
 const panel=element.artRef?resources?.art?.(element.artRef,0):null;
 const size=Math.max(10,Math.min(20,b.w/36));ctx.font=`${size}px ${fontFamily}`;ctx.textAlign='center';ctx.textBaseline='middle';
 ctx.fillStyle=element.color;drawMenuText(ctx,element,[state.section,state.slot].filter(Boolean).join(' / '),b.x+b.w/2,b.y+12,b.w-12);
 if(!rows.length)drawMenuText(ctx,element,'No compatible parts available',b.x+b.w/2,b.y+b.h/2,b.w-12);
 rows.slice(start,start+8).forEach((row,i)=>{
  const card=garageGridBounds(b,i),selected=start+i===index,locked=row.disabled===true||row.label.endsWith(' · Locked');
  ctx.save();ctx.filter=menuControlFilter(selected,!locked);
  if(panel)drawMenuPanelArt(ctx,panel,card);
  else{ctx.fillStyle=locked?'#101318':'#17212b';ctx.fillRect(card.x,card.y,card.w,card.h);}
  const [name,...statusParts]=row.label.split(' · '),status=statusParts.join(' · ').replace(/(\d+) scrap/,(_,n)=>Number(n).toLocaleString('en-US')+' scrap');
  const width=card.w-8,measure=text=>ctx.measureText?.(text)?.width??text.length*size*.5,lines=[];let line='';
  for(const word of name.split(' ')){if(line&&measure(line+' '+word)>width){lines.push(line);line=word;}else line=line?line+' '+word:word;}
  if(line)lines.push(line);
  const visible=lines.slice(0,2);if(lines.length>2)visible[1]+='…';
  const lineHeight=Math.max(11,Math.min(size*1.2,card.h/(visible.length+(status?1:0)+.5))),total=visible.length+(status?1:0);
  ctx.fillStyle=locked?'#73808b':element.color;
  visible.forEach((text,j)=>drawMenuText(ctx,element,text,card.x+card.w/2,card.y+card.h/2+(j-(total-1)/2)*lineHeight,width));
  if(status){ctx.fillStyle=locked?'#73808b':'#e5bd67';drawMenuText(ctx,element,status,card.x+card.w/2,card.y+card.h/2+(visible.length-(total-1)/2)*lineHeight,width);}
  ctx.restore();
 });
}
