import {test,expect} from '@playwright/test';
const dialog=(page,title)=>page.getByRole('dialog',{name:title,exact:true});
const apply=(page,title)=>dialog(page,title).getByRole('button',{name:'Apply',exact:true}).click();
async function ready(page){await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady&&window.__game?.state!=='loading');}
async function seed(page,name){return page.evaluate(async name=>{
 const Mesh=await import('/src/model3d/ModelDocument.js'),Rig=await import('/src/model3d/ModelRig.js'),{saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');
 const model=Mesh.createModelDocument(name),mesh=Mesh.addPrimitive(model,'box'),joint=Rig.addJoint(model,[0,0,0]);Rig.assignVerticesToJoint(model,mesh.vertices,joint);model.materials[0].color='#ed22dd';
 const idle=Rig.addAnimation(model,'Idle',1),rise=Rig.addAnimation(model,'Rise',1);Rig.setKeyframe(model,idle,joint,0,{position:[0,0,0]});Rig.setKeyframe(model,rise,joint,0,{position:[0,0,0]});Rig.setKeyframe(model,rise,joint,1,{position:[0,0.6,0]});
 await saveProjectFileAndConfirm('models',name,model);return {idle,rise};
},name);}
for(const mobile of [false,true])test(`${mobile?'portrait':'desktop'} item selects model animation, saves, places and animates in a level`,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize(mobile?{width:390,height:844}:{width:1280,height:800});await ready(page);
 const name=`Item Crystal ${mobile}`,clips=await seed(page,name);
 await page.evaluate(mobile=>{const g=window.__game;g.deviceIsMobile=mobile;g.isMobile=mobile;g.setViewport({width:innerWidth,height:innerHeight,scale:1,dpr:1,isMobile:mobile});g.transitionTo('item-editor');void g.itemEditor.getDesktopActionHandlers()['item-model']();},mobile);
 await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await dialog(page,'Model Animation').getByLabel('Animation',{exact:true}).selectOption({label:'Rise'});await apply(page,'Model Animation');
 await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.doodad.model?.clip)).toBe(clips.rise);
 await expect.poll(()=>page.evaluate(()=>Boolean(window.__game.itemEditor.getDoodadArtCanvas()))).toBe(true);
 await page.screenshot({path:`test-results/item-model-${mobile?'portrait':'desktop'}.png`});
 await page.evaluate(()=>{void window.__game.itemEditor.getDesktopActionHandlers()['item-model-animation']();});
 await dialog(page,'Model Animation').getByLabel('Animation',{exact:true}).selectOption({label:'Idle'});await apply(page,'Model Animation');
 await expect.poll(()=>page.evaluate(()=>!window.__game.itemEditor.busy)).toBe(true);
 await page.evaluate(()=>window.__game.itemEditor.undo());expect(await page.evaluate(()=>window.__game.itemEditor.doodad.model.clip)).toBe(clips.rise);
 await page.evaluate(()=>{void window.__game.itemEditor.getDesktopActionHandlers().save();});await page.getByPlaceholder('Filename',{exact:true}).fill(name);await page.locator('.project-browser-btn.primary').filter({hasText:'Save'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.itemEditor.status)).toBe('Saved');
 await page.evaluate(()=>{const g=window.__game;g.enterEditor();g.applyWorldData(g.editor.buildEmptyLevelData(20,16));void g.editor.addMixTape();});
 await page.locator(`.project-browser-row[data-name="${name}"]`).getByRole('button',{name:'Open',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.world.decals.find(d=>d.itemType==='item')?.model?.clip)).toBe(clips.rise);
 const result=await page.evaluate(async()=>{
  const {default:World}=await import('/src/world/World.js');const source=window.__game.world.decals.find(d=>d.itemType==='item');
  const world=new World();world.applyData({tileSize:32,width:4,height:4,tiles:['....','....','....','....'],decals:[{...source,x:0,y:0,w:96,h:96}]});
  const g=Object.create(Object.getPrototypeOf(window.__game));Object.assign(g,{world,worldTime:0,camera:{x:0,y:0,width:128,height:128},abilities:{},decalImageCache:new Map(),getIgnitirTint:()=>0});
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
  const capture=time=>{g.worldTime=time;ctx.clearRect(0,0,128,128);g.drawWorld(ctx,{cameraOverride:{...g.camera,fastEditorRender:true}});return ctx.getImageData(0,0,128,128).data;};
  const a=capture(0),b=capture(0.5);let magenta=0,changed=0;for(let i=0;i<a.length;i+=4){if(a[i]>80&&a[i]>a[i+1]*2&&a[i+2]>a[i+1]*2)magenta++;if(a[i]!==b[i])changed++;}
  return {magenta,changed,model:world.data.decals[0].model};
 });
 expect(result.magenta).toBeGreaterThan(20);expect(result.changed).toBeGreaterThan(20);expect(result.model.clip).toBe(clips.rise);
});

test('one object authors and saves two independent animations through the model editor',async({page})=>{
 await ready(page);await page.evaluate(async()=>{const g=window.__game;g.enterModelEditor();const e=g.modelEditor,Rig=await import('/src/model3d/ModelRig.js');e.joint=Rig.addJoint(e.model,[0,0,0]);Rig.assignVerticesToJoint(e.model,e.model.vertices.map(v=>v.id),e.joint);});
 const action=id=>page.evaluate(id=>{void window.__game.modelEditor.handleMenuAction(id);},id);
 for(const [name,axis] of [['Rise','Y'],['Slide','Z']]){
  await action('animation-new');await dialog(page,'New animation').getByLabel('Name',{exact:true}).fill(name);await apply(page,'New animation');
  expect(await page.evaluate(()=>({time:window.__game.modelEditor.time,pose:window.__game.modelEditor.pose}))).toEqual({time:0,pose:{}});
  await action('keyframe-set');await action('animation-time');await dialog(page,'Timeline').getByLabel('Time (seconds)',{exact:true}).fill('1');await apply(page,'Timeline');
  await action('pose-joint');await dialog(page,'Pose joint').getByLabel(axis,{exact:true}).fill('0.6');await apply(page,'Pose joint');await action('keyframe-set');
 }
 await action('save');await page.getByPlaceholder('Filename',{exact:true}).fill('Two Animation Object');await page.locator('.project-browser-btn.primary').filter({hasText:'Save'}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.modelEditor.status)).toBe('Saved Two Animation Object');
 await action('new');await action('open');await page.locator('.project-browser-row[data-name="Two Animation Object"]').getByRole('button',{name:'Open',exact:true}).click();
 expect(await page.evaluate(()=>window.__game.modelEditor.model.animations.map(c=>c.name))).toEqual(['Rise','Slide']);
 await action('animation-select');await dialog(page,'Animation').getByLabel('Clip',{exact:true}).selectOption({label:'Slide'});await apply(page,'Animation');
 const poses=await page.evaluate(async()=>{const e=window.__game.modelEditor,{sampleAnimation}=await import('/src/model3d/ModelRig.js');return e.model.animations.map(c=>Object.values(sampleAnimation(e.model,c.id,0.5))[0].position);});
 expect(poses).toEqual([[0,0.3,0],[0,0,0.3]]);
});

test('actor state can change a model animation without choosing the model again',async({page})=>{
 await ready(page);const clips=await seed(page,'Actor Two Clips');
 await page.evaluate(()=>{const g=window.__game;g.enterActorEditor();const e=g.actorEditor,next=structuredClone(e.actor);next.states[0].animation.model={ref:'Actor Two Clips'};e.setActor(next);e.selectActorState(next.states[0].id);});
 await page.getByRole('button',{name:'Model Animation',exact:true}).click();await dialog(page,'Model Animation').getByLabel('Animation',{exact:true}).selectOption({label:'Rise'});await apply(page,'Model Animation');
 expect(await page.evaluate(()=>window.__game.actorEditor.actor.states[0].animation.model.clip)).toBe(clips.rise);
});

test('race item paints animated model geometry, renders pixels and disappears on collection',async({page})=>{
 await ready(page);const clips=await seed(page,'Race Item Crystal');
 await page.evaluate(async clips=>{const g=window.__game,{saveProjectFileAndConfirm}=await import('/src/ui/projectFiles.js');await saveProjectFileAndConfirm('items','Race 3D Item',{kind:'item',item:{id:'race-3d-item',name:'Crystal',model:{ref:'Race Item Crystal',clip:clips.rise},widthM:2,heightM:3}});g.enterRaceEditor();void g.raceEditor.openRaceItemPicker();},clips);
 await page.locator('.project-browser-row[data-name="Race 3D Item"]').getByRole('button',{name:'Open',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.__game.raceEditor.selectedItemDefinition?.model?.clip)).toBe(clips.rise);
 const result=await page.evaluate(async()=>{
  const THREE=await import('/src/vendorBridge/three.js'),{default:RaceEditor}=await import('/src/ui/RaceEditor.js');
  const source=window.__game.raceEditor.createRaceScenerySprite({x:0,z:0}),e=new RaceEditor({});e.ensureRaceScenery=()=>[source];e.getSelectedRaceRuntimeType=()=> 'circuit';e.getRaceRouteLength=()=>100;e.getRaceSurfaceGeometryRevisionKey=()=> 'test';e.getRaceArtSpriteCanvas=()=>null;e.sampleRaceDoodadGroundPoint=(x,z)=>({x,z,elevation:0});e.playtestSession={elapsedMs:0};
  const renderer={scene:new THREE.Scene()},webgl=new THREE.WebGLRenderer({alpha:true,preserveDrawingBuffer:true});webgl.setSize(128,128);
  const camera=new THREE.PerspectiveCamera(40,1,0.01,100);camera.position.set(7,6,8);camera.lookAt(0,1,0);
  const capture=()=>{webgl.render(renderer.scene,camera);const gl=webgl.getContext(),pixels=new Uint8Array(128*128*4);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return pixels;};
  try{e.addRaceThreeDoodads(renderer);const a=capture();e.playtestSession.elapsedMs=500;e.addRaceThreeDoodads(renderer);const b=capture();let opaque=0,changed=0;for(let i=0;i<a.length;i+=4){if(a[i+3])opaque++;if(a[i]!==b[i]||a[i+3]!==b[i+3])changed++;}e.playtestSession.removedSceneryIds=[source.id];e.addRaceThreeDoodads(renderer);const cleared=capture().filter((value,i)=>i%4===3&&value).length;return {opaque,changed,cleared};}
  finally{e.clearRaceThreeScene(renderer);webgl.dispose();}
 });expect(result.opaque).toBeGreaterThan(40);expect(result.changed).toBeGreaterThan(40);expect(result.cleared).toBe(0);
});
