// Closed-loop pressure modulation: persistent lock must keep releasing pressure,
// not settle at a fixed fraction of full demand while the wheel stays locked.
export function advanceAbsPressure(previous=1,{enabled=true,slip=0,target=.13,dt=0}={}){
 if(!enabled)return 1;
 const seconds=Math.max(0,Math.min(.1,Number(dt)||0));
 target=Math.max(.01,Number(target)||.13);slip=Math.max(0,Number(slip)||0);
 const pressure=Math.max(.01,Math.min(1,Number.isFinite(previous)?previous:1));
 if(slip>target)return Math.max(.01,pressure*Math.exp(-seconds*30*Math.min(4,slip/target-1)));
 if(slip<target*.9)return Math.min(1,pressure+seconds*6*(1-slip/(target*.9)));
 return pressure;
}
