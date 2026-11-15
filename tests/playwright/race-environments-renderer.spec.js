// Independent production sky compositor evidence, NOT a driving/playability test.
import fs from 'node:fs';
import {test,expect} from '@playwright/test';
for(const mobile of [false,true])test(`independent sky compositor ${mobile?'handheld':'desktop'}`,async({page},info)=>{
 test.setTimeout(180000);
 const width=mobile?390:1280,height=mobile?240:480;
 await page.goto('/index.html?hideFullscreenForTesting');
 await page.waitForFunction(()=>window.__gameReady,null,{timeout:120000});
 const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
 for(const row of ledger.rows.filter(r=>r.binding)){
  const result=await page.evaluate(async({race,width,height})=>{
   const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');
   const e=window.__game.raceEditor,payload=await hydrateProjectFilePayload('races',race,{forceRefresh:true});
   e.selectedRace=e.normalizeLoadedRaceDocument(payload.data,race);
   const ref=e.getRaceSkyboxSettings().artRef;await e.hydrateRaceArt(ref);e.raceSkyboxRenderCache=null;
   const outputs=[];
   for(const yaw of [0,.25,.5,.75]){
    const c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d');
    const drawn=e.drawRaceSkyboxArt(ctx,{x:0,y:0,w:width,h:height},{horizon:height*.65,normalizedCameraYaw:yaw});
    outputs.push({yaw,drawn,png:c.toDataURL('image/png').split(',')[1]});
   }
   return {ref,outputs,authoredFx:e.getRaceRenderVisualFx()};
  },{race:row.raceRef,width,height});
  expect(result.ref).toBe(row.binding.skyboxArtRef);
  fs.mkdirSync(info.outputPath(),{recursive:true});
  for(const frame of result.outputs){expect(frame.drawn).toBe(true);fs.writeFileSync(info.outputPath(`${row.siteGroup}-${frame.yaw}.png`),Buffer.from(frame.png,'base64'));}
  fs.writeFileSync(info.outputPath(row.siteGroup+'-state.json'),JSON.stringify({race:row.raceRef,ref:result.ref,authoredFx:result.authoredFx,note:'Independent native sky compositor; no terrain, driving, weather overlay or route-wide acceptance.'},null,2));
 }
});
