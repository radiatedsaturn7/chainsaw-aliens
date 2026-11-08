import {drawMenuText} from './MenuAppearance.js';
import {garageCarPerformance} from '../garage/GarageAutoUpgrade.js';

export function drawCarComponent(ctx,b,e,car,resources,time,parameters,fontFamily='system-ui'){
  const drawText=(...args)=>drawMenuText(ctx,e,...args);
  if(!car){drawText('Choose a car',b.x+b.w/2,b.y+b.h/2,b.w-10);return;}
  const renderer=resources.game.carEditor,tuning=resources.tuning(car);
  if(e.type==='car-preview'){
    ctx.save();const yaw=e.angleBinding?Number(parameters[e.angleBinding]??e.angle)*Math.PI/180:e.animation==='spin'?(e.loop?time/e.duration:Math.min(1,time/e.duration))*Math.PI*2:e.angle*Math.PI/180;
    const choice=renderer.getRaceCarProjectedArtRef(car,0,yaw);
    if(car.art?.bodyModel?.ref||!choice.artRef){resources.carPreview.draw(ctx,b,car,yaw+Math.PI,time);ctx.restore();return;}
    resources.carPreview.drawSprite(ctx,b,car,choice);ctx.restore();return;
  }
  if(e.type==='car-stats'){
    const performance=garageCarPerformance(car,tuning);const lines=[car.name||'Car',`${Math.round(tuning.powerHp||0)} HP · ${Math.round(Number(tuning.torqueLbFt||0)*1.355817948)} Nm`,`${Math.round(tuning.weightKg||0)} kg · ${tuning.drivetrain||car.tuning?.drivetrain||''}`,`Class ${performance.class} · ${performance.points} PI`];
    lines.forEach((line,i)=>drawText(line,b.x+b.w/2,b.y+(i+0.5)*b.h/lines.length,b.w-10));return;
  }
  const min=Number(tuning.idleRpm||800),max=Number(tuning.redlineRpm||7000),points=Array.from({length:41},(_,i)=>{const rpm=min+(max-min)*i/40,torque=renderer.getRaceTorqueNmAtRpm(rpm,tuning);return {rpm,torque,hp:torque*rpm/7127}}),peak=Math.max(1,...points.flatMap(p=>[p.torque,p.hp]));
  const compact=b.h<80,plotTop=b.y+(compact?4:25),plotBottom=b.y+b.h-(compact?4:20),plotHeight=Math.max(1,plotBottom-plotTop);
  ctx.font=`${Math.max(10,Math.min(14,b.h/8))}px ${fontFamily}`;if(!compact)drawText('HP (gold) · Torque Nm (blue)',b.x+b.w/2,b.y+12,b.w-12);
  for(const [key,color] of [['hp','#ffd467'],['torque','#72caff']]){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.beginPath();points.forEach((p,i)=>{const x=b.x+10+i/40*(b.w-20),y=plotBottom-p[key]/peak*plotHeight;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();}
  if(!compact)drawText(`${min} — ${max} RPM`,b.x+b.w/2,b.y+b.h-7,b.w-12);
}
