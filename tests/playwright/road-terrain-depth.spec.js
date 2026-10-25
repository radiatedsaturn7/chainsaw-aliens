import {test,expect} from '@playwright/test';
test('terrain artwork stays under roads at close and distant grazing angles',async({page})=>{
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 const samples=await page.evaluate(async()=>{
  const THREE=await import('/src/vendorBridge/three.js');
  const editor=window.__game.raceEditor,renderer=editor.getRaceThreeWorldRenderer(512,512);
  const texture=new THREE.DataTexture(new Uint8Array([0,255,0,255]),1,1);texture.needsUpdate=true;
  const original=editor.getRaceThreeTexture;editor.getRaceThreeTexture=()=>texture;
  const target=new THREE.WebGLRenderTarget(512,512),results=[];
  try{
   for(const distance of [20,200,800]){
    renderer.scene=new THREE.Scene();
    const terrain=new THREE.PlaneGeometry(100,100);terrain.rotateX(-Math.PI/2);terrain.translate(0,0,distance);
    const geo=terrain.toNonIndexed();geo.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*3).fill(1),3));
    const base=new THREE.Mesh(geo,editor.getRaceThreeMaterial(renderer,{polygonOffset:false}));renderer.scene.add(base);
    const roadGeo=new THREE.PlaneGeometry(20,100);roadGeo.rotateX(-Math.PI/2);roadGeo.translate(0,0,distance);
    const roadMat=editor.getRaceThreeMaterial(renderer,{polygonOffset:true}).clone();roadMat.color.setRGB(1,0,0);roadMat.vertexColors=false;
    const road=new THREE.Mesh(roadGeo,roadMat);road.renderOrder=2;renderer.scene.add(road);
    const positions=geo.attributes.position.array;
    editor.addRaceThreeTerrainArtwork(renderer,geo,{positions,textureColors:new Float32Array(positions.length).fill(1),artGroups:[{artRef:'test',start:0,count:geo.attributes.position.count}]});
    const camera=new THREE.PerspectiveCamera(48,1,.06,2200);camera.position.set(0,Math.max(2,distance*.03),0);camera.lookAt(0,0,distance);camera.updateMatrixWorld(true);
    renderer.threeRenderer.setRenderTarget(target);renderer.threeRenderer.clear();renderer.threeRenderer.render(renderer.scene,camera);
    const pixel=new Uint8Array(4);renderer.threeRenderer.readRenderTargetPixels(target,256,256,1,1,pixel);
    const side=new THREE.Vector3(30,0,distance).project(camera),sidePixel=new Uint8Array(4);
    if(Math.abs(side.x)<.95)renderer.threeRenderer.readRenderTargetPixels(target,Math.floor((side.x+1)*256),256,1,1,sidePixel);
    results.push({distance,road:[...pixel],terrain:Math.abs(side.x)<.95?[...sidePixel]:null});
   }
  }finally{renderer.threeRenderer.setRenderTarget(null);target.dispose();texture.dispose();editor.getRaceThreeTexture=original;}
  return results;
 });
 for(const sample of samples){expect(sample.road[0],JSON.stringify(sample)).toBeGreaterThan(240);expect(sample.road[1],JSON.stringify(sample)).toBeLessThan(10);if(sample.terrain)expect(sample.terrain[1],JSON.stringify(sample)).toBeGreaterThan(240);}
});
