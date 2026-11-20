import {test,expect} from '@playwright/test';
import {installThumbnailBrowseWitness,expectThumbnailOnCanvas} from '../helpers/carThumbnailBrowseWitness.js';

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

// Shared-art phase-2 pilot: keyboard and touch picker-to-drive acceptance.
import '../helpers/carCatalogPlaceholderPickerCases.js';

import '../helpers/carCatalogPlaceholderWave02PickerCases.js';

import "../helpers/carCatalogPlaceholderWave03PickerCases.js";

import "../helpers/carCatalogPlaceholderWave04PickerCases.js";

import "../helpers/carCatalogPlaceholderWave05PickerCases.js";

import "../helpers/carCatalogPlaceholderWave06PickerCases.js";
// Register the two Tutsan paged-picker/input cases in staging catalog CI.
import "../helpers/tutsanStaticPickerCases.js";

import "../helpers/carCatalogPlaceholderWave07PickerCases.js";

import "../helpers/carCatalogPlaceholderWave08PickerCases.js";

// Full navigation coverage remains separate from each car's bounded setup and real drive.
import '../helpers/carCatalogPickerTraversalCases.js';

import '../helpers/carCatalogPlaceholderWave09PickerCases.js';

import '../helpers/carCatalogPlaceholderWave10PickerCases.js';

import '../helpers/carCatalogPlaceholderWave11PickerCases.js';

import '../helpers/carCatalogPlaceholderWave12PickerCases.js';

import '../helpers/carCatalogPlaceholderWave13PickerCases.js';

import '../helpers/carCatalogPlaceholderWave14PickerCases.js';

import '../helpers/carCatalogPlaceholderWave15PickerCases.js';

import '../helpers/carCatalogPlaceholderWave16PickerCases.js';

import '../helpers/carCatalogPlaceholderWave17PickerCases.js';

import '../helpers/carCatalogPlaceholderWave18PickerCases.js';

const names=['2005 Flint Coupe','2018 Kestrel 660','2023 Volt-Hound GT','2024 Caravan-9'];
async function holdImage(context,expectedPath){
  const held=new Set();let release;
  const waiting=new Promise(resolve=>{release=resolve;});
  await context.route(url=>url.pathname===expectedPath,async route=>{
    held.add(new URL(route.request().url()).pathname);
    await waiting;
    await route.continue();
  });
  // Track the retired fake-car fill only on the two actual preview surfaces.
  await context.addInitScript(()=>{
    window.__fakeCarFills=0;
    window.__paintedStockPosters=new Set();
    const drawImage=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args){
      const result=drawImage.call(this,image,...args);
      if(this.canvas===window.__game?.canvas&&image instanceof HTMLImageElement&&image.naturalWidth>0&&args.length===8){
        const path=new URL(image.currentSrc||image.src).pathname;
        if(path.endsWith('-poster.webp'))window.__paintedStockPosters.add(path);
      }
      return result;
    };
    const original=CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.fill=function(...args){
      if(this.fillStyle==='#73848e'&&(this.canvas===window.__game?.canvas||this.canvas.closest('.project-browser-art-preview')))window.__fakeCarFills++;
      return original.apply(this,args);
    };
  });
  return {held,release};
}

test('car selector does not show a fake car while real stock previews load',async({browser})=>{
  test.setTimeout(120000);
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(()=>Object.defineProperty(navigator,'userAgentData',{value:{mobile:true}}));
  const qa=await installThumbnailBrowseWitness(context);
  const target=names[0],path='/'+qa.thumb.previews[qa.thumb.carsByName[target]].url;
  const net=await holdImage(context,path);
  try{
    const page=await context.newPage();
    await page.goto('/index.html?hideFullscreenForTesting');
    await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
    await page.evaluate(async target=>{
      const {createMenuDocument}=await import('/src/menus/MenuDocument.js');
      const g=window.__game;g.setDisplayMode('color');
      const doc=createMenuDocument();doc.parameters.carRef=target;
      // Scope the in-memory selection to this context before ordinary screen opening.
      g.menuProgress={...g.menuProgress,carRef:target};
      await g.menuPlayer.open(doc,{preview:true,screenId:'cars'});
    },target);
    const selected=await page.evaluate(()=>window.__game.menuPlayer.flow.parameters.carRef);
    expect(selected).toBe(target);
    await expect.poll(()=>net.held.has(path),{timeout:30000}).toBe(true);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    expect(await page.evaluate(()=>window.__fakeCarFills)).toBe(0);
    qa.assertBrowseCold();
    net.release();
    for(const name of names)await expectThumbnailOnCanvas(page,qa,name,{selected:name===selected});
    qa.assertBrowseCold();
  }finally{net.release();await context.close();}
});

for(const mode of ['open','saveAs'])test('Cars '+mode+' stays blank until the actual poster is ready',async({browser})=>{
  test.setTimeout(120000);
  const context=await browser.newContext({serviceWorkers:'block'});
  const qa=await installThumbnailBrowseWitness(context);
  const target=names[0],path='/'+qa.thumb.previews[qa.thumb.carsByName[target]].poster.url;
  const net=await holdImage(context,path);
  try{
    const page=await context.newPage();
    await page.goto('/index.html?hideFullscreenForTesting');
    await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
    await page.evaluate(async mode=>{
      const {openProjectBrowser}=await import('/src/ui/ProjectBrowserModal.js');
      void openProjectBrowser({fixedFolder:'cars',mode});
    },mode);
    const name=names[0];
    await page.getByRole('button',{name:'Search',exact:true}).click();
    await page.getByPlaceholder('Search in folder...').fill(name);
    const canvas=page.locator('.project-browser-row[data-name="2005 Flint Coupe"] .project-browser-art-preview canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(()=>net.held.has(path),{timeout:30000}).toBe(true);
    const opaque=()=>canvas.evaluate(el=>{
      const data=el.getContext('2d').getImageData(0,0,el.width,el.height).data;
      let count=0;for(let i=3;i<data.length;i+=4)if(data[i]>128)count++;
      return count;
    });
    expect(await opaque()).toBe(0);
    expect(await page.evaluate(()=>window.__fakeCarFills)).toBe(0);
    qa.assertBrowseCold();
    net.release();
    await expect.poll(opaque,{timeout:30000}).toBeGreaterThan(100);
    qa.assertBrowseCold();
  }finally{net.release();await context.close();}
});

test('campaign Load Save stays blank until the slot poster is ready',async({browser})=>{
  test.setTimeout(120000);
  const context=await browser.newContext({serviceWorkers:'block'});
  const qa=await installThumbnailBrowseWitness(context);
  const target=names[0],path='/'+qa.thumb.previews[qa.thumb.carsByName[target]].poster.url;
  const net=await holdImage(context,path);
  try{
    const page=await context.newPage();
    await page.goto('/index.html?hideFullscreenForTesting');
    await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
    const name=names[0];
    await page.evaluate(async name=>{
      const {createMenuDocument}=await import('/src/menus/MenuDocument.js');
      const {CampaignSaves}=await import('/src/menus/CampaignSaves.js');
      const g=window.__game;g.setDisplayMode('color');
      await g.menuPlayer.open(createMenuDocument(),{preview:true,screenId:'splash'});
      // Seed a slot in memory only and enter the real campaign save chooser.
      g.campaignSaves??=new CampaignSaves(g);
      g.campaignSaves.slots[0]={summary:{car:name,condition:71},playTimeSeconds:2};
      g.menuPlayer.showSaveSlots('start');
    },name);
    await expect.poll(()=>net.held.has(path),{timeout:30000}).toBe(true);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    expect(await page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('saves-start');
    expect(await page.evaluate(()=>window.__fakeCarFills)).toBe(0);
    expect(await page.evaluate(path=>window.__paintedStockPosters.has(path),path)).toBe(false);
    qa.assertBrowseCold();
    net.release();
    await expect.poll(()=>page.evaluate(path=>window.__paintedStockPosters.has(path),path),{timeout:30000}).toBe(true);
    qa.assertBrowseCold();
  }finally{net.release();await context.close();}
});
