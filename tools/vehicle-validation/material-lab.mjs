import * as T from '../../src/vendorBridge/three.js';
import {validateModelDocument} from '../../src/model3d/ModelDocument.js';
import {GarageModelPreview} from '../../src/menus/GarageModelPreview.js';
import {automotiveMaterial,applyAutomotiveEnvironment,automotiveEnvironment} from '../../src/model3d/AutomotiveMaterials.js';
import {inspectVehicleShader,vehicleRenderChannels} from '../../src/model3d/VehicleRenderDiagnostics.js';
import {updateRaceLighting} from '../../src/racing/RaceLighting.js';
const el=id=>document.getElementById(id);
const out=el('measure'),canvas=el('render');
for(const channel of vehicleRenderChannels){const opt=document.createElement('option');opt.value=opt.textContent=channel;el('channel').append(opt);}
async function readPack(part){
 const r=await fetch(new URL('../../src/model3d/wrx/fit10-'+part+'.pack',import.meta.url));if(!r.ok)throw Error('Unable to read '+part);
 return validateModelDocument(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).json());
}
try{
 const [body,wheel]=await Promise.all(['body','wheel'].map(readPack));
 const car={art:{bodyModel:{ref:'Field-Forgetmenot',position:[0,-.510368,-.2286],scale:[1,1,1]},
  wheelModel:{ref:'Field-Forgetmenot-Wheel',scale:[1,1,1]}},
  dimensions:{lengthM:4.41452,widthM:1.7399,trackFrontM:1.49098,trackRearM:1.4859,wheelbaseM:2.54}};
 const garage=new GarageModelPreview({library:{get:key=>key===car.art.bodyModel.ref?body:wheel}});
 if(!garage.prepare(car)||garage.wheels.children.length!==4)throw Error('Could not place roster vehicle');
 const scene=garage.scene,renderer=new T.WebGLRenderer({canvas,antialias:false,alpha:false});
 renderer.setSize(1080,650,false);
 renderer.outputColorSpace=T.SRGBColorSpace;
 scene.background=new T.Color('#273240');
 const camera=new T.PerspectiveCamera(46,1080/650,.1,90);
 const materialRoot=new T.Group();materialRoot.userData.automotiveMaterials=[];
 scene.add(materialRoot);
 const sphere=(x,y,z,r,spec,color,asPanel=false)=>{
  const material=automotiveMaterial({color},spec);materialRoot.userData.automotiveMaterials.push(material);
  const geometry=asPanel?new T.CylinderGeometry(r,r,.43,58,2,true,0,Math.PI*1.35):new T.SphereGeometry(r,48,30);
  if(asPanel)material.side=T.DoubleSide;
  const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);
  if(asPanel)mesh.rotation.z=Math.PI*.5;
  materialRoot.add(mesh);
 };
 sphere(-2,.57,-2.2,.30,{preset:'machined',metalness:1,roughness:.035},'#e8e8e8');
 sphere(-1.3,.57,-2.2,.30,{preset:'paint',roughness:.18,reflection:1},'#adb2b8');
 sphere(-.60,.57,-2.2,.30,body.materials.find(m=>m.automotive?.preset==='paint').automotive,'#124b9a');
 for(let i=0;i<5;i++)sphere(.11+i*.51,.57,-2.2,.21,{preset:'machined',metalness:1,roughness:.07+i*.20},'#bba466');
 for(let i=0;i<5;i++)sphere(.11+i*.51,.57,-2.8,.21,{preset:'machined',metalness:i*.25,roughness:.28},'#bba466');
 sphere(2.6,.53,-2.1,.35,{preset:'paint',roughness:.285,paintCalibration:true,paintClearcoatRoughness:.077},'#124b9a',true);
 const plane=new T.Mesh(new T.PlaneGeometry(45,45),new T.MeshStandardMaterial({color:'#4a4c4e',roughness:.94}));
 plane.rotation.x=-Math.PI/2;plane.position.y=-.013;scene.add(plane);
 const models=[garage.instance.root,...garage.wheelInstances.map(x=>x.root),materialRoot];
 const holder={scene};
 const gl=renderer.getContext();
 let restore=[],lastChannel='final',boundProbe=null,lastMs=0;
 const presets={
  front:[[-6,2.7,8],[0,.65,-.45]],rear:[[0,2.3,-8],[0,.63,0]],side:[[-9,2.4,.2],[0,.62,-.22]],
  hood:[[-2.8,2.1,3.75],[0,.75,1.31]],wheel:[[-3,1.0,2.65],[-.66,.39,1.25]],
  calibration:[[.35,3.35,1.3],[.3,.55,-2.47]]
 };
 function refresh(){
  const view=el('view').value,[pos,look]=presets[view];
  garage.carRoot.visible=view!=='calibration';garage.shadow.visible=view!=='calibration';
  materialRoot.visible=view==='calibration'||view==='front';
  const axis=new T.Vector3(0,1,0);
  garage.carRoot.rotation.y=Number(el('heading').value)*Math.PI/180;
  const point=new T.Vector3(...look);
  camera.position.copy(new T.Vector3(...pos).sub(point).applyAxisAngle(axis,Number(el('orbit').value)*Math.PI/180).add(point));
  camera.lookAt(point);camera.updateMatrixWorld();
  const env=el('probe').value;
  if(env!==boundProbe){
   for(const root of models){
    if(env==='none'){
     for(const m of root.userData.automotiveMaterials){m.envMap=null;m.needsUpdate=true;}
     root.userData.automotiveEnvironmentKey=null;
    }else applyAutomotiveEnvironment(root,env,renderer);
   }
   boundProbe=env;
  }
  const input=(id,fallback,min,max)=>{
   if(el(id).value==='')return fallback;
   const value=Number(el(id).value);return Number.isFinite(value)?Math.max(min,Math.min(max,value)):fallback;
  };
  const paint=garage.instance.root.userData.automotiveMaterials.find(m=>m.userData.automotive.preset==='paint');
  paint.metalness=input('metalness',0,0,1);paint.roughness=input('baseRoughness',.285,.0525,1);
  paint.clearcoatRoughness=input('coatRoughness',.077,.0525,1);
  scene.userData.rtgModelLights.fill.intensity=input('fill',2,0,3);
  const mode=el('outputMode').value;
  renderer.toneMapping=mode==='aces'?T.ACESFilmicToneMapping:mode==='neutral'?T.NeutralToneMapping??T.ReinhardToneMapping:T.NoToneMapping;
  renderer.toneMappingExposure=Number(el('exposure').value)||1;
  // Real race shader hook, not a replacement PBR implementation.
  updateRaceLighting(holder,{brightness:1,cameraPosition:camera.position});
  const channel=el('channel').value;
  if(lastChannel!==channel){
   restore.forEach(fn=>fn());restore=[];lastChannel=channel;
   for(const root of models)for(const mat of root.userData.automotiveMaterials)
    restore.push(inspectVehicleShader(mat,channel,{gain:channel.includes('specular')||channel==='clearcoat'?4:1}));
  }
  const start=performance.now();renderer.render(scene,camera);lastMs=performance.now()-start;
  const tex=boundProbe==='none'?null:automotiveEnvironment(boundProbe);
  out.textContent=`${body.name} and four native wheels. Target ${canvas.width}×${canvas.height}, ${renderer.info.render.calls} draws, CPU submit ${lastMs.toFixed(2)} ms.\n${tex?'Linear RGBA16F probe '+tex.image.width+'×'+tex.image.height+' ('+(tex.image.data.byteLength/1024).toFixed(0)+' KiB source, plus Three PMREM)':'Environment disabled'}; channel ${lastChannel}; ${gl.getError()?'WebGL error':'no WebGL error'}.`;
 }
 for(const id of ['channel','probe','outputMode','exposure','view','heading','orbit','metalness','baseRoughness','coatRoughness','fill'])
  el(id).addEventListener('input',refresh);
 el('reset-light').addEventListener('click',()=>{
   for(const [id,v] of Object.entries({metalness:0,baseRoughness:.285,coatRoughness:.077,fill:2}))el(id).value=v;
   refresh();
 });
 el('profile').addEventListener('click',async()=>{
  refresh();
  const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if(!ext){out.textContent+='\nGPU timer unavailable in this WebGL context.';return;}
  const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);renderer.render(scene,camera);gl.endQuery(ext.TIME_ELAPSED_EXT);
  try{
   for(let i=0;i<120;i++){
    await new Promise(r=>requestAnimationFrame(r));
    if(gl.getParameter(ext.GPU_DISJOINT_EXT)){out.textContent+='\nGPU timer disjoint. Repeat the capture.';return;}
    if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){out.textContent+='\nGPU: '+(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6).toFixed(2)+' ms (one warmed frame; local hardware only).';return;}
   }
   out.textContent+='\nGPU sample timed out.';
  }finally{gl.deleteQuery(q);}
 });
 refresh();document.body.dataset.ready='true';
}catch(e){out.textContent=e.stack;document.body.dataset.ready='error';throw e;}
