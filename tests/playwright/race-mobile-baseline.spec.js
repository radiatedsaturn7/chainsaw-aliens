import {test,expect} from '@playwright/test';
// A bounded CI regression budget, not a claim of 60 FPS on real phones.
test.use({viewport:{width:800,height:360},isMobile:true,hasTouch:true,deviceScaleFactor:3});
test('mobile-sized race keeps rendering within a bounded CPU budget',async({page},testInfo)=>{
 await page.goto('/index.html',{waitUntil:'load'});
 const result=await page.evaluate(async()=>{
  const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
  const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
  const car=editor.project.cars.find(c=>c.id==='starter-rwd');
  editor.project.selectedCarId=car.id;editor.startPlaytest(car.id,{hydrateCars:false});
  const session=editor.playtestSession;
  session.countdownRemainingMs=0;session.startupFramePending=false;session.launchLockMs=0;
  editor.raceInput.throttleAxis=1;
  const canvas=document.createElement('canvas');canvas.width=406;canvas.height=228;
  const ctx=canvas.getContext('2d'),bounds={x:0,y:0,w:406,h:228};
  const samples=[];let finite=true;
  for(let i=0;i<150;i++){
   const start=performance.now();editor.updatePlaytestSafely(1/60);editor.drawRacePlaytestFrameSafely(ctx,bounds);
   if(i>=30)samples.push(performance.now()-start);
   finite&&=Number.isFinite(session.worldX)&&Number.isFinite(session.worldZ);
   if(i%30===0)await new Promise(requestAnimationFrame);
  }
  samples.sort((a,b)=>a-b);
  const result={sampleCount:samples.length,frameCpuP95Ms:samples[Math.floor(samples.length*.95)],finite,sessionAlive:editor.playtestSession===session,canvas:[canvas.width,canvas.height],budgetMs:150};
  editor.endPlaytest();return result;
 });
 await testInfo.attach('mobile-frame-budget.json',{body:JSON.stringify(result,null,2),contentType:'application/json'});
 expect(result.sessionAlive).toBe(true);expect(result.finite).toBe(true);expect(result.sampleCount).toBe(120);
 expect(result.frameCpuP95Ms).toBeLessThan(result.budgetMs);
});
