import {repairConditionColor} from '../garage/GarageRepairs.js';
import {drawCarComponent} from './MenuCarStats.js';
import {drawMenuPanelArt} from './MenuPanelArtwork.js';
import {menuControlFilter} from './MenuControlStyle.js';
import {garageGridBounds,upgradeGridArea} from './MenuGarageWidgets.js';
import {drawMenuText} from './MenuAppearance.js';
import {TUNING_SECTIONS} from '../garage/GarageTuning.js';

export function drawGarageTuner(ctx,b,tuner,fontFamily='system-ui',element={},resources=null){
 const scale=Math.min(b.w/900,b.h/460),text=(label,x,y,size=19,color='#ffffff',align='left',width=b.w)=>{
  ctx.fillStyle=color;ctx.font=`${Math.max(10,size*scale)}px ${fontFamily}`;ctx.textAlign=align;ctx.textBaseline='middle';drawMenuText(ctx,element,label,x,y,width);
 };
 const panel=element.artRef?resources?.art?.(element.artRef,0):null;
 const areas=[],rect=(x,y,w,h,kind,extra={})=>{const r={x,y,w,h,kind,...extra};areas.push(r);return r;};
 const button=(r,label,selected=false,enabled=true,subtitle=null)=>{
  ctx.save();ctx.filter=menuControlFilter(selected,enabled);
  if(panel)drawMenuPanelArt(ctx,panel,r);
  else{ctx.fillStyle=enabled?'#17212b':'#101318';ctx.fillRect(r.x,r.y,r.w,r.h);}
  const gap=Math.min(r.h/4,Math.max(12,22*scale));
  text(label,r.x+r.w/2,r.y+r.h/2-(subtitle!==null?gap/2:0),19,enabled?'#ffffff':'#ff5757','center',r.w-8);
  if(subtitle!==null)text(subtitle,r.x+r.w/2,r.y+r.h/2+gap/2,19,enabled?'#e5bd67':'#ff5757','center',r.w-8);
  ctx.restore();
 };
 const mode=tuner?.mode||'grid';if(!element.transparentBackground){ctx.fillStyle='#000000';ctx.fillRect(b.x,b.y,b.w,b.h);}
 if(mode!=='grid')text((mode==='edit'||mode==='repair'||mode==='stats')?tuner.row.label.toUpperCase():[TUNING_SECTIONS[tuner.index].label,...(tuner.pathLabels?.()||[])].join(' / ').toUpperCase(),b.x+8,mode==='list'?b.y+12:b.y+b.h*.065,mode==='list'?22:27,'#ffffff','left',b.w*.68);
 if(mode==='grid'){
  for(let i=0;i<8;i++){
   const card=garageGridBounds(b,i),r=rect(card.x,card.y,card.w,card.h,'category',{index:i});
   const enabled=tuner?tuner.enabled(i):i===0,selected=enabled&&(tuner?.index??0)===i;
   button(r,'',selected,enabled);
   ctx.save();ctx.filter=menuControlFilter(selected,enabled);
   const words=TUNING_SECTIONS[i].label.split(' '),middle=Math.ceil(words.length/2),lines=words.length===1?words:[words.slice(0,middle).join(' '),words.slice(middle).join(' ')];
   lines.forEach((line,j)=>text(line,r.x+r.w/2,r.y+r.h/2+(j-(lines.length-1)/2)*Math.max(13,22*scale),21,enabled?'#ffffff':'#73808b','center',r.w-8));
   ctx.restore();
  }
  if(tuner?.message)text(tuner.message,b.x+6,b.y+b.h-8,18,'#adb9c5','left',b.w-12);
 }else if(mode==='list'){
  const rows=tuner.sectionRows();
  rows.forEach((row,index)=>{
   const offset=index,card=garageGridBounds(upgradeGridArea(b),offset),r=rect(card.x,card.y,card.w,card.h,'row',{index});
   button(r,'',index===tuner.rowIndex,true);
   ctx.save();ctx.filter=menuControlFilter(index===tuner.rowIndex,true);
   const words=row.label.split(' '),middle=Math.ceil(words.length/2),lines=words.length===1?words:[words.slice(0,middle).join(' '),words.slice(middle).join(' ')];
   const lineHeight=Math.min(r.h/4,Math.max(11,20*scale));
   lines.forEach((line,j)=>text(line,r.x+r.w/2,r.y+r.h/2+(j-lines.length/2)*lineHeight,18,row.enabled?'#ffffff':'#73808b','center',r.w-8));
   const condition=row.conditionSummary||(row.repair?{average:row.value,worst:row.value}:null);
   const value=condition?`${Math.floor(condition.average)}%`:row.displayValue??(row.children||row.stats||row.preset||row.rev?'':row.repair?(row.id==='all'||row.id==='service'?'':`${Math.floor(row.value)}%`):row.enabled?(row.options?row.options[row.value]?.label:row.format==='percent'?`${Math.round(row.value*100)}%`:Number(row.value.toFixed(4)).toString()):'(Locked)');
   text(value||'',r.x+r.w/2,r.y+r.h/2+lines.length/2*lineHeight,18,row.enabled?(condition?repairConditionColor(condition.worst):'#e5bd67'):'#ff5757','center',r.w-8);
   ctx.restore();
  });
  if(tuner.message&&TUNING_SECTIONS[tuner.index]?.id!=='repair')text(tuner.message,b.x+6,b.y+b.h-8,17,'#adb9c5','left',b.w-12);
  if(tuner.row?.repair)text(`${tuner.row.cost} scrap`,b.x+b.w-6,b.y+12,18,'#e5bd67','right',b.w*.3);
 }else if(mode==='stats'){
  ctx.save();ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${Math.max(10,18*scale)}px ${fontFamily}`;
  const content={x:b.x,y:b.y+b.h*.15,w:b.w/2,h:b.h*.65};
  if(resources){
   drawCarComponent(ctx,content,{...element,type:'car-stats'},tuner.car,resources,0,{},fontFamily);
   drawCarComponent(ctx,{...content,x:b.x+b.w/2},{...element,type:'power-curve'},tuner.car,resources,0,{},fontFamily);
  }
  ctx.restore();
 }else if(mode==='repair'){
  const row=tuner.row;
  for(const [i,label,kind] of [[5,'Repair','apply'],[6,'Cancel','exit']]){const card=garageGridBounds(b,i);button(rect(card.x,card.y,card.w,card.h,kind),label,kind===(tuner.repairAction||'apply'),!tuner.busy,kind==='apply'?String(row.cost):null);}
 }else{
  const row=tuner.row,value=tuner.draft,ratio=Math.max(0,Math.min(1,(value-row.min)/(row.max-row.min||1)));
  text(row.options?row.options[value]?.label:row.format==='percent'?`${Math.round(value*100)}%`:Number(value.toFixed(4)).toString(),b.x+b.w/2,b.y+b.h*.20,34,'#e5bd67','center',b.w*.8);
  const track=rect(b.x+b.w*.15,b.y+b.h*.30,b.w*.7,b.h*.13,'slider'),y=track.y+track.h/2;
  ctx.fillStyle='#485663';ctx.fillRect(track.x,y-3,track.w,6);ctx.fillStyle='#e5bd67';ctx.fillRect(track.x,y-3,track.w*ratio,6);ctx.beginPath();ctx.arc(track.x+track.w*ratio,y,Math.max(6,9*scale),0,Math.PI*2);ctx.fill();
  if(!row.options){text(row.minLabel||String(row.min),track.x,b.y+b.h*.46,17,'#adb9c5');text(row.maxLabel||String(row.max),track.x+track.w,b.y+b.h*.46,17,'#adb9c5','right');}
  text(tuner.message||(tuner.busy?'Saving…':row.options?.[value]?.error||''),b.x+b.w/2,b.y+b.h-8,18,'#adb9c5','center',b.w-12);
 }
 if(tuner)tuner.hitAreas=areas;
}
