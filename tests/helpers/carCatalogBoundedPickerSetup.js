import {expect} from '@playwright/test';
import {catalogPickerPlan} from './carCatalogPickerPlan.js';

export async function pickerState(page){
 return page.evaluate(async()=>{
  const g=window.__game,p=g.menuPlayer;
  const {showroomPage}=await import('/src/menus/MenuGarageWidgets.js');
  const {getRaceArtSpriteCanvasShared}=await import('/src/ui/shared/raceArtSpriteCanvas.js');
  const e=p.flow.screen.elements.find(e=>e.type==='car-showroom');
  const choices=p.resources.choices('cars',p.flow.document,p.flow.parameters);
  const shown=showroomPage(choices,p.flow.parameters[e.binding],e.maxVisible);
  const car=p.resources.car(p.flow.parameters[e.binding]);
  const refs=car?p.resources.exteriorArtRefs(car):[];
  return {selected:p.flow.parameters[e.binding],index:shown.index,start:shown.start,visible:shown.entries.map(c=>c.value),choices:choices.map(c=>c.value),maximum:e.maxVisible,carId:car?.id,ready:refs.length>0&&refs.every(ref=>!!getRaceArtSpriteCanvasShared(ref,{frameIndex:0,cache:g.carEditor.raceArtSpriteCache,allowSyncFetch:false})),errors:[...p.resources.errors]};
 });
}
export async function settlePicker(page,menuReady){
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await menuReady();
}
async function pickerPoint(page,{name,direction}){
 return page.evaluate(async({name,direction})=>{
  const g=window.__game,p=g.menuPlayer,e=p.flow.screen.elements.find(e=>e.type==='car-showroom');
  const {menuElementBounds}=await import('/src/menus/MenuRenderer.js');
  const {menuElementPose}=await import('/src/menus/MenuDocument.js');
  const {showroomPage,garageCardBounds}=await import('/src/menus/MenuGarageWidgets.js');
  const pose=menuElementPose(e,p.flow.time),b=menuElementBounds(e,p.bounds,pose);
  if(pose.rotation!==0||pose.scale!==1)throw Error('Picker input geometry requires untransformed showroom');
  let point;
  if(direction)point={x:b.x+b.w*(direction>0?.75:.25),y:b.y+b.h-12};
  else{
   const choices=p.resources.choices('cars',p.flow.document,p.flow.parameters);
   const shown=showroomPage(choices,p.flow.parameters[e.binding],e.maxVisible),i=shown.entries.findIndex(c=>c.value===name);
   if(i<0)throw Error('Target card is not visible');
   if(p.flow.parameters[e.binding]===name)throw Error('Target already selected before real card input');
   const card=garageCardBounds(b,shown.entries.length,i);point={x:card.x+card.w/2,y:card.y+card.h/2};
  }
  const c=g.canvas,r=c.getBoundingClientRect();
  return {x:r.x+point.x*r.width/c.width,y:r.y+point.y*r.height/c.height};
 },{name,direction});
}
export async function stepPicker(page,mobile,menuReady,direction=1){
 if(mobile){const pt=await pickerPoint(page,{direction});await page.touchscreen.tap(pt.x,pt.y);}
 else await page.keyboard.press(direction>0?'ArrowRight':'ArrowLeft');
 await settlePicker(page,menuReady);
}
export async function selectCatalogTarget(page,{targetName,mobile,menuReady,info}){
 const started=Date.now(),initial=await pickerState(page),plan=catalogPickerPlan(initial.choices,targetName,initial.maximum);
 // Use the same controller method as carousel/card input, not parameter/resource injection.
 await page.evaluate(({stageName})=>{const p=window.__game.menuPlayer,e=p.flow.screen.elements.find(e=>e.type==='car-showroom');p.selectShowroomCar(e,stageName);},plan);
 await settlePicker(page,menuReady);
 await expect.poll(async()=>{const s=await pickerState(page);return {selected:s.selected,ready:s.ready,errors:s.errors};},{timeout:90000}).toEqual({selected:plan.stageName,ready:true,errors:[]});
 if(plan.selection==='card'){
  // Require the real visible target exterior to hydrate before actual pointer input.
  await expect.poll(()=>page.evaluate(async name=>{
   const g=window.__game,p=g.menuPlayer,{getRaceArtSpriteCanvasShared}=await import('/src/ui/shared/raceArtSpriteCanvas.js');
   const car=p.resources.car(name),refs=car?p.resources.exteriorArtRefs(car):[];
   return refs.length>0&&refs.every(ref=>!!getRaceArtSpriteCanvasShared(ref,{frameIndex:0,cache:g.carEditor.raceArtSpriteCache,allowSyncFetch:false}));
  },targetName),{timeout:90000}).toBe(true);
  const pt=await pickerPoint(page,{name:targetName});
  if(mobile)await page.touchscreen.tap(pt.x,pt.y);else await page.mouse.click(pt.x,pt.y);
  await settlePicker(page,menuReady);
 }else await stepPicker(page,mobile,menuReady,1); // Last page with one card: enter with actual next input.
 const selected=await pickerState(page);expect(selected.selected).toBe(targetName);expect(selected.visible).toContain(targetName);expect(selected.start).toBe(plan.start);expect(selected.errors).toEqual([]);
 await info.attach('picker-setup',{body:Buffer.from(JSON.stringify({mode:mobile?'touch':'desktop',setup:'native-controller-stage-then-real-input',plan,originalTraversalDistance:plan.index-initial.index,elapsedMs:Date.now()-started})),contentType:'application/json'});
}
