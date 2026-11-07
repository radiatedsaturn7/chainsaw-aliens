const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Quasi-static suspension-mount compliance. Torsional rigidity (Nm/degree)
// becomes an effective vertical mount spring across the track; mount and suspension act in series.
// This is not a deformable mesh or a separate torsional vibration integrator.
export function chassisComplianceScale(rigidityNmDeg,springNpm,trackM){
 if(!(rigidityNmDeg>0))return 1; // Legacy direct simulator callers remain rigid.
 const mountNpm=clamp(rigidityNmDeg,1000,100000)*180/Math.PI/(Math.max(.5,trackM)**2);
 return mountNpm/(mountNpm+Math.max(0,springNpm));
}
export function resolveChassisMass(tuning,physical){
 const baseMass=Math.max(450,Number(tuning.weightKg)||1495);
 const ballast=clamp(Number(tuning.ballastKg)||0,0,200);
 const position=clamp(Number(tuning.ballastPosition)||0,-1,1); // rear to front
 let profile=physical?structuredClone(physical):undefined;
 if(profile?.inertiaTensorBodyKgM2&&profile.massKg>0){
  for(const key of Object.keys(profile.inertiaTensorBodyKgM2))profile.inertiaTensorBodyKgM2[key]*=baseMass/profile.massKg;
  profile.massKg=baseMass;
 }
 if(!ballast)return {tuning,physical:profile};
 const mass=baseMass+ballast,wheelbase=Number(tuning.wheelbaseM)||2.65;
 const front=Number(profile?.frontWeightDistribution??tuning.frontWeightDistribution)||.54;
 const height=Number(profile?.cgLocationBodyM?.y??tuning.cgHeightM)||.54;
 const ballastFront=.5+position*.4; // within the axles
 const dz=(ballastFront-front)*wheelbase,dy=.25-height;
 const fraction=ballast/mass,reducedMass=baseMass*ballast/mass;
 const tensor=profile?.inertiaTensorBodyKgM2||{xx:baseMass*1.4,yy:baseMass*1.65,zz:baseMass*.65,xy:0,xz:0,yz:0};
 profile={...profile,massKg:mass,frontWeightDistribution:(front*baseMass+ballastFront*ballast)/mass,
  cgLocationBodyM:{x:profile?.cgLocationBodyM?.x||0,y:height+fraction*dy,z:(profile?.cgLocationBodyM?.z||0)+fraction*dz},
  inertiaTensorBodyKgM2:{...tensor,xx:tensor.xx+reducedMass*(dy*dy+dz*dz),yy:tensor.yy+reducedMass*dz*dz,zz:tensor.zz+reducedMass*dy*dy,yz:(tensor.yz||0)-reducedMass*dy*dz}};
 return {tuning:{...tuning,weightKg:mass,frontWeightDistribution:profile.frontWeightDistribution,cgHeightM:profile.cgLocationBodyM.y},physical:profile};
}
