import { test, expect } from '@playwright/test';

test('road mipmap distance compiles in both renderers and persists in the editor', async ({ page }) => {
  const shaderErrors = [];
  page.on('console', message => {
    if (/shader error|VALIDATE_STATUS|shader.*compile/i.test(message.text())) shaderErrors.push(message.text());
  });
  await page.goto('/index.html');
  await page.waitForFunction(() => window.__gameReady);
  const result = await page.evaluate(async () => {
    const THREE = await import('/src/vendorBridge/three.js');
    const { default: RaceEditor } = await import('/src/ui/RaceEditor.js');
    const editor = new RaceEditor({});
    await editor.openRaceRoadTextures(async () => ({ roadArt: 'test', roadRepeat: 3, roadRepeatWidth: 3,
      roadMipmaps: true, roadMipmapDistance: 4, roadFilter: 'balanced' }));
    const loaded = editor.normalizeLoadedRaceDocument(editor.serializeSelectedRaceDocument());
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 64, 64);
    editor.getRaceArtSpriteCanvas = () => canvas;
    const threeRenderer = new THREE.WebGLRenderer(); threeRenderer.setSize(64, 64);
    const renderer = { threeRenderer, textureCache: new Map() };
    const texture = editor.getRaceThreeTexture(renderer, 'test', loaded.roadTextures.road);
    const material = editor.getRaceThreeMaterial(renderer, { texture, textureOptions: loaded.roadTextures.road });
    material.vertexColors = false;
    const scene = new THREE.Scene();
    const geometry = new THREE.PlaneGeometry(2, 2); scene.add(new THREE.Mesh(geometry, material));
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10); camera.position.z = 2;
    threeRenderer.render(scene, camera);
    const programs = threeRenderer.info.programs.length;
    const fallback = editor.getRaceWebGLGroundRenderer(64, 64);
    const fallbackLinked = !!fallback?.gl?.getProgramParameter(fallback.meshProgram, fallback.gl.LINK_STATUS);
    const hasBias = fallback?.meshLocations?.mipmapBias != null;
    geometry.dispose(); material.dispose(); texture.dispose(); threeRenderer.dispose();
    return { distance: loaded.roadTextures.road.mipmapDistance, programs, fallbackLinked, hasBias };
  });
  expect(result).toEqual({ distance: 4, programs: 1, fallbackLinked: true, hasBias: true });
  expect(shaderErrors).toEqual([]);
});

for (const [name, width, height] of [['portrait',390,844],['landscape',844,390],['desktop',1280,800]]) {
  test(`skybox scaling preview and controls fit ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/index.html');
    await page.waitForFunction(() => window.__gameReady);
    const result = await page.evaluate(async ({width,height}) => {
      const { default: RaceEditor } = await import('/src/ui/RaceEditor.js');
      const editor = new RaceEditor({});
      editor.handleMenuAction('skybox-next');
      const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
      Object.assign(canvas.style,{position:'fixed',inset:'0',zIndex:'99999'}); document.body.append(canvas);
      const ctx=canvas.getContext('2d'); editor.drawRaceSettingsDialog(ctx,width,height);
      const regions=editor.raceSettingsSliderRegions;
      const scale=regions.find(r=>r.key==='skybox-scale-x');
      editor.updateRaceSettingsSlider(scale,scale.track.x+scale.track.w*(2-.25)/(4-.25));
      const preview=[];const original=editor.drawRaceSkyboxArt.bind(editor);
      editor.drawRaceSkyboxArt=(context,bounds,options)=>{preview.push(editor.getRaceSkyboxSettings());return original(context,bounds,options);};
      editor.drawRaceSettingsDialog(ctx,width,height);
      editor.closeRaceSettingsDialog({accept:true});
      return {label:editor.getMenuItems('settings').find(i=>i.id==='skybox-next').label,
        count:regions.length,inside:regions.every(r=>r.bounds.x>=0&&r.bounds.y>=0&&r.bounds.x+r.bounds.w<=width&&r.bounds.y+r.bounds.h<height-48),
        previewScale:preview.at(-1)?.scaleX,savedScale:editor.getRaceSkyboxSettings().scaleX};
    }, {width,height});
    expect(result).toEqual({label:'Skybox',count:4,inside:true,previewScale:2,savedScale:2});
    await page.screenshot({path:`test-results/race-skybox-${name}.png`});
  });
}

test('painted terrain crossfades on the GPU and road decals remain visible above it',async({page})=>{
 const errors=[];page.on('console',m=>{if(/shader error|VALIDATE_STATUS|shader.*compile/i.test(m.text()))errors.push(m.text());});
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 const pixels=await page.evaluate(async()=>{
  const THREE=await import('/src/vendorBridge/three.js');
  const {terrainBlendGrid,createTerrainBlendMaterial}=await import('/src/racing/RaceTerrainTextureBlend.js');
  const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
  const art=color=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,32,32);return c;};
  const grid=terrainBlendGrid({cellSizeM:40,cells:{'0,0':{artRef:'red'},'1,0':{artRef:'blue'}}},c=>c.artRef);
  const images={red:art('#ff0000'),blue:art('#0000ff')};
  const material=createTerrainBlendMaterial({THREE,grid,getCanvas:r=>images[r],makeMaterial:map=>new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide})});
  const renderer=new THREE.WebGLRenderer(),scene=new THREE.Scene(),target=new THREE.WebGLRenderTarget(128,64);
  const geometry=new THREE.PlaneGeometry(80,40);geometry.rotateX(-Math.PI/2);geometry.translate(40,0,20);
  scene.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'white',side:THREE.DoubleSide})));
  const overlay=new THREE.Mesh(geometry,material);overlay.renderOrder=1;scene.add(overlay);
  const e=new RaceEditor({});e.selectedRace.decals=[{id:'visible',kind:'decal',artRef:'green',x:20,z:20,widthM:6,heightM:6}];
  e.getRaceSurfaceModel=()=>({sampleWorld:()=>({elevation:0})});e.getRaceArtSpriteCanvas=()=>art('#00ff00');
  const state={scene,textureCache:new Map()};e.syncRaceThreeDecals(state);
  const camera=new THREE.OrthographicCamera(-40,40,20,-20,.1,200);camera.position.set(40,100,20);camera.up.set(0,0,-1);camera.lookAt(40,0,20);
  renderer.setRenderTarget(target);renderer.render(scene,camera);
  const sample=x=>{const p=new Uint8Array(4);renderer.readRenderTargetPixels(target,x,32,1,1,p);return [...p];};
  const result=[sample(16),sample(64),sample(112),sample(32)];
  e.clearRaceThreeDecals(state);material.dispose();geometry.dispose();target.dispose();renderer.dispose();return result;
 });
 expect(errors).toEqual([]);
 expect(pixels[0][0]).toBeGreaterThan(200);expect(pixels[0][2]).toBeLessThan(15);
 expect(pixels[1][0]).toBeGreaterThan(60);expect(pixels[1][2]).toBeGreaterThan(60);
 expect(pixels[2][2]).toBeGreaterThan(200);expect(pixels[2][0]).toBeLessThan(15);
 expect(pixels[3][1]).toBeGreaterThan(200);expect(pixels[3][0]).toBeLessThan(15);
});

test('editor-intent campaign assets select through the real picker and load renderable art',async({page})=>{
 test.setTimeout(180000);
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 const assets=await page.evaluate(async()=>{
  const policy=await (await fetch('/tests/fixtures/campaign-art-intent.json')).json();
  const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
  window.__intentEditor=new RaceEditor({});
  return Object.entries(policy.editorAssets);
 });
 expect(assets.length).toBeGreaterThan(0);
 for(const [ref,intent] of assets){
  await page.evaluate(async({ref,intent})=>{
   const {hydrateProjectFilePayload}=await import('/src/ui/projectFiles.js');
   const payload=await hydrateProjectFilePayload(intent.kind==='doodad'?'doodads':'art',ref);
   if(!payload)throw Error(`Missing editor asset: ${ref}`);
   if(intent.kind==='doodad')void window.__intentEditor.openRaceDoodadPicker();
   else void window.__intentEditor.openRaceSkyboxArtPicker();
  },{ref,intent});
  await page.locator(`.project-browser-row[data-name="${ref}"]`).getByRole('button',{name:'Open',exact:true}).click();
  await expect.poll(()=>page.evaluate(kind=>kind==='doodad'?window.__intentEditor.selectedDoodadRef:window.__intentEditor.selectedRace.skyboxArtRef,intent.kind)).toBe(ref);
  const result=await page.evaluate(async({ref,intent})=>{
   const e=window.__intentEditor;
   const artRef=intent.kind==='doodad'?e.getSelectedRaceDoodad()?.artRef:e.selectedRace.skyboxArtRef;
   const payload=await e.hydrateRaceArt(artRef);
   const canvas=e.getRaceArtSpriteCanvas(artRef);
   if(!canvas)throw Error(`Editor art failed to render: ${ref}`);
   const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
   let visible=false;for(let i=3;i<pixels.length;i+=4)if(pixels[i]){visible=true;break;}
   const definition=intent.kind==='doodad'?e.getSelectedRaceDoodad():null;
   return {artRef,loaded:Boolean(payload),visible,width:canvas.width,height:canvas.height,isFence:definition?.isFence??null};
  },{ref,intent});
  expect(result.artRef).toBe(ref);expect(result.loaded).toBe(true);expect(result.visible).toBe(true);
  expect(result.width).toBeGreaterThan(0);expect(result.height).toBeGreaterThan(0);
  if(intent.kind==='doodad')expect(result.isFence).toBe(true);
 }
});
