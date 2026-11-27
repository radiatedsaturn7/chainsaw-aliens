import {mergeGeometries} from '../../../vendor/three-addons/utils/BufferGeometryUtils.js';
import * as T from '../../vendorBridge/three.js';
import {automotiveMaterial,applyAutomotiveEnvironment} from '../../model3d/AutomotiveMaterials.js';
import {materialDoc} from './export.mjs';
const {sin,cos,PI}=Math;
const views={orbit:[.72,.26],front:[0,0],rear:[PI,0],side:[PI/2,0],top:[0,PI/2]};
const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
const zebra=new T.ShaderMaterial({side:T.DoubleSide,
 vertexShader:`varying vec3 p; varying vec3 n;void main(){vec4 v=modelViewMatrix*vec4(position,1.);p=v.xyz;n=normalMatrix*normal;gl_Position=projectionMatrix*v;}`,
 fragmentShader:`varying vec3 p;varying vec3 n;uniform mat4 cameraWorld;uniform bool ortho;void main(){
  vec3 i=ortho?vec3(0.,0.,-1.):normalize(p);
  vec3 r=mat3(cameraWorld)*reflect(i,normalize(n)*(gl_FrontFacing?1.:-1.));
  float x=sin(32.*atan(r.y,length(r.xz))+7.*r.x);
  float a=max(0.05,0.75*fwidth(x));gl_FragColor=vec4(mix(vec3(0.023,0.030,0.041),vec3(0.95,0.97,1.),smoothstep(-a,a,x)),1.);}`,
 uniforms:{cameraWorld:{value:new T.Matrix4()},ortho:{value:false}}});
export function createViewport(canvas,{onPick=()=>{},onZoom=()=>{},onFailure=()=>{},onRender=()=>{}}={}){
 const scene=new T.Scene();scene.background=new T.Color('#243747');
 const renderer=new T.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(Math.min(1.6,devicePixelRatio||1));renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
 const cam=new T.PerspectiveCamera(39,1,.04,90),or=new T.OrthographicCamera(-2,2,2,-2,.04,90);
 const world=new T.Group();world.userData.automotiveMaterials=[];scene.add(world);
 const grid=new T.GridHelper(28,56,0x4a6276,0x334958);scene.add(grid);
 const ground=new T.Mesh(new T.PlaneGeometry(80,80),new T.MeshStandardMaterial({color:0x223445,roughness:.94}));ground.rotation.x=-PI/2;ground.position.y=-.019;scene.add(ground);
 const shadowSize=96,texels=new Uint8Array(shadowSize*shadowSize*4);
 for(let y=0;y<shadowSize;y++)for(let x=0;x<shadowSize;x++){
  const q=4*(x+y*shadowSize),u=Math.abs(2*x/(shadowSize-1)-1),v=Math.abs(2*y/(shadowSize-1)-1);
  texels[q+3]=Math.round(154*Math.max(0,1-u**3.4-v**3.8)**2);
 }
 const shadowTex=new T.DataTexture(texels,shadowSize,shadowSize);shadowTex.magFilter=T.LinearFilter;shadowTex.needsUpdate=true;
 const shadow=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));
 shadow.rotation.x=-PI/2;shadow.position.y=.006;scene.add(shadow);
 const key=new T.DirectionalLight(0xe8f4ff,2.62);key.position.set(4.2,7,4.8);scene.add(key);
 const fill=new T.DirectionalLight(0xffddca,.82);fill.position.set(-3,2,-4);scene.add(fill);
 const ambient=new T.HemisphereLight(0xc9e5ff,0x445a67,1.44);scene.add(ambient);
 const diagnostic={
  clay:new T.MeshStandardMaterial({color:'#b6b9bc',roughness:.68,side:T.DoubleSide}),
  glossy:new T.MeshPhysicalMaterial({color:'#607286',roughness:.14,metalness:.36,clearcoat:1,clearcoatRoughness:.082,side:T.DoubleSide}),
  wire:new T.MeshBasicMaterial({color:'#a1e2fe',wireframe:true,side:T.DoubleSide}),
  normals:new T.MeshNormalMaterial({side:T.DoubleSide}),zebra
 };
 const mask=new T.MeshBasicMaterial({color:'#74eed3',wireframe:false,transparent:true,opacity:.19,depthWrite:false,side:T.DoubleSide,
  polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const ray=new T.Raycaster();let selected='',mode='production',light='studio',view='orbit',projection='perspective',display='complete',frame=0,geo=null,camActive=cam,mats={},az=.72,el=.26,zoom=1.18,pan=new T.Vector3(),batches=[],drag=new Map(),dragChanged=false;
 const highlight=new T.Group();scene.add(highlight);
 const request=()=>{if(!frame)frame=requestAnimationFrame(render);};
 function camera(){
  const w=canvas.clientWidth,h=canvas.clientHeight,aspect=w/Math.max(1,h),dist=(geo?.metadata?.lengthM??4.4)*1.88/zoom*Math.max(1,.95/aspect);
  const ortho=projection==='ortho',c=ortho?or:cam;cam.aspect=aspect;cam.updateProjectionMatrix();
  const ey=new T.Vector3(sin(az)*cos(el),sin(el),cos(az)*cos(el)).multiplyScalar(dist);
  const center=pan.clone().add(new T.Vector3(0,(geo?.metadata.heightM??1.4)*.44,0));
  if(ortho){const extent=dist*.343;or.left=-extent*aspect;or.right=extent*aspect;or.top=extent;or.bottom=-extent;or.updateProjectionMatrix();}
  c.position.copy(center).add(ey);c.up.set(0,view==='top'?0:1,view==='top'?-1:0);c.lookAt(center);c.updateMatrixWorld();camActive=c;zebra.uniforms.cameraWorld.value.copy(c.matrixWorld);zebra.uniforms.ortho.value=ortho;
  return [w,h];
 }
 function render(){frame=0;const [w,h]=camera();if(!w||!h)return;const size=renderer.getSize(new T.Vector2());if(size.x!==w||size.y!==h)renderer.setSize(w,h,false);renderer.render(scene,camActive);onRender();}
 function setLighting(k){
  light=k;const outdoor=k==='track-clear';scene.background.set(outdoor?'#6c91b3':'#263a4b');ground.material.color.set(outdoor?'#46535e':'#223445');
  key.intensity=outdoor?3.4:2.38;fill.intensity=outdoor?.30:.88;ambient.intensity=outdoor?1.48:1.24;
  applyAutomotiveEnvironment(world,k,renderer);
  diagnostic.glossy.envMap=Object.values(mats).find(m=>m.envMap)?.envMap||null;diagnostic.glossy.needsUpdate=true;request();
 }
 function restyle(){
  highlight.clear();
  for(const m of world.children){
   const key=m.userData.component,wanted=key===selected;
   m.visible=display!=='isolate'||!selected||wanted;
   m.material=mode==='production'?mats[m.userData.surface]:diagnostic[mode];
   m.position.copy(m.userData.home);
   if(display==='exploded'){
    const p=m.userData.center,delta=new T.Vector3((p.x<-.10?-1:p.x>.10?1:0)*.48,.30+Math.max(0,p.y-.5)*.27,p.z*.31);
    if(['wheels','tires'].includes(key))delta.x*=2;
    m.position.add(delta);
   }
   if(wanted&&m.visible&&display!=='isolate'&&mode==='production'){
    const outline=new T.Mesh(m.geometry,mask);outline.position.copy(m.position);outline.quaternion.copy(m.quaternion);outline.renderOrder=4;
    highlight.add(outline);
   }
  }
  shadow.visible=display==='complete';request();
 }
 function setDesign(next){
  world.clear();highlight.clear();batches.forEach(g=>g.dispose());batches=[];for(const m of Object.values(mats))m.dispose();mats={};
  geo=next;
  const keys=new Set([...next.parts,...next.wheelParts].map(r=>r.material));
  for(const id of keys){
   const doc=materialDoc(next.genome,id,{texture:false});
   const glass=id==='glass',optic=id==='opticCover';
   mats[id]=automotiveMaterial({color:doc.color,side:T.DoubleSide,transparent:glass||optic,opacity:optic?.19:glass?(next.genome.components.glass.type==='tinted'?.52:.31):1},
    doc.automotive);
   if(optic){mats[id].opacity=.19;mats[id].transparent=true;mats[id].depthWrite=false;}
  }
  world.userData.automotiveMaterials=Object.values(mats);
  delete world.userData.automotiveEnvironmentKey;
  const append=(p,location=null)=>{
   const m=new T.Mesh(p.geometry,mats[p.material]);if(location)m.position.fromArray(location);
   if(location?.[0]<0)m.rotation.y=PI;
   m.userData={component:p.component,surface:p.material,home:m.position.clone(),center:p.geometry.boundingBox.getCenter(new T.Vector3()).add(m.position)};
   world.add(m);
  };
  const appendBatch=(parts,p=null)=>{
   const groups=new Map();
   for(const r of parts){
    const id=r.component+'|'+r.material;
    if(!groups.has(id))groups.set(id,[]);
    groups.get(id).push(r);
   }
   for(const group of groups.values()){
    if(group.length===1){append(group[0],p);continue;}
    const geometry=mergeGeometries(group.map(q=>q.geometry));
    if(!geometry){group.forEach(x=>append(x,p));continue;}
    geometry.computeBoundingBox();batches.push(geometry);
    append({...group[0],geometry},p);
   }
  };
  appendBatch(next.parts);
  Object.values(next.wheels).forEach(pos=>appendBatch(next.wheelParts,pos));
  shadow.scale.set(next.metadata.widthM*1.46,next.metadata.lengthM*1.19,1);
  setLighting(light);restyle();
 }
 function setView(next){if(!Object.hasOwn(views,next))return;[az,el]=views[next];view=next;pan.set(0,0,0);projection=next==='orbit'?'perspective':'ortho';request();}
 function setZoom(v){zoom=clamp(v,1,4);onZoom(zoom);request();}
 function nudge(dx,dy){const c=camActive;const ms=(geo?.metadata.lengthM??4.4)/Math.max(80,canvas.clientHeight)/zoom;
  pan.addScaledVector(new T.Vector3().setFromMatrixColumn(c.matrixWorld,0),-dx*ms).addScaledVector(new T.Vector3().setFromMatrixColumn(c.matrixWorld,1),dy*ms);request();
 }
 canvas.addEventListener('pointerdown',e=>{if(e.button>1)return;if(!drag.size)dragChanged=false;else dragChanged=true;canvas.setPointerCapture(e.pointerId);drag.set(e.pointerId,[e.clientX,e.clientY,e.clientX,e.clientY]);});
 canvas.addEventListener('pointermove',e=>{
  const prev=drag.get(e.pointerId);if(!prev)return;
  const dx=e.clientX-prev[0],dy=e.clientY-prev[1];
  if(Math.hypot(e.clientX-prev[2],e.clientY-prev[3])>4)dragChanged=true;
  if(drag.size===2){
   const other=[...drag].find(([id])=>id!==e.pointerId)[1];const dist=(x,y)=>Math.hypot(x-other[0],y-other[1]);
   setZoom(zoom*clamp(dist(e.clientX,e.clientY)/Math.max(8,dist(...prev)),.71,1.39));nudge(dx/2,dy/2);
  }else if(dragChanged){
   if(e.shiftKey||e.buttons===4||(projection==='ortho'&&view!=='orbit'))nudge(dx,dy);
   else{az-=dx*.008;el=clamp(el+dy*.007,-1.28,1.56);view='orbit';request();}
  }
  drag.set(e.pointerId,[e.clientX,e.clientY,prev[2],prev[3]]);
 });
 canvas.addEventListener('pointerup',e=>{
  if(drag.size===1&&!dragChanged){
   const b=canvas.getBoundingClientRect(),x=2*(e.clientX-b.left)/b.width-1,y=1-2*(e.clientY-b.top)/b.height;
   ray.setFromCamera(new T.Vector2(x,y),camActive);
   const hits=ray.intersectObjects(world.children.filter(x=>x.visible));if(hits.length)onPick(hits[0].object.userData.component);
  }drag.delete(e.pointerId);
 });canvas.addEventListener('pointercancel',e=>drag.delete(e.pointerId));
 canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.002));},{passive:false});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onFailure('3D context lost. Reopen the designer to restore the preview.');});
 const observer=new ResizeObserver(request);observer.observe(canvas);
 function project(p){
  const [w,h]=camera();
  const q=new T.Vector3().fromArray(p).project(camActive);
  return {x:(q.x*.5+.5)*w,y:(1-(q.y*.5+.5))*h,visible:q.z>=-1&&q.z<=1&&Math.abs(q.x)<=1&&Math.abs(q.y)<=1};
 }
 function unprojectAt(x,y,p){
  const [w,h]=camera();if(!w||!h)return null;
  const origin=new T.Vector3().fromArray(p),normal=camActive.getWorldDirection(new T.Vector3());
  ray.setFromCamera(new T.Vector2(2*x/w-1,1-2*y/h),camActive);
  const point=ray.ray.intersectPlane(new T.Plane().setFromNormalAndCoplanarPoint(normal,origin),new T.Vector3());
  return point?.toArray()??null;
 }
 return {setDesign,setView,project,unprojectAt,nudge,focusWorld(p){pan.fromArray(p);pan.y-=(geo?.metadata.heightM??1.4)*.44;request();},setZoom,setLighting,resetPan(){pan.set(0,0,0);request();},
  setProjection(p){projection=p;request();},setMode(m){if(m!=='production'&&!diagnostic[m])return;mode=m;restyle();},
  setDisplay(d){display=d;restyle();},select(s){selected=s;restyle();},
  state:()=>({mode,lift:el,az,zoom,projection,display,selected,light,view,drawCalls:renderer.info.render.calls,glError:renderer.getContext().getError()}),
  dispose(){observer.disconnect();batches.forEach(x=>x.dispose());if(frame)cancelAnimationFrame(frame);Object.values(mats).forEach(x=>x.dispose());Object.values(diagnostic).filter(x=>x!==zebra).forEach(x=>x.dispose());mask.dispose();ground.geometry.dispose();ground.material.dispose();shadow.geometry.dispose();shadow.material.dispose();shadowTex.dispose();grid.geometry.dispose();grid.material.dispose();renderer.dispose();}
 };
}
