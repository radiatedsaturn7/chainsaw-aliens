import * as THREE from '../../vendorBridge/three.js';
import { PARAMS,PRESETS,createGenome,normalizeGenome,setParameter,setControl,buildFender,exportOBJ } from './surface.mjs';
import {validateMesh} from './validate.mjs';

const $ = id => document.getElementById(id);
const controls = new Map(), history = [];
const modes = ['clay','gloss','zebra','wire','normals'];
const views = ['orbit','side','front','top'];
const baselineCache=new Map();
const state = { genome:createGenome('wrx'), surface:null, good:null, view:'orbit', mode:'clay', selected:null, refs:null, valid:false, renders:0 };
const copy = x => JSON.parse(JSON.stringify(x));
const clamp=(x,l,h)=>Math.max(l,Math.min(h,x));
const human=s=>s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,s=>s.toUpperCase());
const paramValue=(genome,key,def)=>genome.parameters?.[key]??genome.params?.[key]??genome[key]??def;
const presetId=g=>String(g.presetId??g.preset??g.id??g.model??'wrx').toLowerCase();
const status=$('status'), canvas=$('scene'), viewport=$('viewport');
const scene=new THREE.Scene();scene.background=new THREE.Color('#1b2939');
const camera=new THREE.PerspectiveCamera(39,1,.015,50);
const ortho=new THREE.OrthographicCamera(-1,1,1,-1,.015,50);
let current=camera, renderer, frame=0;
const ang={az:.95,el:.22,d:2.65,extent:.92};
const target=new THREE.Vector3(.76,.53,1.35);
const ray=new THREE.Raycaster();
const sun=new THREE.DirectionalLight(0xe8f4ff,3.05);sun.position.set(2.6,5,2.5);scene.add(sun);
const fill=new THREE.DirectionalLight(0xf2d8bf,1.25);fill.position.set(-2.4,1,-2.4);scene.add(fill);
scene.add(new THREE.HemisphereLight(0xd2ecff,0x394d61,1.95));
const grid=new THREE.GridHelper(5,40,0x35485e,0x243447);grid.position.set(0,-.004,0);scene.add(grid);
const ax=new THREE.AxesHelper(.19);ax.position.set(.31,.002,.52);scene.add(ax);
const clay=new THREE.MeshStandardMaterial({color:0xb9c4ce,roughness:.73,metalness:.04,side:THREE.DoubleSide});
const gloss=new THREE.MeshPhysicalMaterial({color:0x818589,roughness:.185,metalness:.26,clearcoat:.95,clearcoatRoughness:.12,side:THREE.DoubleSide});
function studioEnvironment(){
 const w=128,h=64,data=new Float32Array(w*h*4);
 const strips=[
  {u:.115,v:.30,uw:.066,vh:.080,p:5.8,tilt:.065},
  {u:.335,v:.50,uw:.14,vh:.021,p:9.0,tilt:-.12},
  {u:.600,v:.37,uw:.075,vh:.108,p:6.2,tilt:0},
  {u:.835,v:.51,uw:.12,vh:.024,p:5.5,tilt:.10}
 ];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const u=(x+.5)/w,v=(y+.5)/h;let light=.12+Math.cos(v*2.9)*.048;
  for(const s of strips){
   let a=Math.abs(u-s.u);a=Math.min(a,1-a);
   const b=Math.abs(v-s.v-(u-s.u)*s.tilt);
   const k=Math.pow(a/s.uw,8)+Math.pow(b/s.vh,8);
   light+=s.p*Math.exp(-k);
  }
  const i=(y*w+x)*4;data[i]=light;data[i+1]=light;data[i+2]=light;data[i+3]=1;
 }
 const tex=new THREE.DataTexture(data,w,h,THREE.RGBAFormat,THREE.FloatType);
 tex.mapping=THREE.EquirectangularReflectionMapping;tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.needsUpdate=true;
 const convolution=new THREE.PMREMGenerator(renderer);
 const pmrem=convolution.fromEquirectangular(tex);
 gloss.envMap=pmrem.texture;gloss.envMapIntensity=.84;gloss.needsUpdate=true;convolution.dispose();tex.dispose();
}
const wire=new THREE.MeshBasicMaterial({color:0x7dd2ff,wireframe:true,side:THREE.DoubleSide});
const normal=new THREE.MeshNormalMaterial({side:THREE.DoubleSide});
const zebra=new THREE.ShaderMaterial({side:THREE.DoubleSide,
 vertexShader:'varying vec3 n; varying vec3 p; void main(){ n=normalize(normalMatrix*normal); vec4 v=modelViewMatrix*vec4(position,1.); p=v.xyz; gl_Position=projectionMatrix*v; }',
 fragmentShader:'varying vec3 n; varying vec3 p; void main(){ vec3 q=reflect(normalize(p),normalize(n)); float a=atan(q.z,q.x)*.83+q.y*.47; float v=sin(a*24.); float w=max(fwidth(v),.015); gl_FragColor=vec4(mix(vec3(.045,.066,.089),vec3(.89,.94,.96),smoothstep(-w,w,v)),1.); }'});
const materials={clay,gloss,zebra,wire,normals:normal};
const surfaceObject=new THREE.Mesh(new THREE.BufferGeometry(),clay);scene.add(surfaceObject);
const networkGroup=new THREE.Group();scene.add(networkGroup);
const handles=new THREE.Group();scene.add(handles);
const handleGeom=new THREE.SphereGeometry(.008,8,5);
const handleMat=new THREE.MeshBasicMaterial({color:0x7ce8db,depthTest:false});
const selectedMat=new THREE.MeshBasicMaterial({color:0xffcd85,depthTest:false});
const cageMat=new THREE.LineBasicMaterial({color:0x4ca89b,depthTest:false,transparent:true,opacity:.68});
const networkMaterial=new THREE.MeshStandardMaterial({color:0x627e91,roughness:.84,metalness:.08,side:THREE.DoubleSide,transparent:true,opacity:.66,depthWrite:false});
const railMaterials=[new THREE.LineBasicMaterial({color:0xa1d7e9}),new THREE.LineBasicMaterial({color:0xf4a98e})];

function geometry(mesh) {
 if(!mesh?.positions?.length || !mesh?.indices?.length) throw Error('No indexed surface from solver.');
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(mesh.positions.flat?.()??mesh.positions,3));
 if(mesh.normals?.length) g.setAttribute('normal',new THREE.Float32BufferAttribute(mesh.normals.flat?.()??mesh.normals,3));
 g.setIndex(Array.from(mesh.indices.flat?.()??mesh.indices));if(!g.attributes.normal)g.computeVertexNormals();g.computeBoundingSphere();
 return g;
}
function points(x){if(!x?.length)return [];if(typeof x[0]==='number'){return Array.from({length:Math.floor(x.length/3)},(_,i)=>[x[3*i],x[3*i+1],x[3*i+2]]);}return x.map(p=>Array.isArray(p)||ArrayBuffer.isView(p)?p:p.position??[p.x,p.y,p.z]);}
function edgeRail(mesh,name){
 const explicit=mesh?.rails?.[name];if(explicit?.length && typeof explicit[0]!=='number')return points(explicit);
 if(typeof mesh?.eval!=='function')return [];
 return Array.from({length:37},(_,i)=>mesh.eval(i/36,name==='hood'?0:1));
}
function line(points,material,asSegments=false){const g=new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));return asSegments?new THREE.LineSegments(g,material):new THREE.Line(g,material);}
function clearGroup(group){for(const x of [...group.children]){group.remove(x);if(x.geometry!==handleGeom)x.geometry?.dispose();}}
function rebuildCage(mesh){
 clearGroup(handles);
 const cs=mesh?.controls??[];
 const cols=mesh?.controlCols??mesh?.cols??0, rows=mesh?.controlRows??mesh?.rows??0;
 const list=[];
 for(let i=0;i<cs.length;i++){
   const c=cs[i],p=c.position??c;
   if(!Array.isArray(p)&&!ArrayBuffer.isView(p))continue;
   const x=new THREE.Mesh(handleGeom,String(c.index??i)===String(state.selected)?selectedMat:handleMat);
   x.position.fromArray(p);x.userData.index=c.index??i;x.renderOrder=40;
   if(String(c.index??i)===String(state.selected))x.scale.setScalar(1.42);
   handles.add(x);
   if(cols>1&&rows>1&&i%cols>0)list.push(cs[i-1].position,p);
   if(cols>1&&rows>1&&i>=cols)list.push(cs[i-cols].position,p);
 }
 if(list.length){const l=line(list,cageMat,true);l.renderOrder=39;handles.add(l);}
 handles.visible=$('cage').checked;
 const select=$('point');select.replaceChildren(new Option('None',''),...cs.map((c,i)=>new Option(c.label??('Point '+(i+1)+' · Station '+((c.station??0)+1)),String(c.index??i))));
 select.value=state.selected==null?'':String(state.selected);
 syncPoint(mesh);
}
function rebuildNetwork(mesh){
 clearGroup(networkGroup);
 if(state.networkMeshes){
  try{
   const network=state.networkMeshes(mesh,state.genome);
   state.networkDiagnostics=network?.diagnostics;
   const list=Array.isArray(network)?network:(network?.meshes??network);
   for(const [name,m] of Object.entries(list??{})){
    if(!m?.positions||!m?.indices)continue;
    const object=new THREE.Mesh(geometry(m),networkMaterial);object.name=name;networkGroup.add(object);
   }
  }catch(e){console.warn('Adjacent panels unavailable',e);}
 }
 for(const [i,name] of ['hood','bumper'].entries()){
  const rail=edgeRail(mesh,name);if(rail.length>1)networkGroup.add(line(rail,railMaterials[i]));
 }
 networkGroup.visible=$('network').checked;
}
function diagnosis(mesh,error){
 const d=mesh?.diagnostics??{};
 state.valid=!!mesh && d.valid!==false && !error;
 status.classList.toggle('invalid',!state.valid);
 status.dataset.valid=String(state.valid);
 status.querySelector('span').textContent=state.valid?'Valid surface':state.good?'Invalid / holding last valid':'Invalid surface';
 const details=$('diagnostics');details.replaceChildren();
 const read={'Triangles':mesh?Math.round(mesh.indices.length/3):'–'};
 for(const [key,val] of Object.entries(d)){
  if(['valid','triangles'].includes(key)||val==null)continue;
  if(key==='bounds'&&Array.isArray(val)){read['Panel extents (m)']=val[1]?.map((x,i)=>(x-val[0][i]).toFixed(3)).join(' × ');continue;}
  read[human(key)]=Array.isArray(val)?(val.length?val.join(', '):'None'):typeof val==='object'?JSON.stringify(val):typeof val==='number'?Number(val.toPrecision(5)):String(val);
 }
 const seam=state.networkDiagnostics;
 if(seam&&state.valid&&$('network').checked){
  read['Panel gap target (mm)']=seam.gapTargetMm??'–';
  read['Crown tangent deviation (°)']=seam.hoodTangentResidualDegrees?.max?.toFixed?.(3)??'–';
 }
 if(error)read.Error=error.message??String(error);
 for(const [name,val] of Object.entries(read)){
  const a=document.createElement('dt');a.textContent=name;
  const b=document.createElement('dd');b.textContent=String(val);
  details.append(a,b);
 }
 $('export').disabled=!state.valid;$('undo').disabled=!history.length;
 document.documentElement.dataset.surfaceValid=String(state.valid);
}
function refresh({fit=false,sync=true}={}){
 let mesh,error;
 try{mesh=buildFender(state.genome);
  if(mesh?.diagnostics?.valid!==false){
   const g=geometry(mesh);surfaceObject.geometry.dispose();surfaceObject.geometry=g;
   state.good=mesh;state.surface=mesh;rebuildCage(mesh);rebuildNetwork(mesh);
  }
 }catch(e){error=e;}
 state.candidate=mesh;
 diagnosis(mesh,error);
 if(sync)syncInputs();
 if(fit)fitCamera();
 renderSoon();
 document.dispatchEvent(new CustomEvent('lotg-surface-studio-changed',{detail:{genome:copy(state.genome),valid:state.valid}}));
 return state.valid;
}
function syncInputs(){
 for(const [key,{def,slider,num}] of controls){const val=paramValue(state.genome,key,def.default);slider.value=val;num.value=val;}
 const p=presetId(state.genome);if([...$('preset').options].some(x=>x.value===p))$('preset').value=p;
 syncPoint(state.candidate??state.good);
}
function remember(){history.push(copy(state.genome));if(history.length>75)history.shift();$('undo').disabled=false;}
function applyGenome(g,{record=true,fit=false}={}){
 if(!g||typeof g!=='object'||Array.isArray(g))throw new TypeError('Expected a saved surface genome.');
 const normalized=normalizeGenome(g);
 if(record)remember();state.genome=normalized;
 if(fit)state.selected=null;
 return refresh({fit});
}
function updateParameter(key,value,record){
 if(!Number.isFinite(value)||!Object.hasOwn(PARAMS,key))return false;
 if(record)remember();
 const d=PARAMS[key];state.genome=setParameter(state.genome,key,clamp(value,d.min,d.max));
 return refresh();
}
function paramFields(){
 const root=$('parameters'), groups=new Map();
 root.className='parameters';
 for(const [key,def] of Object.entries(PARAMS)){
  const name=def.group??'Shape';
  if(!groups.has(name)){
    const section=document.createElement('section');section.className='parameter-group';const t=document.createElement('h3');t.textContent=name;section.append(t);root.append(section);groups.set(name,section);
  }
  const row=document.createElement('div');row.className='param';
  const label=document.createElement('label');label.textContent=def.label??human(key);label.htmlFor='param-'+key;
  const slider=document.createElement('input'),num=document.createElement('input');
  for(const [el,type,id] of [[slider,'range','param-'],[num,'number','num-']]){
    el.type=type;el.id=id+key;el.dataset.parameter=key;el.min=def.min;el.max=def.max;el.step=def.step;el.setAttribute('aria-label',label.textContent+(type==='number'?' numeric':''));
  }
  slider.addEventListener('input',()=>{if(!slider._open){remember();slider._open=true;}updateParameter(key,Number(slider.value),false);});
  slider.addEventListener('change',()=>{slider._open=false;});
  num.addEventListener('change',()=>{if(num.value!=='')updateParameter(key,Number(num.value),true);else syncInputs();});
  row.append(label,slider,num);groups.get(name).append(row);controls.set(key,{def,slider,num});
 }
}
function pointDelta(index,axis){
  const axisI='xyz'.indexOf(axis);
  const d=state.genome.overrides?.[index]??state.genome.controlDeltas?.[index]??state.genome.deltas?.[index]??state.genome.controlOffsets?.[index]??state.genome.controls?.[index]?.delta??state.genome.offsets?.[index];
  if(d!=null) return Number(d[axisI]??d[axis]??0);
  return Number(state.genome.controlDeltas?.[index+':'+axis]??0);
}
function updatePoint(index,axis,delta,record=true){
 if(!Number.isFinite(delta)||index==null)return false;
 if(record)remember();
 state.genome=setControl(state.genome,Number(index),axis,clamp(delta,-.014,.014));
 return refresh();
}
function selectPoint(index){
 state.selected=index;
 rebuildCage(state.good);
 renderSoon();
}
function syncPoint(mesh){
 const cs=mesh?.controls??[];
 const x=cs.find((c,i)=>String(c.index??i)===String(state.selected));
 const coords=x?.position??x;
 $('point-help').textContent=coords?'Position (m): '+Array.from(coords).map(p=>p.toFixed(3)).join(' / '):'Pick a point on the cage, or select it below.';
 for(const axis of 'xyz'){const el=$('axis-'+axis);if(!el)continue;el.disabled=!x;el.value=x?String(Math.round(pointDelta(state.selected,axis)*100000)/100):'';}
 $('reset-point').disabled=!x;
}
function axisFields(){
 for(const a of 'xyz'){
  const label=document.createElement('label');label.textContent=a.toUpperCase()+' Δ mm';
  const input=document.createElement('input');input.type='number';input.step='1';input.min='-14';input.max='14';input.disabled=true;input.id='axis-'+a;
  input.addEventListener('change',()=>{if(input.value!=='')updatePoint(state.selected,a,Number(input.value)/1000);else syncPoint(state.good);});
  label.append(input);$('axes').append(label);
 }
}
function fitCamera(){
 const g=surfaceObject.geometry; if(g.attributes.position?.count){
  g.computeBoundingBox();const b=g.boundingBox.clone();
  if(networkGroup.visible)for(const obj of networkGroup.children){if(obj.isMesh){obj.geometry.computeBoundingBox();b.union(obj.geometry.boundingBox);}}
  const size=b.getSize(new THREE.Vector3());b.getCenter(target);
  const aspect=Math.max(.3,viewport.clientWidth/Math.max(1,viewport.clientHeight));
  const spread=Math.max(size.y,size.z/Math.min(1,aspect),size.x)/2;
  ang.extent=Math.max(.42,spread*1.28);ang.d=Math.max(1.65,spread*3.85);
 }
 updateCamera();
}
function updateCamera(){
 const aspect=Math.max(.25,viewport.clientWidth/Math.max(1,viewport.clientHeight));
 if(state.view==='orbit'){
  current=camera;camera.aspect=aspect;
  camera.position.set(target.x+ang.d*Math.cos(ang.el)*Math.sin(ang.az),target.y+ang.d*Math.sin(ang.el),target.z+ang.d*Math.cos(ang.el)*Math.cos(ang.az));
  camera.up.set(0,1,0);
 }else{
  current=ortho;ortho.top=ang.extent;ortho.bottom=-ang.extent;ortho.left=-ang.extent*aspect;ortho.right=ang.extent*aspect;
  ortho.up.set(0,state.view==='top'?0:1,state.view==='top'?1:0);
  ortho.position.copy(target).add(state.view==='front'?new THREE.Vector3(0,0,4):state.view==='top'?new THREE.Vector3(0,4,0):new THREE.Vector3(4,0,0));
 }
 current.lookAt(target);current.updateProjectionMatrix();current.updateMatrixWorld();
}
function renderSoon(){
 if(frame)return;
 frame=requestAnimationFrame(()=>{frame=0;updateCamera();if(renderer){renderer.render(scene,current);state.renders++;}renderReference();});
}
function setView(view){
 if(!views.includes(view))return;
 state.view=view;
 for(const x of $('views').querySelectorAll('button'))x.setAttribute('aria-pressed',String(x.dataset.view===view));
 $('view-badge').textContent=(view==='orbit'?'PERSPECTIVE':view.toUpperCase()+' / ORTHOGRAPHIC')+' · METRES';
 $('hint').textContent=view==='orbit'?'Drag to orbit · Scroll to zoom':'Orthographic view · Scroll to zoom';
 renderSoon();
}
function setMode(mode){
 if(!modes.includes(mode))return;
 state.mode=mode;$('shading').value=mode;surfaceObject.material=materials[mode];renderSoon();
}
function pointer(){
 let drag=null;
 function cameraNdc(x,y){const b=viewport.getBoundingClientRect();return new THREE.Vector2((x-b.left)/b.width*2-1,1-(y-b.top)/b.height*2);}
 viewport.addEventListener('pointerdown',e=>{
  if(e.button!==0 || !e.isPrimary)return;
  viewport.setPointerCapture(e.pointerId);
  updateCamera();ray.setFromCamera(cameraNdc(e.clientX,e.clientY),current);
  const hit=handles.visible?ray.intersectObjects(handles.children.filter(x=>x.isMesh),false)[0]:null;
  if(hit){
   const id=hit.object.userData.index;
   selectPoint(id);
   const dir=current.getWorldDirection(new THREE.Vector3());
   drag={id,x:e.clientX,y:e.clientY,origin:hit.object.position.clone(),prior:'xyz'.split('').map(a=>pointDelta(id,a)),plane:new THREE.Plane().setFromNormalAndCoplanarPoint(dir,hit.object.position),registered:false};
   drag.start=ray.ray.intersectPlane(drag.plane,new THREE.Vector3());
  }else drag={x:e.clientX,y:e.clientY,orbit:true};
 });
 viewport.addEventListener('pointermove',e=>{
  if(!drag||!e.isPrimary)return;
  if(drag.orbit){
   const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
   if(state.view==='orbit'){ang.az-=dx*.009;ang.el=clamp(ang.el+dy*.009,-1.46,1.46);}
   else {
    const r=new THREE.Vector3().setFromMatrixColumn(current.matrixWorld,0);
    const up=new THREE.Vector3().setFromMatrixColumn(current.matrixWorld,1);
    const m=2*ang.extent/Math.max(1,viewport.clientHeight);
    target.addScaledVector(r,-dx*m).addScaledVector(up,dy*m);
   }
   drag.x=e.clientX;drag.y=e.clientY;renderSoon();
  }else if(drag.start&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>3){
   ray.setFromCamera(cameraNdc(e.clientX,e.clientY),current);
   const there=ray.ray.intersectPlane(drag.plane,new THREE.Vector3());if(!there)return;
   if(!drag.registered){remember();drag.registered=true;}
   const delta=there.sub(drag.start).toArray();
   for(const [i,a] of [...'xyz'].entries())state.genome=setControl(state.genome,Number(drag.id),a,clamp(drag.prior[i]+delta[i],-.014,.014));
   refresh();
  }
 });
 for(const kind of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(kind,()=>{drag=null;});
 viewport.addEventListener('wheel',e=>{e.preventDefault();const a=Math.exp(clamp(e.deltaY,-500,500)*.0014);ang.d=clamp(ang.d*a,.28,12);ang.extent=clamp(ang.extent*a,.09,8);renderSoon();},{passive:false});
}
function renderReference(){
 const box=$('reference'),ui=$('ref-source');box.replaceChildren();ui.hidden=true;
 if(!$('overlay').checked||state.view==='orbit')return;
 const kind=presetId(state.genome), root=state.refs?.presets??state.refs;
 const ref=root?.[kind]?.views?.[state.view]??root?.[kind]?.[state.view];
 const srcLink=root?.[kind]?.source;
 try{const url=new URL(srcLink);if(url.protocol==='https:'){ui.querySelector('a').href=url.href;ui.hidden=false;}}catch{}
 if(ref&&(typeof ref==='string'||ref.svg||ref.url||ref.src||ref.image)){
   const src=typeof ref==='string'?ref:ref.svg??ref.url??ref.src??ref.image;
   if(typeof src==='string'&&/^[a-zA-Z0-9_./-]+\.svg$/.test(src)&&!src.includes('..')){const img=new Image();img.src=src;img.alt='';box.append(img);return;}
 }
 let baseline=baselineCache.get(kind);
 if(!baseline){try{baseline=buildFender(createGenome(kind));baselineCache.set(kind,baseline);}catch{return;}}
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 const w=viewport.clientWidth,h=viewport.clientHeight;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);box.append(svg);
 const project=p=>{const v=new THREE.Vector3(...p).project(current);return `${(w*(v.x+1)/2).toFixed(2)},${(h*(1-v.y)/2).toFixed(2)}`;};
 const groups=ref?.paths??ref?.lines??[['hood',edgeRail(baseline,'hood')],['bumper',edgeRail(baseline,'bumper')]];
 for(const row of groups){const ps=points(Array.isArray(row)&&typeof row[0]==='string'?row[1]:row.world??row.points??row);if(ps.length<2||ps[0].length!==3)continue;
  const p=document.createElementNS(ns,'polyline');p.setAttribute('points',ps.map(project).join(' '));p.setAttribute('stroke','#d9f9ca');p.setAttribute('stroke-width','1.4');p.setAttribute('stroke-dasharray','5 4');p.setAttribute('fill','none');svg.append(p);
 }
}
function download(body,name,type){
 const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function undo(){if(!history.length)return false;state.genome=history.pop();return refresh();}
function uiError(e){const el=$('error');el.textContent=e.message??String(e);el.hidden=false;setTimeout(()=>{el.hidden=true;},6500);}
function installEngineNavigation() {
 const exit=()=>document.dispatchEvent(new Event('lotg-surface-studio-exit'));
 $('back-to-graphics').addEventListener('click',exit);
 window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&!e.defaultPrevented){e.preventDefault();exit();}
 });
 document.body.dataset.drawer='view';
 $('studio-mobile-rail').addEventListener('click',e=>{
  const choice=e.target.closest('button[data-drawer]')?.dataset.drawer;
  if(!choice)return;
  const next=document.body.dataset.drawer===choice?'view':choice;
  document.body.dataset.drawer=next;
  for(const b of $('studio-mobile-rail').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.drawer===next));
  renderSoon();
 });
}

function boot(){
 installEngineNavigation();
 paramFields();axisFields();
 try{
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
  studioEnvironment();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.07;
  new ResizeObserver(()=>{renderer.setSize(viewport.clientWidth,viewport.clientHeight,false);renderSoon();}).observe(viewport);
 }catch(e){uiError(Error('WebGL could not start. Geometry controls and export remain available.'));console.warn(e);}
 refresh({fit:true});pointer();
 $('preset').addEventListener('change',()=>applyGenome(createGenome($('preset').value),{fit:true}));
 $('views').addEventListener('click',e=>setView(e.target.dataset.view));
 $('shading').addEventListener('change',()=>setMode($('shading').value));
 $('fit').addEventListener('click',()=>{fitCamera();renderSoon();});
 $('point').addEventListener('change',()=>{const v=$('point').value;const c=state.good?.controls?.find((c,i)=>String(c.index??i)===v);selectPoint(v===''?null:c?.index??Number(v));});
 $('reset-point').addEventListener('click',()=>{if(state.selected==null)return;remember();for(const a of 'xyz')state.genome=setControl(state.genome,state.selected,a,0);refresh();});
 $('cage').addEventListener('change',()=>{handles.visible=$('cage').checked;renderSoon();});
 $('network').addEventListener('change',()=>{networkGroup.visible=$('network').checked;diagnosis(state.candidate);renderSoon();});
 $('overlay').addEventListener('change',renderSoon);
 $('undo').addEventListener('click',undo);
 $('reset').addEventListener('click',()=>applyGenome(createGenome($('preset').value),{fit:true}));
 $('load').addEventListener('click',()=>$('file').click());
 $('file').addEventListener('change',async()=>{const f=$('file').files[0];if(!f)return;
   try{if(f.size>1_000_000)throw Error('Saved surface JSON is too large.');const payload=JSON.parse(await f.text());const g=payload.genome??payload;if(!PRESETS[presetId(g)])throw Error('Unrecognized starting model in this JSON.');applyGenome(g,{fit:true});}
   catch(e){uiError(e);}finally{$('file').value='';}
 });
 $('save').addEventListener('click',()=>download(JSON.stringify(state.genome,null,2)+'\n',presetId(state.genome)+'-fender.json','application/json'));
 $('export').addEventListener('click',()=>{
  if(!state.valid)return;
  try{
   const result=validateMesh(state.good);
   if(!result.ok)throw Error('Export blocked by geometry checks: '+result.issues.map(i=>i.code).join(', '));
   const v=exportOBJ(state.good);download(typeof v==='string'?v:v.obj,presetId(state.genome)+'-fender.obj','text/plain');
  }catch(e){uiError(e);}
 });
 window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){e.preventDefault();undo();}});
 window.designer={
  getGenome:()=>copy(state.genome),applyGenome,setView,setMode,getDiagnostics:()=>({...state.candidate?.diagnostics,valid:state.valid}),
  getControlScreen:(i)=>{
    updateCamera();const p=handles.children.find(c=>c.isMesh&&Number(c.userData.index)===Number(i));if(!p)return null;
    const v=p.position.clone().project(current),b=viewport.getBoundingClientRect();
    return {x:b.left+b.width*(v.x+1)/2,y:b.top+b.height*(1-v.y)/2};
  },
  getState:()=>({view:state.view,mode:state.mode,valid:state.valid,renders:state.renders,selected:state.selected,vertexCount:state.good?.positions?.length/3||0,networkMeshes:networkGroup.children.filter(x=>x.isMesh).length}),
  setParameter:(k,v)=>updateParameter(k,Number(v),true),setControl:(i,a,d)=>updatePoint(i,a,Number(d)),undo,selectPoint,fit:()=>{fitCamera();renderSoon();}
 };
 import('./network.mjs').then(m=>{state.networkMeshes=m.buildNetwork;if(state.good){rebuildNetwork(state.good);diagnosis(state.candidate);fitCamera();}renderSoon();}).catch(e=>console.warn('No adjacent-panel module yet.',e));
 fetch('./references.json').then(r=>r.ok?r.json():null).then(r=>{state.refs=r;renderSoon();}).catch(()=>{});
 document.documentElement.dataset.designerReady='true';
}
boot();
