export const CAR_FX_VIEWS=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
export const CAR_FX_DAMAGE=['engine','suspension','transmission','body','tire'];
export const CAR_FX_TRIGGERS=['always','precipitation','braking','reverse','cold','night','accelerating',...CAR_FX_DAMAGE.map(k=>k+'-damage')];
const num=(v,d,min,max)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):d;
export function normalizeCarFxView(v={}){
 return {placements:Array.isArray(v.placements)?v.placements.filter(p=>p&&typeof p==='object').map(p=>({x:num(p.x,0,-4,4),y:num(p.y,0,-4,4)})):[{x:num(v.x,0,-4,4),y:num(v.y,0,-4,4)}],artRef:String(v.artRef||'').trim(),frameIndex:Math.round(num(v.frameIndex,0,0,10000)),
  x:num(v.x,0,-4,4),y:num(v.y,0,-4,4),width:num(v.width,.15,.005,4),height:num(v.height,.15,.005,4),
  rotation:num(v.rotation,0,-180,180),opacity:num(v.opacity,1,0,1),mirror:v.mirror===true};
}
// New angles inherit the chosen artwork and sizing, but never another view's positions.
export function newCarFxPlacementView(effect){
 const source=Object.values(effect.views||{}).find(v=>v.artRef)||Object.values(effect.views||{})[0]||{};
 return normalizeCarFxView({...source,artRef:effect.artRef||source.artRef||'',x:0,y:0,placements:[]});
}
export function normalizeCarFx(effects=[]){
 return (Array.isArray(effects)?effects:[]).filter(e=>e&&typeof e==='object').map((e,i)=>({
  id:String(e.id||`fx-${i}`),artRef:String(e.artRef||Object.values(e.views||{}).find(v=>v?.artRef)?.artRef||''),name:String(e.name||'Effect').slice(0,100),enabled:e.enabled!==false,
  triggers:[...new Set((Array.isArray(e.triggers)?e.triggers:['always']).filter(t=>CAR_FX_TRIGGERS.includes(t)))],
  coldBelowC:num(e.coldBelowC,5,-80,60),
  damageLevels:Object.fromEntries(CAR_FX_DAMAGE.map(k=>{const min=num(e.damageLevels?.[k]?.min,25,0,100);return [k,{min,max:Math.max(min,num(e.damageLevels?.[k]?.max,100,0,100))}];})),
  views:Object.fromEntries(CAR_FX_VIEWS.filter(v=>e.views?.[v]).map(v=>[v,normalizeCarFxView(e.views[v])]))
 }));
}
export function migrateCarFx(art={}){
 if(Array.isArray(art.fx))return normalizeCarFx(art.fx);
 const views={};
 for(const slot of CAR_FX_VIEWS){
  const angle=art.angleLayers?.[slot]?.brakes,ref=angle&&Object.hasOwn(angle,'artRef')?angle.artRef:art.brakeLightArtRef;
  if(!ref||(!angle&&!['rear','rearRight','rearLeft'].includes(slot)))continue;
  const t={...art,...angle?.transforms};
  views[slot]=normalizeCarFxView({artRef:ref,frameIndex:angle?.frameIndex??art.brakeLightFrameIndex,
   x:(t.brakeLightOffsetX||0)*.18,y:.44+(t.brakeLightOffsetY||0)*.22,
   width:.44*(t.brakeLightScaleX||1),height:.16*(t.brakeLightScaleY||1)});
 }
 return Object.keys(views).length?normalizeCarFx([{id:'legacy-brake-lights',name:'Brake lights',triggers:['braking'],views}]):[];
}
export function carFxActive(effect,state={}){
 if(!effect.enabled)return false;
 return effect.triggers.some(t=>damageTriggerActive(effect,t,state.damage)||t==='always'||t==='braking'&&state.braking||t==='accelerating'&&state.accelerating
  ||t==='reverse'&&state.reverse||t==='night'&&state.night||t==='precipitation'&&state.precipitation
  ||t==='cold'&&Number.isFinite(state.temperatureC)&&state.temperatureC<=effect.coldBelowC);
}
// Player input is authoritative for pedals/gear; AI uses its own session.
export function carFxDrivingState(session={},input=null,{braking=false}={}){
 const drive=session?.engineDrive||session?.tireSlip?.engineDrive||{};
 return {
  braking:input?Boolean(input.brake||Number(input.brakeAxis)>0||input.handbrake||session?.authoritativeHandbrakeActive):Boolean(braking||Number(drive.brake)>0),
  accelerating:Number(input?.throttleAxis??drive.throttle??0)>.05,
  reverse:Number(input?.gear??session?.gear??drive.gear??0)<0
 };
}
export function damageTriggerActive(effect,trigger,damage={}){
 const kind=trigger.replace('-damage','');if(!CAR_FX_DAMAGE.includes(kind)||!trigger.endsWith('-damage'))return false;
 const raw=damage?.[{body:'panels',tire:'tires'}[kind]||kind];
 const value=typeof raw==='object'?Math.max(0,...Object.values(raw||{}).map(v=>Number(v)||0)):Number(raw)||0;
 const range=effect.damageLevels?.[kind]||{min:25,max:100};
 return value>=range.min&&value<=range.max;
}
export function getCarFxArtRefs(car){return [...new Set((car?.art?.fx||[]).flatMap(e=>[e.artRef,...Object.values(e.views||{}).map(v=>v.artRef)].filter(Boolean)))];}
export function drawCarFx(ctx,{effects=[],slot,state={},previewId=null,x=0,y=0,width=1,height=1,rotation=0,getArt}){
 for(const effect of effects){
  if(effect.id!==previewId&&!carFxActive(effect,state))continue;
  const authored=effect.views?.[slot];
  // An unconfigured angle can be tested without adding saved placements.
  const v=authored||(effect.id===previewId?{...newCarFxPlacementView(effect),placements:[{x:0,y:0}]}:null);
  const ref=v?.artRef||effect.artRef;if(!v||!ref)continue;
  const art=getArt(ref,{frameIndex:v.frameIndex});if(!art)continue;
  for(const p of v.placements||[{x:v.x,y:v.y}])for(const side of v.mirror&&Math.abs(p.x)>.0001?[1,-1]:[1]){
   ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.translate(p.x*width*side,p.y*height);
   ctx.rotate(v.rotation*Math.PI/180*side);if(side<0)ctx.scale(-1,1);
   ctx.globalAlpha*=v.opacity;ctx.imageSmoothingEnabled=false;
   ctx.drawImage(art,-v.width*width/2,-v.height*height/2,v.width*width,v.height*height);ctx.restore();
  }
 }
}
