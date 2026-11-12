import {test,expect} from '@playwright/test';

test('filtered uphill decals do not put dark fringes on a white road',async({page})=>{
 const errors=[];
 page.on('console',m=>{if(/shader error|VALIDATE_STATUS|shader.*compile/i.test(m.text()))errors.push(m.text());});
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 const pixels=await page.evaluate(async()=>{
  const THREE=await import('/src/vendorBridge/three.js');
  const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
  const e=new RaceEditor({}),art=document.createElement('canvas');art.width=art.height=64;
  const ctx=art.getContext('2d');ctx.fillStyle='white';ctx.fillRect(8,8,48,48);
  e.getRaceArtSpriteCanvas=()=>art;e.getRaceGroundTextureFilterMode=()=> 'smooth';
  const surface={sampleWorld:({z})=>({elevation:z*.035})};e.getRaceSurfaceModel=()=>surface;
  e.selectedRace.decals=[{id:'edge-test',kind:'decal',artRef:'alpha-test',x:0,z:0,widthM:4,heightM:4}];
  const gpu=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});gpu.setSize(128,128);
  const renderer={scene:new THREE.Scene(),textureCache:new Map(),threeRenderer:gpu};
  e.syncRaceThreeDecals(renderer);
  const camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,2,6);camera.lookAt(0,0,0);
  const gl=gpu.getContext(),data=new Uint8Array(128*128*4);
  const sample=background=>{gpu.setClearColor(background,1);gpu.render(renderer.scene,camera);gl.readPixels(0,0,128,128,gl.RGBA,gl.UNSIGNED_BYTE,data);let min=255,max=0;for(let i=0;i<data.length;i+=4){min=Math.min(min,data[i],data[i+1],data[i+2]);max=Math.max(max,data[i],data[i+1],data[i+2]);}return {min,max};};
  const white=sample(0xffffff),black=sample(0x000000);
  e.clearRaceThreeDecals(renderer);for(const t of renderer.textureCache.values())t.dispose();gpu.dispose();
  return {white,black};
 });
 expect(errors).toEqual([]);expect(pixels.black.max).toBeGreaterThan(240);expect(pixels.black.min).toBe(0);
 expect(pixels.white.min).toBeGreaterThanOrEqual(248);
});
