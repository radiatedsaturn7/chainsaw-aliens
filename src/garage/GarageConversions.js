// Game-calibrated crate engines, not claims about a specific manufacturer's unit.
export const GARAGE_ENGINES = {
 turbo: {label:'Turbo', displacement:2, aspiration:'Turbocharged', inertia:.24, idle:850, redline:7000, limit:7400, mass:150,
  points:[[850,100],[2000,230],[3500,290],[5500,280],[7000,225],[7400,190]]},
 six: {label:'Six', displacement:3, aspiration:'Naturally Aspirated', inertia:.32, idle:800, redline:7400, limit:7800, mass:190,
  points:[[800,110],[2000,170],[4000,245],[6000,255],[7400,225],[7800,200]]},
 v8: {label:'V8', displacement:5, aspiration:'Naturally Aspirated', inertia:.42, idle:750, redline:6500, limit:7000, mass:230,
  points:[[750,190],[2000,300],[4000,380],[5500,370],[6500,335],[7000,290]]},
};
export function applyGarageConversions(car,parts){
 const engine=parts.find(i=>i.carPart.engineSwap)?.carPart.engineSwap;
 const drive=parts.find(i=>i.carPart.drivetrainSwap)?.carPart.drivetrainSwap;
 const targets=[car.tuning,...Object.values(car.transmissions||{})];
 if(engine){
  const spec=GARAGE_ENGINES[engine];if(!spec)throw Error('Unknown engine conversion');
  const curve={rpmMin:spec.idle,rpmMax:spec.limit,torquePoints:spec.points.map(([rpm,torqueLbFt])=>({rpm,torqueLbFt}))};
  const previousMass=Number(car.tuning.engineMassKg)||180;
  const values={engineDisplacementL:spec.displacement,aspiration:spec.aspiration,engineInertiaKgM2:spec.inertia,engineMassKg:spec.mass,
   idleRpm:spec.idle,redlineRpm:spec.redline,revLimitRpm:spec.limit,tachometerMaxRpm:Math.ceil(spec.limit/1000)*1000,
   autoUpshiftRpm:spec.redline*.94,autoDownshiftRpm:spec.idle+900,launchRpm:spec.limit*.42,
   torquePeakStartRpm:2000,torquePeakEndRpm:spec.redline*.85,torqueFalloffRpm:spec.limit,
   torqueLbFt:Math.max(...spec.points.map(p=>p[1])),powerHp:Math.max(...spec.points.map(([rpm,t])=>rpm*t/5252)),garageEngineCurve:true};
  const baseWeight=Number(car.tuning.weightKg)||1495;
  for(const target of targets){Object.assign(target,values);target.engineCurve=structuredClone(curve);target.weightKg=Math.max(450,(Number(target.weightKg)||baseWeight)+spec.mass-previousMass);}
  car.tuning.engineConversion=engine;
  car.mechanics={...car.mechanics,boostBar:spec.aspiration==='Turbocharged'?1.1:0};
 }
 if(drive){
  if(!['fwd','rwd','awd'].includes(drive))throw Error('Unknown drivetrain conversion');
  const mass={fwd:0,rwd:20,awd:80};
  const original=String(car.tuning.drivetrain||'awd').toLowerCase();
  const delta=mass[drive]-(mass[original]??80);
  const baseWeight=Number(car.tuning.weightKg)||1495;
  for(const target of targets){target.drivetrain=drive;target.drivetrainEfficiency={fwd:.90,rwd:.88,awd:.84}[drive];target.weightKg=Math.max(450,(Number(target.weightKg)||baseWeight)+delta);}
  car.tuning.drivetrainConversion=drive;
 }
}
