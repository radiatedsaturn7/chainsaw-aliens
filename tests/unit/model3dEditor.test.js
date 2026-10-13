import test from 'node:test';
import assert from 'node:assert/strict';
import ModelEditor from '../../src/ui/ModelEditor.js';
import {buildRacePortraitMenuModel} from '../../src/ui/RaceEditor.js';
import {getEditorMenuSpec} from '../../src/ui/shared/editorMenuSpec.js';
import {importOBJ,exportOBJ} from '../../src/model3d/ModelImport.js';
const context=()=>new Proxy({measureText:value=>({width:String(value).length*7}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>k in o?o[k]:()=>{}});

test('3D editor uses standard four-button portrait rail and exposes all modeling menus',()=>{
  assert.deepEqual(buildRacePortraitMenuModel('model3d').bottomRailActions,['menu','undo','redo','model-play']);
  const spec=getEditorMenuSpec('model3d');assert.equal(spec.root.length,7);
  for(const action of ['extrude-faces','weld-vertices','assign-joint','toggle-ik','keyframe-set','uv-generate','uv-paint'])assert.ok(spec.actions[action]);
});
for(const [width,height,mobile] of [[390,844,true],[844,390,true],[1280,800,false]])test(`3D editor shared shell draws at ${width}x${height}`,()=>{
  const e=new ModelEditor({deviceIsMobile:mobile,isMobile:mobile});e.draw(context(),width,height);
  assert.ok(e.modelBounds.w>0&&e.modelBounds.h>0);assert.deepEqual(e.buttons.filter(b=>['model-selection','model-camera','model-transform','model-tools'].includes(b.id)).map(b=>b.id),['model-selection','model-camera','model-transform','model-tools']);assert.ok(e.buttons.some(b=>b.id==='race-map-zoom'));
  if(height>width)for(const id of ['menu','undo','redo','model-play'])assert.ok(e.buttons.some(b=>b.id===id),id);
});
test('mesh menu commands work with undo and OBJ round trips',async()=>{
  const e=new ModelEditor({deviceIsMobile:false,isMobile:false});await e.handleMenuAction('select-all');assert.equal(e.model.vertices.length,8);
  await e.handleMenuAction('duplicate');assert.equal(e.model.vertices.length,16);await e.handleMenuAction('undo');assert.equal(e.model.vertices.length,8);
  const loaded=importOBJ(exportOBJ(e.model));assert.equal(loaded.vertices.length,8);assert.equal(loaded.faces.length,e.model.faces.length);
});

test('camera framing stays fixed during edits until Zoom Fit',async()=>{
  const e=new ModelEditor({});await e.handleMenuAction('shape-box');
  const before=structuredClone(e.modelRenderer.framing);
  e.change('Move vertex',()=>{e.model.vertices[0].position[0]+=20;});
  assert.deepEqual(e.modelRenderer.framing,before);
  await e.handleMenuAction('zoom-fit');assert.notDeepEqual(e.modelRenderer.framing,before);
});
test('imported material painting targets the displayed material and its UV faces',async()=>{
  const e=new ModelEditor({});await e.handleMenuAction('shape-box');
  const model=structuredClone(e.model);model.materials.push({id:'imported',name:'Imported',color:'#ffffff',texture:null});
  model.faces.forEach(f=>{f.material='imported';});e.loadModel(model);
  assert.equal(e.activeMaterial().id,'imported');assert.equal(e.textureFaces().length,model.faces.length);
  e.modelBounds={x:0,y:0,w:128,h:128};e.paintAt({x:64,y:64});
  assert.equal(e.model.materials[0].texture,null);assert.ok(e.activeMaterial().texture.pixels.some(p=>p===e.color));
});

test('shared gamepad menu confirmation does not also select geometry',()=>{
  const e=new ModelEditor({});e.modelBounds={x:0,y:0,w:400,h:300};e.mobileRootOpen=true;e.gamepadFocusedItemId='mesh';
  let picked=0;e.handlePointerDown=()=>picked++;
  const input={isGamepadConnected:()=>true,getGamepadActions:()=>({jump:true}),getGamepadAxes:()=>({})};
  e.update(input,1/60);assert.equal(e.activeRootId,'mesh');assert.equal(e.gamepadSubmenuOpen,true);assert.equal(picked,0);
});
test('Escape closes model menus before exiting and axis panning stays in the viewed plane',()=>{
  let exited=0;const e=new ModelEditor({exitModelEditor(){exited++;}});e.mobileRootOpen=true;
  const input={wasPressedCode:code=>code==='Escape'};e.update(input,1/60);assert.equal(e.mobileRootOpen,false);assert.equal(exited,0);
  e.view='x';e.panRaceMapBy(10,20);assert.equal(e.pan[0],0);assert.notEqual(e.pan[2],0);
  e.pan=[0,0,0];e.view='y';e.panRaceMapBy(10,20);assert.equal(e.pan[1],0);assert.notEqual(e.pan[2],0);
  e.update(input,1/60);assert.equal(exited,1);
});
test('UV editing shows a rendered preview without painting over its area',async()=>{
  const e=new ModelEditor({});await e.handleMenuAction('shape-box');e.uvMode=true;e.draw(context(),390,844);
  assert.ok(e.uvBounds.h<e.modelBounds.h);
  const before=e.revision;e.paintAt({x:e.modelBounds.x+10,y:e.modelBounds.y+e.modelBounds.h-5});assert.equal(e.revision,before);
});

test('quick command shortcuts retain keydown modifiers after keyup before the next frame',async()=>{
  const {default:Input}=await import('../../src/game/Input.js');
  const previous=globalThis.window;globalThis.window=new EventTarget();
  const input=new Input(),e=new ModelEditor({});
  try{
    await e.handleMenuAction('select-all');
    const down=Object.assign(new Event('keydown'),{code:'KeyD',ctrlKey:true});
    window.dispatchEvent(down);window.dispatchEvent(Object.assign(new Event('keyup'),{code:'KeyD'}));
    assert.equal(input.isDownCode('ControlLeft'),undefined);
    e.update(input,1/60);assert.equal(e.model.vertices.length,16);
    input.reset();assert.equal(input.wasCommandPressedCode('KeyD'),false);
  }finally{input.destroy();globalThis.window=previous;}
});

test('orthographic tracing preserves image aspect and follows world-space pan and zoom',()=>{
  const e=new ModelEditor({}),image={width:800,height:400},view={x:0,y:0,w:500,h:300};
  e.modelRenderer.framing={center:[0,0,0],extent:2};e.view='z';
  const first=e.tracingImageBounds(image,view);assert.equal(first.w/first.h,2);assert.ok(first.w<=view.w&&first.h<=view.h);
  e.zoom=2;const zoomed=e.tracingImageBounds(image,view);assert.equal(zoomed.w,first.w*2);
  e.pan=[1,0,0];const panned=e.tracingImageBounds(image,view);assert.equal(panned.x,zoomed.x-300);
  e.view='x';e.pan=[0,0,1];assert.equal(e.tracingImageBounds(image,view).x,zoomed.x+300);
  e.view='y';assert.equal(e.tracingImageBounds(image,view).y,zoomed.y-300);
});

test('starter cube and connected object selection support move, rotate, scale and drag undo',async()=>{
  const e=new ModelEditor({});assert.equal(e.model.vertices.length,8);assert.equal(e.model.faces.length,12);
  e.selectObject(e.model.faces[0].id);assert.equal(e.selectedVertices().length,8);
  const before=structuredClone(e.model);
  e.modelBounds={x:0,y:0,w:400,h:400};e.modelRenderer.unprojectToPlane=(x,y)=>[x/100,y/100,0];
  await e.handleMenuAction('move-selection');e.handlePointerDown({x:100,y:100,id:1});e.handlePointerMove({x:150,y:100,id:1});e.handlePointerUp({id:1});
  for(let i=0;i<8;i++)assert.equal(e.model.vertices[i].position[0],before.vertices[i].position[0]+0.5);
  await e.handleMenuAction('undo');assert.deepEqual(e.model.vertices,before.vertices);
  e.selectObject(e.model.faces[0].id);await e.handleMenuAction('rotate-selection');
  e.handlePointerDown({x:100,y:100});e.handlePointerMove({x:150,y:100});e.handlePointerUp({});
  const rotated=structuredClone(e.model.vertices);assert.notDeepEqual(rotated,before.vertices);
  for(let i=0;i<8;i++)assert.ok(Math.abs(Math.hypot(...rotated[i].position)-Math.hypot(...before.vertices[i].position))<1e-9);
  await e.handleMenuAction('scale-selection');e.handlePointerDown({x:100,y:100});e.handlePointerMove({x:150,y:100});e.handlePointerUp({});
  for(let i=0;i<8;i++)assert.ok(Math.abs(Math.hypot(...e.model.vertices[i].position)/Math.hypot(...rotated[i].position)-Math.exp(0.5))<1e-9);
  await e.handleMenuAction('new');assert.equal(e.model.vertices.length,8);assert.equal(e.history.undoStack.length,0);
});

for(const kind of ['vertices','faces','object'])for(const axis of [0,1,2])test(`${kind} selection moves only on gizmo ${'XYZ'[axis]} and records one undo`,async()=>{
 const THREE=await import('../../src/vendorBridge/three.js');const e=new ModelEditor({});
 e.modelBounds={x:0,y:0,w:600,h:500};e.modelRenderer.bounds=e.modelBounds;
 const camera=e.modelRenderer.camera=new THREE.PerspectiveCamera(40,1.2,0.01,100);camera.position.set(4,3,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 await e.handleMenuAction(`select-${kind}`);
 if(kind==='object')e.selectObject(e.model.faces[0].id);
 else if(kind==='faces')e.selection.faces=[e.model.faces[0].id];else e.selection.vertices=[e.model.vertices[0].id];
 const ids=new Set(e.selectedVertices()),before=structuredClone(e.model),gizmo=e.getModelGizmo(),end=gizmo.handles.find(h=>h.axis===axis).points[1];
 const start={x:gizmo.origin.x+(end.x-gizmo.origin.x)*0.85,y:gizmo.origin.y+(end.y-gizmo.origin.y)*0.85,id:1};
 const dx=(end.x-gizmo.origin.x)*0.3,dy=(end.y-gizmo.origin.y)*0.3;
 e.handlePointerDown(start);assert.equal(e.modelDrag.gizmo.hit.axis,axis);
 e.handlePointerMove({x:start.x+dx,y:start.y+dy,id:2});assert.deepEqual(e.model,before,'another pointer cannot move selection');
 for(const fraction of [0.3,0.7,1])e.handlePointerMove({x:start.x+dx*fraction,y:start.y+dy*fraction,id:1});
 e.handlePointerUp({id:2});assert.ok(e.modelDrag);e.handlePointerUp({id:1});
 for(let i=0;i<e.model.vertices.length;i++)for(let c=0;c<3;c++){
  const change=e.model.vertices[i].position[c]-before.vertices[i].position[c];
  if(ids.has(e.model.vertices[i].id)&&c===axis)assert.ok(change>0.01);else assert.equal(change,0);
 }
 assert.equal(e.history.undoStack.length,1);const after=structuredClone(e.model);
 await e.handleMenuAction('undo');assert.deepEqual(e.model,before);
 await e.handleMenuAction('redo');assert.deepEqual(e.model,after);
});

test('Escape cancels a gizmo drag without adding history or exiting',async()=>{
 const THREE=await import('../../src/vendorBridge/three.js');let exits=0;const e=new ModelEditor({exitModelEditor(){exits++}});
 e.modelBounds={x:0,y:0,w:600,h:500};e.modelRenderer.bounds=e.modelBounds;
 const camera=e.modelRenderer.camera=new THREE.PerspectiveCamera(40,1.2,0.01,100);camera.position.set(4,3,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 e.selectObject(e.model.faces[0].id);const before=structuredClone(e.model),g=e.getModelGizmo();
 e.handlePointerDown({...g.origin,id:1});e.handlePointerMove({x:g.origin.x+30,y:g.origin.y+15,id:1});assert.notDeepEqual(e.model,before);
 e.update({wasPressedCode:code=>code==='Escape'},1/60);assert.deepEqual(e.model,before);assert.equal(e.modelDrag,null);assert.equal(e.history.undoStack.length,0);assert.equal(exits,0);
});

for(const mode of ['rotate','scale'])test(`gizmo ${mode} changes the selected face about its center on the chosen axis`,async()=>{
 const THREE=await import('../../src/vendorBridge/three.js'),{pickModelGizmo}=await import('../../src/model3d/ModelTransformGizmo.js');
 const e=new ModelEditor({});e.modelBounds={x:0,y:0,w:600,h:500};e.modelRenderer.bounds=e.modelBounds;
 const camera=e.modelRenderer.camera=new THREE.PerspectiveCamera(40,1.2,0.01,100);camera.position.set(4,3,5);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 e.selection.faces=[e.model.faces[0].id];await e.handleMenuAction(`${mode}-selection`);
 const before=structuredClone(e.model),ids=new Set(e.selectedVertices()),g=e.getModelGizmo(),h=g.handles[mode==='scale'?1:0];
 const start=mode==='scale'?h.points[1]:h.points.find(p=>pickModelGizmo(g,p)?.axis===h.axis);
 e.handlePointerDown({...start,id:1});assert.ok(e.modelDrag.gizmo);
 const end=mode==='rotate'?{x:start.x+15,y:start.y-20}:{x:start.x+(start.x-g.origin.x)*0.3,y:start.y+(start.y-g.origin.y)*0.3};
 e.handlePointerMove({...end,id:1});e.handlePointerUp({id:1});assert.notDeepEqual(e.model,before);
 for(let i=0;i<e.model.vertices.length;i++){
  const v=e.model.vertices[i],old=before.vertices[i];if(!ids.has(v.id)){assert.deepEqual(v,old);continue;}
  if(mode==='rotate')assert.ok(Math.abs(Math.hypot(...v.position.map((n,k)=>n-g.center[k]))-Math.hypot(...old.position.map((n,k)=>n-g.center[k])))<1e-9);
  else for(let k=0;k<3;k++)if(k!==h.axis)assert.equal(v.position[k],old.position[k]);
 }
 await e.handleMenuAction('undo');assert.deepEqual(e.model,before);
});
