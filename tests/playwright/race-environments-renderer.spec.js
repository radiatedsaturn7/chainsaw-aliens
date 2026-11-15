// Independent production sky compositor evidence, NOT a driving/playability test.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`independent sky compositor ${mobile?'handheld':'desktop'}`,async({page},info)=>{
 test.setTimeout(180000);
 const width=mobile?390:1280,height=mobile?240:480;
 await page.goto('/index.html?hideFullscreenForTesting');
 await page.waitForFunction(()=>window.__gameReady&&!window.__game.loading,null,{timeout:120000});
 const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
 const requested=process.env.RACE_RENDER_NAMES?.split('|');
 for(const row of ledger.rows.filter(r=>r.binding&&(!requested||requested.includes(r.raceRef)))){
  let document=JSON.parse(fs.readFileSync('data/server-storage/files/'+row.documentPath));if(document.__chainsawStorage)document=JSON.parse(gunzipSync(Buffer.from(document.data,'base64')));
  const result=await page.evaluate(async({race,raceDocument,width,height})=>{
   const e=window.__game.raceEditor;
   if(!e.applyLoadedRaceDocument(raceDocument,{name:race}))throw Error('Independent race object load failed: '+race);
   const {roadTextureSettings,shoulderTextureForSegment}=await import('/src/racing/RaceRoadTextures.js');
   const {skyVisibilityOpacity}=await import('/src/racing/WeatherVisibility.js');
   const map=e.selectedRace.road.tileMap,tileImageCounts={};for(const cell of Object.values(map?.cells||{})){const image=cell.artRef||cell.tileArtRef||e.getRaceSurfaceArtRefForSlot(cell.tileId||map.defaultTileId||'grass')||e.getRaceDefaultGroundArtRef(cell.tileId,cell.tileWeights,map)||'[procedural/default tile]';tileImageCounts[image]=(tileImageCounts[image]||0)+1;}
   const surfaceSamples=[...new Map(e.selectedRace.road.segments.map(s=>[s.surface,s])).values()].map(s=>({surface:s.surface,shoulder:shoulderTextureForSegment(e.selectedRace.roadTextures,s),surfaceArt:e.getRaceSurfaceArtRefForSurface(s.surface)}));
   const effectiveLayers={tileImageCounts,road:roadTextureSettings(e.selectedRace),surfaceSamples,margin:e.selectedRace.margin,ground:e.selectedRace.groundPlaneArtRef};
   const choices=window.__game.menuPlayer.resources.choices('races',{});if(!choices.some(x=>x.value===race))throw Error('Not exposed by runtime race selector: '+race);
   const ref=e.getRaceSkyboxSettings().artRef;await e.hydrateRaceArt(ref);e.raceSkyboxRenderCache=null;
   const outputs=[];const stats=c=>{const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let min=255,max=0,sum=0,n=0;for(let i=0;i<px.length;i+=4)for(let j=0;j<3;j++){const v=px[i+j];min=Math.min(min,v);max=Math.max(max,v);sum+=v;n++;}return {min,max,mean:sum/n};};const controls=[];
   for(const yaw of [-.01,0,.01,Math.PI/2,Math.PI,Math.PI*1.5]){
    const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');
    const drawn=e.drawRaceSkyboxArt(ctx,{x:0,y:0,w:width,h:height},{horizon:height*.65,normalizedCameraYaw:yaw});
    const png=c.toDataURL('image/png').split(',')[1];let authoredPng=null;if(yaw===0){e.drawRaceParallaxBackground(ctx,{x:0,y:0,w:width,h:height},{horizon:height*.65,cameraYaw:yaw,suppressGroundFill:true});authoredPng=c.toDataURL('image/png').split(',')[1];}outputs.push({yaw,drawn,png,authoredPng});
   }
   // Matched known-existing staging sky: same authored weather, brightness,
   // bounds and yaw. Only a temporary diagnostic art binding changes, restored below.
   for(const artRef of [ref,'providence']){
    await e.hydrateRaceArt(artRef);const saved=e.selectedRace.skyboxSettings.artRef,savedDirect=e.selectedRace.skyboxArtRef;
    e.selectedRace.skyboxSettings.artRef=artRef;e.selectedRace.skyboxArtRef=artRef;e.raceSkyboxRenderCache=null;if(e.getRaceSkyboxSettings().artRef!==artRef)throw Error('Diagnostic binding mismatch');
    const c=document.createElement('canvas');c.width=width;c.height=height;
    const ctx=c.getContext('2d');const rawDrawn=e.drawRaceSkyboxArt(ctx,{x:0,y:0,w:width,h:height},{horizon:height*.65,normalizedCameraYaw:0});const rawStats=stats(c);
    e.drawRaceParallaxBackground(ctx,{x:0,y:0,w:width,h:height},{horizon:height*.65,cameraYaw:0,suppressGroundFill:true});
    controls.push({artRef,rawDrawn,rawStats,compositeStats:stats(c),png:c.toDataURL('image/png').split(',')[1]});
    e.selectedRace.skyboxSettings.artRef=saved;e.selectedRace.skyboxArtRef=savedDirect;e.raceSkyboxRenderCache=null;
   }
   const weather=e.getRaceWeatherState(),opacity=skyVisibilityOpacity(weather.visibilityDistanceM),fx=e.getRaceRenderVisualFx();
   return {ref,outputs,controls,weather,visibilityOpacity:opacity,maximumArtworkContrast:255*(1-opacity)*fx.skyBrightness,compositeTargetRedirected:!!e.raceSkyboxCompositeTarget,authoredFx:fx,effectiveLayers};
  },{race:row.raceRef,raceDocument:document.race,width,height});
  expect(result.ref).toBe(row.binding.skyboxArtRef);
  fs.mkdirSync(info.outputPath(),{recursive:true});
  for(const frame of result.outputs){expect(frame.drawn).toBe(true);fs.writeFileSync(info.outputPath(`${row.siteGroup}-${frame.yaw}.png`),Buffer.from(frame.png,'base64'));if(frame.authoredPng)fs.writeFileSync(info.outputPath(`${row.siteGroup}-authored-composite.png`),Buffer.from(frame.authoredPng,'base64'));}
  for(const control of result.controls){expect(control.rawDrawn).toBe(true);fs.writeFileSync(info.outputPath(`${row.siteGroup}-matched-${control.artRef}.png`),Buffer.from(control.png,'base64'));delete control.png;}
  fs.writeFileSync(info.outputPath(row.siteGroup+'-state.json'),JSON.stringify({race:row.raceRef,ref:result.ref,controls:result.controls,weather:result.weather,visibilityOpacity:result.visibilityOpacity,maximumArtworkContrast:result.maximumArtworkContrast,compositeTargetRedirected:result.compositeTargetRedirected,authoredFx:result.authoredFx,effectiveLayers:result.effectiveLayers,note:'Independent native sky compositor from exact stored race object; deliberately not storage transport, terrain, driving, weather overlay or route-wide acceptance.'},null,2));
 }
 for(const ref of [...new Set(ledger.rows.map(r=>r.binding?.groundPlaneArtRef).filter(Boolean))]){
  const png=await page.evaluate(async ref=>{const e=window.__game.raceEditor;await e.hydrateRaceArt(ref);const art=e.getRaceArtSpriteCanvas(ref);if(!art)throw Error('Missing ground '+ref);const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;for(let y=0;y<2;y++)for(let x=0;x<2;x++)ctx.drawImage(art,x*256,y*256,256,256);return c.toDataURL('image/png').split(',')[1];},ref);
  fs.writeFileSync(info.outputPath(ref+'-native-tile-repeat.png'),Buffer.from(png,'base64'));
 }

});
