import {CAR_PART_ACTIONS,editCarPart} from './CarPartForms.js';
import {chooseImage} from './MenuDesignerForms.js';
import {pickModelBinding,pickModelAnimation} from './ModelPicker.js';
import {itemEffectFields, EFFECT_LABELS, RECIPIENTS} from '../items/ItemEffectFields.js';
import {itemLibrary} from '../items/ItemLibrary.js';
import {EditorInputActionNormalizer,EDITOR_INPUT_ACTIONS as INPUT} from './shared/input/editorInputActions.js';
import {getEditorControllerRootMenuEntries,getStandardEditorActionRailIds} from './shared/editorMenuSpec.js';
import DoodadEditor from './DoodadEditor.js';
import {normalizeItemDocument, serializeItemDocument, ITEM_EFFECT_TYPES, ITEM_MODIFIERS} from '../items/ItemDocument.js';
import {openEditorForm,chooseEditorFiles} from './shared/editorForm.js';
import {openProjectBrowser} from './ProjectBrowserModal.js';
import {saveProjectFileAndConfirm, sanitizeProjectFileName} from './projectFiles.js';
import {drawSharedPanel, drawSharedFocusRing, drawSharedPortraitActionRail, getSharedMobilePortraitEditorLayout, UI_SUITE} from './uiSuite.js';

const labels = {...CAR_PART_ACTIONS,'item-model':'3D Model','item-model-animation':'Model Animation','item-2d':'Use 2D Artwork','item-properties':'Properties','item-effect-add':'Add Effect','item-effect-edit':'Edit Effect','item-effect-delete':'Remove Effect','item-template':'Built-in Items','item-legacy':'Import Old Mix Tape','item-art':'Artwork','item-image':'Import Image'};
const field = (id,label,value,type='text') => ({id,label,value,type,required:false});
const option = value => ({value,label:value});
const yesNo = [option('yes'),option('no')];

// Reuses Doodad's artwork preview, pointer routing and mode-specific shared shell.
export default class ItemEditor extends DoodadEditor {
  constructor(game) {
    super(game);
    this.doodad = normalizeItemDocument({id:globalThis.crypto?.randomUUID?.()||`item-${Date.now()}-${Math.random().toString(36).slice(2)}`});
    this.undoItems = []; this.redoItems = []; this.selectedEffect = 0;
    this.effectOffset = 0; this.previewZoom = 1; this.previewPan = {x:0,y:0};
    this.landscapeRootId = 'effects'; this.busy = false;this.itemInput=new EditorInputActionNormalizer();this.listScroll={};this.listRegions=[];
  }
  get editorId() {return 'item';}
  get editorTitle() {return 'Item Editor';}
  getQuickAction(){return {id:'item-effect-add',label:'+ Effect',onClick:this.getDesktopActionHandlers()['item-effect-add']};}
  async run(task) {
    if(this.busy)return;
    this.busy=true;
    try {return await task();} catch(error) {this.status=error.message;this.game.showSystemToast?.(error.message);}
    finally {this.busy=false;this.game.input?.reset?.();}
  }
  async change(task) {
    const before=structuredClone(this.doodad);
    await task();
    this.doodad=normalizeItemDocument(this.doodad);
    this.selectedEffect=Math.max(0,Math.min(this.selectedEffect,this.doodad.effects.length-1));
    if(JSON.stringify(before)!==JSON.stringify(this.doodad)){
      this.undoItems.push(before); if(this.undoItems.length>100)this.undoItems.shift(); this.redoItems=[];this.status='Unsaved changes';
    }
  }
  history(redo=false) {
    const from=redo?this.redoItems:this.undoItems,to=redo?this.undoItems:this.redoItems;
    if(!from.length)return;to.push(structuredClone(this.doodad));this.doodad=from.pop();this.selectedEffect=Math.max(0,Math.min(this.selectedEffect,this.doodad.effects.length-1));
    void this.hydrateDoodadArt();this.status='Unsaved changes';
  }
  undo(){this.history();}
  redo(){this.history(true);}
  newDoodad(){void this.run(()=>this.change(()=>{this.doodad=normalizeItemDocument({id:globalThis.crypto?.randomUUID?.()||`item-${Date.now()}`});this.currentDocumentName='';}));}
  loadDoodadDocument(data,name='') {
    this.doodad=normalizeItemDocument(data?.data||data);this.currentDocumentName=name;
    this.undoItems=[];this.redoItems=[];this.selectedEffect=0;this.effectOffset=0;
    void this.hydrateDoodadArt();this.status=`Loaded ${this.doodad.name}`;return true;
  }
  async openItem(legacy=false) {
    const folder=legacy?'doodads':'items';
    const picked=await openProjectBrowser({mode:'open',fixedFolder:folder,initialFolder:folder,title:legacy?'Import Old Mix Tape':'Open Item'});
    if(picked?.payload)this.loadDoodadDocument(picked.payload,legacy?'':picked.name);
  }
  async saveDoodad({forceSaveAs=false}={}) {
    let name=this.currentDocumentName;
    if(forceSaveAs||!name){const picked=await openProjectBrowser({mode:'saveAs',fixedFolder:'items',initialFolder:'items',initialName:this.doodad.name,title:'Save Item'});if(picked?.action!=='saveAs')return;name=picked.name;}
    name=sanitizeProjectFileName(name);
    await saveProjectFileAndConfirm('items',name,serializeItemDocument(this.doodad),{timeoutMs:60000});
    this.currentDocumentName=name;this.status='Saved';
  }
  exportItem() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(serializeItemDocument(this.doodad),null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=`${sanitizeProjectFileName(this.doodad.name)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async importItem() {
    const [file]=await chooseEditorFiles('application/json,.json');if(!file)return;
    this.doodad=normalizeItemDocument(JSON.parse(await file.text()));this.currentDocumentName='';
    await this.hydrateDoodadArt();
  }
  async matchArtworkSize() {
    const ref=this.doodad.artRef;
    if(!ref)return;
    await this.hydrateDoodadArt(ref);
    if(this.doodad.artRef!==ref)return;
    const art=this.getDoodadArtCanvas();
    if(!art?.width||!art?.height)return;
    this.doodad.widthPx=art.width;
    this.doodad.heightPx=art.height;
    this.doodad.widthM=this.doodad.heightM*art.width/art.height;
    this.zoomFit();
  }
  async pickArt() {
    const ref=await super.pickArt();
    if(ref){this.doodad.model=null;await this.matchArtworkSize();}
    return ref;
  }
  async importItemArtwork() {
    const editor=this;let applied=false;
    await chooseImage({get element(){return editor.doodad;},change:fn=>{fn();applied=true;}});
    if(applied){this.doodad.model=null;await this.matchArtworkSize();}
  }
  async properties() {
    const item=this.doodad;
    const result=await openEditorForm('Item Properties',[
      field('name','Name',item.name),field('description','Description',item.description),
      field('widthPx','Level width (pixels)',item.widthPx,'number'),field('heightPx','Level height (pixels)',item.heightPx,'number'),
      field('widthM','Race width (meters)',item.widthM,'number'),field('heightM','Race height (meters)',item.heightM,'number'),
      field('groundOffsetM','Ground offset (meters)',item.groundOffsetM,'number'),
      {id:'persistent',label:'Remember collection between runs',value:item.persistent?'yes':'no',options:yesNo},
      {id:'rotate',label:'Rotate in race',value:item.rotate?'yes':'no',options:yesNo}
    ]);
    if(result)Object.assign(item,result,{persistent:result.persistent==='yes',rotate:result.rotate==='yes'});
  }
  async editEffect(add=false) {
    const effect=add?{type:'health',target:'',amount:1,operation:'add'}:this.doodad.effects[this.selectedEffect];
    if(!effect)return;
    await this.game.radio?.load();
    const tracks=this.game.radio?.library?.tracks||[];
    const entries=await itemLibrary.list();
    const items=(await Promise.all(entries.map(entry=>itemLibrary.load(entry.name).catch(()=>null)))).filter(Boolean);
    const fields=itemEffectFields(effect,this.doodad,{tracks,items});
    const result=await openEditorForm(add?'Add Item Effect':'Edit Item Effect',fields);
    if(!result)return;
    const choices=fields.find(field=>field.id==='target').options(result);
    const choice=choices.find(choice=>choice.value===result.target);
    result.contentName=choice?.label||'';result.itemRef=result.type==='inventory'&&result.bag==='items'?choice?.ref||'':'';
    if(['weapon','ability','device','unlock'].includes(result.type)||(result.type==='inventory'&&result.bag==='radio'))result.amount=1;
    const effects=[...this.doodad.effects];if(add)effects.push(result);else effects[this.selectedEffect]=result;
    // Validate before changing the live document, so an invalid form cannot corrupt it.
    this.doodad=normalizeItemDocument({...this.doodad,effects});if(add)this.selectedEffect=effects.length-1;
  }
  async builtins() {
    const items=await itemLibrary.loadDefaults();
    const result=await openEditorForm('Built-in Item',[{id:'id',label:'Item',value:items[0].id,options:items.map(item=>({value:item.id,label:item.name}))}]);
    if(result){this.doodad=normalizeItemDocument(items.find(item=>item.id===result.id));this.currentDocumentName='';}
  }
  getDesktopActionHandlers() {
    const edit=task=>()=>this.run(()=>this.change(task));
    return {
      new:()=>this.newDoodad(),open:()=>this.run(()=>this.openItem()),save:()=>this.run(()=>this.saveDoodad()),
      export:()=>this.run(()=>this.exportItem()),import:edit(()=>this.importItem()),
      'save-as':()=>this.run(()=>this.saveDoodad({forceSaveAs:true})),
      'exit-main':()=>this.exitToMainMenu(),undo:()=>this.undo(),redo:()=>this.redo(),
      'zoom-fit':()=>this.zoomFit(),
      'item-properties':edit(()=>this.properties()),'item-effect-add':edit(()=>this.editEffect(true)),
      'item-effect-edit':edit(()=>this.editEffect()),'item-effect-delete':edit(()=>{this.doodad.effects.splice(this.selectedEffect,1);this.selectedEffect=Math.max(0,this.selectedEffect-1);}),
      'item-model':edit(async()=>{const model=await pickModelBinding(this.doodad.model,{compact:true});if(model)this.doodad.model=model;}),
      'item-model-animation':edit(async()=>{const model=await pickModelAnimation(this.doodad.model);if(model)this.doodad.model=model;}),
      'item-2d':edit(()=>{this.doodad.model=null;}),
      'item-art':edit(()=>this.pickArt()),'item-image':edit(()=>this.importItemArtwork()),
      'item-part':edit(()=>editCarPart(this.doodad)),
      'item-part-changes':edit(()=>editCarPart(this.doodad,'changes')),
      'item-part-tuning':edit(()=>editCarPart(this.doodad,'tuning')),
      'item-part-curve':edit(()=>editCarPart(this.doodad,'curve')),
      'item-part-remove':edit(()=>{this.doodad.carPart=null;}),
      'item-template':edit(()=>this.builtins()),'item-legacy':()=>this.run(()=>this.openItem(true))
    };
  }
  getMenuItems(root=this.landscapeRootId) {
    const groups={parts:Object.keys(CAR_PART_ACTIONS),file:['new','save','save-as','open','export','import','item-template','item-legacy','exit-main'],edit:['undo','redo','item-properties'],view:['zoom-fit'],artwork:['item-art','item-image','item-model','item-model-animation','item-2d'],effects:['item-effect-add','item-effect-edit','item-effect-delete']};
    const handlers=this.getDesktopActionHandlers();
    return (groups[root]||[]).map(id=>({id,label:labels[id]||({'exit-main':'Exit','save-as':'Save As','zoom-fit':'Fit Preview'}[id])||id[0].toUpperCase()+id.slice(1),onClick:handlers[id],disabled:((id==='item-model-animation'||id==='item-2d')&&!this.doodad.model?.ref)||(id==='undo'&&!this.undoItems.length)||(id==='redo'&&!this.redoItems.length)||(['item-effect-edit','item-effect-delete'].includes(id)&&!this.doodad.effects.length)}));
  }
  getDoodadFileMenuItems(){return this.getMenuItems('file');}
  selectMobileRoot(id){this.mobileRootId=id;}
  drawPortraitMenuSheet(ctx,layout) {
    drawSharedPanel(ctx,layout.menuSheet,{fill:UI_SUITE.colors.panel,border:UI_SUITE.colors.border});
    this.drawActionRows(ctx,layout.rootRail,['file','artwork','effects','parts'].map(id=>({id:`root-${id}`,label:id,active:this.mobileRootId===id,onClick:()=>this.selectMobileRoot(id)})),4);
    this.drawActionRows(ctx,layout.subRail,this.getMenuItems(this.mobileRootId),2);
  }
  setSliderValue(key,value){if(key==='item-zoom')this.previewZoom=value;}
  drawZoom(ctx,bounds){this.drawDoodadSlider(ctx,bounds,{id:'item-zoom',label:'Zoom',min:0.25,max:4,value:this.previewZoom,format:value=>`${Math.round(value*100)}%`});}
  zoomFit(){this.previewZoom=1;this.previewPan={x:0,y:0};}
  exitToMainMenu(){this.game.transitionTo('title',{forceCleanup:true});}
  drawPreview(ctx,bounds) {
    drawSharedPanel(ctx,bounds,{fill:UI_SUITE.colors.panelAlt,border:UI_SUITE.colors.border});
    ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();
    const art=this.getDoodadArtCanvas(),ratio=!this.doodad.model?.ref&&art?.width&&art?.height?art.width/art.height:this.doodad.widthPx/this.doodad.heightPx;
    const h=Math.max(8,Math.min(bounds.h-90,(bounds.w-32)/ratio))*this.previewZoom,w=h*ratio;
    const x=bounds.x+bounds.w/2-w/2+this.previewPan.x,y=bounds.y+30+(bounds.h-90)/2-h/2+this.previewPan.y;
    if(art){ctx.imageSmoothingEnabled=false;ctx.drawImage(art,x,y,w,h);}else{ctx.fillStyle=UI_SUITE.colors.accent;ctx.fillRect(x,y,w,h);}
    ctx.fillStyle=UI_SUITE.colors.text;ctx.font=`14px ${UI_SUITE.font.family}`;ctx.textAlign='left';
    ctx.fillText(this.doodad.name,bounds.x+10,bounds.y+20,bounds.w-20);ctx.fillText(this.status,bounds.x+10,bounds.y+bounds.h-48,bounds.w-20);ctx.restore();
    this.drawZoom(ctx,{x:bounds.x+6,y:bounds.y+bounds.h-42,w:bounds.w-12,h:34});
  }
  drawStudioSprintPreview(ctx,bounds){this.drawPreview(ctx,bounds);}
  effectLabel(effect){
    const title=EFFECT_LABELS[effect.type]||effect.type;
    const content=effect.bag==='radio'?(this.game.radio?.library?.tracks.find(track=>track.id===effect.target)?.title||'Track'):effect.contentName;
    const recipient=RECIPIENTS.find(entry=>entry.value===effect.recipient)?.label||'Player';
    return `${title}: ${content||effect.amount} · ${recipient}${effect.when==='use'?' · Use':effect.when==='hit'?' · Hit':''}`;
  }
  drawEffects(ctx,bounds) {
    drawSharedPanel(ctx,bounds,{fill:UI_SUITE.colors.panel,border:UI_SUITE.colors.border});
    const listBounds={x:bounds.x,y:bounds.y,w:bounds.w,h:Math.max(36,bounds.h-40)};
    this.effectListBounds=listBounds;
    const handlers=this.getDesktopActionHandlers(),part=this.doodad.carPart;
    const rows=this.doodad.effects.map((effect,index)=>({id:`effect:${index}`,label:this.effectLabel(effect),active:index===this.selectedEffect,onClick:()=>{this.selectedEffect=index;}}));
    if(part)rows.push(...[
      ['item-part',`Part: ${part.slot} · ${part.price} credits`],
      ['item-part-changes',`${part.modifiers.length} stat changes`],
      ['item-part-tuning',`${part.tuning.length} tuning settings unlocked`],
      ['item-part-curve',`${part.torqueCurve.length} torque curve points`]
    ].map(([id,label])=>({id:`summary:${id}`,label,onClick:handlers[id]})));
    this.drawActionRows(ctx,listBounds,rows);
    ['item-effect-add','item-effect-edit','item-effect-delete'].forEach((id,i)=>this.registerButton(ctx,{x:bounds.x+6+i*(bounds.w-12)/3,y:bounds.y+bounds.h-34,w:(bounds.w-12)/3-4,h:28},{id,label:['+ Effect','Edit','Remove'][i],onClick:handlers[id]}));
  }
  drawLandscapeSubmenu(ctx,bounds,{items=null,...options}={}) {
    const handlers=this.getDesktopActionHandlers();
    super.drawLandscapeSubmenu(ctx,bounds,{...options,items:(items||this.getMenuItems()).map(item=>({...item,onClick:handlers[item.id]||item.onClick}))});
  }
  drawControls(ctx,bounds){this.drawEffects(ctx,bounds);}
  drawDesktopControls(ctx,bounds){this.drawEffects(ctx,bounds);}
  drawPortraitHotPanel(ctx,bounds){this.drawEffects(ctx,bounds);}
  drawPortrait(ctx,width,height) {
    const layout=getSharedMobilePortraitEditorLayout(width,height,{middleRailHeight:50,maxBottomRailHeight:92});
    const surface=layout.workSurface,hotbar={x:surface.x,y:layout.actionRail.y-48,w:surface.w,h:40};
    const preview={...surface,h:Math.max(60,(hotbar.y-surface.y)*0.45)};
    this.drawPreview(ctx,preview);
    this.drawEffects(ctx,{x:surface.x,y:preview.y+preview.h+4,w:surface.w,h:Math.max(60,hotbar.y-preview.y-preview.h-8)});
    const handlers=this.getDesktopActionHandlers();
    ['item-properties','item-art','item-image'].forEach((id,i)=>this.registerButton(ctx,{x:hotbar.x+i*hotbar.w/3,y:hotbar.y,w:hotbar.w/3-4,h:36},{id,label:labels[id],onClick:handlers[id]}));
    const actions=[{id:'menu',label:'Menu',onClick:()=>this.toggleMobileMenu()},{id:'undo',label:'Undo',disabled:!this.undoItems.length,onClick:()=>this.undo()},{id:'redo',label:'Redo',disabled:!this.redoItems.length,onClick:()=>this.redo()},{id:'context',label:'+ Effect',onClick:handlers['item-effect-add']}];
    const rail=drawSharedPortraitActionRail(ctx,layout.actionRail,this.panJoystick,getStandardEditorActionRailIds('context').map(id=>actions.find(action=>action.id===id)),{reserveThumbstick:true,drawButton:(bounds,action)=>this.registerButton(ctx,bounds,action)});
    if(rail?.thumbstickCenter)Object.assign(this.panJoystick,{center:rail.thumbstickCenter,radius:rail.thumbstickRadius,knobRadius:rail.knobRadius});
    if(this.mobileMenuOpen)this.drawPortraitMenuSheet(ctx,layout);
  }
  draw(ctx,width,height){this.listRegions=[];super.draw(ctx,width,height);}
  drawActionRows(ctx,bounds,actions,columns=1) {
    const key=`${this.activeViewportMode}:${this.mobileRootId}:${this.landscapeRootId}:${Math.round(bounds.x)}:${Math.round(bounds.y)}`;
    const rowH=44,cols=Math.max(1,columns),max=Math.max(0,Math.ceil(actions.length/cols)*rowH+12-bounds.h);
    if(this.focusEffectChanged&&actions[0]?.id?.startsWith('effect:')){
      const top=this.selectedEffect*rowH+6,current=this.listScroll[key]||0;
      this.listScroll[key]=top<current?top:top+36>current+bounds.h?top+36-bounds.h:current;
      this.focusEffectChanged=false;
    }
    const focused=actions.findIndex(action=>action.id===this.gamepadFocusedItemId||action.focused);
    if(this.activeViewportMode==='gamepad'&&focused>=0){
      const top=Math.floor(focused/cols)*rowH+6,current=this.listScroll[key]||0;
      this.listScroll[key]=top<current?top:top+36>current+bounds.h?top+36-bounds.h:current;
    }
    const offset=Math.max(0,Math.min(max,this.listScroll[key]||0));this.listScroll[key]=offset;
    this.listRegions.push({key,bounds:{...bounds},max});
    ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();
    const w=(bounds.w-16-(cols-1)*8)/cols;
    for(let i=0;i<actions.length;i++){
      const action=actions[i],b={x:bounds.x+8+(i%cols)*(w+8),y:bounds.y+6+Math.floor(i/cols)*rowH-offset,w,h:36};
      if(b.y>=bounds.y&&b.y+b.h<=bounds.y+bounds.h){this.registerButton(ctx,b,{...action,listRegionKey:key});if(action.focused||action.id===this.gamepadFocusedItemId)drawSharedFocusRing(ctx,b);}
    }
    ctx.restore();
  }
  inside(point,b){return point.x>=b.x&&point.x<=b.x+b.w&&point.y>=b.y&&point.y<=b.y+b.h;}
  handlePointerDown(point){
    if(this.busy)return;
    if(this.desktopDropdown){super.handlePointerDown(point);return;}
    const region=[...this.listRegions].reverse().find(region=>this.inside(point,region.bounds));
    if(region){this.listDrag={region,startY:point.y,offset:this.listScroll[region.key]||0,moved:false,button:[...this.buttons].reverse().find(button=>button.listRegionKey===region.key&&this.inside(point,button.bounds))};return;}
    super.handlePointerDown(point);
  }
  handlePointerMove(point){
    if(this.listDrag){const drag=this.listDrag,delta=point.y-drag.startY;if(Math.abs(delta)>7)drag.moved=true;if(drag.moved)this.listScroll[drag.region.key]=Math.max(0,Math.min(drag.region.max,drag.offset-delta));return;}
    super.handlePointerMove(point);
  }
  handlePointerUp(point){
    if(this.listDrag){const drag=this.listDrag;this.listDrag=null;if(!drag.moved&&drag.button&&this.inside(point,drag.button.bounds))drag.button.onClick?.();return;}
    super.handlePointerUp(point);
  }
  handleWheel(point){
    const region=[...this.listRegions].reverse().find(region=>this.inside(point,region.bounds));
    if(region){this.listScroll[region.key]=Math.max(0,Math.min(region.max,(this.listScroll[region.key]||0)+(point.deltaY||0)));return;}
    super.handleWheel(point);
  }
  cancel(){
    if(this.desktopDropdown){this.desktopDropdown=null;this.openDesktopDropdownRootId=null;return;}
    if(this.gamepadSubmenuOpen){this.gamepadSubmenuOpen=false;this.landscapeRootDrawerOpen=true;return;}
    if(this.landscapeRootDrawerOpen||this.mobileMenuOpen){this.landscapeRootDrawerOpen=false;this.mobileMenuOpen=false;return;}
    this.exitToMainMenu();
  }
  update(input,dt=0) {
    if(this.busy)return;
    const previousEffect=this.selectedEffect;
    if(this.panJoystick.active){this.previewPan.x-=this.panJoystick.dx*dt*180;this.previewPan.y-=this.panJoystick.dy*dt*180;}
    if(input?.wasPressedCode?.('Escape'))this.cancel();
    if(input?.wasPressedCode?.('ArrowDown'))this.selectedEffect=Math.min(this.doodad.effects.length-1,this.selectedEffect+1);
    if(input?.wasPressedCode?.('ArrowUp'))this.selectedEffect=Math.max(0,this.selectedEffect-1);
    if(input?.wasPressedCode?.('Enter'))void this.getDesktopActionHandlers()['item-effect-edit']();
    const command=['ControlLeft','ControlRight','MetaLeft','MetaRight'].some(key=>input?.isDownCode?.(key));
    for(const [key,id] of [['KeyS','save'],['KeyZ','undo'],['KeyY','redo']])if(input?.wasCommandPressedCode?.(key)||(command&&input?.wasPressedCode?.(key)))this.getDesktopActionHandlers()[id]();
    const pad=this.itemInput.updateGamepad(input,dt,{includePanIntent:true}),roots=getEditorControllerRootMenuEntries(this.editorId);
    const direction=Math.abs(pad.axes.leftY||0)>0.5?(pad.axes.leftY<0?INPUT.NAV_UP:INPUT.NAV_DOWN):Math.abs(pad.axes.leftX||0)>0.5?(pad.axes.leftX<0?INPUT.NAV_LEFT:INPUT.NAV_RIGHT):null;
    if(!direction){this.padRepeat=0;this.padDirection=null;}else{this.padRepeat=(this.padRepeat||0)-dt;if(this.padDirection!==direction||this.padRepeat<=0){pad.actions.push({type:direction});this.padDirection=direction;this.padRepeat=0.2;}}
    for(const action of pad.actions){
      if(action.type===INPUT.MENU){this.landscapeRootDrawerOpen=!this.landscapeRootDrawerOpen;this.gamepadSubmenuOpen=false;this.gamepadFocusedItemId=roots[0]?.id;}
      else if(action.type===INPUT.CANCEL)this.cancel();
      else if(action.type===INPUT.UNDO)this.undo();
      else if(action.type===INPUT.REDO)this.redo();
      else if(this.landscapeRootDrawerOpen||this.gamepadSubmenuOpen){
        const entries=this.landscapeRootDrawerOpen?roots:this.getMenuItems(this.landscapeRootId);
        let index=Math.max(0,entries.findIndex(entry=>entry.id===this.gamepadFocusedItemId));
        if([INPUT.NAV_UP,INPUT.NAV_LEFT,INPUT.NAV_DOWN,INPUT.NAV_RIGHT].includes(action.type)){index=(index+([INPUT.NAV_UP,INPUT.NAV_LEFT].includes(action.type)?-1:1)+entries.length)%entries.length;this.gamepadFocusedItemId=entries[index]?.id;}
        if(action.type===INPUT.CONFIRM&&entries[index]){if(this.landscapeRootDrawerOpen){this.landscapeRootId=entries[index].id;this.landscapeRootDrawerOpen=false;this.gamepadSubmenuOpen=true;this.gamepadFocusedItemId=this.getMenuItems(this.landscapeRootId)[0]?.id;}else if(!entries[index].disabled)entries[index].onClick?.();}
      }else{
        if(action.type===INPUT.NAV_UP)this.selectedEffect=Math.max(0,this.selectedEffect-1);
        if(action.type===INPUT.NAV_DOWN)this.selectedEffect=Math.min(this.doodad.effects.length-1,this.selectedEffect+1);
        if(action.type===INPUT.CONFIRM)this.getDesktopActionHandlers()[this.doodad.effects.length?'item-effect-edit':'item-effect-add']();
      }
    }
    if(!this.gamepadSubmenuOpen&&!this.landscapeRootDrawerOpen){this.previewPan.x-=Number(pad.axes.rightX||0)*dt*180;this.previewPan.y-=Number(pad.axes.rightY||0)*dt*180;}
    if(previousEffect!==this.selectedEffect)this.focusEffectChanged=true;
  }
}
