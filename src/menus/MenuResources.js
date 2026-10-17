import {partFits} from '../garage/CarPart.js';
import {itemLibrary} from '../items/ItemLibrary.js';
import {safeProperty} from './MenuWidgets.js';
import {MenuCarPreview} from './MenuCarPreview.js';
import {listProjectFiles,loadProjectFile,hydrateProjectFilePayload} from '../ui/projectFiles.js';
import {getRaceArtSpriteCanvasShared,hydrateRaceArtSpriteShared} from '../ui/shared/raceArtSpriteCanvas.js';

export class MenuResources {
  constructor(game){this.game=game;this.carPreview=new MenuCarPreview(game.carEditor);this.showroomFrames=new WeakMap();this.cars=new Map();this.carSources=new Map();this.artCache=new Map();this.tunings=new WeakMap();this.garageCars=new Map();this.partCatalog=[];this.pending=new Map();this.errors=new Map();}
  get garage(){return this.garageOverride||this.game.items?.garage;}
  async prepareGarage(){
    await this.garage?.load();
    const entries=await itemLibrary.list();
    this.partCatalog=(await Promise.all(entries.map(async e=>{try{return {ref:e.name,item:await itemLibrary.load(e.name)};}catch{return null;}}))).filter(e=>e?.item.carPart);
  }
  garageCatalog(){
    const owned=this.garage?.owned()||[];
    return [...this.partCatalog,...owned.filter(item=>!this.partCatalog.some(e=>e.item.id===item.id)).map(item=>({ref:'owned:'+item.id,item}))];
  }
  choices(source,document,parameters={}){
    if(source==='garage-parts'){
      if(!this.partCatalog.length)this.request('garage-catalog',()=>this.prepareGarage());
      return this.garageCatalog().filter(({item})=>item.carPart.forSale||this.garage?.items.progress.bags.items[item.id]>0).map(({ref,item})=>({value:ref,label:item.name}));
    }
    const folder={cars:'cars',races:'races',levels:'levels',movies:'cutscenes',actors:'actors',doodads:'doodads'}[source];
    return folder?listProjectFiles(folder).map(f=>({label:f.name,value:f.name})):[];
  }
  request(key,fn){if(this.pending.has(key)||this.errors.has(key))return;const task=Promise.resolve().then(fn).catch(e=>this.errors.set(key,String(e?.message||e))).finally(()=>{this.pending.delete(key);this.showroomFrames=new WeakMap();});this.pending.set(key,task);}
  car(ref){
    const stock=this.stockCar(ref),garage=this.garage;
    if(!stock||!garage?.items.ready||!garage.installed(ref).length)return stock;
    const key=`${ref}:${garage.revision}:${garage.items.revision}`;
    const cached=this.garageCars.get(key);if(cached?.stock===stock)return cached.car;
    this.request(`garage-car:${key}`,async()=>{const car=await garage.build(ref,stock);this.garageCars.set(key,{stock,car});});
    return null;
  }
  stockCar(ref){
    if(!ref)return null;
    const cached=loadProjectFile('cars',ref)?.data;
    if(this.cars.has(ref)&&(!cached||this.carSources.get(ref)===cached))return this.cars.get(ref);
    const install=data=>{if(!data)throw Error(`Car not found: ${ref}`);const car=this.game.carEditor.normalizeLoadedCarDocument(data.car||data);this.cars.set(ref,car);this.carSources.set(ref,data);for(const artRef of this.game.carEditor.collectRaceCarArtRefs(car))this.request(`art:${artRef}`,()=>hydrateRaceArtSpriteShared(artRef));return car};
    if(cached)return install(cached);
    this.request(`car:${ref}`,async()=>install((await hydrateProjectFilePayload('cars',ref))?.data));return null;
  }
  asset(source,ref,parameters={}){
    if(source==='garage'){
      const garage=this.garage,entry=this.garageCatalog().find(e=>e.ref===ref),item=entry?.item;
      if(!garage)return null;
      const owned=Number(garage.items.progress.bags.items[item?.id])||0;
      const installed=!!item&&garage.configuration(parameters.carRef).installed[item.carPart.slot]===item.id;
      const locked=!!item?.carPart.unlockKey&&!garage.items.progress.unlocks[item.carPart.unlockKey];
      const credits=Number(garage.items.game.player?.credits??garage.items.savedStats?.credits)||0;
      return {credits,owned,installed,artRef:item?.artRef||'',price:item?.carPart.price||0,partStatus:item?`${installed?'Installed · ':''}${locked?'Locked · ':''}${!partFits(item.carPart,parameters.carRef)?'Does not fit · ':''}Owned: ${owned} · Price: ${item.carPart.price} · Credits: ${credits}`:'Choose a part',name:item?.name||''};
    }
    if(source==='parameters')return typeof ref==='object'?ref:parameters[ref];
    if(source==='cars')return this.car(ref);
    if(!['actors','doodads'].includes(source)||!ref)return null;
    const data=loadProjectFile(source,ref)?.data;
    if(data)return data.actor||data;
    this.request(`${source}:${ref}`,()=>hydrateProjectFilePayload(source,ref));return null;
  }
  elementAsset(element,parameters){return this.asset(element.dataSource,element.assetRef||parameters[element.binding],parameters);}
  property(element,parameters){
    const asset=this.elementAsset(element,parameters);
    return safeProperty(asset,element.property);
  }
  assetArt(element,parameters,time=0){
    const asset=this.elementAsset(element,parameters);
    const animation=asset?.states?.[0]?.animation;
    const ref=element.artRef||(element.property?safeProperty(asset,element.property):null)||animation?.artRef||asset?.artRef||asset?.art?.ref;
    return typeof ref==='string'?this.art(ref,Math.floor(time*(animation?.fps||8))):null;
  }
  drawParkedCar(ctx,b,car,key,draw){
    if(typeof document==='undefined'||this.pending.size||!car){draw(ctx,b);return;}
    let frames=this.showroomFrames.get(car);if(!frames){frames=new Map();this.showroomFrames.set(car,frames);}
    const width=Math.max(1,Math.ceil(b.w)),height=Math.max(1,Math.ceil(b.h)),id=`${key}:${width}:${height}`;
    let canvas=frames.get(id);
    if(!canvas){
      canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      draw(canvas.getContext('2d'),{x:0,y:0,w:width,h:height});
      if(frames.size>=8)frames.clear();frames.set(id,canvas);
    }
    ctx.drawImage(canvas,b.x,b.y,b.w,b.h);
  }
  tuning(car){if(!this.tunings.has(car))this.tunings.set(car,this.game.carEditor.getRaceCarTuning(car));return this.tunings.get(car);}
  art(ref,frameIndex=0){if(!ref)return null;const canvas=getRaceArtSpriteCanvasShared(ref,{frameIndex,cache:this.artCache});if(!canvas)this.request(`art:${ref}`,()=>hydrateRaceArtSpriteShared(ref));return canvas;}
}
