// Independent production sky compositor evidence, NOT a driving/playability test.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {test,expect} from '@playwright/test';
import {resolveDiagnosticRaceChoice,assertRequestedRaceCoverage} from '../../tools/race-environments/selector.mjs';
const compact=process.env.RACE_RENDER_COMPACT==='1',extension=compact?'jpg':'png';
const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
const requested=process.env.RACE_RENDER_NAMES?.split('|');
// Diagnostic-only override never writes saved documents or changes authored effects.
const diagnosticRef=process.env.RACE_RENDER_DIAGNOSTIC_REF;
if(diagnosticRef&&requested?.length!==1)throw Error('Diagnostic art comparison requires exactly one named race');
const selected=ledger.rows.filter(r=>r.binding&&(!requested||requested.includes(r.raceRef))&&(!process.env.RACE_RENDER_PACK||r.environmentPack===process.env.RACE_RENDER_PACK));
assertRequestedRaceCoverage(selected,requested);
const deviceModes=process.env.RACE_RENDER_DEVICES==='desktop'?[false]:[false,true];
for(const selectedRow of selected)for(const mobile of deviceModes)test(`${selectedRow.raceRef} independent sky ${mobile?'handheld':'desktop'}`,async({page},info)=>{
 test.setTimeout(180000);
 const width=mobile?390:1280,height=mobile?240:480;
 await page.goto('/index.html?hideFullscreenForTesting');
 await page.waitForFunction(()=>window.__gameReady&&!window.__game.loading,null,{timeout:120000});
 for(const row of [selectedRow]){
  let document=JSON.parse(fs.readFileSync('data/server-storage/files/'+row.documentPath));if(document.__chainsawStorage)document=JSON.parse(gunzipSync(Buffer.from(document.data,'base64')));
  if(diagnosticRef){document.race.skyboxArtRef=diagnosticRef;document.race.skyboxSettings={...document.race.skyboxSettings,artRef:diagnosticRef};}
  const result=await page.evaluate(async({race,documentPath,raceDocument,width,height,compact})=>{
   const e=window.__game.raceEditor;
   if(!e.applyLoadedRaceDocument(raceDocument,{name:race}))throw Error('Independent race object load failed: '+race);
   const {roadTextureSettings,shoulderTextureForSegment}=await import('/src/racing/RaceRoadTextures.js');
   const {skyVisibilityOpacity}=await import('/src/racing/WeatherVisibility.js');
   const map=e.selectedRace.road.tileMap,tileImageCounts={},tileImageById={};for(const cell of Object.values(map?.cells||{})){const image=cell.artRef||cell.tileArtRef||e.getRaceSurfaceArtRefForSlot(cell.tileId||map.defaultTileId||'grass')||e.getRaceDefaultGroundArtRef(cell.tileId,cell.tileWeights,map)||'[procedural/default tile]';tileImageCounts[image]=(tileImageCounts[image]||0)+1;const id=cell.tileId||map.defaultTileId||'grass';tileImageById[id]??={};tileImageById[id][image]=(tileImageById[id][image]||0)+1;}
   const surfaceSamples=[...new Map([...e.selectedRace.road.segments,...(e.selectedRace.road.network?.edges||[])].map(s=>[s.surface,s])).values()].map(s=>({surface:s.surface,shoulder:shoulderTextureForSegment(e.selectedRace.roadTextures,s),surfaceArt:e.getRaceSurfaceArtRefForSurface(s.surface)}));
   const effectiveLayers={tileImageCounts,tileImageById,road:roadTextureSettings(e.selectedRace),surfaceSamples,margin:e.selectedRace.margin,ground:e.selectedRace.groundPlaneArtRef};
   const {hydrateServerStorage}=await import('/src/ui/serverStorage.js');await hydrateServerStorage({folder:'races'});
   const selectorChoices=window.__game.menuPlayer.resources.choices('races',{});
   const ref=e.getRaceSkyboxSettings().artRef;await e.hydrateRaceArt(ref);e.raceSkyboxRenderCache=null;
   const outputs=[];const stats=c=>{const px=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let min=255,max=0,sum=0,n=0;for(let i=0;i<px.length;i+=4)for(let j=0;j<3;j++){const v=px[i+j];min=Math.min(min,v);max=Math.max(max,v);sum+=v;n++;}return {min,max,mean:sum/n};};const controls=[];
   for(const yaw of [-.01,0,.01,Math.PI/2,Math.PI,Math.PI*1.5]){
    const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');
    const drawn=e.drawRaceSkyboxArt(ctx,{x:0,y:0,w:width,h:height},{horizon:height*.65,normalizedCameraYaw:yaw});
    const png=c.toDataURL(compact?'image/jpeg':'image/png',.78).split(',')[1];let authoredPng=null;if(yaw===0){e.drawRaceParallaxBackground(ctx,{x:0,y:0,w:width,h:height},{horizon:height*.65,cameraYaw:yaw,suppressGroundFill:true});authoredPng=c.toDataURL(compact?'image/jpeg':'image/png',.78).split(',')[1];}outputs.push({yaw,drawn,png,authoredPng});
   }
   // Matched known-existing staging sky: same authored weather, brightness,
   // bounds and yaw. Only a temporary diagnostic art binding changes, restored below.
   for(const artRef of [ref,'providence']){
    await e.hydrateRaceArt(artRef);const saved=e.selectedRace.skyboxSettings.artRef,savedDirect=e.selectedRace.skyboxArtRef;
    e.selectedRace.skyboxSettings.artRef=artRef;e.selectedRace.skyboxArtRef=artRef;e.raceSkyboxRenderCache=null;if(e.getRaceSkyboxSettings().artRef!==artRef)throw Error('Diagnostic binding mismatch');
    const c=document.createElement('canvas');c.width=width;c.height=height;
    const ctx=c.getContext('2d');const rawDrawn=e.drawRaceSkyboxArt(ctx,{x:0,y:0,w:width,h:height},{horizon:height*.65,normalizedCameraYaw:0});const rawStats=stats(c);
    e.drawRaceParallaxBackground(ctx,{x:0,y:0,w:width,h:height},{horizon:height*.65,cameraYaw:0,suppressGroundFill:true});
    controls.push({artRef,rawDrawn,rawStats,compositeStats:stats(c),png:c.toDataURL(compact?'image/jpeg':'image/png',.78).split(',')[1]});
    e.selectedRace.skyboxSettings.artRef=saved;e.selectedRace.skyboxArtRef=savedDirect;e.raceSkyboxRenderCache=null;
   }
   // Explicit diagnostic authorization: 100% sky brightness ONLY, same yaw,
   // viewport and weather. Raw sky-only capture additionally omits fog by calling
   // the native art compositor directly; this is never a release default.
   const savedFx=structuredClone(e.selectedRace.visualFx),savedWeather=JSON.stringify(e.getRaceWeatherState());
   const diagnostic={};
   try{
    e.selectedRace.visualFx={...e.selectedRace.visualFx,skyBrightness:1};
    for(const mode of ['sky100-authored-weather','sky100-raw-no-fog']){
     const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');
     if(mode==='sky100-authored-weather')e.drawRaceParallaxBackground(ctx,{x:0,y:0,w:width,h:height},{horizon:height*.65,cameraYaw:0,suppressGroundFill:true});
     else if(!e.drawRaceSkyboxArt(ctx,{x:0,y:0,w:width,h:height},{horizon:height*.65,normalizedCameraYaw:0}))throw Error('Diagnostic raw sky missing');
     diagnostic[mode]={stats:stats(c),png:c.toDataURL(compact?'image/jpeg':'image/png',.78).split(',')[1]};
    }
    for(const horizonRatio of [.35,.8])for(const yaw of [-.01,.01]){
     const hillPitch=horizonRatio<.5?-.2:.2;
     const c=document.createElement('canvas');c.width=width;c.height=height;
     if(!e.drawRaceSkyboxArt(c.getContext('2d'),{x:0,y:0,w:width,h:height},{horizon:height*horizonRatio,normalizedCameraYaw:yaw,hillPitch}))throw Error('Pitch/wrap diagnostic missing');
     diagnostic[`pitch-${horizonRatio}-yaw-${yaw}`]={horizonRatio,hillPitch,yaw,stats:stats(c),png:c.toDataURL(compact?'image/jpeg':'image/png',.78).split(',')[1]};
    }
   }finally{e.selectedRace.visualFx=savedFx;}
   if(JSON.stringify(e.getRaceWeatherState())!==savedWeather)throw Error('Diagnostic changed weather');
   const weather=e.getRaceWeatherState(),opacity=skyVisibilityOpacity(weather.visibilityDistanceM),fx=e.getRaceRenderVisualFx();
   return {ref,selectorChoices,outputs,controls,diagnostic,weather,visibilityOpacity:opacity,maximumArtworkContrast:255*(1-opacity)*fx.skyBrightness,compositeTargetRedirected:!!e.raceSkyboxCompositeTarget,authoredFx:fx,effectiveLayers};
  },{race:row.raceRef,documentPath:row.documentPath,raceDocument:document.race,width,height,compact});
  result.selector=resolveDiagnosticRaceChoice(result.selectorChoices,row.raceRef,row.documentPath);
  expect(result.ref).toBe(diagnosticRef||row.binding.skyboxArtRef);
  fs.mkdirSync(info.outputPath(),{recursive:true});
  for(const frame of result.outputs){expect(frame.drawn).toBe(true);fs.writeFileSync(info.outputPath(`${row.siteGroup}-${frame.yaw}.${extension}`),Buffer.from(frame.png,'base64'));if(frame.authoredPng)fs.writeFileSync(info.outputPath(`${row.siteGroup}-authored-composite.${extension}`),Buffer.from(frame.authoredPng,'base64'));}
  for(const [mode,frame]of Object.entries(result.diagnostic)){fs.writeFileSync(info.outputPath(`${row.siteGroup}-${mode}.${extension}`),Buffer.from(frame.png,'base64'));delete frame.png;}
  for(const control of result.controls){expect(control.rawDrawn).toBe(true);fs.writeFileSync(info.outputPath(`${row.siteGroup}-matched-${control.artRef}.${extension}`),Buffer.from(control.png,'base64'));delete control.png;}
  fs.writeFileSync(info.outputPath(row.siteGroup+'-state.json'),JSON.stringify({race:row.raceRef,diagnosticOverride:diagnosticRef||null,savedRef:row.binding.skyboxArtRef,imageFormat:extension,selector:result.selector,ref:result.ref,controls:result.controls,diagnostic:result.diagnostic,weather:result.weather,visibilityOpacity:result.visibilityOpacity,maximumArtworkContrast:result.maximumArtworkContrast,compositeTargetRedirected:result.compositeTargetRedirected,authoredFx:result.authoredFx,effectiveLayers:result.effectiveLayers,note:'Independent native sky compositor from exact stored race object; deliberately not storage transport, terrain, driving, weather overlay or route-wide acceptance.'},null,2));
 }
 for(const ref of [...new Set([selectedRow].map(r=>r.binding?.groundPlaneArtRef).filter(Boolean))]){
  const png=await page.evaluate(async({ref,compact})=>{const e=window.__game.raceEditor;await e.hydrateRaceArt(ref);const art=e.getRaceArtSpriteCanvas(ref);if(!art)throw Error('Missing ground '+ref);const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;for(let y=0;y<2;y++)for(let x=0;x<2;x++)ctx.drawImage(art,x*256,y*256,256,256);return c.toDataURL(compact?'image/jpeg':'image/png',.78).split(',')[1];},{ref,compact});
  fs.writeFileSync(info.outputPath(ref+'-native-tile-repeat.'+extension),Buffer.from(png,'base64'));
 }

});
