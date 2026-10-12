import {normalizeModelBinding} from './ModelBinding.js';
export {normalizeModelBinding} from './ModelBinding.js';
import * as THREE from '../vendorBridge/three.js';
import {validateModelDocument} from './ModelDocument.js';
import {buildModelObject,disposeModelObject,updateModelPose} from './ModelRender.js';
import {loadProjectFile,hydrateProjectFilePayload} from '../ui/projectFiles.js';

// One loading cache per engine, shared by all placements of a saved model.
// Placements own geometry and pose; animating one never changes another.
export class ModelAssetLibrary {
  constructor({load=loadProjectFile,hydrate=hydrateProjectFilePayload}={}){
    this.load=load;this.hydrate=hydrate;this.entries=new Map();this.pending=new Map();this.errors=new Map();this.revision=0;
  }
  adopt(ref,payload){
    const document=payload?.data||payload;
    if(!document)return null;
    const previous=this.entries.get(ref);
    if(previous?.source===document)return previous.model;
    const model=validateModelDocument(structuredClone(document));
    this.entries.set(ref,{source:document,model,revision:++this.revision});this.errors.delete(ref);return model;
  }
  get(ref){
    if(!ref)return null;
    const local=this.load('models',ref);
    if(local){try{return this.adopt(ref,local);}catch(error){this.errors.set(ref,error);return null;}}
    if(this.entries.has(ref))return this.entries.get(ref).model;
    if(!this.pending.has(ref)&&!this.errors.has(ref))void this.prepare(ref).catch(()=>{});
    return null;
  }
  prepare(ref){
    if(!ref)return Promise.reject(Error('Select a saved 3D model'));
    if(this.pending.has(ref))return this.pending.get(ref);
    const request=Promise.resolve().then(async()=>{
      const payload=this.load('models',ref)||await this.hydrate('models',ref);
      if(!payload)throw Error(`3D model not found: ${ref}`);
      return this.adopt(ref,payload);
    }).catch(error=>{this.errors.set(ref,error);throw error;}).finally(()=>this.pending.delete(ref));
    this.pending.set(ref,request);return request;
  }
}
export const modelAssets=new ModelAssetLibrary();

// Local axes: +Y up, +Z forward; wheel axle along X. The placement's parent
// owns world position, car steering or actor facing. Binding rotation is radians.
export class ModelAssetInstance {
  constructor(){this.object=new THREE.Group();this.root=null;this.model=null;this.binding=null;this.time=0;}
  setModel(model,binding){
    const normalized=normalizeModelBinding(binding);if(!normalized)throw Error('Missing model reference');
    const changed=this.model!==model||this.binding?.ref!==normalized.ref;
    if(changed){
      if(this.root){this.object.remove(this.root);disposeModelObject(this.root);}
      this.root=buildModelObject(model);this.object.add(this.root);this.model=model;this.time=0;
    }
    if(this.binding?.clip!==normalized.clip)this.time=0;
    this.binding=normalized;this.root.position.fromArray(normalized.position);this.root.rotation.set(...normalized.rotation);
    this.root.scale.fromArray(normalized.scale);this.update(0);return this.object;
  }
  update(dt=0){
    if(!this.root)return;
    this.time+=Math.max(0,Number(dt)||0)*this.binding.speed;
    const clip=this.model.animations.find(c=>c.id===this.binding.clip||c.name===this.binding.clip);
    updateModelPose(this.root,this.model,{clip:clip?.id||null,time:this.time});
  }
  dispose(){if(this.root){this.object.remove(this.root);disposeModelObject(this.root);}this.root=null;this.model=null;}
}
