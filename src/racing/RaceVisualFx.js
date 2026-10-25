const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const num=(v,d,a,b)=>Number.isFinite(Number(v))?clamp(Number(v),a,b):d;
const color=(v,d)=>/^#[0-9a-f]{6}$/i.test(v||'')?v:d;
export const RACE_FX_PRESETS={
 morning:{brightness:.65,sunX:.25,sunY:.42,sunColor:'#ffdcaa',sunIntensity:.65,skyBrightness:.8,tintColor:'#ffd1a0',tintAmount:.06},
 noon:{brightness:1,sunX:.5,sunY:.08,sunColor:'#fff5dc',sunIntensity:.8,skyBrightness:1,tintColor:'#ffffff',tintAmount:0},
 evening:{brightness:.42,sunX:.75,sunY:.48,sunColor:'#ffb16c',sunIntensity:.65,skyBrightness:.65,tintColor:'#ffae78',tintAmount:.08},
 night:{brightness:.05,sunX:.5,sunY:.15,sunColor:'#afc9ff',sunIntensity:0,skyBrightness:.12,tintColor:'#839ccc',tintAmount:.04}
};
export function normalizeRaceVisualFx(value={}){
 return {enabled:value.enabled===true,preset:Object.hasOwn(RACE_FX_PRESETS,value.preset)?value.preset:'noon',
 sunEnabled:value.sunEnabled!==false,sunDisc:value.sunDisc!==false,sunX:num(value.sunX,.5,0,1),sunY:num(value.sunY,.2,0,1),sunColor:color(value.sunColor,'#fff0cf'),sunSize:num(value.sunSize,.012,.002,.06),sunIntensity:num(value.sunIntensity,.7,0,1),lensFlare:num(value.lensFlare,.12,0,1),sunGlare:num(value.sunGlare,.45,0,1),
 skyBrightness:num(value.skyBrightness,1,0,1),tintColor:color(value.tintColor,'#ffffff'),tintAmount:num(value.tintAmount,0,0,.3),
 motionBlur:num(value.motionBlur,0,0,1),speedLines:num(value.speedLines,0,0,1),speedLineOpacity:num(value.speedLineOpacity,1,0,1),speedLineArtRef:String(value.speedLineArtRef||'').trim(),speedLineArtMode:value.speedLineArtMode==='streak'?'streak':'overlay',vignette:num(value.vignette,0,0,.6),speedStartMph:num(value.speedStartMph,45,0,200),speedFullMph:num(value.speedFullMph,130,10,300)};
}
export function raceFxPreset(name){const p=RACE_FX_PRESETS[name]||RACE_FX_PRESETS.noon;return {brightness:p.brightness,timeOfDay:name==='night'?'night':'day',visualFx:normalizeRaceVisualFx({...p,preset:name,enabled:true,sunEnabled:name!=='night',motionBlur:.16,speedLines:.08,vignette:.1,lensFlare:name==='night'?0:.12})};}
// This geometry is also used by the sky artwork itself: UV placement never drifts
// independently from the image when yaw, offsets, scale or camera pitch change.
export function skyboxImageGeometry(bounds,settings={},aspect=2,{horizon=0,yaw=0,hillPitch=0,driftOffset=0}={}){
 const baseH=Math.max(1,bounds.h*.72),height=baseH*(settings.scaleY||1),width=Math.max(bounds.w*1.35,baseH*aspect*2)*(settings.scaleX||1);
 return {width,height,y:horizon-height*.56+clamp(hillPitch||0,-.4,.4)*bounds.h*.08+(settings.offsetYRatio||0)*bounds.h,
 x:bounds.x+(yaw/(Math.PI*2)+(settings.offsetXTurns||0))*width-width*.5+driftOffset*.18};
}
export function skySunPositions(bounds,geometry,fx){
 const x=geometry.x+fx.sunX*geometry.width,y=geometry.y+fx.sunY*geometry.height;
 const center=bounds.x+bounds.w/2,nearest=x+Math.round((center-x)/geometry.width)*geometry.width;
 return [-1,0,1].map(i=>({x:nearest+i*geometry.width,y})).filter(p=>p.x>=bounds.x-geometry.width*.06&&p.x<=bounds.x+bounds.w+geometry.width*.06);
}
export function drawRaceSkySun(ctx,bounds,geometry,fx,weather='clear'){
 if(!fx.enabled||!fx.sunEnabled||fx.sunIntensity<=0)return;
 const intensity=fx.sunIntensity*(weather==='clear'?1:weather==='rain'?.2:.35),radius=Math.max(1,geometry.height*fx.sunSize);
 ctx.save();ctx.globalCompositeOperation='screen';
 for(const p of skySunPositions(bounds,geometry,fx)){
  if(p.y+radius*8<bounds.y||p.y-radius*8>bounds.y+bounds.h)continue;
  const glow=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,radius*8);glow.addColorStop(0,fx.sunColor);glow.addColorStop(1,fx.sunColor+'00');ctx.fillStyle=glow;ctx.globalAlpha=intensity*.4;ctx.fillRect(p.x-radius*8,p.y-radius*8,radius*16,radius*16);
  if(fx.sunDisc){ctx.globalAlpha=intensity;ctx.fillStyle=fx.sunColor;ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.fill();}

 }
 ctx.restore();
}
// Capture in backing-canvas coordinates so first-person roll/pitch and viewport
// transforms remain aligned when glare is composited after the 3D scene.
export function captureSkySun(ctx,bounds,geometry,fx,horizon){
 const m=ctx.getTransform?.()||{a:1,b:0,c:0,d:1,e:0,f:0};
 return skySunPositions(bounds,geometry,fx).filter(p=>p.y<horizon).map(p=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f}));
}
export function localSunPoints(ctx,points=[]){
 const m=ctx.getTransform?.()||{a:1,b:0,c:0,d:1,e:0,f:0},det=m.a*m.d-m.b*m.c;if(!det)return [];
 return points.map(p=>({x:(m.d*(p.x-m.e)-m.c*(p.y-m.f))/det,y:(-m.b*(p.x-m.e)+m.a*(p.y-m.f))/det}));
}
export function sunFacingAmount(bounds,p,fx,weather='clear'){
 if(!fx.enabled||!fx.sunEnabled||fx.sunIntensity<=0||!p)return 0;
 const u=(p.x-bounds.x)/bounds.w,v=(p.y-bounds.y)/bounds.h;
 if(u<=0||u>=1||v<=0||v>=1)return 0;
 const edge=Math.min(1,u*8,(1-u)*8,v*8,(1-v)*8),dx=(u-.5)*2,dy=(v-.42)*2;
 return fx.sunIntensity*edge*edge/(1+dx*dx*5+dy*dy*3)*(weather==='clear'?1:weather==='rain'?.25:.15);
}
export function drawRaceSunGlare(ctx,bounds,fx,points=[],weather='clear'){
 if(!fx.enabled||!fx.sunEnabled||(!fx.sunGlare&&!fx.lensFlare))return;
 const ranked=points.map(p=>({p,amount:sunFacingAmount(bounds,p,fx,weather)})).sort((a,b)=>b.amount-a.amount),source=ranked[0];
 if(!source||source.amount<=0)return;
 const {p,amount}=source,cx=bounds.x+bounds.w/2,cy=bounds.y+bounds.h*.45,diagonal=Math.hypot(bounds.w,bounds.h);
 ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();ctx.globalCompositeOperation='screen';
 if(fx.sunGlare>0){
  ctx.globalAlpha=amount*fx.sunGlare*.55;ctx.fillStyle='#fff2d8';ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);
  const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,diagonal*.65);g.addColorStop(0,'#fffef5');g.addColorStop(.18,fx.sunColor+'bb');g.addColorStop(1,fx.sunColor+'00');ctx.fillStyle=g;ctx.globalAlpha=amount*fx.sunGlare*.8;ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);
 }
 if(fx.lensFlare>0){
  const strength=amount*Math.sqrt(fx.lensFlare);
  for(let i=0;i<6;i++){
   const x=p.x+(cx-p.x)*(i*.36+.25),y=p.y+(cy-p.y)*(i*.36+.25),r=Math.max(2,diagonal*(.012+(i%3)*.012));
   const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,(i%2?'#b7d7ff':fx.sunColor)+'20');g.addColorStop(.72,i%2?'#b7d7ff':fx.sunColor);g.addColorStop(1,'#ffffff00');ctx.fillStyle=g;ctx.globalAlpha=strength*.55;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  ctx.globalAlpha=strength*.65;ctx.strokeStyle='#fff5df';ctx.lineWidth=Math.max(1,bounds.h/400);ctx.beginPath();ctx.moveTo(p.x-diagonal*.14,p.y);ctx.lineTo(p.x+diagonal*.14,p.y);ctx.stroke();
 }
 ctx.restore();
}
export function skySunFacingYaw(bounds,settings,aspect,fx){
 const g=skyboxImageGeometry(bounds,settings,aspect,{horizon:bounds.h*.58});
 return ((bounds.x+bounds.w/2-g.x-fx.sunX*g.width)/g.width)*Math.PI*2;
}
export function raceSpeedFxAmount(fx,speedMps,paused=false){
 if(!fx.enabled||paused)return 0;
 const t=clamp((Math.abs(speedMps||0)*2.236936-fx.speedStartMph)/Math.max(1,fx.speedFullMph-fx.speedStartMph),0,1);
 return t*t*(3-2*t);
}
function canvasPair(state,w,h){
 if(!state.source){const make=()=>typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):globalThis.document?.createElement('canvas');state.source=make();state.layer=make();}
 if(!state.source||!state.layer)return false;
 for(const c of [state.source,state.layer])if(c.width!==w||c.height!==h){c.width=w;c.height=h;}
 return true;
}
export function drawRaceSpeedFx(ctx,bounds,fx,{speedMps=0,paused=false,time=0,state={},getArt=()=>null}={}){
 if(!fx.enabled)return;
 const amount=raceSpeedFxAmount(fx,speedMps,paused),{x,y,w,h}=bounds;
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 if(amount>0&&fx.motionBlur>0&&ctx.canvas){
  // Fixed three samples, <=640px buffers, no readback or history/ghost accumulation.
  const resolution=Math.min(1,640/Math.max(w,h)),sw=Math.max(1,Math.round(w*resolution)),sh=Math.max(1,Math.round(h*resolution));
  if(canvasPair(state,sw,sh)){
   const src=state.source.getContext('2d'),layer=state.layer.getContext('2d');src.setTransform(1,0,0,1,0,0);src.clearRect(0,0,sw,sh);src.save();src.scale(sw/w,sh/h);src.translate(-x,-y);
   const transform=ctx.getTransform?.();if(transform){const inv=transform.inverse();src.transform(inv.a,inv.b,inv.c,inv.d,inv.e,inv.f);}src.drawImage(ctx.canvas,0,0);src.restore();
   layer.clearRect(0,0,sw,sh);layer.globalCompositeOperation='source-over';layer.globalAlpha=1/3;
   for(let i=1;i<=3;i++){const scale=1+(i/3)*amount*(.04+.16*fx.motionBlur);layer.drawImage(state.source,sw*(1-scale)/2,sh*(1-scale)/2,sw*scale,sh*scale);}
   const mask=layer.createRadialGradient(sw/2,sh*.45,sw*.12,sw/2,sh*.45,sw*.55);mask.addColorStop(0,'#00000000');mask.addColorStop(1,'#000000');layer.globalAlpha=1;layer.globalCompositeOperation='destination-in';layer.fillStyle=mask;layer.fillRect(0,0,sw,sh);layer.globalCompositeOperation='source-over';
   ctx.globalAlpha=Math.sqrt(fx.motionBlur*amount)*.85;ctx.drawImage(state.layer,x,y,w,h);ctx.globalAlpha=1;
  }
 }
 if(fx.tintAmount>0){ctx.globalCompositeOperation='soft-light';ctx.globalAlpha=fx.tintAmount;ctx.fillStyle=fx.tintColor;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';}
 if(amount>0&&fx.speedLines>0&&fx.speedLineOpacity>0){
  const art=fx.speedLineArtRef?getArt(fx.speedLineArtRef):null;
  ctx.globalAlpha=amount*fx.speedLines*fx.speedLineOpacity;
  if(art&&fx.speedLineArtMode==='overlay')ctx.drawImage(art,x,y,w,h);
  else {
   ctx.strokeStyle='#dce7f2';ctx.lineWidth=Math.max(1,w/900);if(!art)ctx.globalAlpha*=.35;
   for(let i=0;i<16;i++){
    const angle=i*Math.PI/8+.11,phase=((time*.7+i*.618)%1+1)%1,r=.36+phase*.2,length=.025+.08*amount;
    const ax=x+w/2+Math.cos(angle)*w*r,ay=y+h*.45+Math.sin(angle)*h*r,bx=x+w/2+Math.cos(angle)*w*(r+length),by=y+h*.45+Math.sin(angle)*h*(r+length);
    if(art){const width=Math.hypot(bx-ax,by-ay),height=Math.max(1,Math.min(h*.1,width*(art.height||1)/Math.max(1,art.width||1)));ctx.save();ctx.translate(ax,ay);ctx.rotate(Math.atan2(by-ay,bx-ax));ctx.drawImage(art,0,-height/2,width,height);ctx.restore();}
    else{ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();}
   }
  }
  ctx.globalAlpha=1;
 }
 const edgeOpacity=fx.vignette*amount;
 if(edgeOpacity>0){const g=ctx.createRadialGradient(x+w/2,y+h/2,Math.min(w,h)*.3,x+w/2,y+h/2,Math.hypot(w,h)*.55);g.addColorStop(0,'#00000000');g.addColorStop(1,`rgba(0,0,0,${edgeOpacity})`);ctx.fillStyle=g;ctx.fillRect(x,y,w,h);}

 ctx.restore();
}

// Demo scenery only: a fixed-size roadside row makes blur visible without
// modifying the race or loading a 3D world into the small settings preview.
export function advanceFxPreviewDistance(state,nowMs,speedMps){
 const dt=state.demoLastMs==null?0:clamp((nowMs-state.demoLastMs)/1000,0,.1);state.demoLastMs=nowMs;
 state.demoDistance=(state.demoDistance||0)+Math.abs(speedMps)*dt;return state.demoDistance;
}
export function racePreviewTrees(bounds,distance=0){
 const result=[];
 for(let i=0;i<12;i++)for(const side of [-1,1]){
  const depth=((i/12+distance/120+(side===1?.04:0))%1+1)%1,t=depth*depth;
  result.push({depth,x:bounds.x+bounds.w/2+side*bounds.w*(.11+.64*t),y:bounds.y+bounds.h*(.58+.42*t),w:bounds.w*(.022+.2*t),h:bounds.h*(.08+.7*t)});
 }
 return result.sort((a,b)=>a.depth-b.depth);
}
export function drawFxPreviewTrees(ctx,bounds,distance){
 for(const tree of racePreviewTrees(bounds,distance)){
  const {x,y,w,h}=tree;ctx.fillStyle='#61513d';ctx.fillRect(x-w*.07,y-h*.55,w*.14,h*.55);
  for(let tier=0;tier<3;tier++){const top=y-h+tier*h*.2,half=w*(.28+tier*.1);ctx.fillStyle=['#487451','#376044','#274c36'][tier];ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x+half,top+h*.48);ctx.lineTo(x-half,top+h*.48);ctx.closePath();ctx.fill();}
 }
}
