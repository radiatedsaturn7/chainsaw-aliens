import {mergeGeometries} from '../../../vendor/three-addons/utils/BufferGeometryUtils.js';
import * as T from '../../vendorBridge/three.js';
import {automotiveMaterial,applyAutomotiveEnvironment} from '../../model3d/AutomotiveMaterials.js';
import {materialDoc} from './export.mjs';
const {sin,cos,PI}=Math;
const mapTexture=(source,linear=false)=>{
 if(!source)return null;const data=new Uint8Array(source.pixels.length*4);
 for(let i=0;i<source.pixels.length;i++){
  const value=source.pixels[i]??'#00000000',rgb=parseInt(value.slice(1,7),16),o=i*4;
  data[o]=rgb>>16;data[o+1]=(rgb>>8)&255;data[o+2]=rgb&255;data[o+3]=value.length===9?parseInt(value.slice(7),16):255;
 }
 const map=new T.DataTexture(data,source.width,source.height,T.RGBAFormat);
 map.colorSpace=linear?T.NoColorSpace:T.SRGBColorSpace;map.flipY=true;map.magFilter=T.LinearFilter;map.minFilter=T.LinearFilter;
 map.needsUpdate=true;return map;
};
const disposeStudioMaterial=m=>{
 for(const q of new Set([m.map,m.normalMap,m.roughnessMap,m.metalnessMap,m.aoMap]))q?.dispose();
 m.dispose();
};
const views={orbit:[.72,.26],front:[0,0],rear:[PI,0],frontElevated:[0,13*PI/180],rearElevated:[PI,14*PI/180],side:[PI/2,0],top:[0,PI/2]};
const clamp=(x,a,b)=>Math.max(a,Math.min(x,b));
const zebra=new T.ShaderMaterial({side:T.DoubleSide,
 vertexShader:`varying vec3 p; varying vec3 n;void main(){vec4 v=modelViewMatrix*vec4(position,1.);p=v.xyz;n=normalMatrix*normal;gl_Position=projectionMatrix*v;}`,
 fragmentShader:`varying vec3 p;varying vec3 n;uniform mat4 cameraWorld;uniform bool ortho;void main(){
  vec3 i=ortho?vec3(0.,0.,-1.):normalize(p);
  vec3 r=mat3(cameraWorld)*reflect(i,normalize(n)*(gl_FrontFacing?1.:-1.));
  float x=sin(32.*atan(r.y,length(r.xz))+7.*r.x);
  float a=max(0.05,0.75*fwidth(x));gl_FragColor=vec4(mix(vec3(0.023,0.030,0.041),vec3(0.95,0.97,1.),smoothstep(-a,a,x)),1.);}`,
 uniforms:{cameraWorld:{value:new T.Matrix4()},ortho:{value:false}}});
// For a screen-space click, compare to the projected segments rather than
// just the feature's sampled vertices. Returns a curve parameter and distance.
export function closestFeatureSegment(x,y,points){
 let hit=null;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  if(!a||!b||a.visible===false&&b.visible===false)continue;
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/Math.max(1e-12,den),0,1);
  const distance=Math.hypot(x-a.x-dx*t,y-a.y-dy*t);
  if(!hit||distance<hit.distance)hit={segment:i-1,t,distance};
 }
 return hit;
}

export function projectiveLineParameter(t,wStart,wEnd){
 if(wStart<=0||wEnd<=0)return null;
 return (t/wEnd)/((1-t)/wStart+t/wEnd);
}
export function createViewport(canvas,{onPick=()=>{},onFeature=null,onZoom=()=>{},onFailure=()=>{},onRender=()=>{}}={}){
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
 const featuresRoot=new T.Group();scene.add(featuresRoot);
 let activeFeature='',featureOverlay='off',byFeature=[];
 const curveStyles={
  selected:new T.LineBasicMaterial({color:'#ffe98a',depthTest:false,toneMapped:false}),
  rail:new T.LineBasicMaterial({color:'#82ebff',depthTest:true,transparent:true,opacity:.78,toneMapped:false}),
  seam:new T.LineBasicMaterial({color:'#57d4bc',depthTest:true,transparent:true,opacity:.75,toneMapped:false}),
  lamp:new T.LineBasicMaterial({color:'#a6bcff',depthTest:true,transparent:true,opacity:.79,toneMapped:false}),
  good:new T.LineBasicMaterial({color:'#8eff8b',depthTest:false,toneMapped:false}),
  warning:new T.LineBasicMaterial({color:'#ff906f',depthTest:false,toneMapped:false})
 };
 for(const m of Object.values(curveStyles))m.depthWrite=false;
 const edgeDots=new T.PointsMaterial({color:'#ffe98a',size:6,sizeAttenuation:false,depthTest:false,depthWrite:false,toneMapped:false});
 function removeFeatureLabels(){
  for(const x of featuresRoot.children)x.geometry.dispose();
  featuresRoot.clear();
 }
 function getFeatureShift(feature){
  if(display!=='exploded')return null;
  const mid=new T.Vector3().fromArray(feature.points[feature.points.length>>1]);
  let part=null,nearest=Infinity;
  for(const m of world.children){
   if(!m.visible||m.userData.component!==feature.component)continue;
   const d=mid.distanceToSquared(m.userData.center);
   if(d<nearest){part=m;nearest=d;}
  }
  return part?part.position.clone().sub(part.userData.home):null;
 }
 function featurePoints(feature){
  const d=getFeatureShift(feature);
  return feature.points.map(x=>new T.Vector3().fromArray(x)).map(x=>d?x.add(d):x);
 }
 function showFeatureLabels(){
  removeFeatureLabels();
  for(const feature of byFeature){
   const chosen=activeFeature===feature.id;
   if(display==='isolate'&&selected&&selected!==feature.component)continue;
   if(!chosen&&featureOverlay==='off')continue;
   if(!chosen&&featureOverlay==='alignment'&&!/edge|seam|rail|join|align|border|gap/.test(feature.type))continue;
   const worldPoints=featurePoints(feature);
   const palette=chosen?'selected':/optical|opening|lamp|head|tail|intake|grille/.test(feature.type)?'lamp':/seam|join|boundary/.test(feature.type)?'seam':'rail';
   const line=new T.Line(new T.BufferGeometry().setFromPoints(worldPoints),curveStyles[palette]);
   line.name='feature-'+feature.id;
   line.renderOrder=chosen?12:8;
   featuresRoot.add(line);
   if(chosen){
    const p=feature.handle?.anchor;
    const anchors=worldPoints.length<=2?worldPoints.slice():[worldPoints[0],worldPoints.at(-1)];
    if(Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)){
     const a=new T.Vector3().fromArray(p),d=getFeatureShift(feature);
     anchors.push(d?a.add(d):a);
    }
    const dots=new T.Points(new T.BufferGeometry().setFromPoints(anchors),edgeDots);
    dots.renderOrder=13;featuresRoot.add(dots);
   }
   const target=feature.metrics?.targetPoints??feature.metrics?.matchedPoints;
   if(featureOverlay==='alignment'&&Array.isArray(target)&&target.length===worldPoints.length){
    const good=[],bad=[],d=getFeatureShift(feature);
    for(let i=0;i<target.length;i++){
     if(!Array.isArray(target[i])||target[i].length!==3||!target[i].every(Number.isFinite))continue;
     const b=new T.Vector3().fromArray(target[i]);
     if(d)b.add(d);
     const gap=b.distanceTo(worldPoints[i]);
     if(gap>.00002)(gap<=.004?good:bad).push(worldPoints[i],b);
    }
    for(const [arr,key] of [[good,'good'],[bad,'warning']]){
     if(!arr.length)continue;
     const ticks=new T.LineSegments(new T.BufferGeometry().setFromPoints(arr),curveStyles[key]);
     ticks.renderOrder=13;featuresRoot.add(ticks);
    }
   }
  }
 }
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
  light=k;const outdoor=k==='track-clear',booth=k==='studio-strips';scene.background.set(outdoor?'#6c91b3':booth?'#77838d':'#263a4b');ground.material.color.set(outdoor?'#46535e':booth?'#6b757d':'#223445');
  key.intensity=outdoor?3.4:booth?1.42:2.38;fill.intensity=outdoor?.30:booth?.58:.88;ambient.intensity=outdoor?1.48:booth?1.32:1.24;
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
  shadow.visible=display==='complete';showFeatureLabels();request();
 }
 function setDesign(next){
  world.clear();highlight.clear();batches.forEach(g=>g.dispose());batches=[];for(const m of Object.values(mats))disposeStudioMaterial(m);mats={};
  geo=next;
  byFeature=Array.isArray(next.features)?next.features.filter(f=>typeof f?.id==='string'&&Array.isArray(f.points)
   &&f.points.length>=2&&f.points.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite))):[];
  if(!byFeature.some(x=>x.id===activeFeature))activeFeature='';
  const keys=new Set([...next.parts,...next.wheelParts].map(r=>r.material));
  for(const id of keys){
   const doc=materialDoc(next.genome,id);
   const glass=id==='glass',optic=id==='opticCover';
   const albedo=(!glass&&!optic)?mapTexture(doc.texture):null;
   const ormMap=mapTexture(doc.automotive.orm,true),normalMap=mapTexture(doc.automotive.normal,true);
   mats[id]=automotiveMaterial({color:doc.color,map:albedo,side:T.DoubleSide,transparent:glass||optic,opacity:optic?.19:glass?(next.genome.components.glass.type==='tinted'?.52:.31):1},
    doc.automotive,{ormMap,normalMap});
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
    const id=r.component+'|'+r.material+'|'+Boolean(r.geometry.index)+'|'+Object.keys(r.geometry.attributes).sort().join(',');
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
 function setView(next){if(!Object.hasOwn(views,next))return;[az,el]=views[next];view=next;pan.set(0,0,0);projection=next==='orbit'||next.endsWith('Elevated')?'perspective':'ortho';request();}
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
   const b=canvas.getBoundingClientRect(),sx=e.clientX-b.left,sy=e.clientY-b.top;
   const x=2*sx/b.width-1,y=1-2*sy/b.height;
   const meshes=world.children.filter(x=>x.visible);
   const feature=onFeature&&pickCurve(sx,sy,b.width,b.height,e.pointerType==='touch'?18:11,meshes);
   if(feature){activeFeature=feature.id;showFeatureLabels();request();onFeature(feature);}
   else {
    ray.setFromCamera(new T.Vector2(x,y),camActive);
    const hits=ray.intersectObjects(meshes);if(hits.length)onPick(hits[0].object.userData.component);
   }
  }drag.delete(e.pointerId);
 });canvas.addEventListener('pointercancel',e=>drag.delete(e.pointerId));
 canvas.addEventListener('wheel',e=>{e.preventDefault();setZoom(zoom*Math.exp(-e.deltaY*.002));},{passive:false});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();onFailure('3D context lost. Reopen the designer to restore the preview.');});
 const observer=new ResizeObserver(request);observer.observe(canvas);
 function pickCurve(sx,sy,width,height,threshold,meshes){
  if(!byFeature.length||!width||!height)return null;
  const candidates=[],q=new T.Vector3();
  for(const f of byFeature){
   if(display==='isolate'&&selected&&selected!==f.component)continue;
   const pts=featurePoints(f);
   const projected=pts.map(p=>{
    q.copy(p).project(camActive);
    return {x:(q.x*.5+.5)*width,y:(1-(q.y*.5+.5))*height,visible:q.z>=-1&&q.z<=1};
   });
   const nearest=closestFeatureSegment(sx,sy,projected);
   if(!nearest||nearest.distance>threshold)continue;
   const {segment:i,t,distance}=nearest,a=pts[i],b=pts[i+1];
   // The same screen interpolation in perspective is not affine in world
   // coordinates. Compensate by reciprocal clip W before sampling the rail.
   const A=camActive.isOrthographicCamera?1:-q.copy(a).applyMatrix4(camActive.matrixWorldInverse).z;
   const B=camActive.isOrthographicCamera?1:-q.copy(b).applyMatrix4(camActive.matrixWorldInverse).z;
   const fT=projectiveLineParameter(t,A,B);if(fT===null)continue;
   const point=a.clone().lerp(b,fT);
   candidates.push({f,point,distance,depth:camActive.position.distanceToSquared(point)});
  }
  candidates.sort((a,b)=>a.distance-b.distance||a.depth-b.depth);
  for(const datum of candidates.slice(0,12)){
   q.copy(datum.point).project(camActive);
   ray.setFromCamera(new T.Vector2(q.x,q.y),camActive);
   const hit=ray.intersectObjects(meshes,false)[0];
   const difference=datum.point.distanceTo(ray.ray.origin)-(hit?.distance??Infinity);
   if(difference<.035)return datum.f;
  }
  return null;
 }
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
  setFeature(id){activeFeature=typeof id==='string'?id:'';showFeatureLabels();request();},
  setFeatureOverlay(v){if(!['off','all','alignment'].includes(v))return;featureOverlay=v;showFeatureLabels();request();},
  state:()=>({mode,lift:el,az,zoom,projection,display,selected,feature:activeFeature,featureOverlay,light,view,drawCalls:renderer.info.render.calls,glError:renderer.getContext().getError()}),
  dispose(){observer.disconnect();removeFeatureLabels();Object.values(curveStyles).forEach(x=>x.dispose());edgeDots.dispose();batches.forEach(x=>x.dispose());if(frame)cancelAnimationFrame(frame);Object.values(mats).forEach(disposeStudioMaterial);Object.values(diagnostic).filter(x=>x!==zebra).forEach(x=>x.dispose());mask.dispose();ground.geometry.dispose();ground.material.dispose();shadow.geometry.dispose();shadow.material.dispose();shadowTex.dispose();grid.geometry.dispose();grid.material.dispose();renderer.dispose();renderer.forceContextLoss();}
 };
}
