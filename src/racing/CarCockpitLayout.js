// Shared cockpit coordinate math: legacy cars remain viewport anchored.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
export function cockpitDashboardRect(bounds,dashboard={},image=null){
 const sx=clamp(finite(dashboard.scaleX,1)||1,.05,12),sy=clamp(finite(dashboard.scaleY,1)||1,.05,12);
 const w=bounds.w*sx,h=(image?bounds.w*image.height/Math.max(1,image.width):bounds.h*.22)*sy;
 return {x:bounds.x+(bounds.w-w)/2+clamp(finite(dashboard.offsetX,0),-4,4)*bounds.w*.2,y:bounds.y+bounds.h-h+clamp(finite(dashboard.offsetY,0),-4,4)*bounds.h*.2,w,h};
}
export function cockpitWheelLayout(bounds,wheel={},dashboardRect){
 const sx=clamp(finite(wheel.scaleX,1)||1,.05,12),sy=clamp(finite(wheel.scaleY,1)||1,.05,12);
 const anchored=wheel.coordinateSpace==='dashboard';
 const basis=anchored?dashboardRect:bounds;
 const diameter=anchored?basis.w*clamp(finite(wheel.width,.24),.01,2):Math.max(34,Math.min(bounds.w,bounds.h)*.13)*2;
 return {x:basis.x+basis.w*(anchored?finite(wheel.anchorX,.35):.5)+clamp(finite(wheel.offsetX,0),-4,4)*basis.w*.2,
 y:basis.y+basis.h*(anchored?finite(wheel.anchorY,1.1):.82)+clamp(finite(wheel.offsetY,0),-4,4)*basis.h*.2,width:diameter*sx,heightScale:diameter*sy};
}
export function cockpitGaugeBounds(bounds,car,image,side='interior'){
 return side==='interior'&&car?.art?.gauges?.interior?.coordinateSpace==='dashboard'?cockpitDashboardRect(bounds,car.art.interior?.dashboard,image):bounds;
}
