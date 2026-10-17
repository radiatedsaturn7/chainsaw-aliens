import {showroomPage,garageBrowserRows,garageCardBounds} from './MenuGarageWidgets.js';
import {menuPaintOrder,menuElementVisible} from './MenuLayout.js';
import {menuElementPose,resolveMenuBackground} from './MenuDocument.js';
import {calculateCarPerformance} from '../racing/CarPerformance.js';

export const menuElementBounds=(element,bounds,pose=element)=>({x:bounds.x+pose.x*bounds.w,y:bounds.y+pose.y*bounds.h,w:element.w*bounds.w,h:element.h*bounds.h});
export const menuElementInteractive=e=>['car-showroom','garage-browser','button','choice','slider','toggle','keybind'].includes(e.type);
export const menuHit=(point,b)=>point.x>=b.x&&point.x<=b.x+b.w&&point.y>=b.y&&point.y<=b.y+b.h;
export function drawMenuImage(ctx,image,b,fit='contain'){
  const scale=fit==='cover'?Math.max(b.w/image.width,b.h/image.height):Math.min(b.w/image.width,b.h/image.height);
  const w=fit==='stretch'?b.w:image.width*scale,h=fit==='stretch'?b.h:image.height*scale;
  ctx.drawImage(image,b.x+(b.w-w)/2,b.y+(b.h-h)/2,w,h);
}
const caption=(text,parameters)=>String(text).replace(/\{\{([\w.-]+)\}\}/g,(_,key)=>String(parameters[key]??''));

export function drawMenuScreen(ctx,bounds,document,screen,parameters,{time=0,resources,focus=null,selected=null,editing=false,videos=null,widgetStates=new Map()}={}){
  screen=resolveMenuBackground(document,screen);
  ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();ctx.fillStyle=screen.background;ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);
  const background=resources?.art(screen.backgroundArt,Math.floor(time*8));if(background)ctx.drawImage(background,bounds.x,bounds.y,bounds.w,bounds.h);
  if(screen.effect!=='none'){
    ctx.save();ctx.fillStyle=screen.effect==='stars'?'#ffffff':'#91bedb';ctx.strokeStyle='#91bedb';ctx.globalAlpha=0.5;
    for(let i=0;i<65;i++){const x=bounds.x+((i*0.61803398875)%1)*bounds.w,y=bounds.y+((i*0.381966+time*(screen.effect==='rain'?0.5:0.04))%1)*bounds.h;
      if(screen.effect==='rain'){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-4,y+12);ctx.stroke()}else ctx.fillRect(x,y,screen.effect==='snow'?3:2,screen.effect==='snow'?3:2);
    }ctx.restore();
  }
  for(const element of menuPaintOrder(screen.elements)){
    if(!menuElementVisible(element,screen.elements))continue;const pose=editing?{x:element.x,y:element.y,opacity:1,scale:1,rotation:0}:menuElementPose(element,time),b=menuElementBounds(element,bounds,pose);
    ctx.save();ctx.translate(b.x+b.w/2,b.y+b.h/2);ctx.rotate(pose.rotation*Math.PI/180);ctx.scale(pose.scale,pose.scale);ctx.translate(-b.x-b.w/2,-b.y-b.h/2);ctx.globalAlpha=pose.opacity;
    ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();
    const interactive=menuElementInteractive(element);if(interactive){ctx.fillStyle=element.background;ctx.fillRect(b.x,b.y,b.w,b.h);}
    ctx.fillStyle=element.color;ctx.font=`${Math.max(10,element.fontSize*Math.min(bounds.w/720,bounds.h/900))}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';
    let label=caption(element.label,parameters),value=parameters[element.binding];
    if(element.type==='shape'){
      ctx.beginPath();const inset=element.strokeWidth/2,x=b.x+inset,y=b.y+inset,w=Math.max(0,b.w-2*inset),h=Math.max(0,b.h-2*inset);
      if(element.shape==='ellipse')ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);
      else if(element.shape==='triangle'){ctx.moveTo(x+w/2,y);ctx.lineTo(x+w,y+h);ctx.lineTo(x,y+h);ctx.closePath();}
      else ctx.rect(x,y,w,h);
      ctx.fillStyle=element.fill;ctx.fill();if(element.strokeWidth){ctx.strokeStyle=element.stroke;ctx.lineWidth=element.strokeWidth;ctx.stroke();}
    }
    else if(element.type==='container'){if(editing){ctx.strokeStyle='#7496a8';ctx.lineWidth=1;ctx.setLineDash?.([5,4]);ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.setLineDash?.([]);ctx.fillText(element.label,b.x+b.w/2,b.y+12,b.w-12);}}
    else if(element.type==='image'){const image=resources?.art(element.artRef,Math.floor(time*8));if(image)drawMenuImage(ctx,image,b,element.imageFit);else ctx.fillText(element.artRef||'Choose artwork',b.x+b.w/2,b.y+b.h/2,b.w-12);}
    else if(element.type==='video'){const video=videos?.get(element.id);if(video?.readyState>=2)ctx.drawImage(video,b.x,b.y,b.w,b.h);else ctx.fillText(editing?'Video: '+(element.videoUrl||'Choose source'):'Loading video…',b.x+b.w/2,b.y+b.h/2,b.w-12);}
    else if(element.type==='property-display'){const property=resources?.property(element,parameters);const shown=property==null?'—':typeof property==='number'?property.toFixed(element.decimals):typeof property==='object'?JSON.stringify(property):String(property);ctx.fillText(`${label}${label?': ':''}${shown}${element.suffix}`,b.x+b.w/2,b.y+b.h/2,Math.max(1,b.w-12));}
    else if(element.type==='asset-preview'){const image=resources?.assetArt(element,parameters,time);if(image)drawMenuImage(ctx,image,b,element.imageFit);else ctx.fillText('Choose an actor / item image',b.x+b.w/2,b.y+b.h/2,Math.max(1,b.w-12));}
    else if(element.type==='car-showroom'){
      const choices=resources?.choices('cars',document,parameters)||[];
      const page=showroomPage(choices,value,element.maxVisible),state=widgetStates.get(element.id)||{};
      if(!choices.length)ctx.fillText('Save a car in the Car Editor to begin',b.x+b.w/2,b.y+b.h/2,b.w-16);
      for(const [i,entry] of page.entries.entries()){
        const selected=entry.value===(value||choices[0]?.value),card=garageCardBounds(b,page.entries.length,i);
        const elapsed=Math.max(0,time-(state.selectedAt??time));
        const blend=editing?1:1-Math.exp(-elapsed*8);
        const scale=selected?1+(element.selectedScale-1)*blend:1;
        ctx.save();ctx.globalAlpha*=selected?1:element.inactiveOpacity;
        ctx.fillStyle='#34434a';ctx.beginPath();ctx.ellipse(card.x+card.w/2,card.y+card.h*.8,card.w*.43,card.h*.09,0,0,Math.PI*2);ctx.fill();
        const preview={x:card.x+card.w*(1-scale)/2,y:card.y+card.h*(1-scale)/2,w:card.w*scale,h:card.h*.85*scale};
        const car=resources?.car(entry.value),view={...element,type:'car-preview',animation:'none',angleBinding:'',angle:element.angle+(selected&&!editing?elapsed/element.duration*360:0)};
        const draw=(context,area)=>drawCarComponent(context,area,view,car,resources,time,parameters);
        if(!selected&&resources?.drawParkedCar)resources.drawParkedCar(ctx,preview,car,element.angle,draw);else draw(ctx,preview);
        ctx.fillStyle=element.color;ctx.fillText(entry.label,card.x+card.w/2,card.y+card.h-4,card.w-8);ctx.restore();
      }
      ctx.fillStyle=element.color;ctx.fillText(`◀  ${page.index+1} / ${choices.length}  ▶   ·   Confirm to select`,b.x+b.w/2,b.y+b.h-10,b.w-12);
    }
    else if(element.type==='garage-browser'){
      const state=widgetStates.get(element.id)||{},rows=resources?garageBrowserRows(resources,parameters,state):[];
      const index=Math.max(0,Math.min(state.index||0,rows.length-1)),start=Math.floor(index/4)*4,visible=rows.slice(start,start+4);
      ctx.fillText(['Upgrades',state.section,state.slot].filter(Boolean).join(' / '),b.x+b.w/2,b.y+12,b.w-12);
      if(!rows.length)ctx.fillText('No compatible parts available',b.x+b.w/2,b.y+b.h/2,b.w-12);
      for(const [i,row] of visible.entries()){
        const card=garageCardBounds(b,visible.length,i);ctx.fillStyle=start+i===index?'#486c83':'#18242d';ctx.fillRect(card.x,card.y,card.w,card.h);
        ctx.fillStyle=element.color;ctx.fillText(row.label,card.x+card.w/2,card.y+card.h/2,card.w-12);
      }
      ctx.fillStyle=element.color;ctx.fillText(`${state.section?'‹ Back   ·   ':''}◀ / ▶ Browse   ·   Confirm ${state.slot?'buy / install':'open'}`,b.x+b.w/2,b.y+b.h-10,b.w-12);
    }
    else if(['car-preview','car-stats','power-curve'].includes(element.type))drawCarComponent(ctx,b,element,resources?.car(element.assetRef||value),resources,time,parameters);
    else{
      if(element.type==='choice'){const options=element.source?resources?.choices(element.source,document,parameters)||[]:element.options;label+=`: ${options.find(o=>JSON.stringify(o.value)===JSON.stringify(value))?.label||'Choose…'}`;}
      if(element.type==='toggle')label+=value?' ✓':' —';
      if(element.type==='keybind')label+=`: ${value||'Set key'}`;
      if(element.type==='slider'){
        const number=Number.isFinite(Number(value))?Number(value):element.min,ratio=Math.max(0,Math.min(1,(number-element.min)/(element.max-element.min||1)));
        ctx.fillStyle='#18242d';ctx.fillRect(b.x+10,b.y+b.h*0.7,b.w-20,5);ctx.fillStyle=element.color;ctx.fillRect(b.x+10,b.y+b.h*0.7,(b.w-20)*ratio,5);
        label+=`: ${Number(number.toFixed(2))}`;ctx.fillText(label,b.x+b.w/2,b.y+b.h*0.35,b.w-16);
      }else ctx.fillText(label,b.x+b.w/2,b.y+b.h/2,Math.max(1,b.w-16));
    }
    ctx.restore();
    if(element.id===focus||element.id===selected){ctx.save();ctx.strokeStyle=element.id===selected?'#ffce51':'#ffffff';ctx.lineWidth=3;ctx.strokeRect(b.x+1,b.y+1,b.w-2,b.h-2);if(editing){ctx.fillStyle='#ffce51';ctx.fillRect(b.x+b.w-10,b.y+b.h-10,10,10)}ctx.restore();}
  }
  ctx.restore();
}
function drawCarComponent(ctx,b,e,car,resources,time,parameters){
  if(!car){ctx.fillText('Choose a car',b.x+b.w/2,b.y+b.h/2,b.w-10);return;}
  const renderer=resources.game.carEditor,tuning=resources.tuning(car);
  if(e.type==='car-preview'){
    ctx.save();const yaw=e.angleBinding?Number(parameters[e.angleBinding]??e.angle)*Math.PI/180:e.animation==='spin'?(e.loop?time/e.duration:Math.min(1,time/e.duration))*Math.PI*2:e.angle*Math.PI/180;
    const choice=renderer.getRaceCarProjectedArtRef(car,0,yaw);
    if(car.art?.bodyModel?.ref||!choice.artRef){resources.carPreview.draw(ctx,b,car,yaw+Math.PI,time);ctx.restore();return;}
    resources.carPreview.drawSprite(ctx,b,car,choice);ctx.restore();return;
  }
  if(e.type==='car-stats'){
    const performance=calculateCarPerformance(car);const lines=[car.name||'Car',`${Math.round(tuning.powerHp||0)} HP · ${Math.round(Number(tuning.torqueLbFt||0)*1.355817948)} Nm`,`${Math.round(tuning.weightKg||0)} kg · ${tuning.drivetrain||car.tuning?.drivetrain||''}`,`Class ${performance.performanceClass||performance.class||''}`];
    lines.forEach((line,i)=>ctx.fillText(line,b.x+b.w/2,b.y+(i+0.5)*b.h/lines.length,b.w-10));return;
  }
  const min=Number(tuning.idleRpm||800),max=Number(tuning.redlineRpm||7000),points=Array.from({length:41},(_,i)=>{const rpm=min+(max-min)*i/40,torque=renderer.getRaceTorqueNmAtRpm(rpm,tuning);return {rpm,torque,hp:torque*rpm/7127}}),peak=Math.max(1,...points.flatMap(p=>[p.torque,p.hp]));
  ctx.font=`${Math.max(10,Math.min(14,b.h/8))}px system-ui`;ctx.fillText('HP (gold) · Torque Nm (blue)',b.x+b.w/2,b.y+12,b.w-12);
  for(const [key,color] of [['hp','#ffd467'],['torque','#72caff']]){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();points.forEach((p,i)=>{const x=b.x+10+i/40*(b.w-20),y=b.y+b.h-20-p[key]/peak*(b.h-45);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();}
  ctx.fillText(`${min} — ${max} RPM`,b.x+b.w/2,b.y+b.h-7,b.w-12);
}
