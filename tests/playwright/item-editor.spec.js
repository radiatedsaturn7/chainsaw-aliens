import {test,expect} from '@playwright/test';
const dialog=(page,name)=>page.getByRole('dialog',{name,exact:true});
const apply=(page,name)=>dialog(page,name).getByRole('button',{name:'Apply',exact:true}).click();
async function ready(page){await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');}
async function action(page,id){await expect.poll(()=>page.evaluate(()=>!window.__game.itemEditor.busy)).toBe(true);await page.evaluate(id=>{void window.__game.itemEditor.getDesktopActionHandlers()[id]();},id);}
async function clickItem(page,id){await expect.poll(()=>page.evaluate(()=>!window.__game.itemEditor.busy)).toBe(true);await expect.poll(()=>page.evaluate(id=>window.__game.itemEditor.buttons.some(b=>b.id===id&&!b.disabled),id)).toBe(true);const p=await page.evaluate(id=>{const g=window.__game,b=g.itemEditor.buttons.find(b=>b.id===id).bounds,r=g.canvas.getBoundingClientRect();return{x:r.x+(b.x+b.w/2)*r.width/g.viewport.width,y:r.y+(b.y+b.h/2)*r.height/g.viewport.height};},id);await page.mouse.click(p.x,p.y);}
test.beforeEach(async({page})=>{
 let progress={};
 await page.route('**/__storage/file*',async route=>{
  const request=route.request(),url=new URL(request.url()),body=request.method()==='POST'?request.postDataJSON():null;
  if((body?.folder||url.searchParams.get('folder'))==='settings'&&(body?.name||url.searchParams.get('name'))==='rtg-item-progress'){
   if(body){progress=body.data;return route.fulfill({json:{ok:true}});}
   return route.fulfill({json:{ok:true,file:{data:progress}}});
  }
  return route.continue();
 });
});
for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} item file authors grants, reloads artwork and persists collection`,async({page},info)=>{
 test.setTimeout(120000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page);
 const name=`Item Bundle ${info.workerIndex} ${mobile}`;
 await page.evaluate(async({mobile,name})=>{
  const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});
  const {saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');await saveProjectFileAndConfirm('art',name,{width:8,height:8,frames:[{pixels:Array(64).fill('#32dd88ff')}]});
  g.title.setScreen('game');g.handleTitleMenuAction('item-editor');
 },{mobile,name});
 await expect.poll(()=>page.evaluate(()=>window.__game.state)).toBe('item-editor');expect(await page.getByRole('dialog').count()).toBe(0);
 if(mobile)await clickItem(page,'item-properties');else await action(page,'item-properties');
 await dialog(page,'Item Properties').getByLabel('Name',{exact:true}).fill(name);
 await dialog(page,'Item Properties').getByLabel('Level width (pixels)',{exact:true}).fill('48');await apply(page,'Item Properties');
 await action(page,'item-art');await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 for(const [type,target,amount] of [['key','red',1],['max-health','',2],['armor','',3],['device','scanner',1],['unlock','garage',1]]){
  await clickItem(page,'item-effect-add');await dialog(page,'Add Item Effect').getByLabel('Effect',{exact:true}).selectOption(type);
  await dialog(page,'Add Item Effect').getByLabel('Target ID (key, weapon, ability, item, device, unlock or modifier)',{exact:true}).fill(target);
  await dialog(page,'Add Item Effect').getByLabel('Amount',{exact:true}).fill(String(amount));await apply(page,'Add Item Effect');
 }
 await action(page,'save');await page.getByPlaceholder('Filename',{exact:true}).fill(name);await page.locator('.project-browser-btn.primary').filter({hasText:'Save'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.status)).toBe('Saved');
 await action(page,'new');await action(page,'open');await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.doodad.effects.length)).toBe(5);
 await expect.poll(()=>page.evaluate(()=>Boolean(window.__game.itemEditor.getDoodadArtCanvas()))).toBe(true);
 expect(await page.evaluate(()=>window.__game.itemEditor.doodad.widthPx)).toBe(48);
 await page.screenshot({path:`test-results/item-bundle-${mobile?'portrait':'desktop'}.png`});
 await page.evaluate(name=>{const g=window.__game;g.enterEditor();g.applyWorldData(g.editor.buildEmptyLevelData(38,24));void g.editor.addMixTape();},name);
 await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.world.decals.some(p=>p.itemType==='item'))).toBe(true);
 await page.evaluate(()=>{const g=window.__game;g.editor.flushPendingAutosave();g.playMostRecentLevel();const p=g.world.decals.find(p=>p.itemType==='item');p.x=g.player.x-16;p.y=g.player.y-16;p.w=32;p.h=32;g.spawnPauseTimer=0;});
 await expect.poll(()=>page.evaluate(()=>window.__game.player.keys?.red)).toBe(1);
 expect(await page.evaluate(()=>({armor:window.__game.player.armor,scanner:window.__game.player.devices.scanner,garage:window.__game.player.unlocks.garage}))).toEqual({armor:3,scanner:true,garage:true});
 await ready(page);await expect.poll(()=>page.evaluate(()=>window.__game.player.keys?.red)).toBe(1);
 expect(await page.evaluate(()=>window.__game.player.devices.scanner)).toBe(true);expect(errors).toEqual([]);
});
