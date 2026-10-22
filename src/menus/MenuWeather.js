import {createWeatherRuntimeState,updateWeatherSystem,drawWeatherParticles,WEATHER_PROFILES} from '../shared/weatherEffects.js';

const runtimes=new WeakMap();
export function menuWeatherState(document,screen,bounds,time=0){
 const weatherType=`weather-${screen.effect}`;
 if(!['snow','rain'].includes(screen.effect)){runtimes.delete(document);return null;}
 const scale=Math.max(.75,Math.min(bounds.w/720,bounds.h/900));
 const intensity=screen.effectIntensity??1,windBias=(screen.effectWind||0)*48;
 const signature=[screen.id,weatherType,bounds.x,bounds.y,bounds.w,bounds.h,intensity,windBias].join(':');
 let runtime=runtimes.get(document);
 const step=dt=>updateWeatherSystem({state:runtime.state,weatherType,bounds,dt,intensity,windBias,scale,maxParticles:360});
 if(!runtime||runtime.signature!==signature||time<runtime.lastTime){
  runtime={signature,state:createWeatherRuntimeState(),lastTime:time,remainder:0};runtimes.set(document,runtime);
  // Populate the screen immediately, with a bounded warm-up rather than
  // replaying the entire menu lifetime after tab changes or resizing.
  const seconds=Math.min(24,bounds.h/(WEATHER_PROFILES[weatherType].vy*scale));
  for(let elapsed=0;elapsed<seconds;elapsed+=.25)step(.25);
 }else{
  runtime.remainder+=Math.min(.25,Math.max(0,time-runtime.lastTime));runtime.lastTime=time;
  while(runtime.remainder>=1/30){step(1/30);runtime.remainder-=1/30;}
 }
 return runtime.state;
}
export function drawMenuWeather(ctx,bounds,document,screen,time){
 const state=menuWeatherState(document,screen,bounds,time);if(!state)return;
 ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();
 drawWeatherParticles(ctx,state.particles,{weatherType:`weather-${screen.effect}`,bounds});ctx.restore();
}
