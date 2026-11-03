import {resolveMenuBackground} from './MenuDocument.js';
import {menuElementVisible} from './MenuLayout.js';
import {drawMenuScreen} from './MenuRenderer.js';
import {listProjectFiles,loadProjectFile,hydrateProjectFilePayload} from '../ui/projectFiles.js';
import {getArtDocumentFrames} from '../ui/shared/artDocumentPixels.js';
import {getRaceArtSpriteCanvasShared} from '../ui/shared/raceArtSpriteCanvas.js';

const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
// Returns null without a drawing surface (headless callers); otherwise resolves
// only after first-frame dependencies and exterior car views have been decoded.
export function prepareMenuScreen(resources,document,screen,parameters,{bounds={x:0,y:0,w:960,h:540},isCurrent=()=>true}={}){
  const canvas=globalThis.document?.createElement?.('canvas'),ctx=canvas?.getContext?.('2d');
  if(!ctx?.fillRect||!ctx?.measureText)return null;
  canvas.width=Math.max(1,Math.ceil(bounds.w));canvas.height=Math.max(1,Math.ceil(bounds.h));
  return (async()=>{
    const resolved=resolveMenuBackground(document,screen,parameters);
    const elements=screen.elements.filter(e=>menuElementVisible(e,screen.elements));
    const refs=new Set([resolved.backgroundArt]);
    for(const e of elements){
      refs.add(e.artRef);refs.add(e.cursorArtRef);
      for(const node of e.nodes||[])for(const key of ['artRef','selectedArtRef','disabledArtRef'])refs.add(node[key]);
      resources.font(e.useDefaultFont?document.defaultFont||e:e);resources.cursor(e);
    }
    const art=ref=>resources.request(`art:${ref}`,()=>resources.prepareArt(ref));
    const visualLoads=[...refs].filter(Boolean).map(art);
    const carRefs=new Set();
    if(elements.some(e=>e.type==='car-showroom')){
      // Enumeration must never issue synchronous XHR while drawing the fade.
      await Promise.all(listProjectFiles('cars',{includeSystem:true}).map(entry=>resources.request(`car:${entry.name}`,async()=>{
        if(!loadProjectFile('cars',entry.name,{allowSyncFetch:false}))await hydrateProjectFilePayload('cars',entry.name);
      })));
      for(const choice of resources.choices('cars',document,parameters))carRefs.add(choice.value);
    }
    for(const e of elements)if(e.type.startsWith('car-')||(['property-display','asset-preview'].includes(e.type)&&e.dataSource==='cars')){
      const ref=e.assetRef||parameters[e.binding];if(typeof ref==='string'&&ref)carRefs.add(ref);
    }
    await Promise.all(visualLoads);
    const missing=[...refs].filter(ref=>ref&&resources.errors.has(`art:${ref}`));
    if(missing.length)throw Error(`Artwork unavailable: ${missing.join(', ')}`);
    // Fetch the page together rather than serializing four cars' requests.
    for(const ref of carRefs)resources.car(ref);
    await Promise.all([...resources.pending.values()]);
    for(const ref of carRefs)resources.car(ref);
    await Promise.all([...resources.pending.values()]);
    const preparedRefs=new Set();
    for(const ref of carRefs){
      if(!isCurrent())return;
      const readyCar=resources.car(ref);if(!readyCar)continue;
      for(const artRef of resources.exteriorArtRefs(readyCar)){
        if(!isCurrent())return;
        if(preparedRefs.has(artRef))continue;preparedRefs.add(artRef);
        await art(artRef);
        const data=loadProjectFile('art',artRef,{allowSyncFetch:false})?.data;
        const count=getArtDocumentFrames(data).frames.length||1;
        for(let frameIndex=0;frameIndex<count;frameIndex++){
          getRaceArtSpriteCanvasShared(artRef,{frameIndex,cache:resources.game.carEditor.raceArtSpriteCache,allowSyncFetch:false});
          await yieldFrame();
          if(!isCurrent())return;
        }
      }
    }
    // Drawing may discover dependent assets (garage-installed tires, map race
    // descriptions, embedded fonts). Resolve them before revealing the screen.
    const priorErrors=new Set(resources.errors.keys());
    for(let pass=0;isCurrent();pass++){
      ctx.clearRect(0,0,canvas.width,canvas.height);
      drawMenuScreen(ctx,{x:0,y:0,w:bounds.w,h:bounds.h},document,screen,parameters,{resources,time:0});
      const appearance=[...resources.appearance.fonts.values(),...resources.appearance.images.values()];
      const appearanceError=appearance.find(f=>f.error);if(appearanceError)throw appearanceError.error;
      const pending=[...resources.pending.values(),...appearance.filter(f=>!f.ready).map(f=>f.pending).filter(Boolean)];
      const failed=[...resources.errors].filter(([key])=>!priorErrors.has(key)||refs.has(key.replace(/^art:/,'')));
      if(failed.length)throw Error(failed.map(([,error])=>error).join(', '));
      if(!pending.length)return;
      if(pass>=32)throw Error('Menu resources did not finish preparing');
      await Promise.all(pending);await yieldFrame();
    }
  })().finally(()=>{canvas.width=1;canvas.height=1;});
}
