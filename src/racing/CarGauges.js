import {drawFuelFace} from './FuelGauge.js';
import {normalizeFuelConfig} from './simulation/FuelModel.js';
import {normalizeIndicatorCrop,fitIndicatorCrop} from './IndicatorArt.js';
import {CONTROL_LAMPS,controlLamp,MECHANICAL_LAMPS,COMPONENT_GAUGE_SOURCES,mechanicalLamp,mechanicalLampVisible} from './MechanicalInstruments.js';
import {normalizeTachometer,carRpmLimits,tachometerScale,drawTachometerFace} from './TachometerFace.js';
import {MenuAppearanceResources} from '../menus/MenuAppearance.js';
const fonts=new MenuAppearanceResources();
const damageArtworkCache=new WeakMap();
// Cache by source image and condition color, never allocate per render frame.
export function tintDamageArtwork(image,color){
 if(!image||typeof image!=='object')return image;
 let cache=damageArtworkCache.get(image);if(!cache){cache=new Map();damageArtworkCache.set(image,cache);}
 const key=`${image.width}:${image.height}:${color}`;if(cache.has(key))return cache.get(key);
 const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(image.width,image.height):globalThis.document?.createElement?.('canvas');
 const ctx=canvas?.getContext?.('2d');if(!ctx)return image;
 canvas.width=image.width;canvas.height=image.height;
 ctx.drawImage(image,0,0);ctx.globalCompositeOperation='multiply';ctx.fillStyle=color;ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(image,0,0);ctx.globalCompositeOperation='source-over';
 if(cache.size>=8)cache.delete(cache.keys().next().value);cache.set(key,canvas);return canvas;
}
export const gaugeDamageColor=(value,healthy)=>value>=75?'#ff4f4f':value>=50?'#ff8a2f':value>=25?'#f2d45c':healthy;
export async function prepareGaugeFont(g){
 fonts.font(g);const entry=fonts.fonts.get(g.fontData);await entry?.pending;
 if(entry&&!entry.ready)throw Error('Could not load the gauge font. Please upload it again.');
}
const n=(v,d,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):d;
export const GAUGE_SOURCES=[...Object.keys(CONTROL_LAMPS),...Object.keys(MECHANICAL_LAMPS),...COMPONENT_GAUGE_SOURCES,'tractionBattery.percent','tractionBattery.kwh','tractionBattery.powerKw','fuel','fuel.gallons','fuel.capacity','fuel.mpg','speed','rpm','rpm.max','rpm.limit','rpm.redline','gear','lapTime','raceTime','lap','completion','raceProgress','map','temperature','damage.engine','damage.transmission',...['front','rear','left','right'].map(k=>'damage.panels.'+k),...['tires','suspension'].flatMap(k=>['fl','fr','rl','rr'].map(w=>'damage.'+k+'.'+w)),...['coolantTemperatureC','oilTemperatureC','oilPressureBar','voltage','boostBar','fuel','charge','coolant','oil','fuelPressureBar','batteryCurrentA','fuelLitersRemaining',...['fl','fr','rl','rr'].flatMap(w=>['tires.'+w+'.pressurePsi','tires.'+w+'.pressureRatio','tires.'+w+'.tread','tires.'+w+'.temperatureC','tires.'+w+'.brakeTemperatureC'])].map(k=>'mechanical.'+k),'decoration'];
export const GAUGE_FORMATS=['number','dial','bar','icon','map'];
export const GAUGE_ART_FIELDS=['highBeamArtRef','fuelIconArtRef','artRef','needleArtRef','overlayArtRef','markerArtRef','carMarkerArtRef','startMarkerArtRef','finishMarkerArtRef','circuitMarkerArtRef','safeArcArtRef','dangerArcArtRef'];
export function normalizeGaugeMap(g={}){
 const result={mapScreenX:n(g.mapScreenX,0,0,.99),mapScreenY:n(g.mapScreenY,0,0,.99),mapScreenWidth:n(g.mapScreenWidth,1,.01,1),mapScreenHeight:n(g.mapScreenHeight,1,.01,1),mapOpacity:n(g.mapOpacity,1,0,1),
  mapOrientation:g.mapOrientation==='heading'?'heading':'north',mapProjection:g.mapProjection==='perspective'?'perspective':'flat',mapPitch:n(g.mapPitch,45,20,80),mapPlayerY:n(g.mapPlayerY,.75,.2,.9),
  mapMode:g.mapMode==='local'?'local':'whole',mapRangeM:n(g.mapRangeM,300,20,10000),
  mapLineColor:String(g.mapLineColor||'#d9e6d2'),mapLineWidth:n(g.mapLineWidth,2,.5,20),
  mapLineBorderColor:String(g.mapLineBorderColor||'#101916'),mapLineBorderWidth:n(g.mapLineBorderWidth,1,0,12),
  mapBorderColor:String(g.mapBorderColor||'#101916'),mapBorderWidth:n(g.mapBorderWidth,0,0,12)};
 for(const [kind,color,size] of [['player','#58d6ff',10],['car','#f2d45c',6],['start','#61e79a',6],['finish','#ff4f4f',6],['circuit','#ffd34d',10]]){
  result[kind+'MarkerShape']=['circle','triangle','square','flag','line'].includes(g[kind+'MarkerShape'])?g[kind+'MarkerShape']:kind==='circuit'?'line':kind==='player'||kind==='car'?'circle':'square';
  result[kind+'MarkerColor']=String(g[kind+'MarkerColor']||color);result[kind+'MarkerSize']=n(g[kind+'MarkerSize'],size,1,40);
 }
 for(const key of ['carMarkerArtRef','startMarkerArtRef','finishMarkerArtRef','circuitMarkerArtRef'])result[key]=String(g[key]||'');
 result.mapScreenWidth=Math.min(result.mapScreenWidth,1-result.mapScreenX);result.mapScreenHeight=Math.min(result.mapScreenHeight,1-result.mapScreenY);
 return result;
}
export function normalizeGauge(g={},i=0){const gauge = {
 opacity:n(g.opacity,1,0,1),damageArtTint:g.damageArtTint===true,artCrop:normalizeIndicatorCrop(g.artCrop),...normalizeGaugeMap(g),tachometer:normalizeTachometer(g.source==='fuel'?{majorInterval:25,minorInterval:5,redline:15,autoScale:false,autoRedline:false,...g.tachometer}:g.tachometer,g),fuelIconArtRef:String(g.fuelIconArtRef||''),fuelShowIcon:g.fuelShowIcon!==false,fuelIconOffsetX:n(g.fuelIconOffsetX,0,-2,2),fuelIconOffsetY:n(g.fuelIconOffsetY,0,-2,2),fuelIconScale:n(g.fuelIconScale,1,.1,4),fuelIconAngle:g.fuelIconAngle==null||g.fuelIconAngle===''?null:n(g.fuelIconAngle,180,-360,360),safeArcArtRef:String(g.safeArcArtRef||''),dangerArcArtRef:String(g.dangerArcArtRef||''),
 id:String(g.id||'gauge-'+i),source:GAUGE_SOURCES.includes(g.source)?g.source:'speed',format:GAUGE_FORMATS.includes(g.format)?g.format:'number',
 textAlign:['left','center','right'].includes(g.textAlign)?g.textAlign:'center',
 name:String(g.name||g.source||'Speed'),enabled:g.enabled!==false,x:n(g.x,.75,-4,4),y:n(g.y,.8,-4,4),width:n(g.width,.2,.005,4),height:n(g.height,.12,.005,4),
 min:n(g.min,0,-1000,100000),max:Math.max(n(g.min,0,-1000,100000)+.001,n(g.max,g.source==='rpm'?8000:g.source==='fuel'?100:200,-999,100001)),units:String(g.units??((!g.source||g.source==='speed')?'MPH':'')),
 color:String(g.color||'#ffffff'),background:String(g.background||'#16251f'),fontFamily:String(g.fontFamily||'monospace'),fontData:String(g.fontData||''),fontFileName:String(g.fontFileName||''),fontSize:n(g.fontSize,18,4,120),fontWeight:Math.round(n(g.fontWeight,400,100,900)/100)*100,fontItalic:g.fontItalic===true,fontUnderline:g.fontUnderline===true,textColor:String(g.textColor||g.color||'#ffffff'),outline:n(g.outline,2,0,12),
 highBeamArtRef:String(g.highBeamArtRef||''),markerArtRef:String(g.markerArtRef||''),artRef:String(g.artRef||''),needleArtRef:String(g.needleArtRef||''),overlayArtRef:String(g.overlayArtRef||''),frameIndex:Math.round(n(g.frameIndex,0,0,10000)),
 startAngle:n(g.startAngle,135,-360,360),sweepAngle:n(g.sweepAngle,270,-360,360),needlePivotX:n(g.needlePivotX,.5,0,1),needlePivotY:n(g.needlePivotY,.85,0,1),
 lapTextTemplate:String(g.lapTextTemplate??(g.source==='raceProgress'?g.textTemplate:'')??'').slice(0,500),progressTextTemplate:String(g.progressTextTemplate??(g.source==='raceProgress'?g.textTemplate:'')??'').slice(0,500),
 textTemplate:String(g.textTemplate??'').slice(0,500),showValue:g.showValue!==false,vertical:g.vertical===true
};return gauge;}
export function defaultGauges(){
 const base=[{source:'map',format:'map',x:.02,y:.02,width:.21,height:.28},{source:'raceTime',x:.75,y:.02,width:.23,height:.07},{source:'lap',x:.8,y:.1,width:.18,height:.06},{source:'rpm',format:'dial',x:.76,y:.69,width:.22,height:.28,max:8000},{source:'speed',x:.78,y:.87,width:.2,height:.08},{source:'gear',x:.69,y:.86,width:.08,height:.1}];
 GAUGE_SOURCES.filter(s=>s.startsWith('damage.')).forEach((source,i)=>base.push({source,format:'icon',x:.02+(i%4)*.035,y:.72+Math.floor(i/4)*.06,width:.028,height:.045,name:source.replace('damage.','')}));
 return base.map((g,i)=>normalizeGauge(g,i));
}
export function normalizeCarGauges(value={}){return Object.fromEntries(['exterior','interior'].map(k=>[k,{...(k==='interior'&&value?.[k]?.coordinateSpace==='dashboard'?{coordinateSpace:'dashboard'}:{}),enabled:value?.[k]?.enabled===true,widgets:Array.isArray(value?.[k]?.widgets)?value[k].widgets.filter(g=>g&&typeof g==='object').map(normalizeGauge):defaultGauges()}]));}
export function gaugeArtRefs(car){return [...new Set([...Object.values(car?.art?.gauges||{}).flatMap(l=>(l.widgets||[]).flatMap(g=>GAUGE_ART_FIELDS.map(key=>g[key]))),...(car?.art?.indicators||[]).map(v=>v.artRef)].filter(Boolean))];}
function isCircuit(state={}){return (state.session?.routeRuntimeType||state.race?.type)==='circuit';}
export function gaugeCompletion({session={},race={}}={}){
 if(session.raceResults||session.networkProgress?.finished)return 100;
 const length=Number(session.routeLength);
 if(!Number.isFinite(length)||length<=0)return 0;
 const distance=Math.max(0,Math.min(length,Number(session.distance)||0));
 const laps=isCircuit({session,race})?Math.max(1,Number(race.laps)||1):1;
 const completed=isCircuit({session,race})?Math.max(0,(Number(session.lap)||1)-1):0;
 return Math.max(0,Math.min(100,(completed+distance/length)/laps*100));
}
export function gaugeValue(g,{session={},car={},race={},gear=session.gear,temperatureC=22}={}){
 if(Object.hasOwn(CONTROL_LAMPS,g.source))return controlLamp(g.source,session);
 if(Object.hasOwn(MECHANICAL_LAMPS,g.source))return mechanicalLamp(g.source,session.mechanical);
 const fuelConfig=normalizeFuelConfig(session.mechanical?.config||car.mechanics||{});
 switch(g.source){case 'tractionBattery.percent':return (session.tractionBattery?.stateOfCharge ?? 1)*100;case 'tractionBattery.kwh':return (session.tractionBattery?.batteryEnergyJ ?? 0)/3.6e6;case 'tractionBattery.powerKw':return (session.tractionBattery?.batteryPowerW ?? 0)/1000;case 'fuel':return (session.mechanical?.fuel??1)*100;case 'fuel.gallons':return (session.mechanical?.fuel??1)*fuelConfig.fuelTankGallons;case 'fuel.capacity':return fuelConfig.fuelTankGallons;case 'fuel.mpg':return fuelConfig.fuelMpg;case 'speed':return Math.abs(session.speedMps||0)*(g.units.toLowerCase()==='km/h'?3.6:2.23694);case 'rpm':return session.engineRpm??((session.rpm||0)*(car.tuning?.revLimitRpm||car.tuning?.redlineRpm||8000));case 'rpm.limit':return carRpmLimits(car).limit;case 'rpm.max':return carRpmLimits(car).max;case 'rpm.redline':return carRpmLimits(car).redline;case 'gear':return gear??0;case 'raceTime':return session.elapsedMs||0;case 'lapTime':return Math.max(0,(session.elapsedMs||0)-(session.lapStartMs||0));case 'lap':return session.lap||1;case 'completion':return gaugeCompletion({session,race});case 'raceProgress':return isCircuit({session,race})?(session.lap||1):gaugeCompletion({session,race});case 'temperature':return temperatureC;default:return g.source.split('.').reduce((v,k)=>v?.[k],session)??0;}
}
function defaultGaugeText(g,value,state){if(g.source==='fuel')return `${Math.round(value)}%`;if(g.source.startsWith('fuel.'))return Number(value).toFixed(1);if(Object.hasOwn(CONTROL_LAMPS,g.source))return value?'On':'Off';if(Object.hasOwn(MECHANICAL_LAMPS,g.source))return ['Off','Warning','Critical'][value]||'Off';if(g.source==='speed')return String(Math.round(value));if(g.source==='completion')return `${Math.round(value)}%`;if(g.source==='raceProgress')return isCircuit(state)?`Lap ${Math.min(Math.max(1,Math.floor(value)),Math.max(1,Number(state?.race?.laps)||1))}/${Math.max(1,Number(state?.race?.laps)||1)}`:`${Math.round(value)}%`;if(g.source.endsWith('Time')){const t=Math.floor(Math.max(0,value)/100)/10;return `${Math.floor(t/60)}:${(t%60).toFixed(1).padStart(4,'0')}`;}if(g.source.startsWith('mechanical.'))return `${Number(value).toFixed(g.source.includes('Temperature')||g.source.endsWith('pressurePsi')?0:1)}${g.units?' '+g.units:''}`;if(g.source==='gear')return value<0?'R':value===0?'N':String(value);return `${Math.round(value)}${g.units?' '+g.units:''}`;}
// Named placeholders are data lookups, never evaluated JavaScript.
export function gaugeText(g,value,state){
 const formatted=defaultGaugeText(g,value,state),template=String((g.source==='raceProgress'?(g[isCircuit(state)?'lapTextTemplate':'progressTextTemplate']??g.textTemplate):g.textTemplate)||'');
 if(!template)return formatted;
 const aliases={'lap.time':'lapTime','race.time':'raceTime','lap.number':'lap','race.completion':'completion','race.progress':'raceProgress'};
 return template.replace(/\$\{([^{}]+)\}/g,(literal,key)=>{
  key=key.trim();if(key==='value')return formatted;
  if(key==='lap.total')return state?String(Math.max(1,Number(state.race?.laps)||1)):literal;
  const source=aliases[key]||key;
  if(!GAUGE_SOURCES.includes(source)||['map','decoration'].includes(source))return literal;
  if(source===g.source)return formatted;
  if(!state)return literal;
  const instrument={...g,source,units:source==='speed'?(g.source==='speed'?g.units:'MPH'):''};
  return defaultGaugeText(instrument,gaugeValue(instrument,state),state);
 });
}
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
 for(const g of layout.widgets){if(!g.enabled)continue;const r={x:bounds.x+g.x*bounds.w,y:bounds.y+g.y*bounds.h,w:g.width*bounds.w,h:g.height*bounds.h};
 // Warning/status lamps keep square artwork at every viewport aspect ratio.
 if(g.format==='icon'&&(Object.hasOwn(MECHANICAL_LAMPS,g.source)||Object.hasOwn(CONTROL_LAMPS,g.source))){const side=Math.min(r.w,r.h);r.x+=(r.w-side)/2;r.y+=(r.h-side)/2;r.w=r.h=side;}
 regions.push({...r,id:g.id});
 const range=g.source==='fuel'?{min:0,max:100}:g.source==='rpm'&&g.format==='dial'?tachometerScale(g,state?.car):g,value=gaugeValue(g,state),ratio=Math.max(0,Math.min(1,(value-range.min)/Math.max(.001,range.max-range.min))),damage=g.source.startsWith('damage.');
 const lamp=Object.hasOwn(MECHANICAL_LAMPS,g.source)||Object.hasOwn(CONTROL_LAMPS,g.source),lampVisible=!lamp||state?.testIndicators===true||mechanicalLampVisible(value,state?.session?.mechanical);
 const color=damage?gaugeDamageColor(value,g.color):g.color;
 const art=ref=>ref?getArt?.(ref,{frameIndex:g.frameIndex}):null,sourceArtwork=art(g.source==='headlightslight'&&state?.session?.mechanical?.highBeams&&g.highBeamArtRef?g.highBeamArtRef:g.artRef),background=damage&&g.damageArtTint?tintDamageArtwork(sourceArtwork,color):sourceArtwork;ctx.save();ctx.globalAlpha*=n(g.opacity,1,0,1);ctx.fillStyle=color;ctx.strokeStyle=color;
 if(!lampVisible)ctx.globalAlpha*=g.id===selectedId ? .25 : 0;
 if(background){const crop=fitIndicatorCrop(g.artCrop,background.width,background.height);if(crop)ctx.drawImage(background,crop.x,crop.y,crop.width,crop.height,r.x,r.y,r.w,r.h);else ctx.drawImage(background,r.x,r.y,r.w,r.h);}
 if(!(lamp&&state?.testIndicators===true) && state?.session?.mechanical && state.session.mechanical.config?.enabled && g.source!=='decoration')ctx.globalAlpha*=state.session.mechanical.effects?.instruments??1;
 if(g.format==='map')drawMap?.(r,{...g,formattedText:g.textTemplate?gaugeText(g,value,state):undefined,font:gaugeFont(g,bounds.h/300),fontScale:bounds.h/300});
 else if(g.format==='bar'){if(!background){ctx.fillStyle=g.background;ctx.fillRect(r.x,r.y,r.w,r.h);}ctx.fillStyle=color;if(g.vertical)ctx.fillRect(r.x,r.y+r.h*(1-ratio),r.w,r.h*ratio);else ctx.fillRect(r.x,r.y,r.w*ratio,r.h);}
 else if(g.format==='dial'){
 const cx=r.x+r.w/2,cy=r.y+r.h/2,radius=Math.min(r.w,r.h)*(['rpm','fuel'].includes(g.source)?(g.tachometer?.radius??.9)/2:.45),start=g.startAngle*Math.PI/180,sweep=g.sweepAngle*Math.PI/180;
 if(g.source==='fuel')drawFuelFace(ctx,r,g,state?.car,{getArt:art,font:gaugeFont,text:drawGaugeText,scale:bounds.h/300,value});
 else if(g.source==='rpm')drawTachometerFace(ctx,r,g,state?.car,{getArt:art,font:gaugeFont,text:drawGaugeText,scale:bounds.h/300,value});
 else if(!background){ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,radius,Math.min(start,start+sweep),Math.max(start,start+sweep));ctx.stroke();for(let i=0;i<=10;i++){const a=start+sweep*i/10;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*radius*.85,cy+Math.sin(a)*radius*.85);ctx.lineTo(cx+Math.cos(a)*radius,cy+Math.sin(a)*radius);ctx.stroke();}}
 if(!['rpm','fuel'].includes(g.source)||g.tachometer?.displayMode!=='fill'){
 const a=start+sweep*ratio,needle=art(g.needleArtRef);ctx.save();ctx.translate(cx,cy);ctx.rotate(a+Math.PI/2);if(needle)ctx.drawImage(needle,-g.needlePivotX*r.w,-g.needlePivotY*r.h,r.w,r.h);else{ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-radius*.8);ctx.stroke();}ctx.restore();}
 }else if(g.format==='icon'&&!background&&!(g.source==='decoration'&&g.textTemplate)){ctx.fillStyle=color;ctx.fillRect(r.x,r.y,r.w,r.h);}
 if(damage&&background&&!g.damageArtTint){ctx.fillStyle=color;ctx.fillRect(r.x,r.y+r.h-3,r.w*ratio,3);}
 if(g.source==='decoration' ? !!g.textTemplate&&['number','dial','bar','icon'].includes(g.format) : g.showValue&&['number','dial','bar'].includes(g.format)){
 ctx.font=gaugeFont(g,bounds.h/300);ctx.textAlign=g.textAlign||'center';ctx.textBaseline='middle';const text=gaugeText(g,value,state),y=g.format==='dial'?r.y+r.h*.78:r.y+r.h/2;drawGaugeText(ctx,g,text,r.x+(ctx.textAlign==='right'?r.w:ctx.textAlign==='left'?0:r.w/2),y,r.w,bounds.h/300);
 }
 const overlay=art(g.overlayArtRef);if(overlay)ctx.drawImage(overlay,r.x,r.y,r.w,r.h);
 if(g.id===selectedId){ctx.globalAlpha=1;ctx.strokeStyle='#58d6ff';ctx.lineWidth=1;ctx.strokeRect(r.x,r.y,r.w,r.h);}ctx.restore();
 }ctx.restore();return regions;
}
