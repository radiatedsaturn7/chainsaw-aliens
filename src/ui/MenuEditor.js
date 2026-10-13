import {MENU_WIDGETS,widgetLabel,widgetDefaults} from '../menus/MenuWidgets.js';
import {setupWidget,chooseImage,parameterNames} from './MenuDesignerForms.js';
import {getMenuDesignerSurfaceLayout,getMenuDesignerPickerLayout} from './shared/menuDesignerLayout.js';
import RaceEditor from './RaceEditor.js';
import {createMenuDocument,normalizeMenuDocument,normalizeMenuElement,MENU_ACTION_TYPES,MENU_ANIMATIONS} from '../menus/MenuDocument.js';
import {drawMenuScreen,menuElementBounds,menuHit} from '../menus/MenuRenderer.js';
import {MenuResources} from '../menus/MenuResources.js';
import {EditorInputActionNormalizer,EDITOR_INPUT_ACTIONS as INPUT} from './shared/input/editorInputActions.js';
import {getEditorMenuSpec,getEditorTouchRootMenuEntries} from './shared/editorMenuSpec.js';
import {openEditorForm,chooseEditorFiles} from './shared/editorForm.js';
import {openProjectBrowser} from './ProjectBrowserModal.js';
import {saveProjectFileAndConfirm,listProjectFiles} from './projectFiles.js';
import {saveServerPreference} from './serverPreferences.js';
import {drawSharedDesktopContextPanel,drawSharedPanel} from './uiSuite.js';

const label=id=>id.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(' ');
const text=(id,label,value,required=false)=>({id,label,value,type:'text',required});
const select=(id,label,value,options)=>({id,label,value,options});
const unique=(prefix,items)=>{let i=1;while(items.some(item=>item.id===`${prefix}-${i}`))i++;return `${prefix}-${i}`;};
const parse=value=>{try{return JSON.parse(value)}catch{return value}};
const labels={'widget-add':'Add Widget','element-setup':'Widget Setup','element-properties':'Layout & Style','element-select':'Layers','screen-select':'Screens','element-action':'On Click / Change','screen-background':'Background Image','insert-car-preview':'Car Rotator','insert-property-display':'Property Display','insert-asset-preview':'Actor / Item Image','menu-preview':'Preview This Screen','menu-preview-start':'Play From Start','element-animation':'Animation','menu-animate':'Animate Canvas','screen-start':'Use as First Screen','starting-menu':'Use for Main Play','clear-starting-menu':'Use Default Play','element-art':'Choose Artwork','menu-parameters':'Configuration Parameters','layer-up':'Bring Forward','layer-down':'Send Backward'};
export default class MenuEditor extends RaceEditor {
  constructor(game){super(game,{mode:'car'});this.resources=new MenuResources(game);this.menuInput=new EditorInputActionNormalizer();this.undoMenus=[];this.redoMenus=[];this.currentMenuName='';this.loadMenu(createMenuDocument());this.activeRootId='screens';}
  get editorId(){return 'menu-designer'}
  get title(){return 'Menu Editor'}
  get screen(){return this.menu.screens.find(s=>s.id===this.screenId)||this.menu.screens[0]}
  get element(){return this.screen.elements.find(e=>e.id===this.elementId)}
  loadMenu(document,name=''){this.menu=normalizeMenuDocument(document);this.screenId=this.menu.startScreen;this.elementId=null;this.currentMenuName=name;this.undoMenus=[];this.redoMenus=[];this.menuTime=0;this.animating=false;this.menuDrag=null;this.menuPicker=null;this.status=name?`Opened ${name}`:'Add a widget from the bottom bar. Drag to arrange it; Setup connects it.';}
  snapshot(){return structuredClone({menu:this.menu,screenId:this.screenId,elementId:this.elementId})}
  record(before){if(JSON.stringify(before.menu)===JSON.stringify(this.menu))return;this.undoMenus.push(before);if(this.undoMenus.length>60)this.undoMenus.shift();this.redoMenus=[];this.status='Menu changed. Save to keep changes.';}
  change(fn){const before=this.snapshot();try{fn();this.menu=normalizeMenuDocument(this.menu);this.record(before)}catch(error){Object.assign(this,before);throw error}}
  history(redo=false){const from=redo?this.redoMenus:this.undoMenus,to=redo?this.undoMenus:this.redoMenus;if(!from.length)return;to.push(this.snapshot());Object.assign(this,from.pop());this.menuDrag=null;}
  getMenuItems(root){if(root==='preview')root='view';const spec=getEditorMenuSpec(this.editorId);return (spec.sections[root]?.actions||[]).map(id=>({id,label:this.getRaceActionLabel(id),disabled:false,onSelect:()=>this.handleMenuAction(id)}))}
  isActionAvailable(id){return Boolean(getEditorMenuSpec(this.editorId).actions[id])}
  getRaceActionLabel(id){return labels[id]||label(id)}
  getRacePortraitContextAction(){return {id:'menu-preview',label:'Preview',onClick:()=>this.handleMenuAction('menu-preview')}}
  getDesktopContextActions(){return ['widget-add','element-setup','element-properties','element-action','menu-preview'].map(id=>({id,label:this.getRaceActionLabel(id),contextPanelCommand:true,onClick:()=>this.handleMenuAction(id)}))}
  drawDesktopContext(ctx,bounds){
    const summary={...bounds,h:Math.min(160,bounds.h*0.3)};
    drawSharedDesktopContextPanel(ctx,summary,{title:this.title,lines:[this.menu.name,`Screen: ${this.screen.name}`,`Selected: ${this.element?.label||'None'}`],contentRoles:['document-summary','active-tool-summary','status'],status:this.status});
    const commands=this.getDesktopContextActions();
    const rows=[...commands,{id:'screen-select',label:`Screen: ${this.screen.name}`,onClick:()=>this.handleMenuAction('screen-select')},...this.screen.elements.map(e=>({id:`select-widget:${e.id}`,label:`${e.id===this.elementId?'● ':''}${e.label||widgetLabel(e.type)} · ${widgetLabel(e.type)}`,active:e.id===this.elementId,onClick:()=>{this.elementId=e.id;this.status='Setup connects this widget. Layout & Style changes its appearance.';}}))];
    this.drawActionRows(ctx,{x:bounds.x,y:bounds.y+summary.h,w:bounds.w,h:bounds.h-summary.h},rows,1,{scrollKey:'menu-designer:inspector'});
  }
  drawLandscapeToolOptions(ctx,bounds){
    drawSharedDesktopContextPanel(ctx,bounds,{title:`${this.screen.name} · ${this.element?.label||'Select a widget'}`,lines:[],contentRoles:['status'],status:this.status});
  }
  drawRaceTopPlayControl(){}
  drawLandscapeRaceMapThumbstick(){}
  updateCarEditorPreviewPlaytest(){} updateCarEditorPreviewSelectHold(){return false} ensureCarEditorPreviewPlaytestSession(){return null}
  update(input,dt){
    if(typeof document!=='undefined'&&document.querySelector('dialog[open]'))return;
    if(this.menuPicker){this.updatePicker(input,dt);return;}
    const cmd=input?.isDownCode?.('ControlLeft')||input?.isDownCode?.('ControlRight')||input?.isDownCode?.('MetaLeft')||input?.isDownCode?.('MetaRight');
    for(const [code,action] of Object.entries({KeyZ:'undo',KeyY:'redo',KeyC:'copy',KeyX:'cut',KeyV:'paste',KeyD:'duplicate',KeyS:'save'}))if(input?.wasCommandPressedCode?.(code)||(cmd&&input?.wasPressedCode?.(code)))void this.handleMenuAction(action);
    if(!cmd&&(input?.wasPressedCode?.('Delete')||input?.wasPressedCode?.('Backspace')))void this.handleMenuAction('delete');
    const cancel=()=>{if(this.menuDrag){Object.assign(this,this.menuDrag.before);this.menuDrag=null;return;}if(this.desktopDropdown){this.closeEditorMenus();return;}if(this.gamepadSubmenuOpen){this.gamepadSubmenuOpen=false;this.mobileRootOpen=true;return;}if(this.mobileRootOpen){this.mobileRootOpen=false;return;}this.exitToMainMenu();};
    if(input?.wasPressedCode?.('Escape'))cancel();
    const pad=this.menuInput.updateGamepad(input,dt,{includePanIntent:true});
    this.menuPadConnected=pad.connected;
    const roots=getEditorTouchRootMenuEntries(this.editorId);
    for(const action of pad.actions){
      if(action.type===INPUT.MENU){this.mobileRootOpen=!this.mobileRootOpen;this.gamepadSubmenuOpen=false;this.gamepadFocusedItemId=roots[0]?.id;}
      else if(action.type===INPUT.CANCEL)cancel();
      else if(action.type===INPUT.UNDO)this.history();
      else if(action.type===INPUT.REDO)this.history(true);
      else if(this.mobileRootOpen||this.gamepadSubmenuOpen){const entries=this.mobileRootOpen?roots:this.getMenuItems(this.activeRootId);let index=Math.max(0,entries.findIndex(e=>e.id===this.gamepadFocusedItemId));
        if([INPUT.NAV_UP,INPUT.NAV_LEFT,INPUT.NAV_DOWN,INPUT.NAV_RIGHT].includes(action.type)){index=(index+([INPUT.NAV_UP,INPUT.NAV_LEFT].includes(action.type)?-1:1)+entries.length)%entries.length;this.gamepadFocusedItemId=entries[index]?.id;}
        if(action.type===INPUT.CONFIRM&&entries[index]){if(this.mobileRootOpen){this.activeRootId=entries[index].id;this.mobileRootOpen=false;this.gamepadSubmenuOpen=true;this.gamepadFocusedItemId=this.getMenuItems(this.activeRootId)[0]?.id;}else{void this.handleMenuAction(entries[index].id);this.gamepadSubmenuOpen=false;}}
      }
    }
    if(pad.connected&&this.menuBounds&&!this.mobileRootOpen&&!this.gamepadSubmenuOpen){const b=this.menuBounds;this.menuCursor||={x:b.x+b.w/2,y:b.y+b.h/2};this.menuCursor.x=Math.max(b.x,Math.min(b.x+b.w,this.menuCursor.x+pad.axes.leftX*dt*350));this.menuCursor.y=Math.max(b.y,Math.min(b.y+b.h,this.menuCursor.y+pad.axes.leftY*dt*350));const point={...this.menuCursor,id:'menu-gamepad'};if(pad.pressed.jump)this.handlePointerDown(point);else if(pad.down.jump)this.handlePointerMove(point);if(pad.released.jump)this.handlePointerUp(point);}
    if(this.animating)this.menuTime+=Math.max(0,Number(dt)||0);
  }
  exitToMainMenu(){this.resources.carPreview.dispose();this.game?.exitMenuEditor?.()}
  drawCarEditorWorkSurface(ctx,bounds){
    this.carArtSliderRegions=[];this.menuSurfaceBounds={...bounds};
    const layout=getMenuDesignerSurfaceLayout(bounds);this.menuBounds=layout.canvas;this.menuHotbarBounds=layout.hotbar;
    drawMenuScreen(ctx,this.menuBounds,this.menu,this.screen,this.menu.parameters,{resources:this.resources,time:this.menuTime,selected:this.elementId,editing:!this.animating});
    ctx.save();ctx.fillStyle='#aec6d2';ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillText(this.menuPicker?(this.pickerEntries()[this.pickerFocus]?.description||this.pickerEntries()[this.pickerFocus]?.label||'Choose an item'):`Screen: ${this.screen.name} · ${this.element?widgetLabel(this.element.type)+' selected':'Select a widget to edit'}`,bounds.x,bounds.y+14,bounds.w);ctx.restore();
    const ids=['widget-add','element-setup','element-select','screen-select'],width=(layout.hotbar.w-18)/4;
    ids.forEach((id,i)=>this.registerDrawnButton(ctx,{x:layout.hotbar.x+i*(width+6),y:layout.hotbar.y,w:width,h:44},{id,label:({'widget-add':'+ Widget ▴','element-setup':'Setup','element-select':'Layers ▴','screen-select':'Screens ▴'})[id],onClick:()=>this.handleMenuAction(id)}));
    if(this.menuPicker)this.drawPicker(ctx);
    if(this.menuPadConnected&&this.menuCursor&&!this.menuPicker){ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(this.menuCursor.x,this.menuCursor.y,6,0,Math.PI*2);ctx.stroke();ctx.restore();}
  }
  pickerEntries(){
    if(this.menuPicker==='widgets')return MENU_WIDGETS.map(w=>({id:`pick-widget:${w.type}`,label:w.label,description:w.description,action:()=>this.runAction(`insert-${w.type}`)}));
    if(this.menuPicker==='screens')return [...this.menu.screens.map(s=>({id:`pick-screen:${s.id}`,label:s.name,action:()=>{this.screenId=s.id;this.elementId=null;this.animating=false;this.menuTime=0;}})),{id:'pick-screen:new',label:'+ New Screen',action:()=>this.runAction('screen-new')}];
    if(this.menuPicker==='layers')return this.screen.elements.length?[...this.screen.elements].reverse().map(e=>({id:`pick-layer:${e.id}`,label:e.label||widgetLabel(e.type),description:widgetLabel(e.type),action:()=>{this.elementId=e.id;}})):[{id:'pick-layer:add',label:'+ Add Widget',action:()=>this.openPicker('widgets')}];
    if(this.menuPicker==='animation')return [...MENU_ANIMATIONS.map(animation=>({id:`pick-animation:${animation}`,label:({none:'None (static)',pulse:'Pulse',fade:'Fade in',bob:'Bob up / down',spin:this.element?.type==='car-preview'?'Rotate car':'Rotate'})[animation],action:()=>{this.change(()=>{this.element.animation=animation;this.element.keyframes=[];if(animation==='spin'&&this.element.type==='car-preview')this.element.angleBinding='';});this.animating=animation!=='none';this.menuTime=0;this.status=animation==='none'?'Animation off':`${label(animation)} animation playing on the canvas`;}})),{id:'pick-animation:timing',label:'Speed / Repeat…',action:()=>this.runAction('animation-timing')}];
    return [];
  }
  openPicker(kind){this.closeEditorMenus();this.menuPicker=this.menuPicker===kind?null:kind;this.pickerFocus=0;this.pickerPress=null;}
  drawPicker(ctx){
    const entries=this.pickerEntries();
    const anchor=this.buttons.find(b=>b.id===({'widgets':'widget-add',layers:'element-select',screens:'screen-select',animation:'element-setup'})[this.menuPicker]&&b.bounds.y===this.menuHotbarBounds.y)?.bounds||this.menuHotbarBounds;
    this.pickerLayout=getMenuDesignerPickerLayout(anchor,this.menuSurfaceBounds,entries,this.pickerFocus);
    drawSharedPanel(ctx,this.pickerLayout.panel,{fill:'#15232f',border:'#91b4d0'});
    for(const entry of this.pickerLayout.buttons)this.registerDrawnButton(ctx,entry.bounds,{...entry,active:entry.index===this.pickerFocus,onClick:()=>this.choosePicker(entry)});
  }
  choosePicker(entry){
    if(!entry||entry.disabled)return;
    if(entry.page){this.pickerFocus=Math.max(0,Math.min(this.pickerEntries().length-1,(this.pickerLayout.page+entry.page)*this.pickerLayout.pageSize));return;}
    this.menuPicker=null;this.pickerPress=null;
    Promise.resolve().then(()=>entry.action?.()).catch(error=>{this.status=error.message});
  }
  updatePicker(input,dt){
    const pressed=code=>input?.wasPressedCode?.(code),pad=this.menuInput.updateGamepad(input,dt);
    if(pressed('Escape')||pad.actions.some(a=>a.type===INPUT.CANCEL)){this.menuPicker=null;return;}
    const entries=this.pickerEntries(),count=entries.length;
    let delta=0;
    if(pressed('ArrowRight'))delta++;if(pressed('ArrowLeft'))delta--;if(pressed('ArrowDown'))delta+=2;if(pressed('ArrowUp'))delta-=2;
    for(const a of pad.actions){if(a.type===INPUT.NAV_RIGHT)delta++;if(a.type===INPUT.NAV_LEFT)delta--;if(a.type===INPUT.NAV_DOWN)delta+=2;if(a.type===INPUT.NAV_UP)delta-=2;}
    if(delta&&count)this.pickerFocus=(this.pickerFocus+delta+count)%count;
    if(pressed('Enter')||pressed('Space')||pad.actions.some(a=>a.type===INPUT.CONFIRM))this.choosePicker(entries[this.pickerFocus]);
  }
  handleWheel(p={}){if(this.menuPicker){const entries=this.pickerEntries();this.pickerFocus=Math.max(0,Math.min(entries.length-1,this.pickerFocus+(p.deltaY>0?2:-2)));return;}return super.handleWheel(p);}
  handlePointerDown(p={}){
    if(this.menuPicker){const hit=this.pickerLayout?.buttons.find(b=>menuHit(p,b.bounds));if(hit){this.pickerPress={id:p.id,entry:hit};return;}this.menuPicker=null;this.pickerPress=null;return;}
    if(this.mobileRootOpen||this.desktopDropdown||this.gamepadSubmenuOpen||this.buttons.some(b=>b.bounds&&menuHit(p,b.bounds)))return super.handlePointerDown(p);
    if(!this.menuBounds||!menuHit(p,this.menuBounds))return super.handlePointerDown(p);
    this.animating=false;this.menuTime=0;
    const e=[...this.screen.elements].reverse().find(e=>e.visible&&menuHit(p,menuElementBounds(e,this.menuBounds)));
    this.elementId=e?.id||null;if(!e)return;
    const rect=menuElementBounds(e,this.menuBounds);
    this.menuDrag={id:p.id,x:p.x,y:p.y,element:structuredClone(e),before:this.snapshot(),resize:p.x>rect.x+rect.w-18&&p.y>rect.y+rect.h-18};
  }
  handlePointerMove(p={}){if(this.menuPicker){const hit=this.pickerLayout?.buttons.find(b=>menuHit(p,b.bounds));if(Number.isInteger(hit?.index))this.pickerFocus=hit.index;return;}const drag=this.menuDrag;if(!drag)return super.handlePointerMove(p);if(drag.id!==undefined&&p.id!==undefined&&drag.id!==p.id)return;const e=this.element,b=this.menuBounds,dx=(p.x-drag.x)/b.w,dy=(p.y-drag.y)/b.h;if(!e)return;if(drag.resize){e.w=Math.max(0.02,Math.min(2,drag.element.w+dx));e.h=Math.max(0.02,Math.min(2,drag.element.h+dy));}else{e.x=Math.max(-1,Math.min(1,drag.element.x+dx));e.y=Math.max(-1,Math.min(1,drag.element.y+dy));e.keyframes=drag.element.keyframes.map(k=>({...k,x:k.x+e.x-drag.element.x,y:k.y+e.y-drag.element.y}));}}
  handlePointerUp(p={}){if(this.pickerPress){const press=this.pickerPress;this.pickerPress=null;if((press.id===undefined||p.id===undefined||press.id===p.id)&&menuHit(p,press.entry.bounds))this.choosePicker(press.entry);return;}if(this.menuPicker)return;if(!this.menuDrag)return super.handlePointerUp(p);if(this.menuDrag.id!==undefined&&p.id!==undefined&&this.menuDrag.id!==p.id)return;this.record(this.menuDrag.before);this.menuDrag=null;}
  async handleMenuAction(id){try{this.closeEditorMenus();if(!['widget-add','element-select','screen-select','element-animation'].includes(id))this.menuPicker=null;return await this.runAction(id)}catch(error){this.status=error.message}}
  async runAction(id){
    this.activeAction=id;
    if(id==='widget-add')return this.openPicker('widgets');
    if(id==='element-setup')return setupWidget(this);
    if(id==='screen-background')return chooseImage(this,{background:true});
    if(id==='test-drive')return this.runAction('menu-preview');
    if(id==='new')return this.loadMenu(createMenuDocument());
    if(id==='undo'||id==='redo')return this.history(id==='redo');
    if(id==='exit-main')return this.exitToMainMenu();
    if(id==='save'||id==='save-as')return this.saveMenu(id==='save-as');
    if(id==='open'){const picked=await openProjectBrowser({fixedFolder:'menus',initialFolder:'menus',mode:'open',title:'Open Menu'});if(picked?.payload?.data)this.loadMenu(picked.payload.data,picked.name);return;}
    if(id==='export'){const blob=new Blob([JSON.stringify(normalizeMenuDocument(this.menu),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${this.menu.name}.menu.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    if(id==='import'){const [file]=await chooseEditorFiles('.json,application/json');if(file)this.loadMenu(JSON.parse(await file.text()));return;}
    if(id==='menu-preview'||id==='menu-preview-start'){this.menuPicker=null;await this.game?.previewMenu?.(this.menu,{screenId:id==='menu-preview'?this.screenId:this.menu.startScreen});return;}
    if(id==='menu-animate'){this.animating=!this.animating;this.menuTime=0;return;}
    if(id==='zoom-fit'){this.animating=false;this.menuTime=0;return;}
    if(id==='screen-select')return this.openPicker('screens');
    if(id==='screen-new'||id==='screen-duplicate'){this.change(()=>{const screen=id==='screen-duplicate'?structuredClone(this.screen):{name:'New Screen',elements:[]};screen.id=unique('screen',this.menu.screens);if(id==='screen-duplicate')screen.name+=' Copy';this.menu.screens.push(screen);this.screenId=screen.id;this.elementId=null;});return;}
    if(id==='screen-start'){this.change(()=>{this.menu.startScreen=this.screenId});return;}
    if(id==='screen-delete'){if(this.menu.screens.length===1)throw Error('Keep at least one screen');this.change(()=>{const old=this.screenId;this.menu.screens=this.menu.screens.filter(s=>s.id!==old);this.screenId=this.menu.screens[0].id;if(this.menu.startScreen===old)this.menu.startScreen=this.screenId;this.elementId=null;const unlink=a=>{if(!a)return null;if(a.type==='screen'&&a.target===old)return null;if(a.then)a.then=unlink(a.then);return a};for(const s of this.menu.screens){s.startAction=unlink(s.startAction);for(const e of s.elements)e.action=unlink(e.action)}});return;}
    if(id==='screen-properties')return this.editScreen();
    if(id.startsWith('insert-')){const type=id.slice(7);this.change(()=>{const e=normalizeMenuElement({...widgetDefaults(type),id:unique(type,this.screen.elements)});this.screen.elements.push(e);this.elementId=e.id;});this.status=`${widgetLabel(type)} added. Use Setup to connect it; drag to move or resize.`;return;}
    if(id==='element-select')return this.openPicker('layers');
    if(id==='menu-parameters')return this.editParameters();
    if(id==='starting-menu'){const name=await this.saveMenu();if(!name)return;const result=await saveServerPreference('menu-launch',{menuRef:name});if(!result.ok)throw Error('Could not save starting menu: '+result.reason);this.status=`Main Play opens ${name}`;return;}
    if(id==='clear-starting-menu'){const result=await saveServerPreference('menu-launch',{menuRef:''});if(!result.ok)throw Error(result.reason);this.status='Main Play uses the most recent level';return;}
    if(id==='paste'){if(this.clipboardElement)this.change(()=>{const e=structuredClone(this.clipboardElement);e.id=unique(e.type,this.screen.elements);e.x+=0.025;e.y+=0.025;this.screen.elements.push(e);this.elementId=e.id});return;}
    if(!this.element)throw Error('Select a widget on the canvas or in Layers first');
    if(id==='copy'||id==='cut'){this.clipboardElement=structuredClone(this.element);if(id==='copy')return;id='delete';}
    if(id==='delete'){this.change(()=>{this.screen.elements=this.screen.elements.filter(e=>e.id!==this.elementId);this.elementId=null});return;}
    if(id==='duplicate'){this.clipboardElement=structuredClone(this.element);return this.runAction('paste');}
    if(id==='layer-up'||id==='layer-down'){this.change(()=>{const a=this.screen.elements,i=a.indexOf(this.element),j=Math.max(0,Math.min(a.length-1,i+(id==='layer-up'?1:-1)));[a[i],a[j]]=[a[j],a[i]]});return;}
    if(id==='element-properties')return this.editElement();
    if(id==='element-art')return chooseImage(this);
    if(id==='element-action'){const action=await this.editAction(this.element.action);if(action!==undefined)this.change(()=>{this.element.action=action});return;}
    if(id==='element-animation')return this.openPicker('animation');
    if(id==='animation-timing'){const e=this.element,result=await openEditorForm('Animation Speed',[{id:'duration',label:'Seconds per animation',value:e.duration,min:0.1,max:600},select('loop','Repeat',String(e.loop),[{value:'true',label:'Keep repeating'},{value:'false',label:'Play once'}])]);if(result)this.change(()=>Object.assign(this.element,{...result,loop:result.loop==='true'}));return;}

  }
  async saveMenu(saveAs=false){let name=this.currentMenuName;if(!name||saveAs){const result=await openProjectBrowser({fixedFolder:'menus',initialFolder:'menus',mode:'saveAs',initialName:this.menu.name,title:'Save Menu'});if(result?.action!=='saveAs')return;name=result.name;}const data=normalizeMenuDocument({...this.menu,name});await saveProjectFileAndConfirm('menus',name,data,{timeoutMs:60000});this.currentMenuName=name;this.menu=data;this.status=`Saved ${name}`;return name;}
  async editScreen(){const s=this.screen;const result=await openEditorForm('Screen Properties',[text('name','Screen name',s.name,true),text('background','Background color',s.background,true),select('backgroundArt','Background art',s.backgroundArt,['',...listProjectFiles('art').map(f=>f.name)]),select('musicRef','Music',s.musicRef,['',...listProjectFiles('music').map(f=>f.name)]),select('effect','Background effect',s.effect,['none','stars','rain','snow']),select('start','Tap / Space / Start action',s.startAction?'edit':'none',[{value:'none',label:'None — use buttons'},{value:'edit',label:'Configure action'}])]);if(!result)return;let action=null;if(result.start==='edit'){action=await this.editAction(s.startAction);if(action===undefined)return;}this.change(()=>{const {start,...properties}=result;Object.assign(this.screen,properties,{startAction:action})});}
  async editElement(){
    const e=this.element,fields=[text('label','Label ({{parameter}} supported)',e.label),...['x','y','w','h'].map(k=>({id:k,label:`${{x:'X',y:'Y',w:'Width',h:'Height'}[k]} (% of screen)`,value:e[k]*100,min:k==='w'||k==='h'?1:-100,max:200})),{id:'fontSize',label:'Font size',value:e.fontSize,min:8,max:160},text('color','Text color',e.color),text('background','Control background color',e.background),select('visible','Visible',String(e.visible),['true','false'])];
    if(['image','asset-preview'].includes(e.type))fields.push(select('imageFit','Fit image',e.imageFit,['contain','cover','stretch']));
    const result=await openEditorForm('Layout & Style',fields,{description:'Drag the widget to move it; drag its gold corner to resize. Use Setup to change data or behavior.'});
    if(result)this.change(()=>{for(const key of ['x','y','w','h'])result[key]/=100;Object.assign(this.element,result,{visible:result.visible==='true'})});
  }
  async editAction(action){
    const names={screen:'Open screen',back:'Back', 'set-param':'Set a parameter',race:'Start race',level:'Load level',movie:'Play movie',quit:'Exit menu'};
    const kind=await openEditorForm('Widget Action',[select('type','When activated',action?.type||'screen',[{value:'none',label:'No action'},...MENU_ACTION_TYPES.map(type=>({value:type,label:names[type]}))])]);
    if(!kind)return undefined;if(kind.type==='none')return null;
    const a=action?.type===kind.type?action:{},fields=[];
    const folders={race:'races',level:'levels',movie:'cutscenes'};
    const targets=kind.type==='screen'?this.menu.screens.map(s=>({value:s.id,label:s.name})):folders[kind.type]?listProjectFiles(folders[kind.type]).map(f=>({value:f.name,label:f.name})):[];
    if(['screen','race','level','movie'].includes(kind.type)){
      targets.push(...parameterNames(this).map(key=>({value:`$${key}`,label:`Selected value: ${key}`})));
      if(a.target&&!targets.some(t=>t.value===a.target))targets.push({value:a.target,label:a.target});
      fields.push(select('target','Destination',a.target||targets[0]?.value||'',targets));
      if(kind.type==='movie')fields.push(text('url','Or video URL (overrides destination)',''));
    }
    if(kind.type==='set-param')fields.push({...text('parameter','Parameter',a.parameter||'',true),suggestions:parameterNames(this)},text('value','Value (text, number, true/false, or JSON)',JSON.stringify(a.value??'')));
    if(!['race','level'].includes(kind.type))fields.push(select('after','Then',a.then?'edit':'none',[{value:'none',label:'Nothing else'},{value:'edit',label:'Configure another action'}]));
    const r=await openEditorForm(names[kind.type],fields,{description:kind.type==='race'?'Launch one saved race with the menu selections. Configure its next destination in the Race Editor’s finish settings.':'The selected values travel into races and levels. Movies finish before the next action runs.'});
    if(!r)return undefined;const result={type:kind.type,target:r.url||r.target||'',parameter:r.parameter||'',value:parse(r.value??'')};
    if(r.after==='edit'){const then=await this.editAction(a.then);if(then===undefined)return undefined;result.then=then;}return result;
  }
  async editParameters(){const r=await openEditorForm('Configuration Parameters',[{id:'parameters',label:'One name = value per line (numbers, booleans and JSON supported)',type:'textarea',required:false,rows:10,value:Object.entries(this.menu.parameters).map(([k,v])=>`${k} = ${JSON.stringify(v)}`).join('\n')}],{description:'Bind choices, toggles and sliders to these names. The complete configuration is passed into races and levels, including custom weapons and character choices.'});if(r)this.change(()=>{const pairs=r.parameters.split('\n').filter(s=>s.trim()).map(line=>{const i=line.indexOf('=');if(i<1)throw Error('Use name = value for each parameter');return [line.slice(0,i).trim(),parse(line.slice(i+1).trim())]});this.menu.parameters=Object.fromEntries(pairs)});}
}
