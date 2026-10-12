import {EditorInputActionNormalizer,EDITOR_INPUT_ACTIONS as INPUT} from './shared/input/editorInputActions.js';
import RaceEditor from './RaceEditor.js';
import * as THREE from '../vendorBridge/three.js';
import * as Mesh from '../model3d/ModelDocument.js';
import * as Rig from '../model3d/ModelRig.js';
import {ModelCanvasRenderer,getModelFrame} from '../model3d/ModelRender.js';
import {importModelFiles,exportOBJ} from '../model3d/ModelImport.js';
import {getEditorMenuSpec,getEditorTouchRootMenuEntries} from './shared/editorMenuSpec.js';
import {openEditorForm,chooseEditorFiles} from './shared/editorForm.js';
import {drawSharedDesktopContextPanel} from './uiSuite.js';
import {openProjectBrowser} from './ProjectBrowserModal.js';
import {saveProjectFileAndConfirm} from './projectFiles.js';

const inside=(p,b)=>b&&p.x>=b.x&&p.y>=b.y&&p.x<=b.x+b.w&&p.y<=b.y+b.h;
const fields3=(value=[0,0,0])=>['x','y','z'].map((id,i)=>({id,label:id.toUpperCase(),value:value[i]}));
const coords=result=>[result.x,result.y,result.z];
const label=id=>id.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(' ');
export default class ModelEditor extends RaceEditor {
  constructor(game){super(game,{mode:'car'});this.model=Mesh.createModelDocument();this.history=new Mesh.ModelHistory();this.modelInput=new EditorInputActionNormalizer();this.currentModelName='';this.selection={vertices:[],faces:[]};this.joint=null;this.clip=null;this.pose={};this.time=0;this.playing=false;this.ik=false;this.tool='select-vertices';this.view='orbit';this.yaw=0.7;this.pitch=0.35;this.zoom=1;this.pan=[0,0,0];this.revision=0;this.modelRenderer=new ModelCanvasRenderer();this.activeRootId='mesh';this.color='#df533f';this.brushSize=3;this.uvMode=false;this.images=new Map();this.materialId=this.model.materials[0].id;this.status='Create a shape or import a model';}
  get editorId(){return 'model3d';}get title(){return '3D Object Editor';}
  getMenuItems(root){root=({'mesh-edit':'edit',camera:'view'})[root]||root;const spec=getEditorMenuSpec(this.editorId);return (spec.sections[root]?.actions||[]).map(id=>({id,label:label(id),disabled:false,onSelect:()=>this.handleMenuAction(id)}));}
  isActionAvailable(id){return Boolean(getEditorMenuSpec(this.editorId).actions[id]);}
  getRaceActionLabel(id){return label(id);}
  getRacePortraitContextAction(){return {id:'model-play',label:this.playing?'Ⅱ':'▶',onClick:()=>this.handleMenuAction('animation-play')};}
  getDesktopContextActions(){return ['shape-box','select-vertices','select-faces','place-joint','uv-editor'].map(id=>({id,label:label(id),contextPanelCommand:true,onClick:()=>this.handleMenuAction(id)}));}
  drawDesktopContext(ctx,bounds){drawSharedDesktopContextPanel(ctx,bounds,{title:this.title,lines:[this.model.name,`${this.model.vertices.length} vertices · ${this.model.faces.length} faces`,`${this.model.joints.length} joints`,label(this.tool),`View: ${this.view.toUpperCase()}`],contentRoles:['document-summary','active-tool-summary','status'],status:this.status});}
  updateCarEditorPreviewPlaytest(){}updateCarEditorPreviewSelectHold(){return false;}ensureCarEditorPreviewPlaytestSession(){return null;}
  update(input,dt){
    if(typeof document!=='undefined'&&document.querySelector('dialog[open]'))return;
    this.updateRaceMapThumbstickPan(dt);
    const cmd=input?.isDownCode?.('ControlLeft')||input?.isDownCode?.('ControlRight')||input?.isDownCode?.('MetaLeft')||input?.isDownCode?.('MetaRight');
    const pressed=code=>input?.wasPressedCode?.(code);
    const commands={KeyZ:'undo',KeyY:'redo',KeyC:'copy',KeyX:'cut',KeyV:'paste',KeyD:'duplicate',KeyA:'select-all',KeyS:'save'};
    const actions={Delete:'delete',Backspace:'delete',Space:'animation-play',Digit1:'view-x',Digit2:'view-y',Digit3:'view-z',Digit4:'view-orbit'};
    for(const [code,action] of Object.entries(commands))if(input?.wasCommandPressedCode?.(code)||(cmd&&pressed(code)))void this.handleMenuAction(action);
    for(const [code,action] of Object.entries(actions))if(!cmd&&pressed(code))void this.handleMenuAction(action);
    const pad=this.modelInput.updateGamepad(input,dt,{includePanIntent:true,includeZoomIntent:true});
    const cancel=()=>{if(this.desktopDropdown){this.closeEditorMenus();return;}if(this.gamepadSubmenuOpen){this.gamepadSubmenuOpen=false;this.mobileRootOpen=true;return;}if(this.mobileRootOpen){this.mobileRootOpen=false;return;}this.exitToMainMenu();};
    if(!pad.connected&&(input?.wasPressed?.('cancel')||pressed('Escape')))cancel();
    const menuOwned=this.mobileRootOpen||this.gamepadSubmenuOpen;
    const roots=getEditorTouchRootMenuEntries(this.editorId);
    for(const action of pad.actions){
      if(action.type===INPUT.MENU){this.mobileRootOpen=!this.mobileRootOpen;this.gamepadSubmenuOpen=false;this.gamepadFocusedItemId=roots[0]?.id;}
      else if(action.type===INPUT.CANCEL)cancel();
      else if(action.type===INPUT.UNDO)void this.handleMenuAction('undo');
      else if(action.type===INPUT.REDO)void this.handleMenuAction('redo');
      else if(action.type===INPUT.PAN&&!this.mobileRootOpen&&!this.gamepadSubmenuOpen)this.panRaceMapBy(action.dx*dt*250,action.dy*dt*250);
      else if(action.type===INPUT.ZOOM)this.zoom=Math.max(0.1,Math.min(10,this.zoom*Math.exp(action.value*dt*2)));
      else if(this.mobileRootOpen||this.gamepadSubmenuOpen){
        const entries=this.mobileRootOpen?roots:this.getMenuItems(this.activeRootId);let index=Math.max(0,entries.findIndex(e=>e.id===this.gamepadFocusedItemId));
        if([INPUT.NAV_UP,INPUT.NAV_LEFT,INPUT.NAV_DOWN,INPUT.NAV_RIGHT].includes(action.type)){index=(index+([INPUT.NAV_UP,INPUT.NAV_LEFT].includes(action.type)?-1:1)+entries.length)%entries.length;this.gamepadFocusedItemId=entries[index]?.id;}
        if(action.type===INPUT.CONFIRM&&entries[index]){if(this.mobileRootOpen){this.activeRootId=entries[index].id;this.mobileRootOpen=false;this.gamepadSubmenuOpen=true;this.gamepadFocusedItemId=this.getMenuItems(this.activeRootId)[0]?.id;}else{void this.handleMenuAction(entries[index].id);this.gamepadSubmenuOpen=false;}}
      }
    }
    if(pad.connected&&!menuOwned&&this.modelBounds&&!this.mobileRootOpen&&!this.gamepadSubmenuOpen){
      const b=this.modelBounds;this.modelCursor||={x:b.x+b.w/2,y:b.y+b.h/2};
      this.modelCursor.x=Math.max(b.x,Math.min(b.x+b.w,this.modelCursor.x+pad.axes.leftX*dt*350));this.modelCursor.y=Math.max(b.y,Math.min(b.y+b.h,this.modelCursor.y+pad.axes.leftY*dt*350));
      const point={...this.modelCursor,id:'model-gamepad'};
      if(pad.pressed.jump)this.handlePointerDown(point);else if(pad.down.jump)this.handlePointerMove(point);
      if(pad.released.jump)this.handlePointerUp(point);
    }
if(this.playing){const clip=this.model.animations.find(c=>c.id===this.clip);this.time+=Math.max(0,dt);if(clip&&this.time>clip.duration){if(clip.loop)this.time%=clip.duration;else{this.time=clip.duration;this.pose=Rig.sampleAnimation(this.model,this.clip,this.time,{loop:false});this.playing=false;}}}
  }
  panRaceMapBy(x,y){if(this.view==='orbit'){this.yaw-=x*0.004;this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+y*0.004));}else{const horizontal=this.view==='x'?2:0,vertical=this.view==='y'?2:1;this.pan[horizontal]+=(this.view==='x'?1:-1)*x*0.01/this.zoom;this.pan[vertical]+=(this.view==='y'?-1:1)*y*0.01/this.zoom;}}
  getRaceMapZoomRatio(){return (Math.log(this.zoom)+Math.log(10))/Math.log(100);}
  updateRaceMapZoomFromSliderX(x){const b=this.raceMapZoomSliderBounds;if(b)this.zoom=Math.exp(-Math.log(10)+Math.max(0,Math.min(1,(x-b.x)/b.w))*Math.log(100));}
  exitToMainMenu(){this.playing=false;this.modelRenderer.dispose();this.game.exitModelEditor?.();}
  change(name,fn){const result=this.history.apply(this.model,name,fn);this.revision++;this.status=name;return result;}
  selectedVertices(){return [...new Set([...this.selection.vertices,...this.model.faces.filter(f=>this.selection.faces.includes(f.id)).flatMap(f=>f.vertices)])];}
  loadModel(model,name=''){this.model=Mesh.validateModelDocument(structuredClone(model));this.history=new Mesh.ModelHistory();this.currentModelName=name;this.selection={vertices:[],faces:[]};this.joint=null;this.clip=this.model.animations[0]?.id||null;this.pose={};this.time=0;this.playing=false;this.materialId=this.model.faces[0]?.material||this.model.materials[0].id;this.modelRenderer.frameModel(this.model);this.revision++;this.status=`Opened ${model.name}`;}
  async saveModel(force=false){let name=this.currentModelName;if(force||!name){const picked=await openProjectBrowser({fixedFolder:'models',initialFolder:'models',mode:'saveAs',initialName:this.model.name,title:'Save 3D Model'});if(!picked?.name)return;name=picked.name;}const snapshot=structuredClone(this.model);snapshot.name=name;await saveProjectFileAndConfirm('models',name,snapshot);this.model.name=name;this.currentModelName=name;this.status=`Saved ${name}`;}
  async handleMenuAction(id){
    try{
      if(id==='new'){this.loadModel(Mesh.createModelDocument());return;}
      if(id==='save'||id==='save-as')return await this.saveModel(id==='save-as');
      if(id==='open'){const picked=await openProjectBrowser({fixedFolder:'models',initialFolder:'models',mode:'open',title:'Open 3D Model',onOpen:({name,payload})=>this.loadModel(payload.data,name)});return picked;}
      if(id==='import'){const files=await chooseEditorFiles('.obj,.json,.gltf,.glb,.bin,.png,.jpg',{multiple:true});if(files.length)this.loadModel(await importModelFiles(files));return;}
      if(id==='export'){this.download(JSON.stringify(this.model),`${this.model.name}.rtg.json`,'application/json');return;}
      if(id==='exit-main')return this.exitToMainMenu();
      if(id==='undo'||id==='redo'){this.model=this.history.restore(this.model,id==='redo');this.revision++;this.selection={vertices:[],faces:[]};this.pose={};return;}
      if(id==='zoom-fit'){this.zoom=1;this.pan=[0,0,0];this.modelRenderer.frameModel(this.model);return;}
      if(id.startsWith('view-')){this.view=id.slice(5);this.uvMode=false;if(this.view==='orbit')this.tool='orbit';return;}
      if(id==='wireframe'){this.wireframe=!this.wireframe;return;}
      if(id.startsWith('shape-')){const empty=!this.model.vertices.length;this.selection=this.change(label(id),()=>Mesh.addPrimitive(this.model,id.slice(6)));if(empty)this.modelRenderer.frameModel(this.model);return;}
      if(['select-vertices','select-faces','place-vertex','move-vertices','select-joints','place-joint','uv-move','uv-paint'].includes(id)){this.tool=id;this.uvMode=id.startsWith('uv-');this.status=label(id);return;}
      if(id==='select-all'){this.selection={vertices:this.model.vertices.map(v=>v.id),faces:this.model.faces.map(f=>f.id)};return;}
      if(id==='copy'||id==='cut'){this.clipboard=Mesh.copyGeometry(this.model,this.selection);if(id==='cut')this.change('Cut',()=>Mesh.deleteGeometry(this.model,this.selection));return;}
      if(id==='paste'){this.selection=this.change('Paste',()=>Mesh.pasteGeometry(this.model,this.clipboard,{offset:[0.2,0,0]}));return;}
      if(id==='duplicate'||id.startsWith('mirror-')){this.selection=this.change(label(id),()=>Mesh.pasteGeometry(this.model,Mesh.copyGeometry(this.model,this.selection),{offset:id==='duplicate'?[0.2,0,0]:[0,0,0],mirror:id.startsWith('mirror-')?id.at(-1):null}));return;}
      if(id==='delete'){this.change('Delete geometry',()=>Mesh.deleteGeometry(this.model,this.selection));this.selection={vertices:[],faces:[]};return;}
      if(id.startsWith('symmetry-')){const axis=id.at(-1);this.change(label(id),()=>{this.model.symmetry[axis]=!this.model.symmetry[axis];});return;}
      if(id==='join-polygon'){this.change('Join polygon',()=>Mesh.joinPolygon(this.model,this.selection.vertices));return;}
      if(id==='weld-vertices'){const vertex=this.change('Weld vertices',()=>Mesh.weldVertices(this.model,this.selection.vertices));this.selection={vertices:[vertex],faces:[]};return;}
      if(id==='extrude-faces'){const result=await openEditorForm('Extend faces',[{id:'distance',label:'Distance',value:0.25}]);if(result)this.selection=this.change('Extend faces',()=>Mesh.extrudeFaces(this.model,this.selection.faces,result.distance));return;}
      if(id==='transform-selection'){const result=await openEditorForm('Move selection',fields3());if(result)this.change('Move vertices',()=>Mesh.moveVertices(this.model,this.selectedVertices(),coords(result)));return;}
      if(id==='uv-generate'){this.change('Generate UV atlas',()=>Mesh.generateUVMap(this.model,this.selection.faces.length?this.selection.faces:undefined));this.uvMode=true;return;}
      if(id==='uv-editor'){this.uvMode=!this.uvMode;this.tool='uv-move';return;}
      if(id==='texture-material'){const result=await openEditorForm('Texture material',[{id:'material',label:'Material',value:this.materialId,options:this.model.materials.map(m=>({value:m.id,label:m.name||m.id}))}]);if(result)this.materialId=result.material;return;}
      if(id==='paint-color'){const result=await openEditorForm('Paint color',[{id:'color',label:'Color',type:'color',value:this.color}]);if(result)this.color=result.color;return;}
      if(id==='paint-size'){const result=await openEditorForm('Brush size',[{id:'radius',label:'Radius in pixels',min:0,max:64,value:this.brushSize}]);if(result)this.brushSize=Math.round(result.radius);return;}
      if(id==='background-image'||id==='texture-import')return await this.loadImage(id);
      if(id==='background-clear'){this.change('Clear background',()=>{delete this.model.backgrounds[this.view];});return;}
      if(id==='texture-export'){const texture=this.textureCanvas();if(texture)this.downloadData(texture.toDataURL(),`${this.model.name}-texture.png`);return;}
      if(id==='toggle-ik'){this.ik=!this.ik;this.status=`IK ${this.ik?'on':'off'}`;return;}
      if(id==='joint-root'){this.joint=null;this.tool='place-joint';this.status='Place a new root joint';return;}
      if(id==='joint-select-list'){const result=await openEditorForm('Select joint',[{id:'joint',label:'Joint',value:this.joint,options:this.model.joints.map(j=>({value:j.id,label:j.name}))}]);if(result)this.joint=result.joint;return;}
      if(id==='joint-reparent'){const result=await openEditorForm('Joint parent',[{id:'parent',label:'Parent',value:this.model.joints.find(j=>j.id===this.joint)?.parent||'',options:[{value:'',label:'Root'},...this.model.joints.filter(j=>j.id!==this.joint).map(j=>({value:j.id,label:j.name}))]}]);if(result)this.change('Reparent joint',()=>Rig.reparentJoint(this.model,this.joint,result.parent||null));this.pose={};return;}
      if(id==='joint-delete'){this.change('Delete joint',()=>Rig.deleteJoint(this.model,this.joint));this.joint=null;this.pose={};return;}
      if(id==='assign-joint'){const result=await openEditorForm('Vertex weight',[{id:'weight',label:'Weight (0 removes this joint)',value:1,min:0,max:1}]);if(result)this.change('Assign vertices to joint',()=>Rig.assignVerticesToJoint(this.model,this.selectedVertices(),this.joint,result.weight));return;}
      if(id==='select-joint-vertices'){this.selection={vertices:this.model.vertices.filter(v=>v.weights?.some(w=>w.joint===this.joint&&w.weight>0)).map(v=>v.id),faces:[]};return;}
      if(id==='joint-properties'||id==='pose-joint')return await this.editJoint(id==='pose-joint');
      if(id==='animation-new'){const result=await openEditorForm('New animation',[{id:'name',label:'Name',type:'text',value:'Animation'},{id:'duration',label:'Duration (seconds)',min:0.1,value:1}]);if(result)this.clip=this.change('New animation',()=>Rig.addAnimation(this.model,result.name,result.duration));return;}
      if(id==='animation-select'){const result=await openEditorForm('Animation',[{id:'clip',label:'Clip',options:this.model.animations.map(c=>({value:c.id,label:c.name})),value:this.clip}]);if(result){this.clip=result.clip;this.time=0;this.pose=Rig.sampleAnimation(this.model,this.clip,0,{loop:false});}return;}
      if(id==='animation-properties'){const clip=this.model.animations.find(c=>c.id===this.clip);if(!clip)throw Error('Select an animation');const result=await openEditorForm('Animation properties',[{id:'name',label:'Name',type:'text',value:clip.name},{id:'duration',label:'Duration (seconds)',min:0.01,value:clip.duration},{id:'fps',label:'Frame rate',min:1,max:120,value:clip.fps},{id:'loop',label:'Playback',value:clip.loop?'loop':'once',options:[{value:'loop',label:'Loop'},{value:'once',label:'Once'}]}]);if(result)this.change('Animation properties',()=>{const last=Math.max(0,...Object.values(clip.tracks).flatMap(keys=>keys.map(k=>k.time)));if(result.duration<last)throw Error('Duration must include the last keyframe');Object.assign(clip,{name:result.name,duration:result.duration,fps:result.fps,loop:result.loop==='loop'});});return;}
      if(id==='keyframe-next'||id==='keyframe-prev'){const clip=this.model.animations.find(c=>c.id===this.clip);const times=[...new Set(Object.values(clip?.tracks||{}).flatMap(keys=>keys.map(k=>k.time)))].sort((a,b)=>a-b);const time=id==='keyframe-next'?times.find(t=>t>this.time+1e-5):times.findLast(t=>t<this.time-1e-5);if(time!==undefined){this.time=time;this.playing=false;this.pose=Rig.sampleAnimation(this.model,this.clip,time,{loop:false});}return;}
      if(id==='animation-time'){const result=await openEditorForm('Timeline',[{id:'time',label:'Time (seconds)',min:0,value:this.time}]);if(result){this.time=result.time;this.pose=Rig.sampleAnimation(this.model,this.clip,this.time,{loop:false});}return;}
      if(id==='keyframe-set'){this.change('Set keyframe',()=>Rig.setKeyframe(this.model,this.clip,this.joint,this.time,this.pose[this.joint]||{}));return;}
      if(id==='keyframe-delete'){this.change('Delete keyframe',()=>{const clip=this.model.animations.find(c=>c.id===this.clip);if(clip?.tracks[this.joint])clip.tracks[this.joint]=clip.tracks[this.joint].filter(k=>Math.abs(k.time-this.time)>1e-4);});return;}
      if(id==='animation-play'||id==='test-drive'){this.playing=!this.playing;return;}
      if(id==='bind-pose'){this.playing=false;this.pose={};this.time=0;return;}
    }catch(error){this.status=error.message;this.game.showSystemToast?.(error.message);}
  }
  async editJoint(poseOnly){
    const joint=this.model.joints.find(j=>j.id===this.joint);if(!joint)throw Error('Select a joint first');
    const current=poseOnly?{...joint,...this.pose[joint.id]}:joint;
    const euler=new THREE.Euler().setFromQuaternion(new THREE.Quaternion(...current.rotation));
    const result=await openEditorForm(poseOnly?'Pose joint':'Joint properties',[{id:'name',label:'Name',type:'text',value:joint.name},...fields3(current.position),...['rx','ry','rz'].map((id,i)=>({id,label:`Rotation ${id.at(-1).toUpperCase()} (degrees)`,value:[euler.x,euler.y,euler.z][i]*180/Math.PI}))]);
    if(!result)return;const transform={position:coords(result),rotation:new THREE.Quaternion().setFromEuler(new THREE.Euler(...[result.rx,result.ry,result.rz].map(n=>n*Math.PI/180))).toArray()};
    if(poseOnly){this.pose[joint.id]=transform;this.playing=false;}else this.change('Edit joint',()=>Object.assign(joint,transform,{name:result.name}));
  }
  download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));this.downloadData(url,name);setTimeout(()=>URL.revokeObjectURL(url),1000);}
  downloadData(url,name){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
  async loadImage(action){
    const [file]=await chooseEditorFiles('image/*');if(!file)return;
    const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
    const image=new Image();image.src=url;await image.decode();
    if(action==='background-image'){this.images.set(url,image);this.change('Set tracing image',()=>{this.model.backgrounds[this.view]={url,opacity:0.35};});return;}
    const canvas=document.createElement('canvas');const scale=Math.min(1,1024/Math.max(image.width,image.height));canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,pixels=[];
    for(let i=0;i<data.length;i+=4)pixels.push('#'+[...data.slice(i,i+4)].map(n=>n.toString(16).padStart(2,'0')).join(''));
    this.change('Import texture',()=>{this.activeMaterial().texture={width:canvas.width,height:canvas.height,pixels};});
  }
  activeMaterial(){return this.model.materials.find(m=>m.id===this.materialId)||this.model.materials[0];}
  textureFaces(){return this.model.faces.filter(f=>f.material===this.activeMaterial().id);}
  textureCanvas(){
    const texture=this.activeMaterial()?.texture;if(!texture||typeof document==='undefined')return null;
    if(this.textureCache?.revision===this.revision&&this.textureCache?.material===this.activeMaterial().id)return this.textureCache.canvas;
    const canvas=document.createElement('canvas');canvas.width=texture.width;canvas.height=texture.height;const ctx=canvas.getContext('2d');
    texture.pixels.forEach((color,i)=>{if(color){ctx.fillStyle=color;ctx.fillRect(i%texture.width,Math.floor(i/texture.width),1,1);}});this.textureCache={revision:this.revision,material:this.activeMaterial().id,canvas};return canvas;
  }
  tracingImageBounds(image,view){
    const extent=(this.modelRenderer.framing||getModelFrame(this.model)).extent;
    const pixelsPerUnit=view.h/extent*this.zoom;
    const aspect=image.width/image.height;
    const fit=Math.min(1,view.w/view.h/aspect);
    const h=extent*fit*pixelsPerUnit,w=h*aspect;
    const horizontal=this.view==='x'?-this.pan[2]:this.pan[0];
    const vertical=this.view==='y'?-this.pan[2]:this.pan[1];
    return {x:view.x+view.w/2-w/2-horizontal*pixelsPerUnit,
      y:view.y+view.h/2-h/2+vertical*pixelsPerUnit,w,h};
  }
  drawCarEditorWorkSurface(ctx,bounds){
    this.carArtSliderRegions=[];this.modelBounds={x:bounds.x,y:bounds.y+28,w:bounds.w,h:Math.max(40,bounds.h-136)};
    ctx.fillStyle='#0c1418';ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.fillStyle='#c4d9d1';ctx.font='12px system-ui';ctx.fillText(`${this.model.name} · ${label(this.tool)}`,bounds.x+8,bounds.y+17,bounds.w-16);
    const view=this.modelBounds,background=this.model.backgrounds[this.view];
    ctx.save();ctx.beginPath();ctx.rect(view.x,view.y,view.w,view.h);ctx.clip();
    if(!this.uvMode&&background&&typeof Image!=='undefined'){
      let image=this.images.get(background.url);if(!image){image=new Image();image.src=background.url;this.images.set(background.url,image);}
      if(image.complete&&image.width&&image.height){const box=this.tracingImageBounds(image,view);ctx.save();ctx.globalAlpha=background.opacity;ctx.drawImage(image,box.x,box.y,box.w,box.h);ctx.restore();}
    }
    if(this.uvMode){
      const horizontal=view.w>=500;
      this.uvBounds={...view,w:horizontal?view.w*0.65:view.w,h:horizontal?view.h:view.h*0.65};
      const preview=horizontal?{x:view.x+view.w*0.67,y:view.y,w:view.w*0.33,h:view.h}:{x:view.x,y:view.y+view.h*0.67,w:view.w,h:view.h*0.33};
      this.drawUV(ctx,this.uvBounds);
      try{this.modelRenderer.draw(ctx,preview,this.model,{revision:this.revision,view:'orbit',yaw:this.yaw,pitch:this.pitch,clip:this.clip,time:this.time,pose:this.playing?null:this.pose});}catch(error){this.status=error.message;}
    }else{
      this.uvBounds=null;
      try{this.modelRenderer.draw(ctx,view,this.model,{revision:this.revision,view:this.view,yaw:this.yaw,pitch:this.pitch,zoom:this.zoom,pan:this.pan,clip:this.clip,time:this.time,pose:this.playing?null:this.pose,wireframe:this.wireframe});}catch(error){this.status=`3D preview: ${error.message}`;}
      const pose=this.playing?Rig.sampleAnimation(this.model,this.clip,this.time):this.pose;
      const skinned=Rig.skinVertices(this.model,pose),positions=new Map(skinned.map(v=>[v.id,v.position]));
      ctx.strokeStyle='#ffcc44';ctx.lineWidth=2;
      for(const face of this.model.faces.filter(f=>this.selection.faces.includes(f.id))){ctx.beginPath();face.vertices.forEach((id,i)=>{const p=this.modelRenderer.project(positions.get(id));if(p)i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.stroke();}
      for(const vertex of skinned){const point=this.modelRenderer.project(vertex.position);if(!point||point.z>1)continue;ctx.fillStyle=this.selection.vertices.includes(vertex.id)?'#ffcc44':'#83b5cd';ctx.fillRect(point.x-3,point.y-3,6,6);}
      const joints=Rig.jointMatrices(this.model,pose);
      for(const joint of this.model.joints){const p=this.modelRenderer.project(new THREE.Vector3().setFromMatrixPosition(joints.get(joint.id)).toArray());if(!p)continue;ctx.fillStyle=joint.id===this.joint?'#ffcc44':'#ed92b4';ctx.beginPath();ctx.arc(p.x,p.y,6,0,Math.PI*2);ctx.fill();if(joint.parent){const parent=this.modelRenderer.project(new THREE.Vector3().setFromMatrixPosition(joints.get(joint.parent)).toArray());ctx.strokeStyle='#ed92b4';ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(parent.x,parent.y);ctx.stroke();}}
    }
    if(this.modelCursor&&this.game?.input?.isGamepadConnected?.()){ctx.strokeStyle='#ffffff';ctx.beginPath();ctx.arc(this.modelCursor.x,this.modelCursor.y,8,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    const hot=['select-vertices','select-faces','move-vertices','view-orbit','uv-editor'];const width=bounds.w/hot.length;
    hot.forEach((id,i)=>this.registerDrawnButton(ctx,{x:bounds.x+i*width,y:bounds.y+bounds.h-70,w:width-3,h:28},{id,label:['Verts','Faces','Move','Orbit','UV'][i],active:this.tool===id,onClick:()=>this.handleMenuAction(id)}));
    this.drawRacePortraitZoomSlider(ctx,{x:bounds.x+4,y:bounds.y+bounds.h-36,w:bounds.w-8,h:26});
    this.timeline={x:bounds.x+8,y:bounds.y+bounds.h-102,w:bounds.w-16,h:24};ctx.fillStyle='#263d40';ctx.fillRect(this.timeline.x,this.timeline.y,this.timeline.w,this.timeline.h);
    const clip=this.model.animations.find(c=>c.id===this.clip),duration=clip?.duration||1;ctx.fillStyle='#65baa4';for(const keys of Object.values(clip?.tracks||{}))for(const key of keys)ctx.fillRect(this.timeline.x+key.time/duration*this.timeline.w-1,this.timeline.y+this.timeline.h-7,3,7);ctx.fillStyle='#f3d778';ctx.fillRect(this.timeline.x+Math.min(1,this.time/duration)*this.timeline.w,this.timeline.y,2,this.timeline.h);ctx.fillStyle='#e5ece9';ctx.fillText(`${clip?.name||'No animation'}  ${this.time.toFixed(2)}s`,this.timeline.x+6,this.timeline.y+16,this.timeline.w-12);
  }
  drawUV(ctx,b){
    const texture=this.textureCanvas();if(texture){ctx.imageSmoothingEnabled=false;ctx.drawImage(texture,b.x,b.y,b.w,b.h);}
    ctx.strokeStyle='#44dfca';for(const face of this.textureFaces()){ctx.beginPath();face.uv.forEach(([u,v],i)=>{const x=b.x+u*b.w,y=b.y+(1-v)*b.h;i?ctx.lineTo(x,y):ctx.moveTo(x,y);ctx.fillStyle='#ffcc44';ctx.fillRect(x-3,y-3,6,6);});ctx.closePath();ctx.stroke();}
  }
  handlePointerDown(p={}){
    if(this.mobileRootOpen||this.desktopDropdown||this.gamepadSubmenuOpen||this.buttons.some(b=>inside(p,b.bounds)))return super.handlePointerDown(p);
    if(inside(p,this.timeline)){const clip=this.model.animations.find(c=>c.id===this.clip);this.time=Math.max(0,(p.x-this.timeline.x)/this.timeline.w)*(clip?.duration||1);this.pose=Rig.sampleAnimation(this.model,this.clip,this.time,{loop:false});this.playing=false;return;}
    if(!inside(p,this.modelBounds))return super.handlePointerDown(p);
    const before=structuredClone(this.model);this.modelDrag={id:p.id,x:p.x,y:p.y,before};
    if(this.uvMode){if(!inside(p,this.uvBounds||this.modelBounds)){this.modelDrag=null;return;}if(this.tool==='uv-paint'){this.paintAt(p);return;}const uv=this.uvBounds||this.modelBounds;let hit=null,best=14;for(const face of this.textureFaces())face.uv.forEach(([u,v],index)=>{const distance=Math.hypot(p.x-uv.x-u*uv.w,p.y-uv.y-(1-v)*uv.h);if(distance<best){best=distance;hit={face:face.id,index};}});this.modelDrag.uv=hit;return;}
    const point=this.modelRenderer.unprojectToPlane(p.x,p.y);
    if(this.tool==='place-vertex'){this.change('Place vertex',()=>{this.selection.vertices.push(Mesh.addVertex(this.model,point));});this.modelDrag=null;return;}
    if(this.tool==='place-joint'){this.joint=this.change('Place joint',()=>Rig.addJoint(this.model,point,this.joint));this.modelDrag=null;return;}
    if(this.tool==='select-faces'){const hit=this.modelRenderer.pickFace(p.x,p.y);if(hit){this.toggleSelection('faces',hit.id);this.materialId=this.model.faces.find(f=>f.id===hit.id).material;}return;}
    if(this.tool==='select-joints'){let best=16;for(const [id,matrix] of Rig.jointMatrices(this.model,this.pose)){const pos=this.modelRenderer.project(new THREE.Vector3().setFromMatrixPosition(matrix).toArray());const distance=pos?Math.hypot(pos.x-p.x,pos.y-p.y):Infinity;if(distance<best){best=distance;this.joint=id;}}return;}
    if(this.tool==='select-vertices'){let best=14,hit=null;for(const vertex of Rig.skinVertices(this.model,this.playing?Rig.sampleAnimation(this.model,this.clip,this.time):this.pose)){const pos=this.modelRenderer.project(vertex.position);const distance=pos?Math.hypot(pos.x-p.x,pos.y-p.y):Infinity;if(distance<best){best=distance;hit=vertex.id;}}if(hit)this.toggleSelection('vertices',hit);}
  }
  toggleSelection(kind,id){const selection=this.selection[kind],index=selection.indexOf(id);if(index<0)selection.push(id);else selection.splice(index,1);}
  paintAt(p){const b=this.uvBounds||this.modelBounds;if(!inside(p,b))return;Mesh.paintTexture(this.model,this.activeMaterial().id,(p.x-b.x)/b.w,1-(p.y-b.y)/b.h,this.color,this.brushSize);this.revision++;}
  handlePointerMove(p={}){
    const drag=this.modelDrag;if(!drag)return super.handlePointerMove(p);if(drag.id!==undefined&&p.id!==undefined&&drag.id!==p.id)return;
    if(this.uvMode){if(this.tool==='uv-paint')this.paintAt(p);else if(drag.uv){const b=this.uvBounds||this.modelBounds;this.model.faces.find(f=>f.id===drag.uv.face).uv[drag.uv.index]=[Math.max(0,Math.min(1,(p.x-b.x)/b.w)),Math.max(0,Math.min(1,1-(p.y-b.y)/b.h))];this.revision++;}}
    else if(this.tool==='move-vertices'){const a=this.modelRenderer.unprojectToPlane(drag.x,drag.y),b=this.modelRenderer.unprojectToPlane(p.x,p.y);Mesh.moveVertices(this.model,this.selectedVertices(),b.map((n,i)=>n-a[i]));this.revision++;}
    else if(this.tool==='select-joints'&&this.ik&&this.joint){this.pose=Rig.solveIK(this.model,this.pose,this.joint,this.modelRenderer.unprojectToPlane(p.x,p.y));this.playing=false;}
    else if(this.view==='orbit'&&this.tool!=='select-vertices'&&this.tool!=='select-faces'){this.yaw+=(p.x-drag.x)*0.008;this.pitch=Math.max(-1.5,Math.min(1.5,this.pitch+(p.y-drag.y)*0.008));}
    drag.x=p.x;drag.y=p.y;
  }
  handlePointerUp(p={}){if(!this.modelDrag)return super.handlePointerUp(p);const before=this.modelDrag.before;this.modelDrag=null;if(JSON.stringify(before)!==JSON.stringify(this.model)){this.history.undoStack.push({label:'Drag',model:before});if(this.history.undoStack.length>50)this.history.undoStack.shift();this.history.redoStack=[];}}
  handleWheel(p={}){if(inside(p,this.modelBounds)){this.zoom=Math.max(0.1,Math.min(10,this.zoom*Math.exp(-Number(p.deltaY||0)*0.001)));return;}super.handleWheel(p);}
}
