import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const carFixture=JSON.parse(readFileSync(new URL('../fixtures/uphill-wrx2-tuning.json',import.meta.url),'utf8')).car;

test('saved WRX2 uphill restart downshifts through RaceEditor and keeps physical wheel animation',async({page})=>{
 test.setTimeout(120000);
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 await page.mouse.click(5,5);
 const result=await page.evaluate(async car=>{
  globalThis.__RTG_VEHICLE_DYNAMICS_WORKER_MODE__='off';
  const g=window.__game;g.enterRaceEditor();const e=g.raceEditor;
  e.selectedRace.hazards=[];e.selectedRace.weather='clear';e.selectedRace.radioEnabled=false;
  e.selectedRace.competition={mode:'solo',aiDrivers:[],trafficEnabled:false};
  e.selectedRace.road.network=null;
  e.selectedRace.road.nodes=[{x:0,y:0,elevation:0,role:'start'},{x:0,y:200,elevation:2.5,role:'finish'}];
  e.selectedRace.road.segments=[{length:200,curve:0,elevation:2.5,surface:'asphalt',turn:'smooth',hazardIds:[]}];
  e.selectedRace.road.width=12;e.selectedRace.road.tileMap=null;
  const loaded=e.normalizeLoadedCarDocument(car);Object.assign(e.selectedCar,loaded);
  e.raceInput.transmissionMode='automatic';
  const preparedWorldBake=e.buildRaceWorldBake(e.getRacePlaytestWorldBakeOptions());
  e.startPlaytest(e.selectedCar.id,{hydrateCars:false,preparedWorldBake});
  const s=e.playtestSession;s.countdownRemainingMs=0;s.startupFramePending=false;s.launchLockMs=0;
  e.updatePlaytestSafely(0);const runner=s.vehicleDynamicsRunner;
  const initial=runner.createStateSnapshot();
  runner.replaceAuthoritativeState({...initial,gear:5,engineRpm:4500,powertrainState:{...initial.powertrainState,gear:5,targetGear:5,engineRpm:4500,shiftTimeRemainingSeconds:0}});
  e.raceInput.gear=5;e.raceInput.autoShift=true;
  const start={...runner.state.position};let maxSpin=0;
  for(let frame=0;frame<180;frame++){
   e.raceInput.activeThrottlePointerId='uphill-test';e.raceInput.throttleAxis=1;e.raceInput.rawThrottleAxis=1;
   e.updatePlaytest(1/60);
   maxSpin=Math.max(maxSpin,Math.abs(e.getRaceTireTextureScroll(e.getRaceSessionCar(s),'fl',s)));
  }
  // Freeze simulation without a pause overlay hiding the car in the artifact.
  e.raceInput.activeThrottlePointerId=null;e.update=()=>{};g.setDisplayMode('color');
  return {gear:runner.state.gear,rpm:runner.state.engineRpm,travel:Math.hypot(runner.state.position.x-start.x,runner.state.position.z-start.z),heightGain:runner.state.position.y-start.y,maxSpin,loads:runner.state.wheelLoadsN};
 },carFixture);
 expect(result.gear).toBeLessThan(5);expect(result.travel).toBeGreaterThan(5);expect(result.heightGain).toBeGreaterThan(.2);expect(result.maxSpin).toBeGreaterThan(.1);
 await page.screenshot({path:'test-results/radio-uphill-wrx2.png'});
});

test('stationary physical wheelspin animates textured tires and emits visible smoke with sound',async({page})=>{
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 const result=await page.evaluate(async()=>{
  const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
  const {getWheelSlipPresentation}=await import('/src/racing/simulation/WheelSlipPresentation.js');
  const {drawWheelCylinder}=await import('/src/racing/CarWheelCylinder.js');
  const sounds=[],e=new RaceEditor({audio:{setTireScreech:(...args)=>sounds.push(args)}});
  e.playtestSession={speedMps:0,elapsedMs:0,tireFxParticles:[]};
  e.getRaceWheelFxEmissionPosition=id=>({x:id.endsWith('l')?-1:1,z:0,elevation:0});
  e.getRaceTireFxVisualMaterialAtWorldPoint=()=>({materialId:'asphalt',surfaceId:'asphalt',region:'road'});
  const state={velocity:{x:0,y:0,z:0},contactPatches:Object.fromEntries(['fl','fr','rl','rr'].map(id=>[id,{normalLoadN:3500,validTreadContact:true,wheelAngularVelocityRadps:35,effectiveRollingRadiusM:.33,longitudinalVelocityMps:0}]))};
  const slip=getWheelSlipPresentation(state);
  e.updateRaceTireAudio({slip:slip.audibleSlip,slipSpeedMps:slip.slipSpeedMps,speedMps:0});
  for(let i=0;i<120;i++)e.emitRaceTireFxParticles(1/60,{...slip,speedMps:0});
  const texture=document.createElement('canvas');texture.width=texture.height=32;const t=texture.getContext('2d');
  t.fillStyle='#222';t.fillRect(0,0,32,32);t.fillStyle='#eee';t.fillRect(0,0,16,8);t.fillStyle='#e44';t.fillRect(16,16,16,8);
  const canvas=document.createElement('canvas');canvas.id='wheelspin-proof';canvas.width=480;canvas.height=240;document.body.appendChild(canvas);
  canvas.style.cssText='position:fixed;inset:0;z-index:99999;background:#10151b';const ctx=canvas.getContext('2d');
  const wheelImage=spin=>{const c=document.createElement('canvas');c.width=c.height=140;const cc=c.getContext('2d');cc.translate(70,70);drawWheelCylinder(cc,{tread:texture,wheel:texture,width:45,height:110,bearing:Math.PI/4,spin});return c;};
  const first=wheelImage(0),next=wheelImage(.7);ctx.drawImage(first,40,10);ctx.drawImage(next,280,10);
  e.projectRaceWorldVisualPoint=p=>({visible:true,screenX:240+p.x*40,screenY:180,renderZ:8,cameraZ:8});
  const drew=e.drawRaceTireFxParticles(ctx,{x:0,y:0,w:480,h:240});
  return {animated:first.toDataURL()!==next.toDataURL(),particles:e.playtestSession.tireFxParticles.length,drew,sound:sounds.at(-1)[0]};
 });
 expect(result).toMatchObject({animated:true,drew:true,sound:true});expect(result.particles).toBeGreaterThan(0);
 await page.locator('#wheelspin-proof').screenshot({path:'test-results/radio-stationary-wheelspin.png'});
});
