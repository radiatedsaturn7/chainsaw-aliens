// Starting points calibrated for this game's normalized controls, not copied
// Forza tune values. Preserve the car's engine, drivetrain and gear count.
const profile=(id,label,tire,kit,spring,height,travel,bump,rebound,arb,camber,diff,finalScale,pressure,aero)=>({
 id,label,tire,kit,finalScale,pressure,
 values:{springFront:spring[0],springRear:spring[1],rideHeightFront:height,rideHeightRear:Math.min(1,height+.02),
 suspensionTravelFront:travel,suspensionTravelRear:Math.min(1,travel+.04),bumpFront:bump,bumpRear:bump+.02,
 reboundFront:rebound,reboundRear:rebound+.02,antiRollFront:arb[0],antiRollRear:arb[1],
 camberFront:camber[0],camberRear:camber[1],toeFront:id==='drift'?-.15:0,toeRear:id==='drift'?.15:.06,
 casterFront:id==='drift'?7.6:6.2,aeroFront:aero,aeroRear:Math.min(1,aero+.08),
 differentialAccel:diff[1],differentialDecel:diff[2],frontDifferentialAccel:diff[0],frontDifferentialDecel:diff[2]*.7,
 rearDifferentialAccel:diff[1],rearDifferentialDecel:diff[2],centerDifferentialBalance:id==='drift'?.75:.55,
 centerDifferentialLock:id==='offroad'?.75:id==='snow'?.35:.45,
 brakeBalance:id==='drift'?.58:.62,brakePressure:['wet','snow','offroad'].includes(id)?1:1.12}
});
export const GARAGE_SETUP_PROFILES=[
 profile('street','Street','street','street',[.5,.5],.5,.5,.48,.58,[.45,.45],[-.8,-.6],[.2,.3,.12],1,[32,31],.15),
 profile('race','Road Race','tarmac','race',[.74,.78],.3,.32,.64,.76,[.72,.78],[-2.4,-1.8],[.35,.55,.2],.95,[30,30],.66),
 profile('rally','Rally','dirt','rally',[.48,.5],.62,.72,.44,.56,[.42,.46],[-1.5,-1.2],[.3,.45,.2],1.1,[28,27],.28),
 profile('drift','Drift','drift','drift',[.62,.54],.44,.52,.5,.66,[.76,.38],[-3.4,-1.0],[.85,.95,.75],1.02,[30,38],.12),
 profile('offroad','Off-road','offroad','offroad',[.38,.42],.82,.9,.34,.46,[.26,.3],[-.6,-.4],[.5,.65,.3],1.2,[24,23],.08),
 profile('drag','Drag','tarmac','drag',[.4,.6],.45,.55,.36,.52,[.22,.3],[-.2,-.1],[.8,.95,.1],1.15,[30,26],0),
 profile('wet','Wet Road','rain','rally',[.58,.6],.48,.58,.48,.6,[.42,.46],[-1.6,-1.2],[.2,.32,.12],.95,[30,29],.5),
 profile('snow','Snow','snow','offroad',[.38,.4],.72,.82,.34,.46,[.25,.28],[-.5,-.3],[.3,.42,.15],1.05,[26,25],.12)
];
export function getGarageSetupProfile(id){const p=GARAGE_SETUP_PROFILES.find(p=>p.id===id);if(!p)throw Error('Choose a driving setup');return p;}
export function garageSetupTargets(profile,stock){
 const t={...stock.tuning,...stock.transmissions?.[stock.defaultTransmissionType]},values={...profile.values};
 values.gearFinalDrive=(Number(t.gearFinalDrive??t.finalDrive)||4.1)*profile.finalScale;
 const gears=t.gearRatios||[];
 gears.forEach((ratio,i)=>{if(Number.isFinite(ratio))values['gearRatios.'+i]=ratio*(profile.id==='race'?1-.08*(1-i/Math.max(1,gears.length-1)):profile.id==='drag'?1-.12*(1-i/Math.max(1,gears.length-1)):1);});
 for(const wheel of ['fl','fr','rl','rr'])values['pressure.'+wheel]=profile.pressure[wheel[0]==='f'?0:1];
 return values;
}
export function garageSetupPartIds(profile){
 const ids=['suspension','transmission','differential','alignment','aero','brakes'].map(slot=>profile.kit+'-'+slot);
 // Wet/snow packages share loose-surface hardware, with dedicated tires and tune.
 ids.push(({tarmac:'race-tires',dirt:'rally-tires'})[profile.tire]||profile.tire+'-tires');
 return ids;
}
