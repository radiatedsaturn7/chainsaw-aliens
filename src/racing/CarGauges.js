import {MenuAppearanceResources} from '../menus/MenuAppearance.js';
const fonts=new MenuAppearanceResources();
export async function prepareGaugeFont(g){
 fonts.font(g);const entry=fonts.fonts.get(g.fontData);await entry?.pending;
 if(entry&&!entry.ready)throw Error('Could not load the gauge font. Please upload it again.');
}
const n=(v,d,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):d;
export const GAUGE_SOURCES=['speed','rpm','gear','lapTime','raceTime','lap','map','temperature','damage.engine','damage.transmission',...['front','rear','left','right'].map(k=>'damage.panels.'+k),...['tires','suspension'].flatMap(k=>['fl','fr','rl','rr'].map(w=>'damage.'+k+'.'+w)),'decoration'];
export const GAUGE_FORMATS=['number','dial','bar','icon','map'];
export const GAUGE_ART_FIELDS=['artRef','needleArtRef','overlayArtRef','markerArtRef','carMarkerArtRef','startMarkerArtRef','finishMarkerArtRef'];
export function normalizeGaugeMap(g={}){
 const result={mapScreenX:n(g.mapScreenX,0,0,.99),mapScreenY:n(g.mapScreenY,0,0,.99),mapScreenWidth:n(g.mapScreenWidth,1,.01,1),mapScreenHeight:n(g.mapScreenHeight,1,.01,1),mapOpacity:n(g.mapOpacity,1,0,1),
  mapOrientation:g.mapOrientation==='heading'?'heading':'north',mapProjection:g.mapProjection==='perspective'?'perspective':'flat',mapPitch:n(g.mapPitch,45,20,80),mapPlayerY:n(g.mapPlayerY,.75,.2,.9),
  mapMode:g.mapMode==='local'?'local':'whole',mapRangeM:n(g.mapRangeM,300,20,10000),
  mapLineColor:String(g.mapLineColor||'#d9e6d2'),mapLineWidth:n(g.mapLineWidth,2,.5,20),
  mapLineBorderColor:String(g.mapLineBorderColor||'#101916'),mapLineBorderWidth:n(g.mapLineBorderWidth,1,0,12),
  mapBorderColor:String(g.mapBorderColor||'#101916'),mapBorderWidth:n(g.mapBorderWidth,0,0,12)};
 for(const [kind,color,size] of [['player','#58d6ff',10],['car','#f2d45c',6],['start','#61e79a',6],['finish','#ff4f4f',6]]){
  result[kind+'MarkerShape']=['circle','triangle','square','flag'].includes(g[kind+'MarkerShape'])?g[kind+'MarkerShape']:kind==='player'||kind==='car'?'circle':'square';
  result[kind+'MarkerColor']=String(g[kind+'MarkerColor']||color);result[kind+'MarkerSize']=n(g[kind+'MarkerSize'],size,1,40);
 }
 for(const key of ['carMarkerArtRef','startMarkerArtRef','finishMarkerArtRef'])result[key]=String(g[key]||'');
 result.mapScreenWidth=Math.min(result.mapScreenWidth,1-result.mapScreenX);result.mapScreenHeight=Math.min(result.mapScreenHeight,1-result.mapScreenY);
 return result;
}
export function normalizeGauge(g={},i=0){const gauge = {
 ...normalizeGaugeMap(g),
 id:String(g.id||'gauge-'+i),source:GAUGE_SOURCES.includes(g.source)?g.source:'speed',format:GAUGE_FORMATS.includes(g.format)?g.format:'number',
 name:String(g.name||g.source||'Speed'),enabled:g.enabled!==false,x:n(g.x,.75,0,1),y:n(g.y,.8,0,1),width:n(g.width,.2,.005,1),height:n(g.height,.12,.005,1),
 min:n(g.min,0,-1000,100000),max:Math.max(n(g.min,0,-1000,100000)+.001,n(g.max,g.source==='rpm'?8000:200,-999,100001)),units:String(g.units??((!g.source||g.source==='speed')?'MPH':'')),
 color:String(g.color||'#ffffff'),background:String(g.background||'#16251f'),fontFamily:String(g.fontFamily||'monospace'),fontData:String(g.fontData||''),fontFileName:String(g.fontFileName||''),fontSize:n(g.fontSize,18,4,120),fontWeight:Math.round(n(g.fontWeight,400,100,900)/100)*100,fontItalic:g.fontItalic===true,fontUnderline:g.fontUnderline===true,textColor:String(g.textColor||g.color||'#ffffff'),outline:n(g.outline,2,0,12),
 markerArtRef:String(g.markerArtRef||''),artRef:String(g.artRef||''),needleArtRef:String(g.needleArtRef||''),overlayArtRef:String(g.overlayArtRef||''),frameIndex:Math.round(n(g.frameIndex,0,0,10000)),
 startAngle:n(g.startAngle,135,-360,360),sweepAngle:n(g.sweepAngle,270,-360,360),needlePivotX:n(g.needlePivotX,.5,0,1),needlePivotY:n(g.needlePivotY,.85,0,1),
 showValue:g.showValue!==false,vertical:g.vertical===true
};gauge.x=Math.min(gauge.x,1-gauge.width);gauge.y=Math.min(gauge.y,1-gauge.height);return gauge;}
export function defaultGauges(){
 const base=[{source:'map',format:'map',x:.02,y:.02,width:.21,height:.28},{source:'raceTime',x:.75,y:.02,width:.23,height:.07},{source:'lap',x:.8,y:.1,width:.18,height:.06},{source:'rpm',format:'dial',x:.76,y:.69,width:.22,height:.28,max:8000},{source:'speed',x:.78,y:.87,width:.2,height:.08},{source:'gear',x:.69,y:.86,width:.08,height:.1}];
 GAUGE_SOURCES.filter(s=>s.startsWith('damage.')).forEach((source,i)=>base.push({source,format:'icon',x:.02+(i%4)*.035,y:.72+Math.floor(i/4)*.06,width:.028,height:.045,name:source.replace('damage.','')}));
 return base.map((g,i)=>normalizeGauge(g,i));
}
export function normalizeCarGauges(value={}){return Object.fromEntries(['exterior','interior'].map(k=>[k,{enabled:value?.[k]?.enabled===true,widgets:Array.isArray(value?.[k]?.widgets)?value[k].widgets.filter(g=>g&&typeof g==='object').map(normalizeGauge):defaultGauges()}]));}
export function gaugeArtRefs(car){return [...new Set(Object.values(car?.art?.gauges||{}).flatMap(l=>(l.widgets||[]).flatMap(g=>GAUGE_ART_FIELDS.map(key=>g[key]))).filter(Boolean))];}
export function gaugeValue(g,{session={},car={},race={},gear=session.gear,temperatureC=22}={}){
 switch(g.source){case 'speed':return Math.abs(session.speedMps||0)*(g.units.toLowerCase()==='km/h'?3.6:2.23694);case 'rpm':return session.engineRpm??((session.rpm||0)*(car.tuning?.revLimitRpm||car.tuning?.redlineRpm||8000));case 'gear':return gear??0;case 'raceTime':return session.elapsedMs||0;case 'lapTime':return Math.max(0,(session.elapsedMs||0)-(session.lapStartMs||0));case 'lap':return session.lap||1;case 'temperature':return temperatureC;default:return g.source.split('.').reduce((v,k)=>v?.[k],session)??0;}
}
export function gaugeText(g,value){if(g.source.endsWith('Time')){const t=Math.floor(Math.max(0,value)/100)/10;return `${Math.floor(t/60)}:${(t%60).toFixed(1).padStart(4,'0')}`;}if(g.source==='gear')return value<0?'R':value===0?'N':String(value);return `${Math.round(value)}${g.units?' '+g.units:''}`;}
export function gaugeFont(g,scale=1){return `${g.fontItalic?'italic ':''}${g.fontWeight||400} ${g.fontSize*scale}px ${fonts.font(g)}`;}
export function drawGaugeText(ctx,g,text,x,y,maxWidth,scale=1){
 ctx.lineJoin='round';ctx.lineWidth=g.outline*2*scale;ctx.strokeStyle='#000000';
 if(g.outline)ctx.strokeText(text,x,y,maxWidth);ctx.fillStyle=g.textColor||g.color;ctx.fillText(text,x,y,maxWidth);
 if(g.fontUnderline){
  const width=Math.min(maxWidth,ctx.measureText(text).width),left=ctx.textAlign==='center'?x-width/2:ctx.textAlign==='right'?x-width:x;
  const size=g.fontSize*scale,baseline=ctx.textBaseline==='top'?size:ctx.textBaseline==='middle'?size*.45:size*.12;
  ctx.beginPath();ctx.moveTo(left,y+baseline);ctx.lineTo(left+width,y+baseline);ctx.strokeStyle=ctx.fillStyle;ctx.lineWidth=Math.max(1,size*.06);ctx.stroke();
 }
}
export function drawCarGauges(ctx,bounds,layout,state,{getArt,drawMap,selectedId}={}){
 const regions=[];ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();
 for(const g of layout.widgets){if(!g.enabled)continue;const r={x:bounds.x+g.x*bounds.w,y:bounds.y+g.y*bounds.h,w:g.width*bounds.w,h:g.height*bounds.h};regions.push({...r,id:g.id});
 const value=gaugeValue(g,state),ratio=Math.max(0,Math.min(1,(value-g.min)/Math.max(.001,g.max-g.min))),damage=g.source.startsWith('damage.');
 const color=damage?(value>=75?'#ff4f4f':value>=50?'#ff8a2f':value>=25?'#f2d45c':g.color):g.color;
 const art=ref=>ref?getArt?.(ref,{frameIndex:g.frameIndex}):null,background=art(g.artRef);ctx.save();ctx.fillStyle=color;ctx.strokeStyle=color;
 if(background)ctx.drawImage(background,r.x,r.y,r.w,r.h);
 if(g.format==='map')drawMap?.(r,{...g,font:gaugeFont(g,bounds.h/300),fontScale:bounds.h/300});
 else if(g.format==='bar'){if(!background){ctx.fillStyle=g.background;ctx.fillRect(r.x,r.y,r.w,r.h);}ctx.fillStyle=color;if(g.vertical)ctx.fillRect(r.x,r.y+r.h*(1-ratio),r.w,r.h*ratio);else ctx.fillRect(r.x,r.y,r.w*ratio,r.h);}
 else if(g.format==='dial'){
 const cx=r.x+r.w/2,cy=r.y+r.h/2,radius=Math.min(r.w,r.h)*.45,start=g.startAngle*Math.PI/180,sweep=g.sweepAngle*Math.PI/180;
 if(!background){ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,radius,Math.min(start,start+sweep),Math.max(start,start+sweep));ctx.stroke();for(let i=0;i<=10;i++){const a=start+sweep*i/10;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*radius*.85,cy+Math.sin(a)*radius*.85);ctx.lineTo(cx+Math.cos(a)*radius,cy+Math.sin(a)*radius);ctx.stroke();}}
 const a=start+sweep*ratio,needle=art(g.needleArtRef);ctx.save();ctx.translate(cx,cy);ctx.rotate(a+Math.PI/2);if(needle)ctx.drawImage(needle,-g.needlePivotX*r.w,-g.needlePivotY*r.h,r.w,r.h);else{ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-radius*.8);ctx.stroke();}ctx.restore();
 }else if(g.format==='icon'&&!background){ctx.fillStyle=color;ctx.fillRect(r.x,r.y,r.w,r.h);}
 if(damage&&background){ctx.fillStyle=color;ctx.fillRect(r.x,r.y+r.h-3,r.w*ratio,3);}
 if(g.source!=='decoration'&&g.showValue&&['number','dial','bar'].includes(g.format)){
 ctx.font=gaugeFont(g,bounds.h/300);ctx.textAlign='center';ctx.textBaseline='middle';const text=gaugeText(g,value),y=g.format==='dial'?r.y+r.h*.78:r.y+r.h/2;drawGaugeText(ctx,g,text,r.x+r.w/2,y,r.w,bounds.h/300);
 }
 const overlay=art(g.overlayArtRef);if(overlay)ctx.drawImage(overlay,r.x,r.y,r.w,r.h);
 if(g.id===selectedId){ctx.strokeStyle='#58d6ff';ctx.lineWidth=1;ctx.strokeRect(r.x,r.y,r.w,r.h);}ctx.restore();
 }ctx.restore();return regions;
}
