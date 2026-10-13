import {MenuCarPreview} from './MenuCarPreview.js';
import {listProjectFiles,loadProjectFile,hydrateProjectFilePayload} from '../ui/projectFiles.js';
import {getRaceArtSpriteCanvasShared,hydrateRaceArtSpriteShared} from '../ui/shared/raceArtSpriteCanvas.js';

export class MenuResources {
  constructor(game){this.game=game;this.carPreview=new MenuCarPreview(game.carEditor);this.cars=new Map();this.carSources=new Map();this.artCache=new Map();this.tunings=new WeakMap();this.pending=new Map();this.errors=new Map();}
  choices(source,document){
    if(source==='grandPrix')return document.grandPrix.map(g=>({label:g.name,value:g.id}));
    const folder={cars:'cars',races:'races',levels:'levels',movies:'cutscenes'}[source];
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
  tuning(car){if(!this.tunings.has(car))this.tunings.set(car,this.game.carEditor.getRaceCarTuning(car));return this.tunings.get(car);}
  art(ref,frameIndex=0){if(!ref)return null;const canvas=getRaceArtSpriteCanvasShared(ref,{frameIndex,cache:this.artCache});if(!canvas)this.request(`art:${ref}`,()=>hydrateRaceArtSpriteShared(ref));return canvas;}
}
