import {safeProperty} from './MenuWidgets.js';
import {MenuCarPreview} from './MenuCarPreview.js';
import {listProjectFiles,loadProjectFile,hydrateProjectFilePayload} from '../ui/projectFiles.js';
import {getRaceArtSpriteCanvasShared,hydrateRaceArtSpriteShared} from '../ui/shared/raceArtSpriteCanvas.js';

export class MenuResources {
  constructor(game){this.game=game;this.carPreview=new MenuCarPreview(game.carEditor);this.cars=new Map();this.carSources=new Map();this.artCache=new Map();this.tunings=new WeakMap();this.pending=new Map();this.errors=new Map();}
  choices(source,document){
    const folder={cars:'cars',races:'races',levels:'levels',movies:'cutscenes',actors:'actors',doodads:'doodads'}[source];
    return folder?listProjectFiles(folder).map(f=>({label:f.name,value:f.name})):[];
  }
  request(key,fn){if(this.pending.has(key)||this.errors.has(key))return;const task=Promise.resolve().then(fn).catch(e=>this.errors.set(key,String(e?.message||e))).finally(()=>this.pending.delete(key));this.pending.set(key,task);}
  car(ref){
    if(!ref)return null;
    const cached=loadProjectFile('cars',ref)?.data;
    if(this.cars.has(ref)&&(!cached||this.carSources.get(ref)===cached))return this.cars.get(ref);
    const install=data=>{if(!data)throw Error(`Car not found: ${ref}`);const car=this.game.carEditor.normalizeLoadedCarDocument(data.car||data);this.cars.set(ref,car);this.carSources.set(ref,data);for(const artRef of this.game.carEditor.collectRaceCarArtRefs(car))this.request(`art:${artRef}`,()=>hydrateRaceArtSpriteShared(artRef));return car};
    if(cached)return install(cached);
    this.request(`car:${ref}`,async()=>install((await hydrateProjectFilePayload('cars',ref))?.data));return null;
  }
  asset(source,ref,parameters={}){
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
  tuning(car){if(!this.tunings.has(car))this.tunings.set(car,this.game.carEditor.getRaceCarTuning(car));return this.tunings.get(car);}
  art(ref,frameIndex=0){if(!ref)return null;const canvas=getRaceArtSpriteCanvasShared(ref,{frameIndex,cache:this.artCache});if(!canvas)this.request(`art:${ref}`,()=>hydrateRaceArtSpriteShared(ref));return canvas;}
}
