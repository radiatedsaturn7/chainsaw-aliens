import {verifyProjectCarPreviewStock,showroomArtVersion,isProjectStorageReadOnly} from '../serverStorage.js';
const MAX_RESIDENT=12,MAX_PENDING=24,MAX_LOADING=2;
const ANGLES=[0,45,90,135,180,225,270,315];
const digest=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const urlOk=x=>typeof x==='string'&&/^assets\/car-previews\/[a-z0-9._-]+\.(webp|png)$/i.test(x);
const safeName=x=>typeof x==='string'&&x.length>0&&x.length<=128&&x!=='.'&&x!=='..'&&!/[\/\\\u0000-\u001f]/.test(x);
const catalogUrl=()=>new URL('assets/car-previews/manifest.json',document.baseURI);
let manifestTask;
const images=new Map();
const verified=new Map();
let verificationActive=0;
const locallyChanged=new Set();

export function invalidateProjectCarThumbnail(name){
  if(typeof name==='string'&&name)locallyChanged.add(name);
}
let active=0;

export function parseCarPreviewCatalog(raw,base){
  if(raw?.schemaVersion!==1||raw.rendererVersion!=='menu-native-v1'||!Array.isArray(raw.anglesDeg)||
    raw.anglesDeg.length!==8||!ANGLES.every((x,i)=>raw.anglesDeg[i]===x))return null;
  const previews=new Map(),names=new Map();
  for(const [id,p] of Object.entries(raw.previews||{})){
    if(!/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(id)||!p||
      !Number.isInteger(p.frameWidth)||p.frameWidth<16||p.frameWidth>384||
      !Number.isInteger(p.frameHeight)||p.frameHeight<16||p.frameHeight>256||p.frameCount!==8||
      !/^assets\/car-previews\/[a-z0-9._-]+\.(webp|png)$/i.test(p.url||'')||
      !/^[0-9a-f]{64}$/i.test(p.sourceSha256||''))continue;
    const a=p.poster;
    const poster=a&&urlOk(a.url)&&a.frameWidth===p.frameWidth&&a.frameHeight===p.frameHeight&&
      Number.isInteger(a.frameIndex)&&ANGLES[a.frameIndex]===a.angleDeg&&digest(a.sha256)
      ? {id:id+':poster',url:new URL(a.url,base).href,w:a.frameWidth,h:a.frameHeight,count:1,frameIndex:a.frameIndex}
      : null;
    const sources=Array.isArray(p.stockSources)&&p.stockSources.length>=1&&p.stockSources.length<=32&&p.stockSources.every(r=>r&&['cars','art','tires','models'].includes(r.folder)&&safeName(r.name)&&digest(r.sha256))
      &&p.stockSources.filter(r=>r.folder==='cars').length===1?p.stockSources:null;
    const atlas={id:id+':atlas',url:new URL(p.url,base).href,w:p.frameWidth,h:p.frameHeight,count:8};
    const carId=p.carId===undefined?id:p.carId;
    if(typeof carId!=='string'||!(/^[a-z0-9][a-z0-9_-]{0,127}$/i).test(carId))continue;
    previews.set(id,{...atlas,sources,poster,carId});
  }
  const pairs=Object.entries(raw.carsByName||{}),frequency=new Map();
  for(const [,id] of pairs)frequency.set(id,(frequency.get(id)||0)+1);
  for(const [name,id] of pairs){
    const entry=previews.get(id);
    if(safeName(name)&&entry&&frequency.get(id)===1&&(!entry.sources||entry.sources.some(x=>x.folder==='cars'&&x.name===name)))names.set(name,id);
  }
  return {names,previews,revision:digest(raw.releaseRevision)?raw.releaseRevision:null};
}
function manifest(){
  if(typeof document==='undefined'||typeof fetch!=='function')return Promise.resolve(null);
  return manifestTask??=(async()=>{
    try {
      const response=await fetch(catalogUrl(),{signal:AbortSignal.timeout(8000)});
      return preparedCatalog=response.ok?parseCarPreviewCatalog(await response.json(),document.baseURI):null;
    }catch{return preparedCatalog=null;}
  })();
}
function promote(id,record){images.delete(id);images.set(id,record);}
function pump(){
  for(const [id,record] of images){
    if(active>=MAX_LOADING)return;
    if(record.status!=='queued')continue;
    record.status='loading';active++;
    const image=new Image();
    const finish=(ok)=>{
      image.onload=image.onerror=null;clearTimeout(timer);
      record.status=ok?'ready':'missing';
      record.image=ok?image:null;active--;promote(id,record);
      for(const listener of record.waiters)listener();
      record.waiters.clear();
      const settled=[...images].filter(([,r])=>r.status==='ready'||r.status==='missing');
      for(const [key] of settled.slice(0,Math.max(0,settled.length-MAX_RESIDENT)))images.delete(key);
      pump();
    };
    const timer=setTimeout(()=>{finish(false);image.removeAttribute('src');},10000);
    image.onload=()=>finish(image.naturalWidth===record.entry.w*record.entry.count&&image.naturalHeight===record.entry.h);
    image.onerror=()=>finish(false);
    image.src=record.entry.url;
  }
}
let preparedCatalog;
function verifyVisible(id,entry,name,whenReady,usable){
  if(!entry.sources?.some(x=>x.folder==='cars'&&x.name===name)||!preparedCatalog.revision)return false;
  const token=entry.sources.map(x=>showroomArtVersion(x.name)).join('|');
  const now=Date.now();
  const previous=verified.get(id);
  if(previous?.token===token&&previous.expires>now)return previous.ok;
  if(previous?.pending||verificationActive>=MAX_LOADING)return false;
  const state={token,expires:0,ok:false,pending:true};verified.set(id,state);verificationActive++;
  void verifyProjectCarPreviewStock(preparedCatalog.revision,id,name,entry.carId,entry.sources).then(ok=>{
    state.ok=ok;state.expires=Date.now()+(isProjectStorageReadOnly()?60000:5000);state.pending=false;verificationActive--;
    if(usable?.()!==false)whenReady?.();
  });
  return false;
}
function requestPreview(name,frame,preferAtlas,whenReady,usable){
  if(locallyChanged.has(name))return null;
  if(preparedCatalog===undefined){
    const pending=manifest();
    if(whenReady)void pending.then(x=>{preparedCatalog=x;if(usable?.()!==false)whenReady();});
    return null;
  }
  if(usable?.()===false)return null;
  const id=preparedCatalog?.names.get(name);
  if(!id)return null;
  const entry=preparedCatalog.previews.get(id);
  if(!verifyVisible(id,entry,name,whenReady,usable))return null;
  const source=!preferAtlas&&entry.poster?.frameIndex===frame?entry.poster:entry;
  const key=source.id;
  let record=images.get(key);
  if(!record){
    const queued=[...images].filter(([,r])=>r.status==='queued');
    if(queued.length>=MAX_PENDING)images.delete(queued[0][0]);
    record={status:'queued',entry:source,image:null,waiters:new Set()};
    images.set(key,record);
  }else if(record.status==='ready')promote(key,record);
  if(whenReady&&(record.status==='queued'||record.status==='loading')&&record.waiters.size<40)record.waiters.add(whenReady);
  pump();
  return record.status==='ready'?record:null;
}
export function paintCarThumbnail(ctx,bounds,name,angle=135,whenReady,usable,preferAtlas=false){
  const frame=((Math.round((Number(angle)||0)/45)%8)+8)%8;
  const found=requestPreview(name,frame,preferAtlas,whenReady,usable);
  if(!found)return false;
  const {entry,image}=found;
  const scale=Math.min(bounds.w/entry.w,bounds.h/entry.h);
  const w=entry.w*scale,h=entry.h*scale;
  if(!Number.isFinite(scale)||scale<=0)return false;
  ctx.drawImage(image,(entry.count===1?0:frame)*entry.w,0,entry.w,entry.h,bounds.x+(bounds.w-w)/2,bounds.y+(bounds.h-h)/2,w,h);
  return true;
}
export function drawCarThumbnailPlaceholder(ctx,{x,y,w,h}){
  const s=Math.min(w/90,h/42),a=x+(w-90*s)/2,b=y+(h-42*s)/2;
  if(!Number.isFinite(s)||s<=0)return;
  ctx.save();ctx.translate(a,b);ctx.scale(s,s);ctx.fillStyle='#73848e';
  ctx.beginPath();ctx.moveTo(3,27);ctx.lineTo(16,22);ctx.lineTo(29,10);ctx.lineTo(57,10);ctx.lineTo(73,22);ctx.lineTo(84,24);ctx.lineTo(88,32);ctx.lineTo(86,34);ctx.lineTo(4,34);ctx.closePath();ctx.fill();
  ctx.fillStyle='#26333a';
  for(const c of [19,70]){ctx.beginPath();ctx.arc(c,34,7,0,Math.PI*2);ctx.fill();}
  ctx.restore();
}
