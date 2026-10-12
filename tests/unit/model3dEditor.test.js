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
  assert.ok(e.modelBounds.w>0&&e.modelBounds.h>0);assert.ok(e.buttons.some(b=>b.id==='select-vertices'));assert.ok(e.buttons.some(b=>b.id==='race-map-zoom'));
  if(height>width)for(const id of ['menu','undo','redo','model-play'])assert.ok(e.buttons.some(b=>b.id===id),id);
});
test('mesh menu commands work with undo and OBJ round trips',async()=>{
  const e=new ModelEditor({deviceIsMobile:false,isMobile:false});await e.handleMenuAction('shape-box');assert.equal(e.model.vertices.length,8);
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
    await e.handleMenuAction('shape-box');
    const down=Object.assign(new Event('keydown'),{code:'KeyD',ctrlKey:true});
    window.dispatchEvent(down);window.dispatchEvent(Object.assign(new Event('keyup'),{code:'KeyD'}));
    assert.equal(input.isDownCode('ControlLeft'),undefined);
    e.update(input,1/60);assert.equal(e.model.vertices.length,16);
    input.reset();assert.equal(input.wasCommandPressedCode('KeyD'),false);
  }finally{input.destroy();globalThis.window=previous;}
});
