// Two purpose-shaped recesses for compact mid-engine bodies: a narrow
// diagonal brake extractor and a triangular aft engine inlet. The common
// UV mask lets the actual door surface and trim remain registered.
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

export function pairedDoorDuctMask(body,u,v){
 const width=body.sideDuctWidth/.48, shift=body.sideDuctHeight-.18;
 const front=(u-(.94-.27*width))/(.27*width);
 const diagonal=.56-(.30+body.sideDuctSweep)*clamp(front)+shift;
 const radius=.016+.023*clamp(front);
 const brake=smooth(0,.07,front)*(1-smooth(.93,1,front))*
  (1-smooth(radius*.57,radius,Math.abs(v-diagonal)));
 const rear=(u-.064)/(.24*width), bottom=.88+shift;
 const top=bottom-.186*Math.pow(1-clamp(rear),.78);
 const engine=smooth(0,.064,rear)*(1-smooth(.925,1,rear))*
  smooth(top,top+.018,v)*(1-smooth(bottom-.016,bottom,v));
 return Math.max(brake,engine);
}
