import {test,expect} from '@playwright/test';

test('catalog pilot hydrates published art and renders eight body angles plus dashboard',async({page},testInfo)=>{
 test.setTimeout(120_000);
 await page.setViewportSize({width:1280,height:1000});
 await page.goto('/index.html?hideFullscreenForTesting');
 await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 const result=await page.evaluate(async()=>{
  const {hydrateProjectFilePayload,loadProjectFile}=await import('/src/ui/projectFiles.js');
  const g=window.__game;g.enterCarEditor();g.setDisplayMode('color');
  const e=g.carEditor;
  const saved=await hydrateProjectFilePayload('cars','2018 Kestrel 660',{forceRefresh:true});
  if(!saved?.data)throw Error('Published pilot car failed to hydrate');
  e.applyLoadedCarDocument(saved.data,{name:'2018 Kestrel 660'});
  const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
  const layers=slots.map(slot=>({label:slot,...e.selectedCar.art.angleLayers[slot].body}));
  layers.push({label:'dashboard',...e.selectedCar.art.interior.dashboard});
  layers.push({label:'shared steering wheel',...e.selectedCar.art.interior.steeringWheel});
  // Explicitly await the application's asynchronous loader. A synchronous cache
  // lookup can return null on cold loads and must never be our loading test.
  for(const ref of new Set(layers.map(l=>l.artRef))){
   const payload=await hydrateProjectFilePayload('art',ref,{forceRefresh:true});
   if(!payload?.data)throw Error(`Published art missing: ${ref}`);
   await e.hydrateRaceArt(ref);
  }
  const contact=document.createElement('canvas');contact.id='catalog-art-contact';
  contact.width=1200;contact.height=920;
  const ctx=contact.getContext('2d');ctx.fillStyle='#252c36';ctx.fillRect(0,0,contact.width,contact.height);
  const stats=layers.map((layer,index)=>{
   const sprite=e.getRaceArtSpriteCanvas(layer.artRef,{frameIndex:layer.frameIndex});
   if(!sprite)throw Error(`Renderer returned no canvas: ${layer.label}`);
   const pixels=sprite.getContext('2d').getImageData(0,0,sprite.width,sprite.height).data;
   let opaque=0,transparent=0,checksum=2166136261;
   for(let i=0;i<pixels.length;i++)checksum=Math.imul(checksum^pixels[i],16777619)>>>0;
   for(let i=3;i<pixels.length;i+=4){if(pixels[i])opaque++;else transparent++;}
   const box=index<8?{x:index%4*300,y:Math.floor(index/4)*250,w:300,h:250}:index===8?{x:0,y:500,w:900,h:420}:{x:900,y:500,w:300,h:420};
   ctx.fillStyle='#fff';ctx.font='18px sans-serif';ctx.fillText(`${layer.label} [frame ${layer.frameIndex}]`,box.x+10,box.y+24);
   const scale=Math.min((box.w-20)/sprite.width,(box.h-44)/sprite.height);
   ctx.drawImage(sprite,box.x+(box.w-sprite.width*scale)/2,box.y+36,sprite.width*scale,sprite.height*scale);
   return {label:layer.label,width:sprite.width,height:sprite.height,opaque,transparent,checksum};
  });
  const host=document.createElement('div');host.id='catalog-contact-host';
  Object.assign(host.style,{position:'fixed',inset:'0',zIndex:'2147483647',background:'#252c36',overflow:'auto'});
  host.append(contact);document.body.append(host);
  return {id:e.selectedCar.id,frames:slots.map(s=>e.selectedCar.art.angleLayers[s].body.frameIndex),wheel:e.selectedCar.art.interior.steeringWheel.artRef,stats,bodyFrames:loadProjectFile('art',layers[0].artRef,{allowSyncFetch:false}).data.frames.length};
 });
 expect(result.id).toBe('kestrel-660-2018');
 expect(result.frames).toEqual([0,7,2,3,4,5,6,1]);
 expect(result.bodyFrames).toBe(8);expect(result.wheel).toBe('steeringwheel');
 expect(result.stats).toHaveLength(10);
 for(const s of result.stats){expect(s.width).toBeGreaterThan(10);expect(s.height).toBeGreaterThan(10);expect(s.opaque).toBeGreaterThan(100);expect(s.transparent).toBeGreaterThan(0);}
 expect(new Set(result.stats.slice(0,8).map(s=>s.checksum)).size).toBe(8);
 const screenshot=await page.locator('#catalog-art-contact').screenshot({path:testInfo.outputPath('catalog-pilot-contact.png')});
 await testInfo.attach('catalog-pilot-contact',{body:screenshot,contentType:'image/png'});
 await testInfo.attach('catalog-pilot-render-stats',{body:Buffer.from(JSON.stringify(result,null,2)),contentType:'application/json'});
 // This is an asset-render smoke test, not a claim of collision/handling QA.
});
