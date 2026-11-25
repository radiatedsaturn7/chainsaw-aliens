import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {expect} from '@playwright/test';

const root=new URL('../../data/server-storage/files/',import.meta.url);
const previewFile=new URL('../../assets/car-previews/manifest.json',import.meta.url);
const runtimeManifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)));
const unpack=d=>d.__chainsawStorage?JSON.parse(gunzipSync(Buffer.from(d.data,'base64'))):d;
const carDocs=new Map(Object.entries(runtimeManifest.folders.cars).filter(([name])=>!name.startsWith('__')).map(([name,path])=>[name,unpack(JSON.parse(fs.readFileSync(new URL(path,root))))]));
const versionDocument=unpack(JSON.parse(fs.readFileSync(new URL(runtimeManifest.folders.cars.__car_versions__,root))));
const mainArtPaths=new Set();
const refsByName=new Map();
function artRefs(value,set=new Set()){
 if(!value||typeof value!=='object')return set;
 if(typeof value.artRef==='string')set.add(value.artRef);
 for(const x of Object.values(value))artRefs(x,set);
 return set;
}
for(const [name,{car}] of carDocs){
 const exterior=new Set();
 for(const kind of ['body','tires','wheels','wheel','tread'])artRefs(car.art?.exterior?.[kind],exterior);
 for(const layer of Object.values(car.art?.angleLayers||{}))for(const kind of ['body','tires','wheels','wheel','tread'])artRefs(layer[kind],exterior);
 for(const key of ['shell','body','artRef','tires'])if(typeof car.art?.[key]==='string')exterior.add(car.art[key]);
 for(const key of ['tread','wheel'])artRefs(car.art?.tireSurfaces?.[key],exterior);
 const all=artRefs(car.art);
 const active=versionDocument.families?.[name]?.active;
 const native=active&&active!==name?carDocs.get(active)?.car:car;
 refsByName.set(name,{id:car.id,bodyModel:native?.art?.bodyModel?.ref,exterior:[...exterior],all:[...all]});
 for(const ref of exterior)if(runtimeManifest.folders.art[ref])mainArtPaths.add(runtimeManifest.folders.art[ref]);
}
const resourceKey=url=>{
 try{
  const parsed=new URL(url),path=decodeURIComponent(parsed.pathname);
  if(path==='/.netlify/functions/storage-file'||path==='/__storage/file'){
   const folder=parsed.searchParams.get('folder'),name=parsed.searchParams.get('name');
   return runtimeManifest.folders[folder]?.[name]||'';
  }
  const prefix='/server-storage/files/';return path.includes(prefix)?path.split(prefix).at(-1):'';
 }catch{return '';}
};
export function catalogCar(name){return refsByName.get(name);}
export function catalogArtPath(ref){return runtimeManifest.folders.art[ref];}
export const isCatalogArtRequest=(url,ref)=>resourceKey(url)===catalogArtPath(ref);

export async function installThumbnailBrowseWitness(context,{originalSprites=false}={}){
 // Loading/placeholder tests explicitly exercise the retained sprite versions.
 // Normal picker tests keep the saved active (including native 3D) versions.
 if(originalSprites){
  const registry=structuredClone(versionDocument);
  for(const [name,family] of Object.entries(registry.families||{}))family.active=name;
  await context.route(url=>url.pathname==='/__storage/file'&&url.searchParams.get('folder')==='cars'&&url.searchParams.get('name')==='__car_versions__',route=>route.fulfill({json:{ok:true,file:{folder:'cars',name:'__car_versions__',version:1,data:registry}}}));
 }
 const thumb=JSON.parse(fs.readFileSync(previewFile));
 expect(thumb.schemaVersion).toBe(1);
 expect(thumb.anglesDeg).toEqual([0,45,90,135,180,225,270,315]);
 const requested=[],thumbRequests=[],loaded=[],initiators=[];
 let choosing=false;
 await context.exposeBinding('__reportPickerFileRequest',(_source,{url,stack,screen,car})=>{
  if(choosing||!mainArtPaths.has(resourceKey(url))||initiators.length>=24)return;
  initiators.push({url,stack,screen,car});
 });
 await context.addInitScript(()=>{
  const report=value=>{
   let url;try{url=new URL(typeof value==='string'||value instanceof URL?value:value?.url,location.href);}catch{return;}
   if(url.searchParams.get('folder')!=='art'&&!url.pathname.includes('/server-storage/files/art/'))return;
   const flow=window.__game?.menuPlayer?.flow;
   void window.__reportPickerFileRequest?.({url:url.href,stack:new Error().stack,screen:flow?.screenId,car:flow?.parameters?.carRef});
  };
  const fetch=window.fetch,xhrOpen=XMLHttpRequest.prototype.open;
  window.fetch=function(input,...args){report(input);return fetch.call(this,input,...args);};
  XMLHttpRequest.prototype.open=function(method,url,...args){report(url);return xhrOpen.call(this,method,url,...args);};
 });
 context.on('request',request=>{
  const url=request.url(),path=resourceKey(url);
  if(mainArtPaths.has(path))requested.push({path,choosing});
  if(new URL(url).pathname.includes('/assets/car-previews/'))thumbRequests.push(url);
 });
 context.on('response',response=>{
  const path=resourceKey(response.url());if(path.startsWith('art/')&&response.ok())loaded.push(path);
 });
 await context.addInitScript(()=>{
  const original=CanvasRenderingContext2D.prototype.drawImage;
  const draws=new Map(),sampled=new WeakMap(),scratch=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
  const modelSources=new WeakMap(),modelDraws=new Map();
  const data={draws,modelDraws,mark:()=>{draws.clear();modelDraws.clear();}};
  // Witness the production native renderer's output, not any arbitrary canvas.
  if(location.protocol.startsWith('http'))void import('/src/menus/MenuCarPreview.js').then(({MenuCarPreview})=>{
   const draw=MenuCarPreview.prototype.draw;
   MenuCarPreview.prototype.draw=function(ctx,b,car,...args){
    const result=draw.call(this,ctx,b,car,...args);
    if(result&&car?.art?.bodyModel?.ref)modelSources.set(ctx.canvas,car.art.bodyModel.ref);
    return result;
   };
  });
  Object.defineProperty(window,'__thumbnailBrowseWitness',{value:data});
  CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
   const result=original.call(this,image,...args);
   if(this.canvas===window.__game?.canvas&&modelSources.has(image)&&args.length===4){
    const [dx,dy,dw,dh]=args,m=this.getTransform(),w=image.width,h=image.height;
    const p0=m.transformPoint({x:dx,y:dy}),p1=m.transformPoint({x:dx+dw,y:dy+dh});
    let sample=sampled.get(image);
    if(!sample){
     const rgba=image.getContext('2d').getImageData(0,0,w,h).data,probes=[];let opaque=0,clear=0;
     for(let i=3;i<rgba.length;i+=4){opaque+=rgba[i]>245;clear+=rgba[i]<8;}
     for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3){const i=4*(y*w+x);if(rgba[i+3]>245)probes.push([x,y,...rgba.slice(i,i+3)]);}
     sample={opaque,clear,probes};sampled.set(image,sample);
    }
    modelDraws.set(modelSources.get(image),{box:[p0.x,p0.y,p1.x,p1.y],opacity:this.globalAlpha,sample,w,h,at:performance.now()});
   }
   if(this.canvas!==window.__game?.canvas||!(image instanceof HTMLImageElement)||args.length!==8)return result;
   const path=new URL(image.currentSrc||image.src).pathname;
   if(!path.includes('/assets/car-previews/'))return result;
   const [sx,sy,sw,sh,dx,dy,dw,dh]=args,m=this.getTransform();
   if(![sx,sy,sw,sh,dx,dy,dw,dh].every(Number.isFinite)||sw<=0||sh<=0||dw<=0||dh<=0)return result;
   let frames=sampled.get(image);if(!frames){frames=new Map();sampled.set(image,frames);}
   let sample=frames.get(sx);
   if(!sample){
    scratch.canvas.width=sw;scratch.canvas.height=sh;
    original.call(scratch,image,sx,sy,sw,sh,0,0,sw,sh);
    const rgba=scratch.getImageData(0,0,sw,sh).data;
    let opaque=0,clear=0;const probes=[];
    for(let i=3;i<rgba.length;i+=4){opaque+=rgba[i]>245;clear+=rgba[i]<8;}
    for(let yy=Math.floor(sh*.2);yy<sh*.86;yy+=Math.max(1,Math.floor(sh/10))){
     for(let xx=Math.floor(sw*.14);xx<sw*.9;xx+=Math.max(1,Math.floor(sw/11))){
      const i=4*(yy*sw+xx);if(rgba[i+3]>245)probes.push([xx,yy,rgba[i],rgba[i+1],rgba[i+2]]);
     }
    }
    sample={opaque,clear,probes};frames.set(sx,sample);
   }
   const p0=m.transformPoint({x:dx,y:dy}),p1=m.transformPoint({x:dx+dw,y:dy+dh});
   draws.set(path,{path,sx,sy,sw,sh,nw:image.naturalWidth,nh:image.naturalHeight,box:[p0.x,p0.y,p1.x,p1.y],opacity:this.globalAlpha,sample,at:performance.now()});
  };
 });
 return {thumb,originalSprites,requested,thumbRequests,loaded,choose(){choosing=true;}, assertBrowseCold(){
  const early=requested.filter(x=>!x.choosing);
  const context=early.length&&initiators.length?'\n'+JSON.stringify(initiators,null,2):'';
  expect(early,'full car body/tire requests before choose'+context).toEqual([]);
 }};
}
export async function thumbnailOnCanvas(page,qa,name,{selected=true}={}){
 const bodyRef=!qa.originalSprites&&catalogCar(name)?.bodyModel;
 if(bodyRef)return page.evaluate(({bodyRef,selected})=>{
  const d=window.__thumbnailBrowseWitness.modelDraws.get(bodyRef),c=window.__game.canvas;
  if(!d||performance.now()-d.at>2500||!d.sample.opaque||!d.sample.clear)return null;
  if(selected?d.opacity<.95:!(d.opacity>0&&d.opacity<.95))return null;
  const [x1,y1,x2,y2]=d.box;
  if(!(x1>=0&&y1>=0&&x2<=c.width&&y2<=c.height&&x2>x1&&y2>y1))return null;
  const x0=Math.floor(x1),y0=Math.floor(y1),px=c.getContext('2d').getImageData(x0,y0,Math.ceil(x2)-x0,Math.ceil(y2)-y0);
  let matched=0,probed=0;
  for(const [sx,sy,r,g,b] of d.sample.probes){
   if(Math.max(r,g,b)*d.opacity<34)continue;
   probed++;
   const x=Math.floor(x1+(sx+.5)*(x2-x1)/d.w)-x0,y=Math.floor(y1+(sy+.5)*(y2-y1)/d.h)-y0,j=4*(y*px.width+x);
   if(px.data[j+3]>200&&Math.max(Math.abs(px.data[j]-r*d.opacity),Math.abs(px.data[j+1]-g*d.opacity),Math.abs(px.data[j+2]-b*d.opacity))<=Math.max(19,40*d.opacity))matched++;
  }
  return probed>=3&&matched>=Math.max(3,Math.floor(probed*.1))?{kind:'native-model',bodyRef,box:d.box,matched}:null;
 },{bodyRef,selected});
 const key=qa.thumb.carsByName?.[name],asset=qa.thumb.previews?.[key];
 expect(asset,`thumbnail entry for ${name}`).toBeTruthy();
 expect(asset.carId??key, `raw runtime identity for ${name}`).toBe(catalogCar(name)?.id);
 expect(asset.stockSources?.filter(x=>x.folder==='cars').map(x=>x.name),`exact storage entry for ${name}`).toEqual([name]);
 const poster=selected?null:asset.poster;
 if(poster){
  expect(poster.frameIndex).toBe(3);expect(poster.angleDeg).toBe(135);
  expect(poster.frameWidth).toBe(asset.frameWidth);expect(poster.frameHeight).toBe(asset.frameHeight);
 }
 return page.evaluate(({url,w,h,count,requestedFrame,selected})=>{
  const canvas=window.__game.canvas,ctx=canvas.getContext('2d');
  const path=new URL(url,document.baseURI).pathname;
  const d=window.__thumbnailBrowseWitness.draws.get(path);
  if(!d||performance.now()-d.at>2500||d.sw!==w||d.sh!==h||d.sy!==0||d.sx%w!==0||d.sx<0||d.sx>=count*w||d.nw!==count*w||d.nh!==h)return null;
  if(requestedFrame!==null&&d.sx/w!==requestedFrame)return null;
  if(selected ? d.opacity<.95 : !(d.opacity>0&&d.opacity<.95))return null;
  const [x1,y1,x2,y2]=d.box;
  if(!(x1>=0&&y1>=0&&x2<=canvas.width&&y2<=canvas.height&&x2>x1&&y2>y1))return null;
  if(!d.sample.opaque||!d.sample.clear||d.sample.probes.length<5)return null;
  let matched=0,probed=0;
  const px=ctx.getImageData(Math.floor(x1),Math.floor(y1),Math.ceil(x2)-Math.floor(x1),Math.ceil(y2)-Math.floor(y1));
  for(const [sx,sy,r,g,b] of d.sample.probes){
   if(Math.max(r,g,b)*d.opacity<34)continue; // black canvas alone cannot satisfy this witness
   probed++;
   const x=Math.floor(x1+(sx+.5)*(x2-x1)/w)-Math.floor(x1),y=Math.floor(y1+(sy+.5)*(y2-y1)/h)-Math.floor(y1);
   const j=4*(y*px.width+x);
   const error=Math.max(Math.abs(px.data[j]-r*d.opacity),Math.abs(px.data[j+1]-g*d.opacity),Math.abs(px.data[j+2]-b*d.opacity));
   if(px.data[j+3]>200&&Math.max(...px.data.slice(j,j+3))>=20&&error<=Math.max(19,40*d.opacity))matched++;
  }
  return probed>=3&&matched>=Math.max(3,Math.floor(probed*.10))?{path,frame:count===1?3:d.sx/w,kind:count===1?'poster':'atlas',box:d.box,matched}:null;
 },{url:poster?.url||asset.url,w:asset.frameWidth,h:asset.frameHeight,count:poster?1:8,requestedFrame:poster?0:selected?null:3,selected});
}
export async function expectThumbnailOnCanvas(page,qa,name,opts){
 let witness;await expect.poll(async()=>{witness=await thumbnailOnCanvas(page,qa,name,opts);return witness;},{timeout:90000}).not.toBeNull();
 return witness;
}
