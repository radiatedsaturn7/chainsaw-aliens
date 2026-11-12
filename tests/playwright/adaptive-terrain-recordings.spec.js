import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import zlib from 'node:zlib';
const stored=JSON.parse(fs.readFileSync(new URL('../../data/server-storage/files/races/Ozark Backroads/document.json',import.meta.url)));
const document=stored.__chainsawStorage?JSON.parse(zlib.gunzipSync(Buffer.from(stored.data,'base64'))):stored;

test('Ozark recorded terrain locations render and match the adaptive height field',async({page},testInfo)=>{
 test.setTimeout(240000);
 await page.goto('/index.html');
 const result=await page.evaluate(async(document)=>{
  const {default:RaceEditor}=await import('/src/ui/RaceEditor.js');
  const THREE=await import('/src/vendorBridge/three.js');
  const {createAdaptiveTerrainField}=await import('/src/racing/RaceAdaptiveTerrain.js');
  const editor=new RaceEditor({});editor.applyLoadedRaceDocument(document);
  const bake=editor.buildRaceWorldBake({buildSurfaceSampler:false,retainTerrainCells:false,validate:false});
  const field=createAdaptiveTerrainField({surfaceBake:bake.surfaceBake,sampleGround:p=>editor.getRaceGroundElevationAtWorldPoint(p,0)});
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(640,360);
  renderer.domElement.id='adaptive-terrain-review';document=window.document;document.body.appendChild(renderer.domElement);
  const views=[{x:-5389.896603,z:-8529.456283,y:-58.722943,yaw:-2.85},{x:-4702.952143,z:-6692.8527,y:-5.763742,yaw:-2.552447}];
  const results=[];
  for(const view of views){
   const scene=new THREE.Scene();scene.background=new THREE.Color('#93b4ce');
   const groups={road:[],terrain:[]};
   for(const t of bake.mesh.triangles){
    if(!t.vertices.some(p=>Math.hypot(p.x-view.x,p.z-view.z)<180))continue;
    const out=groups[t.terrainCell?'terrain':'road'];for(const p of t.vertices)out.push(p.x-view.x,p.elevation*12,p.z-view.z);
   }
   for(const [type,positions] of Object.entries(groups)){
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    scene.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:type==='road'?'#666666':'#4d7951',side:THREE.DoubleSide})));
    if(type==='terrain')scene.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#183421',wireframe:true,transparent:true,opacity:.25,depthWrite:false})));
   }
   const camera=new THREE.PerspectiveCamera(60,640/360,.1,500);
   camera.position.set(-Math.sin(view.yaw)*12,view.y+8,-Math.cos(view.yaw)*12);
   camera.lookAt(Math.sin(view.yaw)*25,view.y-1,Math.cos(view.yaw)*25);
   renderer.render(scene,camera);
   const image=renderer.domElement.toDataURL();
   const ray=new THREE.Raycaster(),errors=[];
   for(let dx=-20;dx<=20;dx+=4)for(let dz=-20;dz<=20;dz+=4){
    const expected=field.sample(view.x+dx,view.z+dz);
    if(expected.distanceToRoad<6)continue;
    ray.set(new THREE.Vector3(dx,2000,dz),new THREE.Vector3(0,-1,0));
    const hits=ray.intersectObjects(scene.children.filter(o=>!o.material.wireframe));
    errors.push(hits.length?Math.abs(hits[0].point.y-expected.elevation*12):Infinity);
   }
   results.push({image,maxError:Math.max(...errors),missing:errors.filter(e=>!Number.isFinite(e)).length});
   for(const child of scene.children){child.geometry.dispose();child.material.dispose();}
  }
  renderer.dispose();return {views:results,stats:bake.terrainGenerationStats};
 },document);
 for(let i=0;i<result.views.length;i++){
  const view=result.views[i];await testInfo.attach(`ozark-recording-${i+1}`,{body:Buffer.from(view.image.split(',')[1],'base64'),contentType:'image/png'});
  expect(view.missing).toBe(0);expect(view.maxError).toBeLessThanOrEqual(.15);
 }
});
