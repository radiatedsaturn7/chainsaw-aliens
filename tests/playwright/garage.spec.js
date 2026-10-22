import {test,expect} from '@playwright/test';
import {seedRaceRuntimeFixtures} from './helpers/race-runtime-fixtures.js';
const dialog=(page,name)=>page.getByRole('dialog',{name,exact:true});
const apply=(page,name)=>dialog(page,name).getByRole('button',{name:'Apply',exact:true}).click();
async function action(page,id){await expect.poll(()=>page.evaluate(()=>!window.__game.itemEditor.busy)).toBe(true);await page.evaluate(id=>{void window.__game.itemEditor.getDesktopActionHandlers()[id]();},id);}
async function clickMenu(page,id){
 await expect.poll(()=>page.evaluate(()=>!window.__game.menuPlayer.flow.busy)).toBe(true);
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const point=await page.evaluate(id=>{const g=window.__game,p=g.menuPlayer,e=p.flow.screen.elements.find(e=>e.id===id),b=p.bounds,r=g.canvas.getBoundingClientRect();return{x:r.x+(b.x+(e.x+e.w/2)*b.w)*r.width/g.viewport.width,y:r.y+(b.y+(e.y+e.h/2)*b.h)*r.height/g.viewport.height};},id);
 await page.mouse.click(point.x,point.y);
}
async function chooseUpgrade(page,value){
 const steps=await page.evaluate(async value=>{
  const p=window.__game.menuPlayer,e=p.flow.screen.elements.find(e=>e.type==='garage-browser');
  p.focus=p.interactive().indexOf(e);
  const {garageBrowserRows}=await import('/src/menus/MenuGarageWidgets.js');
  const state=p.widgetStates.get(e.id)||{},rows=garageBrowserRows(p.resources,p.flow.parameters,state),index=rows.findIndex(r=>r.value===value);
  if(index<0)throw Error('Missing upgrade '+value);
  return index-(state.index||0);
 },value);
 for(let i=0;i<Math.abs(steps);i++)await page.keyboard.press(steps<0?'ArrowLeft':'ArrowRight');
 await page.keyboard.press('Enter');
 await expect.poll(()=>page.evaluate(()=>!window.__game.menuPlayer.flow.busy)).toBe(true);
}
test.beforeEach(async({page})=>{
 const preferences=new Map();
 await page.route('**/__storage/file*',async route=>{
  const req=route.request(),url=new URL(req.url()),body=req.method()==='POST'?req.postDataJSON():null;
  const folder=body?.folder||url.searchParams.get('folder'),name=body?.name||url.searchParams.get('name');
  if(folder==='settings'&&['rtg-item-progress','rtg-radio-progress','rtg-radio-library','menu-launch','menu-settings'].includes(name)){
   if(body){preferences.set(name,body.data);return route.fulfill({json:{ok:true}});}
   return route.fulfill({json:{ok:true,file:{data:preferences.get(name)||{value:name==='rtg-item-progress'?{stats:{credits:5000}}:{}}}}});
  }
  return route.continue();
 });
});
for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} authors, purchases, installs, tunes and removes a garage part`,async({page})=>{
 test.setTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');
 const name=`Garage ECU ${mobile}`,carRef=`Garage Car ${mobile}`;
 await page.evaluate(async({mobile,carRef,name})=>{
  const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});
  const {saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');
  const car=structuredClone(g.carEditor.selectedCar);delete car.__systemPreset;delete car.__editorDraft;delete car.systemFile;car.name=carRef;await saveProjectFileAndConfirm('cars',carRef,{car});window.__garageStock=JSON.stringify({car});
  g.transitionTo('item-editor');g.itemEditor.newDoodad();g.itemEditor.doodad.name=name;
 },{mobile,carRef,name});
 await action(page,'item-part');await dialog(page,'Car Part Properties').getByLabel('Installation slot',{exact:true}).fill('ecu');await dialog(page,'Car Part Properties').getByLabel('Price (credits)',{exact:true}).fill('250');await apply(page,'Car Part Properties');
 await action(page,'item-part-changes');await dialog(page,'Part Changes').getByLabel('New: enabled',{exact:true}).selectOption('yes');await dialog(page,'Part Changes').getByLabel('New: setting',{exact:true}).selectOption('torqueScale');await dialog(page,'Part Changes').getByLabel('New: operation',{exact:true}).selectOption('multiply');await dialog(page,'Part Changes').getByLabel('New: value',{exact:true}).fill('1.2');await apply(page,'Part Changes');
 await action(page,'item-part-tuning');await dialog(page,'Tuning Unlocks').getByLabel('New: enabled',{exact:true}).selectOption('yes');await apply(page,'Tuning Unlocks');
 await action(page,'save');await page.getByPlaceholder('Filename',{exact:true}).fill(name);await page.locator('.project-browser-btn.primary').filter({hasText:'Save'}).click();await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.status)).toBe('Saved');
 const id=await page.evaluate(()=>window.__game.itemEditor.doodad.id);
 await page.evaluate(async({name,carRef})=>{const {createMenuDocument}=await import('/src/menus/MenuDocument.js');const g=window.__game,doc=createMenuDocument();doc.parameters={...doc.parameters,carRef,partRef:name};await g.menuPlayer.open(doc);g.menuPlayer.flow.goTo('garage');},{name,carRef});
 await clickMenu(page,'garage-upgrade');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('upgrades');
 await chooseUpgrade(page,'Engine');await chooseUpgrade(page,'ecu');await chooseUpgrade(page,name);
 await expect.poll(()=>page.evaluate(id=>window.__game.items.progress.bags.items[id],id)).toBe(1);
await expect.poll(()=>page.evaluate(ref=>window.__game.items.garage.configuration(ref).installed.ecu,carRef)).toBe(id);
 await clickMenu(page,'back');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('garage');
 await clickMenu(page,'garage-tune');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('tuning');
 await clickMenu(page,'adjust');await dialog(page,'Garage Tuning').getByLabel('Final drive',{exact:true}).fill('3.4');await apply(page,'Garage Tuning');
 await expect.poll(()=>page.evaluate(ref=>window.__game.items.garage.configuration(ref).tune.gearFinalDrive,carRef)).toBe(3.4);
 await expect.poll(()=>page.evaluate(ref=>Boolean(window.__game.menuPlayer.resources.car(ref)),carRef)).toBe(true);
 await page.screenshot({path:`test-results/menu-garage-${mobile?'portrait':'desktop'}.png`});
 const result=await page.evaluate(async ref=>{const g=window.__game,{loadProjectFile}=await import('/src/ui/projectFiles.js');const stock=loadProjectFile('cars',ref).data,car=await g.items.garage.build(ref,stock.car);return{unchanged:JSON.stringify(stock)===window.__garageStock,drive:g.carEditor.getRaceCarTuning(car).finalDrive,credits:g.player.credits,power:car.tuning.powerHp,stockPower:stock.car.tuning.powerHp};},carRef);
 expect(result.unchanged).toBe(true);expect(result.drive).toBe(3.4);expect(result.credits).toBe(4750);expect(result.power).toBeGreaterThan(result.stockPower);
 if(!mobile){
  await seedRaceRuntimeFixtures(page);
  await page.evaluate(()=>{const p=window.__game.menuPlayer;void p.launchRace('Studio Sprint2',p.flow.parameters);});
  await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.playtestSession?.running),{timeout:60000}).toBe(true);
  expect(await page.evaluate(()=>{const e=window.__game.raceEditor,c=e.getRaceSessionCar(e.playtestSession);return e.getRaceCarTuning(c).finalDrive;})).toBe(3.4);
  await page.evaluate(()=>window.__game.returnRaceTravelToOrigin());await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('menu-player');
 }
 await clickMenu(page,'back');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('garage');
 await clickMenu(page,'garage-upgrade');await expect.poll(()=>page.evaluate(()=>window.__game.menuPlayer.flow.screenId)).toBe('upgrades');
 await page.evaluate(()=>{const p=window.__game.menuPlayer;p.widgetStates.set('garage-parts',{section:'Engine',slot:'ecu',index:0});});
 await chooseUpgrade(page,'');await expect.poll(()=>page.evaluate(ref=>Object.keys(window.__game.items.garage.configuration(ref).installed).length,carRef)).toBe(0);
 expect(await page.evaluate(id=>window.__game.items.progress.bags.items[id],id)).toBe(1);
 expect(errors).toEqual([]);
});
