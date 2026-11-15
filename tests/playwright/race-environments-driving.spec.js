// Bounded real travel/drive evidence. Never overrides lighting, weather or deadlines.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {steeringIntent} from '../../tools/race-environments/driving-controls.mjs';
import {test,expect,devices} from '@playwright/test';
import {resolveDiagnosticRaceChoice} from '../../tools/race-environments/selector.mjs';
const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json'));
const names=(process.env.RACE_DRIVE_NAMES||'Willow Springs — Horse Thief Mile|Daytona Tri-Oval').split('|');
for(const name of names)for(const mobile of [false,true])test.describe(`${name} ${mobile?'handheld':'desktop'}`,()=>{
 test.use({viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile,...(mobile?{userAgent:devices['iPhone 13'].userAgent}:{})});
 test('real authored foreground and sky',async({page},info)=>{
  test.setTimeout(300000);const row=structuredClone(ledger.rows.find(r=>r.raceRef===name));expect(row?.binding).toBeTruthy();
  const baseline=process.env.RACE_DRIVE_BASE_COMMIT;
  if(baseline){
   const commit=execFileSync('git',['rev-parse',baseline],{encoding:'utf8'}).trim();expect(commit).toBe(baseline);
   let doc=JSON.parse(execFileSync('git',['show',`${commit}:data/server-storage/files/${row.documentPath}`],{maxBuffer:40e6}));
   if(doc.__chainsawStorage)doc=JSON.parse(gunzipSync(Buffer.from(doc.data,'base64')));
   row.binding.skyboxArtRef=doc.race.skyboxArtRef||doc.race.skyboxSettings?.artRef;
  }
  const errors=[],network=[];page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('requestfailed',r=>network.push({url:r.url(),error:r.failure()}));
  const snapshot=()=>page.evaluate(()=>{const g=window.__game,e=g?.raceEditor,s=e?.playtestSession;return {state:g?.state,status:e?.status,error:g?.lastRaceTravelError,diagnostics:g?.raceRuntimePreparation?.lastDiagnostics,preparation:e?.racePlaytestPreparation?.phase,race:e?.selectedRace?.name,sky:e?.getRaceSkyboxSettings()?.artRef,weather:e?.getRaceWeatherState(),fx:e?.getRaceRenderVisualFx(),session:s?{running:s.running,pending:s.startupFramePending,elapsed:s.elapsedMs,speed:s.speedMps,distance:s.distanceM,worldX:s.worldX,worldZ:s.worldZ,camera:s.cameraView}:null};});
  try{
   await page.goto('/index.html?hideFullscreenForTesting');await page.waitForFunction(()=>window.__gameReady&&!window.__game.loading,null,{timeout:120000});
   const choices=await page.evaluate(async()=>{const {hydrateServerStorage}=await import('/src/ui/serverStorage.js');await hydrateServerStorage({folder:'races'});return window.__game.menuPlayer.resources.choices('races',{});});
   const selector=resolveDiagnosticRaceChoice(choices,name,row.documentPath);
   const started=await page.evaluate(async race=>{const g=window.__game;g.setDisplayMode('color');return g.startRaceTravel({raceName:race,carSelection:'specific',carRef:'RTG-001'});},selector.value);expect(started).toBe(true);
   await page.waitForFunction(()=>{const g=window.__game,s=g.raceEditor.playtestSession;if(g.state==='prompt'&&!s?.running)throw Error('Race left startup for prompt: '+g.raceEditor.status);return s?.running&&!s.startupFramePending&&s.elapsedMs>2000;},null,{timeout:180000});
   const before=await snapshot();const driveWallStart=Date.now();const targetDistance=Number(process.env.RACE_DRIVE_DISTANCE||0);let distanceTelemetry=null;
   if(targetDistance>0){
    const trace=[],held=new Set();let progress=0;const deadline=Date.now()+90000;
    await page.screenshot({path:info.outputPath('authored-driving-a.png')});
    try{while(Date.now()<deadline&&progress<targetDistance){
     const t=await page.evaluate(()=>{const e=window.__game.raceEditor,s=e.playtestSession,p=e.getRaceRouteProjectionForWorldPoint({x:s.worldX,z:s.worldZ}),look=e.getRaceWorldPoseAtDistance(p.distance+Math.max(8,s.speedMps*1.8));return {elapsed:s.elapsedMs,yaw:s.carYaw,targetYaw:Math.atan2(look.x-s.worldX,look.z-s.worldZ),speed:s.speedMps,lateral:p.lateral,width:Number(p.segment?.roadWidthM||e.selectedRace.road.width||8),distance:p.distance,x:s.worldX,z:s.worldZ};});
     if(!trace.length)distanceTelemetry={startDistance:t.distance};progress=t.distance-distanceTelemetry.startDistance;const intent=steeringIntent(t);trace.push({...t,...intent,progress});
     expect(Math.abs(t.lateral)+1,'Conservative stock-car corridor').toBeLessThanOrEqual(t.width/2);
     for(const [key,on]of [['ArrowLeft',intent.steer<0],['ArrowRight',intent.steer>0],['g',intent.throttle],['r',intent.brake]]){if(on&&!held.has(key)){await page.keyboard.down(key);held.add(key);}else if(!on&&held.has(key)){await page.keyboard.up(key);held.delete(key);}}
     await page.waitForTimeout(150);
    }expect(progress,'Normal-input route progress').toBeGreaterThanOrEqual(targetDistance);
    }finally{for(const key of held)await page.keyboard.up(key).catch(()=>{});distanceTelemetry={...distanceTelemetry,targetDistance,progress,trace};fs.writeFileSync(info.outputPath('distance-trace.json'),JSON.stringify(distanceTelemetry,null,2));}
   }else if(process.env.RACE_DRIVE_STEER==='1'){
    const trace=[],held=new Set();let initialDistance=null,progress=0;
    await page.screenshot({path:info.outputPath('authored-driving-a.png')});
    const deadline=Date.now()+60000;
    try{
     while(Date.now()<deadline&&progress<50){
      const t=await page.evaluate(()=>{const e=window.__game.raceEditor,s=e.playtestSession,p=e.getRaceRouteProjectionForWorldPoint({x:s.worldX,z:s.worldZ}),look=e.getRaceWorldPoseAtDistance(p.distance+Math.max(8,s.speedMps*1.8));return {elapsed:s.elapsedMs,yaw:s.carYaw,targetYaw:Math.atan2(look.x-s.worldX,look.z-s.worldZ),speed:s.speedMps,lateral:p.lateral,width:Number(p.segment?.roadWidthM||e.selectedRace.road.width||8),distance:p.distance,x:s.worldX,z:s.worldZ};});
      initialDistance??=t.distance;progress=t.distance-initialDistance;const intent=steeringIntent(t);trace.push({...t,...intent,progress});
      for(const [key,on]of [['ArrowLeft',intent.steer<0],['ArrowRight',intent.steer>0],['g',intent.throttle],['r',intent.brake]]){if(on&&!held.has(key)){await page.keyboard.down(key);held.add(key);}else if(!on&&held.has(key)){await page.keyboard.up(key);held.delete(key);}}
      await page.waitForTimeout(150);
     }
     expect(progress,'Steered opening-bend route progress').toBeGreaterThanOrEqual(50);
     expect(trace.some(t=>t.steer!==0),'Steering input actually exercised').toBe(true);
    }finally{for(const key of held)await page.keyboard.up(key).catch(()=>{});fs.writeFileSync(info.outputPath('steering-trace.json'),JSON.stringify({scope:'Normal keyboard inputs with read-only route telemetry; 2m-wide car envelope; no pose/speed/physics/deadline overrides.',progress,trace},null,2));}
   }else{
    await page.keyboard.down('g');await page.waitForFunction(()=>window.__game.raceEditor.playtestSession.speedMps>1,null,{timeout:30000});
    await page.screenshot({path:info.outputPath('authored-driving-a.png')});await page.waitForTimeout(2000);await page.keyboard.up('g');
   }
   const after=await snapshot();await page.screenshot({path:info.outputPath('authored-driving-b.png')});
   expect(Math.hypot(after.session.worldX-before.session.worldX,after.session.worldZ-before.session.worldZ)).toBeGreaterThan(.5);expect(after.sky).toBe(row.binding.skyboxArtRef);expect(after.session.elapsed).toBeGreaterThan(before.session.elapsed);expect(after.session.speed).toBeGreaterThan(1);
   fs.writeFileSync(info.outputPath('driving-state.json'),JSON.stringify({race:name,baseline:baseline||null,device:mobile?'handheld':'desktop',selector,before,after,errors,network,timing:{wallMs:Date.now()-driveWallStart,simulationMs:after.session.elapsed-before.session.elapsed},distanceTelemetry,note:'Actual production travel and real update/draw loop; authored captures have no sky brightness, weather or world lighting override. Short drive sample, not route-wide approval.'},null,2));
   // Supported pause keeps both diagnostic exposures at the same pose. Pause UI
   // remains visible; this is explicitly not normal moving-frame acceptance.
   if(process.env.RACE_DRIVE_MATCHED_PAIR==='1'){
    const saved=await page.evaluate(()=>{const e=window.__game.raceEditor;const fx=structuredClone(e.selectedRace.visualFx);e.toggleRacePause();return fx;});
    const pose=()=>page.evaluate(()=>{const e=window.__game.raceEditor,s=e.playtestSession;return {x:s.worldX,z:s.worldZ,yaw:s.carYaw,elapsed:s.elapsedMs,cameraYaw:e.lastRaceRenderCamera?.cameraYaw};});
    try{
     await page.waitForTimeout(300);const a=await pose();await page.screenshot({path:info.outputPath('matched-authored-paused.png')});
     await page.evaluate(()=>{const e=window.__game.raceEditor;e.selectedRace.visualFx={...e.selectedRace.visualFx,skyBrightness:1};});await page.waitForTimeout(300);const b=await pose();
     await page.screenshot({path:info.outputPath('matched-sky100-paused.png')});expect(b).toEqual(a);
     fs.writeFileSync(info.outputPath('matched-pair.json'),JSON.stringify({label:'Same-pose paused production views, pause overlay retained. Left authored; right100% sky only. Not moving acceptance.',authoredBrightness:saved.skyBrightness,authored:a,diagnostic:b},null,2));
    }finally{await page.evaluate(fx=>{const e=window.__game.raceEditor;e.selectedRace.visualFx=fx;if(e.raceInput.paused)e.toggleRacePause();},saved);}
   }
   // Separately authorized sky-only exposure diagnostic, restored immediately.
   if(process.env.RACE_DRIVE_SKY_DIAGNOSTIC==='1'){
    const saved=await page.evaluate(()=>{const e=window.__game.raceEditor,fx=structuredClone(e.selectedRace.visualFx);e.selectedRace.visualFx={...fx,skyBrightness:1};return fx;});
    try{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:info.outputPath('diagnostic-sky100-world-authored.png')});}
    finally{await page.evaluate(fx=>{window.__game.raceEditor.selectedRace.visualFx=fx;},saved);}
    expect((await snapshot()).fx.skyBrightness).toBe(after.fx.skyBrightness);
   }
  }catch(error){fs.writeFileSync(info.outputPath('failure-state.json'),JSON.stringify({race:name,device:mobile?'handheld':'desktop',state:await snapshot().catch(()=>null),errors,network,error:String(error)},null,2));await page.screenshot({path:info.outputPath('failure.png')}).catch(()=>{});throw error;}
 });
});
