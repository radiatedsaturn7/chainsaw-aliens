export const LITERS_PER_US_GALLON=3.785411784;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const n=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
export function normalizeFuelConfig(value={}){
 const fuelTankGallons=clamp(n(value.fuelTankGallons,n(value.fuelLiters,55)/LITERS_PER_US_GALLON),1,100);
 return {fuelTankGallons,fuelLiters:fuelTankGallons*LITERS_PER_US_GALLON,fuelMpg:clamp(n(value.fuelMpg,25),1,200),fuelIdleGallonsPerHour:clamp(n(value.fuelIdleGallonsPerHour,.25),0,5),fuelConsumptionScale:clamp(n(value.fuelConsumptionScale,1),0,20),fuelPowerLoadScale:clamp(n(value.fuelPowerLoadScale,1),.1,10),fuelDoorSide:value.fuelDoorSide==='left'?'left':'right'};
}
// MPG is a reference cruise economy, not a promise of economy at race pace.
export function fuelBurnGallons(config,dt,{engineRunning=true,speedMps=0,rpm=900,maxRpm=7000,throttle=0}={}){
 if(!engineRunning||!Number.isFinite(dt)||dt<=0)return 0;
 const speed=Math.abs(n(speedMps,0)),load=clamp(n(throttle,0),0,1),rpmRatio=clamp(n(rpm,900)/Math.max(1,n(maxRpm,7000)),0,1.5);
 // Closed throttle above idle uses overrun fuel cut.
 if(load<.02&&speed>2&&rpm>1500)return 0;
 const loadFactor=1+2*Math.max(0,load-.35)**2+.2*Math.max(0,rpmRatio-.65);
 const cruise=speed*dt/1609.344/config.fuelMpg*loadFactor;
 const idle=config.fuelIdleGallonsPerHour*dt/3600*(1+load*rpmRatio);
 const powerLoad=1+(clamp(n(config.fuelPowerLoadScale,1),.1,10)-1)*clamp((load-.35)/.65,0,1);
 return Math.max(cruise*powerLoad,idle)*config.fuelConsumptionScale;
}
export function startingFuelFraction(start,capacityGallons,fallback=1){
 if(!start||!['percent','gallons'].includes(start.mode))return fallback;
 const value=n(start.value,NaN);if(!Number.isFinite(value))return fallback;
 return clamp(start.mode==='gallons'?value/Math.max(.001,capacityGallons):value/100,0,1);
}
