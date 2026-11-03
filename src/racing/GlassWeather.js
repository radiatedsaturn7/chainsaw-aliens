import {advanceWipers,wiperAngle} from './CarWipers.js';
export const GLASS_DROP_LIMIT=96;
const GLASS_LAYERS=['windshield','lens'];
const STEP=1/60,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function syncWeatherWipers(session,weather){
 const wet=['rain','storm','snow'].includes(weather?.id)&&Number(weather.precipitationIntensity??weather.visualIntensity??weather.targetIntensity??0)>.02;
 // Edge-triggered: manual off remains respected until the next dry-to-wet transition.
 if(wet&&!session.wiperWeatherWet){session.wipers ||= {enabled:false,phase:0,moving:false};session.wipers.enabled=true;session.wipers.moving=true;}
 session.wiperWeatherWet=wet;
 return wet;
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export function createGlassWeather(){return {seed:0x18f2be01,accumulator:0,windshield:[],lens:[],spawn:0,aspect:16/9};}
export function sweptByWiper(drop,config,aspect,angles){
 if(!config?.artRef)return false;
 return sweptByWiperRange(drop,config,aspect,Math.min(...angles)-.035,Math.max(...angles)+.035);
}
function sweptByWiperRange(drop,config,aspect,min,max){
 if(!config?.artRef)return false;
 for(const mount of config.mounts||[]){
  const dx=drop.x-mount.x,dy=(drop.y-mount.y)/aspect;
  const radius=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
  if(radius<=config.width&&radius>.012&&angle>=min&&angle<=max)return true;
 }
 return false;
}
function tick(session,s,options){
 const {weather={},wipers={},speedMps=0,temperatureC=5,sheltered=false}=options;
 const wet=['rain','storm','snow'].includes(weather.id)&&!sheltered;
 const intensity=wet?clamp(Number(weather.precipitationIntensity??weather.visualIntensity??weather.targetIntensity??0),0,1):0;
 const old=wiperAngle(session,wipers),moving=session.wipers?.moving;
 advanceWipers(session,STEP,wipers);
 const angle=wiperAngle(session,wipers),speed=Math.abs(Number(speedMps)||0);
 // The sweep is identical for every drop in this fixed simulation tick.
 const sweepMin=Math.min(old,angle)-.035,sweepMax=Math.max(old,angle)+.035;
 s.spawn+=STEP*intensity*(weather.id==='storm'?26:18);
 while(s.spawn>=1){
  s.spawn--;
  for(const layer of GLASS_LAYERS){
   if(s[layer].length>=GLASS_DROP_LIMIT)continue;
   s[layer].push({x:.025+random(s)*.95,y:.025+random(s)*(layer==='windshield'?.69:.9),radius:.0035+random(s)*.007,age:0,life:16+random(s)*14,snow:weather.id==='snow'?1:0,drift:random(s)-.5});
  }
 }
 for(const layer of GLASS_LAYERS){
  const drops=s[layer];let keep=0;
  for(const d of drops){
   d.age+=STEP;
   // A warm cabin/glass melts the visual snow film even with freezing ambient air.
   d.snow=Math.max(0,d.snow-STEP*clamp(.25+Number(temperatureC||0)*.008,.12,.55));
   const water=1-d.snow;
   const climb=Math.max(0,speed-7)*.0015;
   d.y+=STEP*(.008-climb)*water*(.5+d.radius*70);
   d.x+=STEP*d.drift*speed*.00015*water;
   d.life-=STEP*(layer==='lens'&&session.wipers?.enabled?18:1);
   if(layer==='windshield'&&moving&&sweptByWiperRange(d,wipers,s.aspect,sweepMin,sweepMax))continue;
   if(d.life<=0||d.y<-.03||d.y>1.03||d.x<-.03||d.x>1.03)continue;
   drops[keep++]=d;
  }
  drops.length=keep;
 }
}
export function updateGlassWeather(session,seconds,options={}){
 if(!session)return;
 syncWeatherWipers(session,options.weather);
 const s=session.glassWeather ||= createGlassWeather();
 s.accumulator+=Number.isFinite(seconds)?clamp(seconds,0,.25):0;
 while(s.accumulator+1e-10>=STEP){tick(session,s,options);s.accumulator=Math.max(0,s.accumulator-STEP);}
 return s;
}
let sprites;
function makeSprites(){
 const create=()=>typeof OffscreenCanvas==='function'?new OffscreenCanvas(64,80):globalThis.document?.createElement?.('canvas');
 const water=create(),snow=create();if(!water||!snow)return null;
 for(const canvas of [water,snow]){canvas.width=64;canvas.height=80;}
 const c=water.getContext('2d'),n=snow.getContext('2d');if(!c||!n)return null;
 // Clear glass lens, dark lower rim and bright upper reflection: no blue fill.
 c.beginPath();c.ellipse(32,40,22,21,-.18,0,Math.PI*2);
 const body=c.createRadialGradient(26,32,3,32,40,23);
 body.addColorStop(0,'rgba(255,255,255,.015)');body.addColorStop(.76,'rgba(20,23,24,.025)');body.addColorStop(1,'rgba(10,12,14,.22)');
 c.fillStyle=body;c.fill();
 c.beginPath();c.ellipse(31,39,20,19,-.18,3.7,5.15);c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=1.4;c.stroke();
 c.beginPath();c.ellipse(34,43,19,17,-.18,.25,1.6);c.strokeStyle='rgba(0,0,0,.16)';c.lineWidth=1;c.stroke();
 for(let i=0;i<9;i++){
  const x=32+Math.sin(i*2.4)*14,y=40+Math.cos(i*2.4)*15,r=9+i%4;
  const g=n.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,255,255,.95)');g.addColorStop(.6,'rgba(238,244,246,.7)');g.addColorStop(1,'rgba(235,245,250,0)');n.fillStyle=g;n.fillRect(x-r,y-r,r*2,r*2);
 }
 return {water,snow};
}
export function drawGlassWeather(ctx,bounds,session,cameraView){
 const s=session?.glassWeather;if(!s)return;
 s.aspect=bounds.w/Math.max(1,bounds.h);
 const drops=cameraView==='first-person'?s.windshield:s.lens;if(!drops.length)return;
 sprites ||= makeSprites();if(!sprites)return;
 ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h*(cameraView==='first-person'?.755:1));ctx.clip();
 for(const d of drops){
  const x=bounds.x+d.x*bounds.w,y=bounds.y+d.y*bounds.h,r=Math.max(1.5,d.radius*bounds.w),fade=Math.min(1,d.age*5,d.life/2);
  const water=1-d.snow;
  if(water>.05){
   // Beads stretch slightly with airflow, without a pointed head or drawn tail.
   const stretch=1+Math.min(.18,Math.abs(session.speedMps||0)*.004);
   const width=r*(1.7+Math.abs(d.drift)*.6),height=r*2*stretch;
   ctx.globalAlpha=fade*water;ctx.drawImage(sprites.water,x-width/2,y-height/2,width,height);

  }
  if(d.snow>.01){ctx.globalAlpha=fade*d.snow;ctx.drawImage(sprites.snow,x-r*1.4,y-r*1.75,r*2.8,r*3.5);}
 }
 ctx.restore();
}
