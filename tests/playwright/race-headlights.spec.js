import {test,expect} from '@playwright/test';
test('rally headlights shade real world geometry, follow the car, and leave rear ground dark',async({page})=>{
 await page.goto('/index.html');
 const result=await page.evaluate(async()=>{
  const THREE=await import('/src/vendorBridge/three.js');const {updateRaceLighting}=await import('/src/racing/RaceLighting.js');
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-600,600,600,-600,1,2000);
  camera.position.set(0,1000,500);camera.up.set(0,0,-1);camera.lookAt(0,0,500);camera.updateMatrixWorld();
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),new THREE.MeshBasicMaterial({color:'#ffffff',side:THREE.DoubleSide}));plane.rotation.x=-Math.PI/2;plane.position.z=500;scene.add(plane);
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(128,128);renderer.setClearColor('#000000');document.body.appendChild(renderer.domElement);
  const state={scene},errors=[];renderer.debug.onShaderError=(_gl,_p,vs,fs)=>{errors.push(_gl.getShaderInfoLog(vs),_gl.getShaderInfoLog(fs));};
  const pixelAt=(x,z)=>{const p=new THREE.Vector3(x,0,z).project(camera),data=new Uint8Array(4);const gl=renderer.getContext();gl.readPixels(Math.floor((p.x+1)*64),Math.floor((p.y+1)*64),1,1,gl.RGBA,gl.UNSIGNED_BYTE,data);return data[0];};
  updateRaceLighting(state,{brightness:.05,pose:{x:0,y:1,z:0}});renderer.render(scene,camera);
  const lit=pixelAt(0,100),far=pixelAt(0,900),behind=pixelAt(0,-50),side=pixelAt(300,100);
  updateRaceLighting(state,{brightness:.05,pose:{x:0,y:1,z:0,yaw:Math.PI}});renderer.render(scene,camera);const turnedAway=pixelAt(0,100);
  updateRaceLighting(state,{brightness:1,pose:{}});renderer.render(scene,camera);const day=pixelAt(0,100);
  renderer.dispose();plane.geometry.dispose();plane.material.dispose();return {lit,far,behind,side,turnedAway,day,errors};
 });
 expect(result.errors).toEqual([]);expect(result.lit).toBeGreaterThan(180);expect(result.far).toBeLessThan(result.lit);expect(result.behind).toBeLessThan(30);expect(result.side).toBeLessThan(30);expect(result.turnedAway).toBeLessThan(30);expect(result.day).toBeGreaterThan(240);
});
