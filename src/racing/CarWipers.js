const finite=(v,d,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):d;
export function normalizeCarWipers(value={}){
 const v=value&&typeof value==='object'?value:{};
 return {artRef:String(v.artRef||''),frameIndex:Math.round(finite(v.frameIndex,0,0,10000)),
  pivotX:finite(v.pivotX,0,0,1),pivotY:finite(v.pivotY,.5,0,1),
  width:finite(v.width,.33,.05,1),parkAngle:finite(v.parkAngle,-5,-180,180),sweepAngle:finite(v.sweepAngle,-80,-180,180),
  cycleSeconds:finite(v.cycleSeconds,1.6,.4,10),
  mounts:(Array.isArray(v.mounts)?v.mounts:[{x:.16,y:.77},{x:.56,y:.77}]).map(p=>({x:finite(p?.x,.16,-1,2),y:finite(p?.y,.77,-1,2)}))};
}
export function toggleWipers(session){
 if(!session)return;
 session.wipers ||= {enabled:false,phase:0,moving:false};
 session.wipers.enabled=!session.wipers.enabled;
 if(session.wipers.enabled)session.wipers.moving=true;
}
export function advanceWipers(session,seconds,config={}){
 const s=session?.wipers;if(!s?.moving)return;
 const dt=Number.isFinite(seconds)?Math.max(0,seconds):0;
 const phase=s.phase+dt/finite(config.cycleSeconds,1.6,.4,10);
 if(!s.enabled&&phase>=1){s.phase=0;s.moving=false;return;}
 s.phase=phase%1;
}
export function wiperAngle(session,config){
 const phase=session?.wipers?.phase||0;
 // Cosine motion slows naturally at the top and parked ends of the sweep.
 return (config.parkAngle+config.sweepAngle*(1-Math.cos(phase*Math.PI*2))/2)*Math.PI/180;
}
export function drawInteriorWipers(ctx,bounds,session,config,getArt,cameraView){
 if(cameraView!=='first-person'||!config?.artRef)return;
 const image=getArt(config.artRef,{frameIndex:config.frameIndex});if(!image)return;
 const width=bounds.w*config.width,height=width*image.height/Math.max(1,image.width);
 ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();ctx.imageSmoothingEnabled=false;
 for(const mount of config.mounts){
  ctx.save();ctx.translate(bounds.x+mount.x*bounds.w,bounds.y+mount.y*bounds.h);ctx.rotate(wiperAngle(session,config));
  ctx.drawImage(image,-width*config.pivotX,-height*config.pivotY,width,height);ctx.restore();
 }
 ctx.restore();
}
