// Dimensions are exact; carcass stiffness and assembly mass are game estimates,
// scaled from the car's authored factory hardware rather than a free grip bonus.
export const tireSizeOf=car=>({widthMm:245,aspectRatio:40,wheelDiameterIn:18,...car.setup?.tireSize});
export const tireRadius=size=>size.wheelDiameterIn*.0254/2+size.widthMm*size.aspectRatio/100000;
export function applyGarageWheelPhysics(car,stock){
 const size=tireSizeOf(car),base=tireSizeOf(stock),offset=Number(car.tuning.wheelOutsetMm)||0;
 const resized=JSON.stringify(size)!==JSON.stringify(base);
 if(!resized&&!offset)return;
 const radius=tireRadius(size),baseRadius=tireRadius(base),sidewall=size.widthMm*size.aspectRatio/100000,baseSidewall=base.widthMm*base.aspectRatio/100000;
 const widthRatio=size.widthMm/base.widthMm,rimRatio=size.wheelDiameterIn/base.wheelDiameterIn;
 const massRatio=.5*widthRatio*(radius/baseRadius)+.5*rimRatio*rimRatio;
 const wheelMassDelta=20*(massRatio-1)+offset*.025;
 const profile=car.tuning.physicalVehicleProfile||car.physicalVehicleProfile||(car.tuning.physicalVehicleProfile={});
 if(resized){
 profile.tireVerticalStiffnessNpm=(profile.tireVerticalStiffnessNpm||210000)*widthRatio*baseSidewall/sidewall;
 profile.tireVerticalDampingNsM=(profile.tireVerticalDampingNsM||1800)*Math.sqrt(widthRatio*baseSidewall/sidewall);
 profile.maximumTireVerticalDeflectionM=Math.min(sidewall*.65,(profile.maximumTireVerticalDeflectionM||.06)*sidewall/baseSidewall);
 }
 if(profile.unsprungMassByWheelKg)for(const wheel of ['fl','fr','rl','rr'])profile.unsprungMassByWheelKg[wheel]=Math.max(10,(profile.unsprungMassByWheelKg[wheel]||40)+wheelMassDelta);
 const baseWeight=car.tuning.weightKg||1450;
 for(const tune of [car.tuning,...Object.values(car.transmissions||{})]){
  if(resized)tune.wheelRadiusM=radius;
  tune.wheelInertiaKgM2=(tune.wheelInertiaKgM2||1.35)*massRatio*(radius/baseRadius)**2+offset*.025*.08**2;
  tune.unsprungMassKg=Math.max(10,(tune.unsprungMassKg||40)+wheelMassDelta);
  tune.weightKg=(tune.weightKg||baseWeight)+4*wheelMassDelta;
  if(offset){
  for(const axle of ['Front','Rear'])tune['track'+axle+'M']=(stock.tuning?.['track'+axle+'M']||stock.dimensions?.['track'+axle+'M']||stock.dimensions?.trackWidthM||1.56)+2*offset/1000;
  tune.trackWidthM=(tune.trackFrontM+tune.trackRearM)/2;
  }
 }
 if(offset)car.dimensions={...car.dimensions,trackFrontM:car.tuning.trackFrontM,trackRearM:car.tuning.trackRearM,trackWidthM:car.tuning.trackWidthM};
}
