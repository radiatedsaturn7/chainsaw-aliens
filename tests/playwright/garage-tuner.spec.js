import {test,expect} from '@playwright/test';

for(const mode of ['keyboard','gamepad','touch'])test(`in-game tuner: ${mode} locks, drafts, acceleration and apply/cancel`,async({page})=>{
 await page.setViewportSize(mode==='touch'?{width:390,height:844}:{width:1280,height:800});
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 await page.evaluate(async mode=>{
  const g=window.__game,{ItemSystem}=await import('/src/items/ItemSystem.js'),{createMenuDocument}=await import('/src/menus/MenuDocument.js');
  const car=structuredClone(g.carEditor.selectedCar);car.setup.tirePressurePsi={fl:32,fr:32,rl:30,rr:30};
  g.deviceIsMobile=mode==='touch';g.isMobile=g.deviceIsMobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:g.deviceIsMobile});
  g.items=new ItemSystem(g,{load:async()=>({}),save:async()=>({ok:true})});g.menuProgress={};g.resolveRaceTravelCarAsync=async()=>({car,name:'Tuner Car'});
  const doc=createMenuDocument();doc.parameters.carRef='Tuner Car';g.menuPlayer.settings.load=async()=>{};
  await g.menuPlayer.open(doc,{preview:true,screenId:'tuning'});await g.menuPlayer.tuner.readyTask;
 },mode);
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner?.ready)).toBe(true);
 const press=async(key,pad)=>{
  if(mode==='gamepad')await page.evaluate(pad=>{const p=window.__game.menuPlayer;p.update({wasGamepadPressed:a=>a===pad},.016);p.update({},.016);},pad);
  else if(mode==='touch'&&['jump','gamepadB'].includes(pad)){
   const point=await page.evaluate(pad=>{const g=window.__game,b=g.menuPlayer.surface.controls.buttons.find(b=>b.id===(pad==='jump'?'jump':'attack')),r=g.canvas.getBoundingClientRect();return {x:r.x+b.x*r.width/g.viewport.width,y:r.y+b.y*r.height/g.viewport.height};},pad);
   await page.mouse.click(point.x,point.y,{delay:80});
  }else await page.keyboard.press(key);
 };
 await press('ArrowRight','dpadRight');await press('Enter','jump');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.message)).toContain('Buy compatible tires');
 await page.screenshot({path:`test-results/tuning-${mode}-grid.png`});
 await press('ArrowLeft','dpadLeft');await press('Enter','jump');await press('Enter','jump');
 await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.mode)).toBe('edit');
 await press('ArrowRight','dpadRight');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.draft)).toBe(32.5);
 await press('Escape','gamepadB');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.row.value)).toBe(32);
 await press('Enter','jump');
 await page.keyboard.down('ArrowRight');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.draft)).toBeGreaterThan(40);await page.keyboard.up('ArrowRight');
 const value=await page.evaluate(()=>window.__game.menuPlayer.tuner.draft);await page.screenshot({path:`test-results/tuning-${mode}-slider.png`});
 await press('Enter','jump');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.tuner.mode)).toBe('list');
 expect(await page.evaluate(()=>window.__game.menuPlayer.resources.garage.configuration('Tuner Car').tune['pressure.fl'])).toBe(value);
 expect(await page.evaluate(()=>window.__game.items.garage.configuration('Tuner Car').tune['pressure.fl'])).toBeUndefined();
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
