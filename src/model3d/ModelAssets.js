import {applyAutomotiveEnvironment,automotivePilotEnabled,automotiveFleetEnabled} from './AutomotiveMaterials.js';
import {wrxBundledModelUrl,loadWrxBundledModel} from './WrxBundledModels.js';
import {wrxPilotPart} from './WrxVisualPilot.js';
import {normalizeModelBinding} from './ModelBinding.js';
export {normalizeModelBinding} from './ModelBinding.js';
import * as THREE from '../vendorBridge/three.js';
import {validateModelDocument} from './ModelDocument.js';
import {buildModelObject,disposeModelObject,updateModelPose} from './ModelRender.js';
import {loadProjectFile,hydrateProjectFilePayload} from '../ui/projectFiles.js';

// One loading cache per engine, shared by all placements of a saved model.
// Placements own geometry and pose; animating one never changes another.
export class ModelAssetLibrary {
  constructor({load=loadProjectFile,hydrate=hydrateProjectFilePayload,bundled=null}={}){
    this.load=load;this.hydrate=hydrate;this.bundled=bundled;this.entries=new Map();this.temporary=new Map();this.pending=new Map();this.errors=new Map();this.revision=0;
  }
  adopt(ref,payload){
    const document=payload?.data||payload;
    if(!document)return null;
    const previous=this.entries.get(ref);
    if(previous?.source===document)return previous.model;
    const model=validateModelDocument(structuredClone(document));
    this.entries.set(ref,{source:document,model,revision:++this.revision});this.errors.delete(ref);return model;
  }
  adoptTemporary(ref,document){
    if(typeof ref!=='string'||!ref.startsWith('studio-session-')||this.temporary.has(ref))throw Error('Invalid temporary model reference');
    const model=validateModelDocument(structuredClone(document));
    this.temporary.set(ref,model);this.revision++;
    return ()=>{if(this.temporary.get(ref)===model){this.temporary.delete(ref);this.revision++;}};
  }
  get(ref){
    if(!ref)return null;
    if(this.temporary.has(ref))return this.temporary.get(ref);
    if(this.bundled&&wrxBundledModelUrl(ref)&&!this.errors.has(ref)){
      if(this.entries.has(ref))return this.entries.get(ref).model;
      if(!this.pending.has(ref))void this.prepare(ref).catch(()=>{});
      return null;
    }
    const local=this.load('models',ref);
    if(local){try{return this.adopt(ref,local);}catch(error){this.errors.set(ref,error);return null;}}
    if(this.entries.has(ref))return this.entries.get(ref).model;
    if(!this.pending.has(ref)&&!this.errors.has(ref))void this.prepare(ref).catch(()=>{});
    return null;
  }
  prepare(ref){
    if(!ref)return Promise.reject(Error('Select a saved 3D model'));
    if(this.temporary.has(ref))return Promise.resolve(this.temporary.get(ref));
    if(this.pending.has(ref))return this.pending.get(ref);
    const request=Promise.resolve().then(async()=>{
      let visual=null;
      if(this.bundled&&wrxBundledModelUrl(ref)){
        try{
          visual=await this.bundled(ref);
          if(visual)return this.adopt(ref,visual);
        }catch(error){console.warn('Using the stock WRX model',error);}
      }
      const payload=this.load('models',ref)||await this.hydrate('models',ref);
      if(!payload)throw Error(`3D model not found: ${ref}`);
      return this.adopt(ref,payload);
    }).catch(error=>{this.errors.set(ref,error);throw error;}).finally(()=>this.pending.delete(ref));
    this.pending.set(ref,request);return request;
  }
}
export const modelAssets=new ModelAssetLibrary({bundled:loadWrxBundledModel});

// Local axes: +Y up, +Z forward; wheel axle along X. The placement's parent
// owns world position, car steering or actor facing. Binding rotation is radians.
export class ModelAssetInstance {
  constructor(){this.object=new THREE.Group();this.root=null;this.model=null;this.binding=null;this.time=0;}
  setModel(model,binding,{vehicleVisual=false}={}){
    const normalized=normalizeModelBinding(binding);if(!normalized)throw Error('Missing model reference');
    const changed=this.model!==model||this.binding?.ref!==normalized.ref||this.vehicleVisual!==vehicleVisual;
    this.vehicleVisual=vehicleVisual;
    if(changed){
      if(this.root){this.object.remove(this.root);disposeModelObject(this.root);}
      const wrxPart=wrxPilotPart(normalized.ref);
      this.root=buildModelObject(model,{wrxPart,automotive:wrxPart?automotivePilotEnabled:vehicleVisual&&automotiveFleetEnabled});this.object.add(this.root);this.model=model;this.time=0;
    }
    if(this.binding?.clip!==normalized.clip)this.time=0;
    this.binding=normalized;this.root.position.fromArray(normalized.position);this.root.rotation.set(...normalized.rotation);
    this.root.scale.fromArray(normalized.scale);this.update(0);return this.object;
  }
  update(dt=0){
    if(!this.root)return;
    this.time+=Math.max(0,Number(dt)||0)*this.binding.speed;
    const clip=this.model.animations.find(c=>c.id===this.binding.clip||c.name===this.binding.clip);
    // A static pilot asset starts in bind pose; retain its authored smooth normals.
    if((!this.root.userData.wrxVisualPilot&&!this.root.userData.automotiveMaterials.length)||clip)updateModelPose(this.root,this.model,{clip:clip?.id||null,time:this.time});
  }
  setAutomotiveEnvironment(profile,renderer){return applyAutomotiveEnvironment(this.root,profile,renderer);}
  dispose(){if(this.root){this.object.remove(this.root);disposeModelObject(this.root);}this.root=null;this.model=null;}
}
