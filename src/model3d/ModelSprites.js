import {ModelCanvasRenderer,getModelFrame} from './ModelRender.js';
import {modelAssets} from './ModelAssets.js';
import {normalizeModelBinding} from './ModelBinding.js';

// Level actors share one WebGL context. Render into the existing 2D pipeline,
// preserving its facing, damage effects, camera and collision dimensions.
export class ModelSpriteRenderer {
  constructor({library=modelAssets,renderer=new ModelCanvasRenderer({cacheSize:16})}={}){
    this.library=library;this.renderer=renderer;this.frames=new WeakMap();this.canvas=null;this.snapshots=new Map();
  }
  image(binding,time=0,{width=256,height=256}={}){
    const transform=normalizeModelBinding(binding);if(!transform)return null;
    const model=this.library.get(transform.ref);if(!model||typeof document==='undefined')return null;
    if(!this.canvas)this.canvas=document.createElement('canvas');
    const w=Math.max(1,Math.min(512,Math.round(width))),h=Math.max(1,Math.min(512,Math.round(height)));
    if(this.canvas.width!==w)this.canvas.width=w;if(this.canvas.height!==h)this.canvas.height=h;
    const ctx=this.canvas.getContext('2d');ctx.clearRect(0,0,w,h);
    if(!this.frames.has(model))this.frames.set(model,getModelFrame(model));
    this.renderer.framing=this.frames.get(model);
    const clip=model.animations.find(c=>c.id===transform.clip||c.name===transform.clip);
    const drawn=this.renderer.draw(ctx,{x:0,y:0,w,h},model,{view:'x',clip:clip?.id||null,time:time*transform.speed,transform});
    return drawn?this.canvas:null;
  }
  snapshot(binding,time=0,dimensions={}){
    const normalized=normalizeModelBinding(binding);if(!normalized)return null;
    const model=this.library.get(normalized.ref);if(!model)return null;
    const animated=Boolean(normalized.clip&&normalized.speed);
    const key=JSON.stringify([normalized,dimensions,animated?Math.floor(time*30):0]);
    const previous=this.snapshots.get(key);if(previous?.model===model)return previous.canvas;
    const source=this.image(normalized,animated?Math.floor(time*30)/30:0,dimensions);if(!source)return null;
    const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;canvas.getContext('2d').drawImage(source,0,0);
    this.snapshots.set(key,{model,canvas});while(this.snapshots.size>64)this.snapshots.delete(this.snapshots.keys().next().value);
    return canvas;
  }
  dispose(){this.snapshots.clear();this.renderer.dispose();this.canvas=null;this.frames=new WeakMap();}
}
export const modelSprites=new ModelSpriteRenderer();
