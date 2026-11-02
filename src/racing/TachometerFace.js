const clamp=(v,d,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):d;
export function normalizeTachometer(t={},g={}){
 return {displayMode:['fill','both'].includes(t.displayMode)?t.displayMode:'needle',darkColor:String(t.darkColor||'#252525'),darkOpacity:clamp(t.darkOpacity,1,0,1),
  majorCutout:t.majorCutout===true||t.majorColor==='transparent',minorCutout:t.minorCutout===true||t.minorColor==='transparent',autoScale:t.autoScale!==false,autoRedline:t.autoRedline!==false,redline:clamp(t.redline,6500,0,100000),
  showFace:t.showFace??!g.artRef,safeColor:String(t.safeColor||'#ffffff'),dangerColor:String(t.dangerColor||'#ff3030'),
  arcWidth:clamp(t.arcWidth,8,0,50),radius:clamp(t.radius,.9,.1,1),
  majorInterval:clamp(t.majorInterval,1000,1,100000),minorInterval:clamp(t.minorInterval,100,0,100000),
  majorLength:clamp(t.majorLength,.16,0,.8),minorLength:clamp(t.minorLength,.08,0,.8),majorWidth:clamp(t.majorWidth,2,.1,12),minorWidth:clamp(t.minorWidth,1,.1,12),
  majorColor:String(t.majorColor==='transparent'?'#ffffff':t.majorColor||'#ffffff'),minorColor:String(t.minorColor==='transparent'?'#bbbbbb':t.minorColor||'#bbbbbb'),showLabels:t.showLabels!==false,labelRadius:clamp(t.labelRadius,.65,.1,1),labelDivisor:clamp(t.labelDivisor,1000,1,10000),
  font:{fontFamily:String(t.font?.fontFamily||'monospace'),fontData:String(t.font?.fontData||''),fontFileName:String(t.font?.fontFileName||''),fontSize:clamp(t.font?.fontSize,10,4,120),fontWeight:Math.round(clamp(t.font?.fontWeight,400,100,900)/100)*100,fontItalic:t.font?.fontItalic===true,fontUnderline:t.font?.fontUnderline===true,textColor:String(t.font?.textColor||'#ffffff'),outline:clamp(t.font?.outline,1,0,12)}
 };
}
export function carRpmLimits(car={}){
 const tuning=car.tuning||{},limit=Math.max(1,Number(tuning.revLimitRpm)||Number(tuning.redlineRpm)||8000);
 const max=Math.max(1,Number(tuning.tachometerMaxRpm)||limit);
 return {max,limit,redline:Math.max(0,Math.min(limit,Number(tuning.redlineRpm)||limit*.9))};
}
export function tachometerScale(g,car={}){
 const t=g.tachometer||normalizeTachometer({},g),limits=carRpmLimits(car);
 const min=t.autoScale?0:g.min,max=t.autoScale?limits.max:Math.max(min+1,g.max);
 const redline=Math.max(min,Math.min(max,t.autoRedline?limits.redline:t.redline));
 return {min,max,redline};
}
export function tachometerTicks(min,max,interval,limit=1000){
 if(!(interval>0)||!(max>min))return [];
 // Bound work even for extreme/custom engines and one-RPM intervals.
 const step=interval*Math.max(1,Math.ceil((max-min)/interval/limit));
 const values=[];for(let i=Math.ceil(min/step);i*step<=max+.00001&&values.length<=limit;i++)values.push(i*step);
 return values;
}
function arc(ctx,cx,cy,radius,start,sweep,width,color,image,imageFraction=1){
 if(Math.abs(sweep)<1e-8||width<=0)return;
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.arc(cx,cy,radius,start,start+sweep,sweep<0);ctx.stroke();
 if(!image)return;
 const count=Math.max(1,Math.min(96,Math.ceil(Math.abs(sweep)*radius/6))),angle=sweep/count,length=Math.abs(angle)*radius;
 for(let i=0;i<count;i++){
  const a=start+(i+.5)*angle;ctx.save();ctx.translate(cx+Math.cos(a)*radius,cy+Math.sin(a)*radius);ctx.rotate(a+Math.sign(sweep)*Math.PI/2);
  ctx.drawImage(image,i*image.width/count*imageFraction,0,image.width/count*imageFraction,image.height,-length/2,-width/2,length+.5,width);ctx.restore();
 }
}
const arcLayers=new WeakMap();
function arcLayer(ctx,width,height){
 let layer=arcLayers.get(ctx);
 if(!layer){const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(1,1):typeof document!=='undefined'?document.createElement('canvas'):null;if(!canvas)return null;layer={canvas,ctx:canvas.getContext('2d')};if(!layer.ctx)return null;arcLayers.set(ctx,layer);}
 if(layer.canvas.width!==width)layer.canvas.width=width;if(layer.canvas.height!==height)layer.canvas.height=height;
 return layer;
}
export function drawTachometerFace(ctx,r,g,car,{getArt,font,text,scale=1,value=0,createLayer=arcLayer,rangeOverride=null,labelForValue=null}){
 const t=g.tachometer||normalizeTachometer({},g),range=rangeOverride||tachometerScale(g,car),cx=r.x+r.w/2,cy=r.y+r.h/2,radius=Math.min(r.w,r.h)/2*t.radius;
 if(!t.showFace)return {radius,...range};
 const start=g.startAngle*Math.PI/180,sweep=g.sweepAngle*Math.PI/180,ratio=(range.redline-range.min)/(range.max-range.min),angle=v=>start+sweep*(v-range.min)/(range.max-range.min);
 const filled=t.displayMode!=='needle',fill=filled?Math.max(0,Math.min(1,(value-range.min)/(range.max-range.min))):1;
 const majorTicks=tachometerTicks(range.min,range.max,t.majorInterval,100);
 const minorTicks=tachometerTicks(range.min,range.max,t.minorInterval).filter(value=>Math.abs(value/t.majorInterval-Math.round(value/t.majorInterval))>1e-6);
 const tick=(target,value,major,cutout=false)=>{
  const a=angle(value),length=major?t.majorLength:t.minorLength;if(length<=0)return;
  target.strokeStyle=cutout?'#000000':major?t.majorColor:t.minorColor;target.lineWidth=(major?t.majorWidth:t.minorWidth)*scale;
  const outer=radius+(cutout?t.arcWidth*scale/2+1:0);
  target.beginPath();target.moveTo(cx+Math.cos(a)*outer,cy+Math.sin(a)*outer);target.lineTo(cx+Math.cos(a)*radius*(1-length),cy+Math.sin(a)*radius*(1-length));target.stroke();
 };
 const drawArcs=target=>{
  target.save();target.lineCap='butt';
  if(filled){target.save();target.globalAlpha*=t.darkOpacity;arc(target,cx,cy,radius,start,sweep,t.arcWidth*scale,t.darkColor,null);target.restore();}
  const safe=Math.min(fill,ratio),danger=Math.max(0,fill-ratio);
  arc(target,cx,cy,radius,start,sweep*safe,t.arcWidth*scale,t.safeColor,getArt(g.safeArcArtRef),ratio>0?safe/ratio:0);
  arc(target,cx,cy,radius,start+sweep*ratio,sweep*danger,t.arcWidth*scale,t.dangerColor,getArt(g.dangerArcArtRef),ratio<1?danger/(1-ratio):0);
  target.restore();
 };
 ctx.save();ctx.lineCap='butt';
 // Erase only the arc layer, never the road, dashboard, other gauges or labels.
 const extent=radius+t.arcWidth*scale/2+2,diameter=extent*2,pixels=Math.max(1,Math.min(2048,Math.ceil(diameter)));
 const layer=(t.majorCutout||t.minorCutout)?createLayer(ctx,pixels,pixels):null;
 if(layer){
  const c=layer.ctx;c.save();c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,pixels,pixels);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.scale(pixels/diameter,pixels/diameter);c.translate(extent-cx,extent-cy);
  drawArcs(c);c.globalCompositeOperation='destination-out';c.lineCap='butt';
  if(t.minorCutout)for(const v of minorTicks)tick(c,v,false,true);
  if(t.majorCutout)for(const v of majorTicks)tick(c,v,true,true);
  c.restore();ctx.drawImage(layer.canvas,cx-extent,cy-extent,diameter,diameter);
 }else drawArcs(ctx);
 if(!t.minorCutout)for(const v of minorTicks)tick(ctx,v,false);
 for(const v of majorTicks){
  if(!t.majorCutout)tick(ctx,v,true);
  if(t.showLabels){const a=angle(v);ctx.font=font(t.font,scale);ctx.textAlign='center';ctx.textBaseline='middle';text(ctx,t.font,labelForValue?labelForValue(v):String(Number((v/t.labelDivisor).toFixed(3))),cx+Math.cos(a)*radius*t.labelRadius,cy+Math.sin(a)*radius*t.labelRadius,Math.max(1,r.w*.22),scale);}
 }
 ctx.restore();return {radius,...range};
}
