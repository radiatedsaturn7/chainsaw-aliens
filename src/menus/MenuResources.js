import {activeCarVersionRef,canonicalCarVersionRef,filterPlayableCarVersions} from '../racing/CarVersions.js';
import {getRaceCarVersions,hydrateRaceCarVersions,hydrateRaceCarVersionFile,resolveRaceCarVersionFile} from '../ui/RaceCarVersionFiles.js';
import {calculateCarPerformance} from '../racing/CarPerformance.js';
import {raceRewardQuote} from '../garage/CampaignEconomy.js';
import {hydrateServerStorage,readShowroomArt,showroomArtVersion} from '../ui/serverStorage.js';
import {planAutoUpgrade,garageCarPerformance} from '../garage/GarageAutoUpgrade.js';
import {loadGarageSetupCatalog} from '../garage/GarageSetups.js';
import {getArtDocumentFrames} from '../ui/shared/artDocumentPixels.js';
import {prepareMenuScreen} from './MenuScreenPreparation.js';
import {MenuAppearanceResources} from './MenuAppearance.js';
import {partFits,isGarageUpgrade,isStockPart} from '../garage/CarPart.js';
import {itemLibrary} from '../items/ItemLibrary.js';
import {safeProperty} from './MenuWidgets.js';
import {MenuCarPreview} from './MenuCarPreview.js';
import {listProjectFiles,loadProjectFile,hydrateProjectFilePayload} from '../ui/projectFiles.js';
import {getRaceArtSpriteCanvasShared,hydrateRaceArtSpriteShared,hasShowroomArtFrames,setShowroomArtFrames,setShowroomArtPage} from '../ui/shared/raceArtSpriteCanvas.js';

export class MenuResources {
  constructor(game){this.appearance=new MenuAppearanceResources();this.game=game;this.carPreview=new MenuCarPreview(game.carEditor);this.showroomFrames=new WeakMap();this.cars=new Map();this.carSources=new Map();this.artCache=new Map();this.tunings=new WeakMap();this.garageCars=new Map();this.partCatalog=[];this.autoQuotes=new Map();this.pending=new Map();this.errors=new Map();this.missingRaces=new Set();}
  async prepareScreen(document,screen,parameters,options){
    this.carVersionsReady ||= hydrateRaceCarVersions();
    await this.carVersionsReady;
    if(options?.isCurrent?.()===false)return;
    return prepareMenuScreen(this,document,screen,parameters,options);
  }
  exteriorArtRefs(car){return this.game.carEditor.collectRaceCarArtRefs({...car,art:{...car.art,gauges:{},interior:{},smoke:{}}});}
  font(element){return this.appearance.font(element);}
  cursor(element){return element.cursorArtRef?this.art(element.cursorArtRef):this.appearance.cursor(element);}
  get garage(){return this.garageOverride||this.game.items?.garage;}
  async prepareGarage(){
    await this.garage?.load();
    await hydrateServerStorage({folder:'tires'}).catch(()=>null);
    this.cancelAutoUpgradeQuotes();
    // Startup catalog only needs item definitions; installed/selected parts load their art on demand.
    this.setupCatalog=await loadGarageSetupCatalog(this.garage,{hydrateDependencies:false});
    const entries=await itemLibrary.list();
    this.partCatalog=(await Promise.all(entries.map(async e=>{try{return {ref:e.name,item:await itemLibrary.load(e.name,{hydrateDependencies:false})};}catch{return null;}}))).filter(e=>e?.item.carPart);
  }
  performance(car){return garageCarPerformance(car,this.game.carEditor.getRaceCarTuning(car));}
  cancelAutoUpgradeQuotes(){
    this.autoQuoteBatch?.controller.abort();
    this.autoQuoteBatch=null;
    this.autoQuotes.clear();
  }
  autoUpgradeQuote(ref,target){
    const stock=this.stockCar(ref);if(!stock)return null;
    const garage=this.garage;
    const revision=`${ref}:${garage.revision}:${garage.items.revision}`;
    if(this.autoQuoteBatch?.revision!==revision||this.autoQuoteBatch?.stock!==stock){
      this.cancelAutoUpgradeQuotes();
      this.autoQuoteBatch={revision,stock,controller:new AbortController(),id:(this.autoQuoteGeneration||0)+1};
      this.autoQuoteGeneration=this.autoQuoteBatch.id;
    }
    const batch=this.autoQuoteBatch,key=`${revision}:${target}`;
    const cached=this.autoQuotes.get(key);if(cached?.stock===stock)return cached.result;
    const signal=batch.controller.signal;
    // PI searches are CPU-heavy. Run one at a time, and discard the entire
    // batch when Stock, another part, or a different car changes its inputs.
    this.request(`auto:${batch.id}:${key}`,()=>{
      const task=(this.autoQuoteQueue||Promise.resolve()).then(async()=>{
        if(signal.aborted)return;
        let result;
        try{
          result=await planAutoUpgrade(garage,ref,stock,target,
            new Map(this.garageCatalog().map(e=>[e.ref,e.item])),car=>this.performance(car),
            garage.items.progress,{signal});
        }catch(error){
          if(signal.aborted)return;
          result={error:error.message};
        }
        if(!signal.aborted&&this.autoQuoteBatch===batch
          &&revision===`${ref}:${garage.revision}:${garage.items.revision}`)this.autoQuotes.set(key,{stock,result});
      });
      this.autoQuoteQueue=task.catch(()=>{});
      return task;
    });return null;
  }
  stockPart(slot){return this.partCatalog.find(({item})=>(item.carPart.stock||isStockPart(item))&&item.carPart.slot===slot)?.item;}
  garageCatalog(){
    const owned=this.garage?.owned()||[];
    return [...this.partCatalog,...owned.filter(item=>!this.partCatalog.some(e=>e.item.id===item.id)).map(item=>({ref:'owned:'+item.id,item}))].filter(({item})=>isGarageUpgrade(item));
  }
  choices(source,document,parameters={}){
    if(source==='garage-parts'){
      if(!this.partCatalog.length)this.request('garage-catalog',()=>this.prepareGarage());
      return this.garageCatalog().filter(({item})=>item.carPart.forSale||this.garage?.items.progress.bags.items[item.id]>0).map(({ref,item})=>({value:ref,label:item.name}));
    }
    const folder={cars:'cars',races:'races',levels:'levels',movies:'cutscenes',actors:'actors',doodads:'doodads'}[source];
    const listed=folder?listProjectFiles(folder,{allowSyncFetch:false}):[];
    const entries=source==='cars'?filterPlayableCarVersions(listed,getRaceCarVersions(),{includeDisabled:parameters.includeDisabledCars===true}):listed;
    // Static manifest entries acquire timestamps as they load. Keep carousel
    // order stable while fetching only one page.
    if(source==='cars')entries.sort((a,b)=>a.name.localeCompare(b.name));
    return entries.map(f=>({label:f.name,value:f.name}));
  }
  hasActiveCarVersion(ref){
    const versions=getRaceCarVersions(),name=canonicalCarVersionRef(versions,ref),active=activeCarVersionRef(versions,name);
    return Boolean(active&&active!==name);
  }
  request(key,fn){if(this.pending.has(key))return this.pending.get(key);if(this.errors.has(key))return Promise.resolve();const task=Promise.resolve().then(fn).catch(e=>this.errors.set(key,String(e?.message||e))).finally(()=>{this.pending.delete(key);this.showroomFrames=new WeakMap();});this.pending.set(key,task);return task;}
  car(ref,{prepareExterior=true}={}){
    const stock=this.stockCar(ref,{prepareExterior}),garage=this.garage;
    // A historical save may still contain the old alternate key. Use its
    // own existing setup if asked directly, without ever moving/deleting it.
    const canonical=canonicalCarVersionRef(getRaceCarVersions(),ref);
    if(ref!==canonical&&!garage?.progress?.cars?.[ref])ref=canonical;
    if(!stock||!garage?.items.ready)return stock;
    // A metadata-only build must not satisfy a later full-art request.
    const key=`${ref}:${garage.revision}:${garage.items.revision}${prepareExterior?'':':no-exterior'}`;
    const cached=this.garageCars.get(key);if(cached?.stock===stock){
      if(prepareExterior&&this.showroomNames?.has(ref))for(const artRef of this.exteriorArtRefs(cached.car))this.requestExteriorArt(ref,artRef);
      return cached.car;
    }
    this.request(`garage-car:${key}`,async()=>{const car=await garage.build(ref,stock,{hydrateArtwork:prepareExterior});this.garageCars.set(key,{stock,car});});
    return null;
  }
  raceReward(ref){
    const race=this.race(ref);if(!race)return null;
    this.raceRewardCache ||= new Map();
    const carRef=this.game?.menuProgress?.selectedGameCar;
    const car=carRef?this.car(carRef):null;
    const revision=`${this.garage?.revision}:${this.garage?.items.revision}:${carRef}:${!!car}`;
    const cached=this.raceRewardCache.get(ref);
    if(cached?.race===race&&cached.revision===revision)return cached.quote;
    const quote=raceRewardQuote(ref,race,this.garage?.progress,car?calculateCarPerformance(car).points:500,carRef);
    this.raceRewardCache.set(ref,{race,revision,quote});return quote;
  }
  race(ref){
    if(!ref)return null;
    const payload=loadProjectFile('races',ref,{allowSyncFetch:false})?.data;
    if(payload)return payload.race||payload;
    if(this.missingRaces.has(ref))return null;
    this.request(`race:${ref}`,async()=>{if(!(await hydrateProjectFilePayload('races',ref))?.data)this.missingRaces.add(ref);});return null;
  }
  // The visible page owns its preview frames. Shared application assets,
  // dirty data, and active race preload are never removed by this budget.
  retainShowroomPage(entries){
    const names=entries.map(e=>e.value), key=JSON.stringify(names);
    if(this.showroomKey!==key){
      this.showroomKey=key;this.showroomGeneration=(this.showroomGeneration||0)+1;
      this.showroomNames=new Set(names);
    }
    this.showroomWanted=new Set();
    for(const name of names){
      const stock=this.cars.get(name),garage=this.garage;
      if(!stock)continue;
      const built=garage?.items.ready?this.garageCars.get(`${name}:${garage.revision}:${garage.items.revision}`):null;
      for(const car of built?.stock===stock?[stock,built.car]:[stock])
        for(const ref of this.exteriorArtRefs(car))this.showroomWanted.add(ref);
    }
    setShowroomArtPage(this.game.carEditor?.raceArtSpriteCache,names.length?this.showroomWanted:null);
  }
  requestExteriorArt(ref,art,{showroom=this.showroomNames?.has(ref),generation=this.showroomGeneration}={}){
    // Capture provenance at enqueue; leaving the page can never convert a
    // showroom-only request into permanently retained canonical hydration.
    if(showroom){
      if(generation!==this.showroomGeneration||!this.showroomNames?.has(ref))return;
      const cache=this.game.carEditor.raceArtSpriteCache;
      this.showroomWanted.add(art);
      if(hasShowroomArtFrames(cache,art)||getRaceArtSpriteCanvasShared(art,{cache,allowSyncFetch:false,showroomArt:false}))return;
      // A save, deletion or storage mode transition can supersede this
      // request without changing the visible page. Scope dedup/errors to
      // this exact version and treat any superseded read as cancellation.
      const version=showroomArtVersion(art);
      return this.request(`showroom-art:${generation}:${version}:${art}`,()=>this.prepareShowroomArt(art,generation,version));
    }
    return this.request(`car-art:${art}`,()=>this.prepareCarArt(art));
  }
  stockCar(ref,{prepareExterior=true}={}){
    if(!ref)return null;
    const versions=getRaceCarVersions();
    ref=canonicalCarVersionRef(versions,ref);
    const showroom=this.showroomNames?.has(ref),generation=this.showroomGeneration;
    const storageVersion=showroom?showroomArtVersion():null;
    const loadArt=car=>{
      if(!prepareExterior)return;
      if(showroom){
        if(generation!==this.showroomGeneration||!this.showroomNames?.has(ref))return;
      }else{
        this.canonicalCarArt ||= new WeakSet();
        if(this.canonicalCarArt.has(car))return;
        this.canonicalCarArt.add(car);
      }
      for(const art of this.exteriorArtRefs(car))this.requestExteriorArt(ref,art,{showroom,generation});
    };
    const cached=resolveRaceCarVersionFile(ref,{versions,allowSyncFetch:false}).payload?.data;
    const active=activeCarVersionRef(versions,ref);
    this.carVersionWarmups ||= new WeakMap();
    let warmed=this.carVersionWarmups.get(versions);
    if(!warmed){warmed=new Set();this.carVersionWarmups.set(versions,warmed);}
    if(active&&active!==ref&&!warmed.has(ref)){
      warmed.add(ref);
      this.request('car-version:'+ref+':'+active,()=>hydrateRaceCarVersionFile(ref,{versions,hydrateDependencies:false}));
    }
    if(this.cars.has(ref)&&(!cached||this.carSources.get(ref)===cached)){
      const car=this.cars.get(ref);loadArt(car);return car;
    }
    const install=data=>{
      if(!data)throw Error(`Car not found: ${ref}`);
      const car=this.game.carEditor.normalizeLoadedCarDocument(data.car||data);
      this.cars.set(ref,car);this.carSources.set(ref,data);loadArt(car);return car;
    };
    if(cached)return install(cached);
    const isCurrent=()=>!showroom||generation===this.showroomGeneration&&storageVersion===showroomArtVersion()&&this.showroomNames?.has(ref);
    this.request(showroom?`showroom-car:${generation}:${storageVersion}:${ref}`:`car:${ref}`,async()=>{
      if(!isCurrent())return;
      let payload;
      try{payload=(await hydrateRaceCarVersionFile(ref,{versions,hydrateDependencies:false})).payload;}
      catch(error){if(!isCurrent())return;throw error;}
      if(isCurrent())install(payload?.data);
    });return null;
  }
  asset(source,ref,parameters={}){
    if(source==='garage'){
      const garage=this.garage,entry=this.garageCatalog().find(e=>e.ref===ref),item=entry?.item;
      if(!garage)return null;
      const owned=Number(garage.items.progress.bags.items[item?.id])||0;
      const installed=!!item&&garage.configuration(parameters.carRef).installed[item.carPart.slot]===item.id;
      const locked=!!item?.carPart.unlockKey&&!garage.items.progress.unlocks[item.carPart.unlockKey];
      const credits=Number(garage.items.game.player?.credits??garage.items.savedStats?.credits)||0;
      return {credits,owned,installed,artRef:item?.artRef||'',price:item?.carPart.price||0,partStatus:item?`${installed?'Installed · ':''}${locked?'Locked · ':''}${!partFits(item.carPart,parameters.carRef)?'Does not fit · ':''}Owned: ${owned} · Price: ${item.carPart.price} · Scrap: ${credits}`:'Choose a part',name:item?.name||''};
    }
    if(source==='parameters')return typeof ref==='object'?ref:parameters[ref];
    if(source==='cars')return this.car(ref);
    if(!['actors','doodads'].includes(source)||!ref)return null;
    const data=loadProjectFile(source,ref,{allowSyncFetch:false})?.data;
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
  prepareShowroomArt(ref,generation,version){
    const isCurrent=()=>generation===this.showroomGeneration&&version===showroomArtVersion(ref)&&this.showroomWanted?.has(ref);
    const task=(this.carArtQueue||Promise.resolve()).then(async()=>{
      if(!isCurrent())return;
      const cache=this.game.carEditor.raceArtSpriteCache ||= new Map();
      if(hasShowroomArtFrames(cache,ref)||getRaceArtSpriteCanvasShared(ref,{cache,allowSyncFetch:false,showroomArt:false}))return;
      let payload;
      try{payload=await readShowroomArt(ref,{isCurrent});}
      catch(error){if(!isCurrent())return;throw error;}
      if(!isCurrent())return;
      if(!payload){
        if(getRaceArtSpriteCanvasShared(ref,{cache,allowSyncFetch:false,showroomArt:false}))return;
        throw Error(`Artwork not found: ${ref}`);
      }
      if(!setShowroomArtFrames(cache,ref,payload,this.showroomWanted)&&isCurrent())throw Error(`Artwork could not be drawn: ${ref}`);
    });
    this.carArtQueue=task.catch(()=>{});return task;
  }
  prepareCarArt(ref){
    const task=(this.carArtQueue||Promise.resolve()).then(async()=>{
      const cache=this.game.carEditor.raceArtSpriteCache ||= new Map();
      const payload=await hydrateRaceArtSpriteShared(ref);
      if(!payload)throw Error(`Artwork not found: ${ref}`);
      const count=getArtDocumentFrames(payload.data).frames.length||1;
      for(let frameIndex=0;frameIndex<count;frameIndex++){
        if(!getRaceArtSpriteCanvasShared(ref,{frameIndex,cache,allowSyncFetch:false,showroomArt:false}))throw Error(`Artwork could not be drawn: ${ref}`);
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    });
    this.carArtQueue=task.catch(()=>{});
    return task;
  }
  async prepareArt(ref){
    const payload=await hydrateRaceArtSpriteShared(ref);
    if(!payload)throw Error(`Artwork not found: ${ref}`);
    const count=getArtDocumentFrames(payload.data).frames.length||1;
    for(let frameIndex=0;frameIndex<count;frameIndex++){
      if(!getRaceArtSpriteCanvasShared(ref,{frameIndex,cache:this.artCache,allowSyncFetch:false}))throw Error(`Artwork could not be drawn: ${ref}`);
      if(frameIndex+1<count)await new Promise(resolve=>setTimeout(resolve,0));
    }
  }
  art(ref,frameIndex=0){if(!ref)return null;const canvas=getRaceArtSpriteCanvasShared(ref,{frameIndex,cache:this.artCache,allowSyncFetch:false});if(!canvas)this.request(`art:${ref}`,()=>this.prepareArt(ref));return canvas;}
}
