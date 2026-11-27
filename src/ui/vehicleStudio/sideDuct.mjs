import {pairedDoorDuctMask} from './pairedDoorDucts.mjs';
// The side-duct chart spans a door from its rear edge (u=0) to its
// forward edge (u=1), and the shoulder (v=0) down to its lower hem.
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
function crescent(body,u,v){
 const w=body.sideDuctWidth,t=(u-(.96-w))/w;
 const lift=body.sideDuctHeight+.17;
 // The rear tail is slim and low. Both rails rise toward the front of
 // the door; the top rail rises sooner, retaining the painted upper sail.
 const split=smooth(.48,.93,t),turn=smooth(.77,1,t);
 const top=Math.max(.025,lift+.185+.182*smooth(0,.48,t)-(.517+body.sideDuctSweep*.4)*split);
 const bottom=Math.min(.96,lift+.32+.21*smooth(.02,.82,t)-.54*turn);
 const edge=.035;
 return smooth(0,.075,t)*(1-smooth(.94,1,t))
  *smooth(top,top+edge,v)*(1-smooth(bottom-edge,bottom,v));
}
export function sideDuctMask(body,u,v){
 if(body.sideDuctCrescent)return crescent(body,u,v);
 if(body.pairedSideDucts)return pairedDoorDuctMask(body,u,v);
 const {sideDuctWidth:w,sideDuctSweep:s,sideDuctHeight:h}=body;
 const t=(u-(.95-w))/w;
 const top=h+s*(1-t),bottom=top+.61*Math.pow(clamp(t),.71);
 const dark=smooth(0,.055,t)*(1-smooth(.94,1,t))*smooth(top,top+.029,v)*(1-smooth(bottom-.034,bottom,v));
 // A tapered insert on the forward upper lip, as on a duct with a vane
 // descending from the belt. The same mask governs recess and surface color.
 const vane=smooth(.46,.54,t)*(1-smooth(.74,.88,t))*smooth(top+.065,top+.085,v)*
  (1-smooth(top+.19-.07*t,top+.21-.07*t,v));
 return dark*(1-vane);
}

// Hood chart: longitudinal station from the glass to the nose, then lateral
// station from left to right. Two swept pockets leave a painted center bridge.
export function cowlDuctMask(body,u,v){
 const x=Math.abs(2*v-1);
 const width=body.cowlDuctWidth, length=body.cowlDuctLength;
 const a=(x-.235)/(width*1.12), aligned=(u-.045-.089*a)/length;
 return smooth(0,.11,a)*(1-smooth(.92,1,a))*smooth(0,.13,aligned)*
  (1-smooth(.90,1,aligned))*smooth(.19,.31,a+aligned*.63);
}
