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
import {drawSharedDesktopContextPanel} from './uiSuite.js';

const label=id=>id.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(' ');
const text=(id,label,value,required=false)=>({id,label,value,type:'text',required});
const select=(id,label,value,options)=>({id,label,value,options});
const unique=(prefix,items)=>{let i=1;while(items.some(item=>item.id===`${prefix}-${i}`))i++;return `${prefix}-${i}`;};
const parse=value=>{try{return JSON.parse(value)}catch{return value}};
const labels={'menu-preview':'Play Preview','menu-animate':'Animate Canvas','screen-start':'Use as First Screen','starting-menu':'Use for Main Play','clear-starting-menu':'Use Default Play','element-art':'Choose Artwork','grand-prix-edit':'Grand Prix Schedules','menu-parameters':'Configuration Parameters','layer-up':'Bring Forward','layer-down':'Send Backward'};
export default class MenuEditor extends RaceEditor {
  constructor(game){super(game,{mode:'car'});this.resources=new MenuResources(game);this.menuInput=new EditorInputActionNormalizer();this.undoMenus=[];this.redoMenus=[];this.currentMenuName='';this.loadMenu(createMenuDocument());this.activeRootId='screens';}
  get editorId(){return 'menu-designer'}
  get title(){return 'Menu Editor'}
  get screen(){return this.menu.screens.find(s=>s.id===this.screenId)||this.menu.screens[0]}
  get element(){return this.screen.elements.find(e=>e.id===this.elementId)}
  loadMenu(document,name=''){this.menu=normalizeMenuDocument(document);this.screenId=this.menu.startScreen;this.elementId=null;this.currentMenuName=name;this.undoMenus=[];this.redoMenus=[];this.menuTime=0;this.animating=false;this.menuDrag=null;this.status=name?`Opened ${name}`:'Starter flow: Splash → Cars → Grand Prix. Add races under Flow.';}
  snapshot(){return structuredClone({menu:this.menu,screenId:this.screenId,elementId:this.elementId})}
  record(before){if(JSON.stringify(before.menu)===JSON.stringify(this.menu))return;this.undoMenus.push(before);if(this.undoMenus.length>60)this.undoMenus.shift();this.redoMenus=[];this.status='Menu changed. Save to keep changes.';}
  change(fn){const before=this.snapshot();try{fn();this.menu=normalizeMenuDocument(this.menu);this.record(before)}catch(error){Object.assign(this,before);throw error}}
  history(redo=false){const from=redo?this.redoMenus:this.undoMenus,to=redo?this.undoMenus:this.redoMenus;if(!from.length)return;to.push(this.snapshot());Object.assign(this,from.pop());this.menuDrag=null;}
  getMenuItems(root){if(root==='preview')root='view';const spec=getEditorMenuSpec(this.editorId);return (spec.sections[root]?.actions||[]).map(id=>({id,label:this.getRaceActionLabel(id),disabled:false,onSelect:()=>this.handleMenuAction(id)}))}
  isActionAvailable(id){return Boolean(getEditorMenuSpec(this.editorId).actions[id])}
  getRaceActionLabel(id){return labels[id]||label(id)}
  getRacePortraitContextAction(){return {id:'menu-preview',label:'Preview',onClick:()=>this.handleMenuAction('menu-preview')}}
  getDesktopContextActions(){return ['screen-select','element-properties','element-action','menu-preview'].map(id=>({id,label:this.getRaceActionLabel(id),contextPanelCommand:true,onClick:()=>this.handleMenuAction(id)}))}
  drawDesktopContext(ctx,bounds){drawSharedDesktopContextPanel(ctx,bounds,{title:this.title,lines:[this.menu.name,`Screen: ${this.screen.name}`,`Selected: ${this.element?.label||'None'}`,`${this.screen.elements.length} elements`,'Drag to move; gold corner resizes.'],contentRoles:['document-summary','active-tool-summary','status'],status:this.status})}
  updateCarEditorPreviewPlaytest(){} updateCarEditorPreviewSelectHold(){return false} ensureCarEditorPreviewPlaytestSession(){return null}
  update(input,dt){
    if(typeof document!=='undefined'&&document.querySelector('dialog[open]'))return;
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
  drawCarEditorWorkSurface(ctx,bounds){this.carArtSliderRegions=[];this.menuBounds={...bounds};drawMenuScreen(ctx,bounds,this.menu,this.screen,this.menu.parameters,{resources:this.resources,time:this.menuTime,selected:this.elementId,editing:!this.animating});if(this.menuPadConnected&&this.menuCursor){ctx.save();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(this.menuCursor.x,this.menuCursor.y,6,0,Math.PI*2);ctx.stroke();ctx.restore();}}
  handlePointerDown(p={}){
    if(this.mobileRootOpen||this.desktopDropdown||this.gamepadSubmenuOpen||this.buttons.some(b=>b.bounds&&menuHit(p,b.bounds)))return super.handlePointerDown(p);
    if(!this.menuBounds||!menuHit(p,this.menuBounds))return super.handlePointerDown(p);
    this.animating=false;this.menuTime=0;
    const e=[...this.screen.elements].reverse().find(e=>e.visible&&menuHit(p,menuElementBounds(e,this.menuBounds)));
    this.elementId=e?.id||null;if(!e)return;
    const rect=menuElementBounds(e,this.menuBounds);
    this.menuDrag={id:p.id,x:p.x,y:p.y,element:structuredClone(e),before:this.snapshot(),resize:p.x>rect.x+rect.w-18&&p.y>rect.y+rect.h-18};
  }
  handlePointerMove(p={}){const drag=this.menuDrag;if(!drag)return super.handlePointerMove(p);if(drag.id!==undefined&&p.id!==undefined&&drag.id!==p.id)return;const e=this.element,b=this.menuBounds,dx=(p.x-drag.x)/b.w,dy=(p.y-drag.y)/b.h;if(!e)return;if(drag.resize){e.w=Math.max(0.02,Math.min(2,drag.element.w+dx));e.h=Math.max(0.02,Math.min(2,drag.element.h+dy));}else{e.x=Math.max(-1,Math.min(1,drag.element.x+dx));e.y=Math.max(-1,Math.min(1,drag.element.y+dy));}}
  handlePointerUp(p={}){if(!this.menuDrag)return super.handlePointerUp(p);if(this.menuDrag.id!==undefined&&p.id!==undefined&&this.menuDrag.id!==p.id)return;this.record(this.menuDrag.before);this.menuDrag=null;}
  async handleMenuAction(id){try{return await this.runAction(id)}catch(error){this.status=error.message}}
  async runAction(id){
    this.activeAction=id;
    if(id==='new')return this.loadMenu(createMenuDocument());
    if(id==='undo'||id==='redo')return this.history(id==='redo');
    if(id==='exit-main')return this.exitToMainMenu();
    if(id==='save'||id==='save-as')return this.saveMenu(id==='save-as');
    if(id==='open'){const picked=await openProjectBrowser({fixedFolder:'menus',initialFolder:'menus',mode:'open',title:'Open Menu'});if(picked?.payload?.data)this.loadMenu(picked.payload.data,picked.name);return;}
    if(id==='export'){const blob=new Blob([JSON.stringify(normalizeMenuDocument(this.menu),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${this.menu.name}.menu.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
    if(id==='import'){const [file]=await chooseEditorFiles('.json,application/json');if(file)this.loadMenu(JSON.parse(await file.text()));return;}
    if(id==='menu-preview'){await this.game?.previewMenu?.(this.menu);return;}
    if(id==='menu-animate'){this.animating=!this.animating;this.menuTime=0;return;}
    if(id==='zoom-fit'){this.animating=false;this.menuTime=0;return;}
    if(id==='screen-select'){const result=await openEditorForm('Choose Screen',[select('id','Screen',this.screenId,this.menu.screens.map(s=>({value:s.id,label:s.name})))]);if(result){this.screenId=result.id;this.elementId=null;this.menuTime=0;}return;}
    if(id==='screen-new'||id==='screen-duplicate'){this.change(()=>{const screen=id==='screen-duplicate'?structuredClone(this.screen):{name:'New Screen',elements:[]};screen.id=unique('screen',this.menu.screens);if(id==='screen-duplicate')screen.name+=' Copy';this.menu.screens.push(screen);this.screenId=screen.id;this.elementId=null;});return;}
    if(id==='screen-start'){this.change(()=>{this.menu.startScreen=this.screenId});return;}
    if(id==='screen-delete'){if(this.menu.screens.length===1)throw Error('Keep at least one screen');this.change(()=>{const old=this.screenId;this.menu.screens=this.menu.screens.filter(s=>s.id!==old);this.screenId=this.menu.screens[0].id;if(this.menu.startScreen===old)this.menu.startScreen=this.screenId;this.elementId=null;const unlink=a=>{if(!a)return null;if(a.type==='screen'&&a.target===old)return null;if(a.then)a.then=unlink(a.then);return a};for(const s of this.menu.screens){s.startAction=unlink(s.startAction);for(const e of s.elements)e.action=unlink(e.action)}});return;}
    if(id==='screen-properties')return this.editScreen();
    if(id.startsWith('insert-')){const type=id.slice(7);this.change(()=>{const e=normalizeMenuElement({id:unique(type,this.screen.elements),type,label:label(type),x:0.1,y:0.2,w:0.8,h:type.startsWith('car-')||type==='power-curve'?0.25:0.1,binding:type.startsWith('car-')||type==='power-curve'?'carRef':''});this.screen.elements.push(e);this.elementId=e.id;});return;}
    if(id==='element-select'){const result=await openEditorForm('Choose Element',[select('id','Element',this.elementId,this.screen.elements.map(e=>({value:e.id,label:`${e.label} (${e.type})`})))]);if(result)this.elementId=result.id;return;}
    if(id==='menu-parameters')return this.editParameters();
    if(id==='grand-prix-edit')return this.editGrandPrix();
    if(id==='starting-menu'){const name=await this.saveMenu();if(!name)return;const result=await saveServerPreference('menu-launch',{menuRef:name});if(!result.ok)throw Error('Could not save starting menu: '+result.reason);this.status=`Main Play opens ${name}`;return;}
    if(id==='clear-starting-menu'){const result=await saveServerPreference('menu-launch',{menuRef:''});if(!result.ok)throw Error(result.reason);this.status='Main Play uses the most recent level';return;}
    if(id==='paste'){if(this.clipboardElement)this.change(()=>{const e=structuredClone(this.clipboardElement);e.id=unique(e.type,this.screen.elements);e.x+=0.025;e.y+=0.025;this.screen.elements.push(e);this.elementId=e.id});return;}
    if(!this.element)throw Error('Select an element on the canvas or from Properties first');
    if(id==='copy'||id==='cut'){this.clipboardElement=structuredClone(this.element);if(id==='copy')return;id='delete';}
    if(id==='delete'){this.change(()=>{this.screen.elements=this.screen.elements.filter(e=>e.id!==this.elementId);this.elementId=null});return;}
    if(id==='duplicate'){this.clipboardElement=structuredClone(this.element);return this.runAction('paste');}
    if(id==='layer-up'||id==='layer-down'){this.change(()=>{const a=this.screen.elements,i=a.indexOf(this.element),j=Math.max(0,Math.min(a.length-1,i+(id==='layer-up'?1:-1)));[a[i],a[j]]=[a[j],a[i]]});return;}
    if(id==='element-properties')return this.editElement();
    if(id==='element-art'){const picked=await openProjectBrowser({fixedFolder:'art',initialFolder:'art',mode:'open',title:'Choose Menu Artwork'});if(picked?.name)this.change(()=>{this.element.artRef=picked.name;this.element.type='image'});return;}
    if(id==='element-action'){const action=await this.editAction(this.element.action);if(action!==undefined)this.change(()=>{this.element.action=action});return;}
    if(id==='element-animation'){const e=this.element,result=await openEditorForm('Animation',[select('animation','Animation',e.animation,MENU_ANIMATIONS),{id:'duration',label:'Duration (seconds)',value:e.duration,min:0.1,max:600},select('loop','Loop',String(e.loop),['true','false'])]);if(result)this.change(()=>Object.assign(this.element,{...result,loop:result.loop==='true'}));return;}
    if(id==='keyframe-clear'){this.change(()=>{this.element.keyframes=[]});return;}
    if(id==='keyframe-add'){const e=this.element,r=await openEditorForm('Set Keyframe',[{id:'time',label:'Time (seconds)',value:e.keyframes.at(-1)?.time+1||0,min:0,max:600},...['x','y'].map(key=>({id:key,label:`${key.toUpperCase()} (0–1)`,value:e[key]})),{id:'opacity',label:'Opacity',value:1,min:0,max:1},{id:'scale',label:'Scale',value:1,min:0.05,max:10},{id:'rotation',label:'Rotation (degrees)',value:0}]);if(r)this.change(()=>{this.element.keyframes=this.element.keyframes.filter(k=>k.time!==r.time);this.element.keyframes.push(r)});return;}
  }
  async saveMenu(saveAs=false){let name=this.currentMenuName;if(!name||saveAs){const result=await openProjectBrowser({fixedFolder:'menus',initialFolder:'menus',mode:'saveAs',initialName:this.menu.name,title:'Save Menu'});if(result?.action!=='saveAs')return;name=result.name;}const data=normalizeMenuDocument({...this.menu,name});await saveProjectFileAndConfirm('menus',name,data,{timeoutMs:60000});this.currentMenuName=name;this.menu=data;this.status=`Saved ${name}`;return name;}
  async editScreen(){const s=this.screen;const result=await openEditorForm('Screen Properties',[text('name','Screen name',s.name,true),text('background','Background color',s.background,true),select('backgroundArt','Background art',s.backgroundArt,['',...listProjectFiles('art').map(f=>f.name)]),select('musicRef','Music',s.musicRef,['',...listProjectFiles('music').map(f=>f.name)]),select('effect','Background effect',s.effect,['none','stars','rain','snow']),select('start','Tap / Space / Start action',s.startAction?'edit':'none',[{value:'none',label:'None — use buttons'},{value:'edit',label:'Configure action'}])]);if(!result)return;let action=null;if(result.start==='edit'){action=await this.editAction(s.startAction);if(action===undefined)return;}this.change(()=>{const {start,...properties}=result;Object.assign(this.screen,properties,{startAction:action})});}
  async editElement(){const e=this.element;const result=await openEditorForm('Element Properties',[
    text('label','Label ({{parameter}} supported)',e.label),...['x','y','w','h'].map(k=>({id:k,label:`${{x:'X',y:'Y',w:'Width',h:'Height'}[k]} (fraction of screen)`,value:e[k],min:k==='w'||k==='h'?0.01:-2,max:3})),
    {id:'fontSize',label:'Font size',value:e.fontSize,min:8,max:160},text('color','Text color',e.color),text('background','Button color',e.background),text('binding','Parameter (e.g. carRef, difficulty, settings.musicVolume)',e.binding),
    select('source','Choices from',e.source,['','cars','grandPrix','races','levels','movies']),
    {id:'options',label:'Choices: one label = value per line (values may be JSON)',type:'textarea',required:false,value:e.options.map(o=>`${o.label} = ${JSON.stringify(o.value)}`).join('\n')},
    ...['min','max','step'].map(k=>({id:k,label:`Slider ${k}`,value:e[k]})),text('videoUrl','Video URL (for Video elements)',e.videoUrl),select('visible','Visible',String(e.visible),['true','false'])]);
    if(result)this.change(()=>{const options=result.options.split('\n').filter(s=>s.trim()).map(s=>{const i=s.indexOf('=');return {label:(i<0?s:s.slice(0,i)).trim(),value:parse((i<0?s:s.slice(i+1)).trim())}});Object.assign(this.element,result,{options,visible:result.visible==='true'})});
  }
  async editAction(action){
    const a=action||{};const r=await openEditorForm('Action',[select('type','Action',a.type||'screen',['none',...MENU_ACTION_TYPES]),text('target','Target (screen ID, saved name, URL, or $parameter)',a.target||''),text('parameter','Parameter to set',a.parameter||''),text('value','Value (text, number, true/false, or JSON)',JSON.stringify(a.value??'')),select('after','After this action',a.then?'edit':'none',[{value:'none',label:'Nothing'},{value:'edit',label:'Configure next action'}])],{description:`Screen IDs: ${this.menu.screens.map(s=>s.id+' ('+s.name+')').join(', ')}\nMovie actions wait for playback before running the next action. Race, level, movie and Grand Prix targets can use a selection such as $carRef or $grandPrix.`});
    if(!r)return undefined;if(r.type==='none')return null;const result={type:r.type,target:r.target,parameter:r.parameter,value:parse(r.value)};if(r.after==='edit'){const then=await this.editAction(a.then);if(then===undefined)return undefined;result.then=then;}return result;
  }
  async editParameters(){const r=await openEditorForm('Configuration Parameters',[{id:'parameters',label:'One name = value per line (numbers, booleans and JSON supported)',type:'textarea',required:false,rows:10,value:Object.entries(this.menu.parameters).map(([k,v])=>`${k} = ${JSON.stringify(v)}`).join('\n')}],{description:'Bind choices, toggles and sliders to these names. The complete configuration is passed into races and levels, including custom weapons and character choices.'});if(r)this.change(()=>{const pairs=r.parameters.split('\n').filter(s=>s.trim()).map(line=>{const i=line.indexOf('=');if(i<1)throw Error('Use name = value for each parameter');return [line.slice(0,i).trim(),parse(line.slice(i+1).trim())]});this.menu.parameters=Object.fromEntries(pairs)});}
  async editGrandPrix(){
    const choose=await openEditorForm('Grand Prix Schedules',[select('id','Schedule','new',[{value:'new',label:'New Grand Prix'},...this.menu.grandPrix.map(g=>({value:g.id,label:g.name}))])]);if(!choose)return;
    const existing=this.menu.grandPrix.find(g=>g.id===choose.id),gp=structuredClone(existing||{id:unique('gp',this.menu.grandPrix),name:'New Grand Prix',races:[]});
    const r=await openEditorForm('Grand Prix',[text('name','Name',gp.name,true),{id:'rounds',label:'Number of races',value:Math.max(1,gp.races.length),min:1,max:100,step:1},select('remove','Delete schedule','false',['false','true'])]);if(!r)return;if(r.remove==='true'){this.change(()=>{this.menu.grandPrix=this.menu.grandPrix.filter(g=>g.id!==gp.id)});return;}
    gp.name=r.name;const races=listProjectFiles('races').map(f=>f.name),movies=['',...listProjectFiles('cutscenes').map(f=>f.name)];if(!races.length)throw Error('Save a race in the Race Editor before creating a Grand Prix');
    const fields=Array.from({length:Math.round(r.rounds)},(_,i)=>[select(`race${i}`,`Round ${i+1}: race`,gp.races[i]?.raceRef||races[0],races),select(`movie${i}`,`Round ${i+1}: intro movie`,gp.races[i]?.movieRef||'',movies)]).flat();const rounds=await openEditorForm('Grand Prix Race Order',fields);if(!rounds)return;
    gp.races=Array.from({length:Math.round(r.rounds)},(_,i)=>({raceRef:rounds[`race${i}`],movieRef:rounds[`movie${i}`]}));this.change(()=>{this.menu.grandPrix=this.menu.grandPrix.filter(g=>g.id!==gp.id);this.menu.grandPrix.push(gp)});
  }
}
