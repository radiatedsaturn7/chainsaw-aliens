import {drawTachometerFace} from './TachometerFace.js';
import {normalizeFuelConfig} from './simulation/FuelModel.js';
export function drawFuelFace(ctx,r,g,car,options){
 const t=g.tachometer;
 drawTachometerFace(ctx,r,{...g,safeArcArtRef:g.dangerArcArtRef,dangerArcArtRef:g.safeArcArtRef,tachometer:{...t,safeColor:t.dangerColor,dangerColor:t.safeColor,font:g}},car,{...options,rangeOverride:{min:0,max:100,redline:Math.max(0,Math.min(100,t.redline))},labelForValue:v=>v===0?'E':v===100?'F':v===50?'½':''});
 if(g.fuelShowIcon===false)return;
 const size=Math.min(r.w,r.h)*.15*(g.fuelIconScale??1);
 let centerX=r.x+r.w*(.5+(g.fuelIconOffsetX??0)),x=centerX-size/2,y=r.y+r.h*(.7+(g.fuelIconOffsetY??0));
 if(g.fuelIconAngle!=null){
  const angle=g.fuelIconAngle*Math.PI/180,radius=Math.min(r.w,r.h)/2*t.radius;
  centerX=r.x+r.w/2+Math.cos(angle)*radius+r.w*(g.fuelIconOffsetX??0);
  x=centerX-size/2;y=r.y+r.h/2+Math.sin(angle)*radius-size/2+r.h*(g.fuelIconOffsetY??0);
 }
 const icon=options.getArt(g.fuelIconArtRef);ctx.save();ctx.strokeStyle=g.textColor;ctx.fillStyle=g.textColor;ctx.lineWidth=Math.max(1,size*.1);
 if(icon)ctx.drawImage(icon,x,y,size,size);
 else{
  ctx.strokeRect(x,y,size*.65,size);ctx.strokeRect(x+size*.12,y+size*.12,size*.4,size*.3);
  ctx.beginPath();ctx.moveTo(x+size*.65,y+size*.35);ctx.lineTo(x+size,y+size*.5);ctx.lineTo(x+size,y+size*.85);ctx.lineTo(x+size*.8,y+size*.85);ctx.stroke();
 }
 const side=normalizeFuelConfig(car?.mechanics||{}).fuelDoorSide,dir=side==='left'?-1:1,ax=centerX+dir*size*1.2;
 ctx.beginPath();ctx.moveTo(ax+dir*size*.35,y+size*.5);ctx.lineTo(ax-dir*size*.2,y+size*.2);ctx.lineTo(ax-dir*size*.2,y+size*.8);ctx.closePath();ctx.fill();ctx.restore();
}
