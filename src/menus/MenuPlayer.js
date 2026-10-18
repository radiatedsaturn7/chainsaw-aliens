import {loadMenuProgress} from './MenuProgress.js';
import {worldMapNodes,worldMapNodePoint} from './MenuWorldMap.js';
import {showroomPage,garageBrowserRows,garageCardBounds} from './MenuGarageWidgets.js';
import {createMenuRepeatState,resetMenuRepeatState,getMenuRepeatDirection} from '../ui/shared/menuRepeat.js';
import {ItemSystem} from '../items/ItemSystem.js';
import {runGarageAction} from '../garage/GarageMenu.js';
import {drawSharedPlayStopButton} from '../ui/uiSuite.js';
import {MenuPreviewSurface} from './MenuPreviewSurface.js';
import {menuPaintOrder,menuElementVisible,fitMenuCanvas} from './MenuLayout.js';
import {MenuFlow} from './MenuFlow.js';
import {MenuResources} from './MenuResources.js';
import {drawMenuScreen,menuElementBounds,menuElementInteractive,menuHit} from './MenuRenderer.js';
import {menuElementPose} from './MenuDocument.js';
import {MenuSettings} from './MenuSettings.js';
import {CutscenePlayer} from '../ui/CutsceneEditor.js';
import {hydrateProjectFilePayload} from '../ui/projectFiles.js';

export default class MenuPlayer {
  constructor(game){this.game=game;this.surface=new MenuPreviewSurface(game);this.resources=new MenuResources(game);this.settings=new MenuSettings(game);this.videos=new Map();this.cutscene=new CutscenePlayer(game);this.mediaGeneration=0;this.focus=0;this.widgetStates=new Map();this.navigationRepeat=createMenuRepeatState();this.preview=false;this.message='';this.flow=null;}
  async open(document,{preview=false,screenId=null}={}){
    if(this.flow){this.flow.active=false;this.flow.generation++;}
    this.restorePreview();this.cleanup();if(typeof window!=='undefined'){this.tabListener=event=>{if(this.game.state==='menu-player'&&event.code==='Tab'&&!this.capturing)event.preventDefault();};window.addEventListener('keydown',this.tabListener);}
    this.preview=preview;this.paused=false;this.message='';this.focus=0;
    if(preview)this.previewSnapshot={worldData:this.game.buildWorldData?.(),menuParameters:this.game.menuParameters,storyData:this.game.storyData,gameMode:this.game.gameMode,playtestActive:this.game.playtestActive,simulationActive:this.game.simulationActive};
    await this.settings.load();
    await this.game.items?.load();
    if(preview&&this.game.items){
      const snapshot={...structuredClone(this.game.items.progress),stats:structuredClone(this.game.items.savedStats)};
      const sandboxGame={player:structuredClone({credits:this.game.player?.credits??snapshot.stats?.credits??0}),abilities:{}};
      const sandbox=new ItemSystem(sandboxGame,{library:this.game.items.library,load:async key=>key==='rtg-item-progress'?snapshot:{},save:async()=>({ok:true})});
      this.resources.garageOverride=sandbox.garage;
    }else this.resources.garageOverride=null;
    await this.resources.prepareGarage();
    this.flow=new MenuFlow(document,{
      parameterChanged:(key,value)=>{void this.settings.set(key,value).catch(error=>{if(this.flow)this.flow.error=error.message})},
      screenChanged:()=>this.enterScreen(),stop:()=>{this.cleanup();this.restorePreview();this.game.transitionTo(this.preview?'menu-editor':'title',{forceCleanup:true})},
      garageAction:async(type,ref,params)=>{
        await runGarageAction(this.resources.garage,type,ref,params,{resolveCar:async name=>{const selected=await this.game.resolveRaceTravelCarAsync(name);return selected?.car;}});
        this.resources.garageCars.clear();this.message='Garage saved';
      },
      playMovie:(ref)=>this.playMovie(ref),launchRace:(ref,params)=>this.launchRace(ref,params),launchLevel:(ref,params)=>this.launchLevel(ref,params)
    });
    if(preview&&this.flow.document.screens.some(s=>s.id===screenId))this.flow.screenId=screenId;
    Object.assign(this.flow.parameters,await loadMenuProgress(this.game),this.settings.parameters());this.game.transitionTo('menu-player',{forceCleanup:true});this.enterScreen();
  }
  restorePreview(){const snapshot=this.previewSnapshot;if(!snapshot)return;this.previewSnapshot=null;if(snapshot.worldData)this.game.applyWorldData(snapshot.worldData);for(const key of ['menuParameters','storyData','gameMode','playtestActive','simulationActive'])this.game[key]=snapshot[key];this.game.raceEditorPlaytestReturn=false;this.game.raceTravelSession=null;}
  releasePauseAudio(){const context=this.pausedAudioContext;this.pausedAudioContext=null;if(context)void context.resume().catch(()=>{});}
  togglePause(){if(!this.preview||(this.flow.busy&&!this.cutscene.active&&!this.movie))return;this.paused=!this.paused;if(this.paused){this.slider=null;this.cancelKeyCapture();const context=this.game.audio?.ctx;if(context?.state==='running'){this.pausedAudioContext=context;void context.suspend().catch(()=>{});}this.pausedVideos=[...this.videos.values(),this.movie].filter(v=>v&&!v.paused);for(const v of this.pausedVideos)v.pause();}else{this.releasePauseAudio();for(const v of this.pausedVideos||[])void v.play().catch(()=>{});this.pausedVideos=[];}}
  cleanupScreen(){this.mediaGeneration++;this.choicePopup=null;this.slider=null;this.game.setActiveMusicTrack?.(null);for(const video of this.videos.values()){video.pause();video.removeAttribute('src');video.load();}this.videos.clear();}
  cleanup(){resetMenuRepeatState(this.navigationRepeat);this.releasePauseAudio();if(this.tabListener&&typeof window!=='undefined')window.removeEventListener('keydown',this.tabListener);this.tabListener=null;this.surface.reset();this.resources.carPreview.dispose();this.cleanupScreen();this.cancelKeyCapture();if(this.cutscene.active){this.cutscene.onDone=null;this.cutscene.stop();}if(this.movie){this.movie.pause();this.movie.removeAttribute('src');this.movie.load();this.movie=null;}this.rejectMovie?.(Error('Playback cancelled'));this.rejectMovie=null;this.resolveMovie=null;}
  enterScreen(){
    this.cleanupScreen();this.widgetStates.clear();this.focus=0;this.message='';const flow=this.flow,screen=flow.screen,generation=this.mediaGeneration;
    for(const e of screen.elements){if(['choice','car-showroom'].includes(e.type)&&e.binding){const choices=e.type==='car-showroom'?this.resources.choices('cars',flow.document,flow.parameters):e.source?this.resources.choices(e.source,flow.document,flow.parameters):e.options;if(choices.length&&!choices.some(o=>JSON.stringify(o.value)===JSON.stringify(flow.parameters[e.binding])))flow.setParameter(e.binding,choices[0].value);}
      if(e.type==='car-showroom')this.widgetStates.set(e.id,{value:flow.parameters[e.binding],selectedAt:flow.time});
      if(e.type==='video'&&e.videoUrl&&typeof document!=='undefined'){const video=document.createElement('video');video.src=e.videoUrl;video.loop=e.loop;video.playsInline=true;video.muted=true;video.onerror=()=>{flow.error=`Video could not load: ${e.videoUrl}`};this.videos.set(e.id,video);void video.play().catch(()=>{this.message='Tap to play video'});}
    }
    if(screen.musicRef)void hydrateProjectFilePayload('music',screen.musicRef).then(payload=>{if(this.mediaGeneration!==generation)return;if(!payload?.data)throw Error(`Music not found: ${screen.musicRef}`);this.game.setActiveMusicTrack?.(screen.musicRef,{restart:true,loop:true})}).catch(error=>{flow.error=error.message});
  }
  interactive(){return (this.flow?menuPaintOrder(this.flow.screen.elements).filter(e=>menuElementVisible(e,this.flow.screen.elements)&&menuElementInteractive(e)).sort((a,b)=>(a.tabOrder||Infinity)-(b.tabOrder||Infinity)):[])||[]}
  moveHorizontal(items,direction){
    const current=items[this.focus];if(!current)return;
    if(['world-map','car-showroom','garage-browser','choice','slider','toggle'].includes(current.type)){void this.activate(current,direction);return;}
    const bounds=this.bounds||{x:0,y:0,w:960,h:540};
    const geometry=e=>{const pose=menuElementPose(e,this.flow.time),b=menuElementBounds(e,bounds,pose);return {x:b.x+b.w/2,y:b.y+b.h/2,h:b.h*pose.scale};};
    const origin=geometry(current);let nearest=-1,distance=Infinity;
    for(const [index,item] of items.entries()){
      if(index===this.focus)continue;
      const target=geometry(item),dx=(target.x-origin.x)*direction,dy=Math.abs(target.y-origin.y);
      // Horizontal navigation stays in the same row and never activates a button.
      if(dx<=0||dy>=(origin.h+target.h)/2)continue;
      const score=Math.hypot(dx,dy);if(score<distance){nearest=index;distance=score;}
    }
    if(nearest>=0)this.focus=nearest;
  }
  async activate(element,direction=1,{choose=false}={}){
    if(!element||this.paused||this.flow.busy||this.capturing)return;
    if(element.type==='world-map'){
      const nodes=worldMapNodes(element,this.resources,this.flow.document,this.flow.parameters);if(!nodes.length)return;
      let index=nodes.findIndex(n=>n.raceRef===this.flow.parameters[element.binding]);if(index<0)index=0;
      if(!choose){index=(index+direction+nodes.length)%nodes.length;this.flow.setParameter(element.binding,nodes[index].raceRef);return;}
      const node=nodes[index];if(node.locked){this.flow.error='This race is locked';return;}
      this.flow.setParameter(element.binding,node.raceRef);return this.flow.run(element.action);
    }
    if(element.type==='car-showroom'||element.type==='garage-browser')return this.activateGarageWidget(element,direction,choose);
    if(element.type==='button')return this.flow.run(element.action);
    if(element.type==='keybind')return this.captureKey(element.binding);
    if(!element.binding){this.flow.error='This control needs a parameter binding';return;}
    const value=this.flow.parameters[element.binding];
    if(element.type==='choice'){const choices=element.source?this.resources.choices(element.source,this.flow.document,this.flow.parameters):element.options;if(!choices.length){this.flow.error='No choices available';return;}const i=choices.findIndex(o=>JSON.stringify(o.value)===JSON.stringify(value));if(choose){this.choicePopup={element,choices,index:Math.max(0,i)};return;}this.flow.setParameter(element.binding,choices[(i+direction+choices.length)%choices.length].value);}
    if(element.type==='toggle')this.flow.setParameter(element.binding,!value);
    if(element.type==='slider')this.flow.setParameter(element.binding,Math.max(element.min,Math.min(element.max,(Number(value)||0)+direction*element.step)));
    if(element.action)await this.flow.run(element.action);
  }
  selectShowroomCar(element,value){
    this.flow.setParameter(element.binding,value);
    this.widgetStates.set(element.id,{value,selectedAt:this.flow.time});
    if(element.onSelect)void this.flow.run(element.onSelect);
  }
  async activateGarageWidget(element,direction,choose){
    const state=this.widgetStates.get(element.id)||{};
    if(element.type==='car-showroom'){
      const choices=this.resources.choices('cars',this.flow.document,this.flow.parameters);
      if(!choices.length){this.flow.error='No saved cars available';return;}
      const index=Math.max(0,choices.findIndex(c=>c.value===this.flow.parameters[element.binding]));
      if(!choices.some(c=>c.value===this.flow.parameters[element.binding]))this.flow.setParameter(element.binding,choices[index].value);
      if(choose)return this.flow.run(element.action);
      this.selectShowroomCar(element,choices[(index+direction+choices.length)%choices.length].value);return;
    }
    const rows=garageBrowserRows(this.resources,this.flow.parameters,state);
    if(!rows.length)return;
    state.index=Math.max(0,Math.min(state.index||0,rows.length-1));
    if(!choose)state.index=(state.index+direction+rows.length)%rows.length;
    const row=rows[state.index];
    if(choose){
      if(!state.section){state.section=row.value;state.index=0;this.flow.setParameter('partSection',row.value);}
      else if(!state.slot){state.slot=row.value;state.index=0;this.flow.setParameter('partSlot',row.value);this.flow.setParameter(element.binding,'');}
      else{this.flow.setParameter('partSlot',state.slot);this.flow.setParameter(element.binding,row.value);await this.flow.run(element.action);}
    }else{
      this.flow.setParameter(state.slot?element.binding:state.section?'partSlot':'partSection',row.value);
      if(element.onSelect)await this.flow.run(element.onSelect);
    }
    this.widgetStates.set(element.id,state);
  }
  backGarageWidget(){
    const element=this.interactive()[this.focus];
    if(element?.type!=='garage-browser')return false;
    const state=this.widgetStates.get(element.id);if(!state?.section)return false;
    if(state.slot)delete state.slot;else delete state.section;
    state.index=0;return true;
  }
  cancelKeyCapture(){if(this.keyListener&&typeof window!=='undefined')window.removeEventListener('keydown',this.keyListener,true);this.keyListener=null;this.capturing=null;}
  captureKey(binding){if(!binding.startsWith('input.')){this.flow.error='Use an input.action binding for key mapping';return;}this.cancelKeyCapture();this.capturing=binding;this.message='Press a key (Escape cancels)';this.keyListener=event=>{event.preventDefault();event.stopImmediatePropagation();if(event.code!=='Escape')this.flow.setParameter(binding,event.code);this.cancelKeyCapture();this.game.input?.reset?.();this.message='';};window.addEventListener('keydown',this.keyListener,true);}
  update(input,dt){
    const flow=this.flow;if(!flow?.active)return;
    const touch=this.surface.pressed(),mapping={dpadUp:'up',dpadDown:'down',dpadLeft:'left',dpadRight:'right',jump:'jump',cancel:'attack',gamepadStart:'pause'};
    const pressed=code=>input?.wasPressedCode?.(code),pad=action=>input?.wasGamepadPressed?.(action)||(action==='cancel'&&input?.wasGamepadPressed?.('gamepadB'))||touch(mapping[action]);
    const axes=input?.getGamepadAxes?.()||input?.gamepadAxes||{};
    const touchHeld=this.surface.previous;
    const held={};
    for(const [direction,action] of Object.entries({up:'dpadUp',down:'dpadDown',left:'dpadLeft',right:'dpadRight'})){
      held[direction]=Boolean(input?.isGamepadDown?.(action)||touchHeld[direction]||pad(action));
    }
    // Use the dominant stick axis so diagonals do not move twice in one frame.
    if(Math.max(Math.abs(axes.leftX||0),Math.abs(axes.leftY||0))>0.5){
      const direction=Math.abs(axes.leftX||0)>Math.abs(axes.leftY||0)?(axes.leftX<0?'left':'right'):(axes.leftY<0?'up':'down');
      held[direction]=true;
    }
    const navigation=getMenuRepeatDirection(this.navigationRepeat,held,dt);
    if(this.preview&&(input?.wasGamepadPressed?.('gamepadSelect')||touch('nextWeapon'))){flow.stop();return;}
    if(this.preview&&pressed('KeyP'))this.togglePause();
    if(this.paused){if(pressed('Escape')||pad('cancel'))flow.stop();return;}
    flow.update(dt);
    if(this.capturing)return;
    if(this.choicePopup){const popup=this.choicePopup;if(pressed('Escape')||pad('cancel')){this.choicePopup=null;return;}if(pressed('ArrowDown')||navigation==='down')popup.index=(popup.index+1)%popup.choices.length;if(pressed('ArrowUp')||navigation==='up')popup.index=(popup.index-1+popup.choices.length)%popup.choices.length;if(pressed('Space')||pressed('Enter')||pad('gamepadStart')||pad('jump'))this.choosePopupItem(popup.index);return;}
    if(pressed('Escape')||pad('cancel')){if(flow.busy){flow.stop();return;}if(!this.backGarageWidget())flow.back();return;}
    if(this.cutscene.active){this.cutscene.update(dt);if(pressed('Space')||pressed('Enter')||pad('gamepadStart')||pad('jump')){if(this.cutscene.waitingPauseClipId)this.cutscene.waitingPauseClipId=null;else this.cutscene.stop();}return;}
    if(this.movie){if(pressed('Space')||pressed('Enter')||pad('gamepadStart')||pad('jump'))void this.resumeMovie();return;}
    if(flow.busy)return;
    for(const element of flow.screen.elements.filter(e=>e.type==='car-showroom')){
      const choices=this.resources.choices('cars',flow.document,flow.parameters);
      if(choices.length&&!choices.some(c=>c.value===flow.parameters[element.binding])){
        flow.setParameter(element.binding,choices[0].value);
        this.widgetStates.set(element.id,{value:choices[0].value,selectedAt:flow.time});
      }
    }
    const items=this.interactive();
    if(pressed('ArrowDown')||(pressed('Tab')&&!input?.isShiftDown?.())||navigation==='down')this.focus=(this.focus+1)%Math.max(1,items.length);
    if(pressed('ArrowUp')||(pressed('Tab')&&input?.isShiftDown?.())||navigation==='up')this.focus=(this.focus-1+items.length)%Math.max(1,items.length);
    if(pressed('ArrowLeft')||navigation==='left')this.moveHorizontal(items,-1);
    if(pressed('ArrowRight')||navigation==='right')this.moveHorizontal(items,1);
    if(pressed('Space')||pressed('Enter')||pad('gamepadStart')||pad('jump')){if(items[this.focus])void this.activate(items[this.focus],1,{choose:true});else if(flow.screen.startAction)void flow.start();}
  }
  draw(ctx,width,height){
    this.viewportBounds={x:0,y:0,w:width,h:height};const handheld=this.surface.layout(width,height);this.bounds=fitMenuCanvas(handheld?.screen||this.viewportBounds);if(!this.flow)return;ctx.fillStyle='#060b10';ctx.fillRect(0,0,width,height);this.surface.draw(ctx);
    drawMenuScreen(ctx,this.bounds,this.flow.document,this.flow.screen,this.flow.parameters,{resources:this.resources,time:this.flow.time,focus:this.interactive()[this.focus]?.id,videos:this.videos,widgetStates:this.widgetStates});
    if(this.cutscene.active){const b=this.bounds;ctx.save();ctx.translate(b.x,b.y);this.cutscene.draw(ctx,b.w,b.h);ctx.restore();}
    if(this.movie){const b=this.bounds;ctx.fillStyle='#000';ctx.fillRect(b.x,b.y,b.w,b.h);if(this.movie.readyState>=2){const scale=Math.min(b.w/this.movie.videoWidth,b.h/this.movie.videoHeight);ctx.drawImage(this.movie,b.x+(b.w-this.movie.videoWidth*scale)/2,b.y+(b.h-this.movie.videoHeight*scale)/2,this.movie.videoWidth*scale,this.movie.videoHeight*scale);}}
    const status=this.flow.error||this.message||(this.flow.busy&&!this.cutscene.active&&!this.movie?'Loading…':'');
    if(status){ctx.save();ctx.fillStyle='rgba(0,0,0,.85)';ctx.fillRect(0,height-64,width,64);ctx.fillStyle=this.flow.error?'#ffb1a6':'#fff';ctx.font='15px system-ui';ctx.textAlign='center';ctx.fillText(status,width/2,height-32,width-20);ctx.restore();}
    if(this.choicePopup){const b=this.bounds;ctx.save();ctx.translate(b.x,b.y);ctx.scale(b.w/960,b.h/540);this.drawChoices(ctx,960,540);ctx.restore();this.choiceRows=this.choiceRows.map(r=>({...r,x:b.x+r.x*b.w/960,y:b.y+r.y*b.h/540,w:r.w*b.w/960,h:r.h*b.h/540}));}
    if(this.preview){this.playPauseBounds={x:Math.max(0,width-214),y:0,w:72,h:36};drawSharedPlayStopButton(ctx,this.playPauseBounds,{isActive:true});ctx.save();ctx.fillStyle='#101c28';ctx.fillRect(width-130,0,130,36);ctx.fillStyle='#fff';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('Exit Preview',width-65,23);ctx.restore();}
  }
  hitElement(point){return menuPaintOrder(this.flow.screen.elements).reverse().find(e=>{if(!menuElementVisible(e,this.flow.screen.elements)||!menuElementInteractive(e))return false;const pose=menuElementPose(e,this.flow.time),b=menuElementBounds(e,this.bounds,pose),dx=point.x-(b.x+b.w/2),dy=point.y-(b.y+b.h/2),a=-pose.rotation*Math.PI/180;return menuHit({x:(dx*Math.cos(a)-dy*Math.sin(a))/pose.scale+b.x+b.w/2,y:(dx*Math.sin(a)+dy*Math.cos(a))/pose.scale+b.y+b.h/2},b)})}
  handlePointerDown(point){
    if(!this.flow||!this.bounds)return;if(this.preview&&this.playPauseBounds&&menuHit(point,this.playPauseBounds)){this.flow.stop();return;}if(this.preview&&point.x>=(this.viewportBounds?.w||this.bounds.w)-130&&point.y<36){this.flow.stop();return;}
    if(!menuHit(point,this.bounds)&&this.surface.down(point))return;
    if(this.paused)return;
    if(this.choicePopup){const row=this.choiceRows?.find(row=>menuHit(point,row));if(row){if(row.page){this.choicePopup.index=Math.max(0,Math.min(this.choicePopup.choices.length-1,this.choicePopup.index+row.page));}else this.choosePopupItem(row.index);}else this.choicePopup=null;return;}
    if(this.cutscene.active){if(this.cutscene.waitingPauseClipId)this.cutscene.waitingPauseClipId=null;else this.cutscene.stop();return;}
    if(this.movie){void this.resumeMovie();return;}if(this.flow.busy||!menuHit(point,this.bounds))return;
    for(const video of this.videos.values())if(video.paused)void video.play().catch(()=>{});
    const e=this.hitElement(point);if(e){this.focus=this.interactive().indexOf(e);if(e.type==='world-map'){const b=menuElementBounds(e,this.bounds,menuElementPose(e,this.flow.time)),nodes=worldMapNodes(e,this.resources,this.flow.document,this.flow.parameters);const node=nodes.map(n=>{const p=worldMapNodePoint(n,b);return {node:n,distance:Math.hypot(point.x-p.x,point.y-p.y)}}).filter(n=>n.distance<Math.max(22,Math.min(b.w,b.h)*.07)).sort((a,b)=>a.distance-b.distance)[0]?.node;if(node){const selected=this.flow.parameters[e.binding]===node.raceRef;this.flow.setParameter(e.binding,node.raceRef);if(selected)void this.activate(e,1,{choose:true});}return;}if(['car-showroom','garage-browser'].includes(e.type)){this.pointerGarageWidget(e,point);return;}if(e.type==='slider'){this.slider={id:point.id,element:e};this.handlePointerMove(point);}else void this.activate(e,1,{choose:true});}else if(this.flow.screen.startAction)void this.flow.start();
  }
  pointerGarageWidget(element,point){
    const b=menuElementBounds(element,this.bounds,menuElementPose(element,this.flow.time));
    const state=this.widgetStates.get(element.id)||{};
    if(point.y>b.y+b.h-24){
      if(element.type==='garage-browser'&&state.section&&point.x<b.x+b.w*.25){this.backGarageWidget();return;}
      void this.activate(element,point.x<b.x+b.w/2?-1:1);return;
    }
    if(element.type==='car-showroom'){
      const choices=this.resources.choices('cars',this.flow.document,this.flow.parameters);
      const page=showroomPage(choices,this.flow.parameters[element.binding],element.maxVisible);
      const index=page.entries.findIndex((_,i)=>menuHit(point,garageCardBounds(b,page.entries.length,i)));
      if(index<0)return;const value=page.entries[index].value;
      if(this.flow.parameters[element.binding]===value)void this.activate(element,1,{choose:true});
      else this.selectShowroomCar(element,value);
    }else{
      const rows=garageBrowserRows(this.resources,this.flow.parameters,state),start=Math.floor((state.index||0)/4)*4,visible=rows.slice(start,start+4);
      const index=visible.findIndex((_,i)=>menuHit(point,garageCardBounds(b,visible.length,i)));
      if(index<0)return;state.index=start+index;this.widgetStates.set(element.id,state);void this.activate(element,1,{choose:true});
    }
  }
  choosePopupItem(index){const popup=this.choicePopup;if(!popup)return;this.flow.setParameter(popup.element.binding,popup.choices[index].value);this.choicePopup=null;if(popup.element.action)void this.flow.run(popup.element.action);}
  drawChoices(ctx,width,height){
    const p=this.choicePopup,w=Math.min(width-24,560),x=(width-w)/2,rowHeight=48,count=Math.max(1,Math.floor((height-150)/rowHeight)),start=Math.floor(p.index/count)*count,y=60;
    this.choiceRows=[];ctx.save();ctx.fillStyle='rgba(0,0,0,.85)';ctx.fillRect(0,0,width,height);ctx.font='18px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(p.element.label,x+w/2,28,w-20);
    const rows=p.choices.slice(start,start+count);for(const [offset,item] of rows.entries()){const index=start+offset,b={x,y:y+offset*rowHeight,w,h:rowHeight,index};ctx.fillStyle=index===p.index?'#486c83':'#203240';ctx.fillRect(b.x,b.y,b.w,b.h-2);ctx.fillStyle='#fff';ctx.fillText(item.label,b.x+b.w/2,b.y+b.h/2,b.w-20);this.choiceRows.push(b);}
    if(p.choices.length>count){for(const [side,page,name] of [[0,-count,'Previous'],[1,count,'Next']]){const b={x:x+side*w/2,y:y+rows.length*rowHeight+8,w:w/2,h:44,page};ctx.fillStyle='#365066';ctx.fillRect(b.x,b.y,b.w-2,b.h);ctx.fillStyle='#fff';ctx.fillText(name,b.x+b.w/2,b.y+22);this.choiceRows.push(b);}}
    ctx.restore();
  }
  handlePointerMove(point){this.surface.move(point);if(!this.slider||!this.bounds)return;if(this.slider.id!==undefined&&point.id!==undefined&&point.id!==this.slider.id)return;const e=this.slider.element,b=menuElementBounds(e,this.bounds,menuElementPose(e,this.flow.time));if(!e.binding)return;const fraction=Math.max(0,Math.min(1,(point.x-b.x)/b.w)),value=e.min+Math.round(fraction*(e.max-e.min)/e.step)*e.step;this.flow.setParameter(e.binding,Math.min(e.max,value));}
  handlePointerUp(point={}){this.surface.up(point);const action=this.slider?.element.action;this.slider=null;if(action)void this.flow.run(action);}
  async playMovie(ref){
    this.cleanupScreen();const flow=this.flow,generation=flow.generation;
    if(/^(https?:|\/|data:video\/|blob:)/i.test(ref)){
      const video=document.createElement('video');video.src=ref;video.playsInline=true;video.volume=this.settings.values['settings.musicVolume']??0.8;this.movie=video;
      return new Promise((resolve,reject)=>{this.resolveMovie=resolve;this.rejectMovie=reject;video.onended=()=>{video.pause();video.removeAttribute('src');video.load();this.movie=null;this.resolveMovie=null;this.rejectMovie=null;this.message='';if(flow.active&&generation===flow.generation)this.enterScreen();resolve()};video.onerror=()=>{this.movie=null;this.rejectMovie=null;reject(Error(`Movie could not load: ${ref}`))};void this.resumeMovie();});
    }
    const payload=await hydrateProjectFilePayload('cutscenes',ref);if(!flow.active||flow.generation!==generation)return;if(!payload?.data)throw Error(`Movie not found: ${ref}`);
    const assets=payload.data.assets||[],references=new Map();
    for(const asset of assets){const folder={art:'art',music:'music',sfx:'sfx',actor:'actors'}[asset.type];if(folder&&asset.ref)references.set(`${folder}:${asset.ref}`,{folder,ref:asset.ref});if(asset.actorRef)references.set(`actors:${asset.actorRef}`,{folder:'actors',ref:asset.actorRef});}
    for(const clip of payload.data.clips||[])if(['music','sfx'].includes(clip.type)){const asset=assets.find(a=>a.id===clip.assetId),name=asset?.ref||clip.assetId;if(name)references.set(`${clip.type}:${name}`,{folder:clip.type,ref:name});}
    const loads=await Promise.allSettled([...references.values()].map(async asset=>{const value=await hydrateProjectFilePayload(asset.folder,asset.ref);if(!value?.data)throw Error(`Movie asset not found: ${asset.ref}`);return value}));
    const failure=loads.find(result=>result.status==='rejected');if(failure)throw failure.reason;
    await this.game.prepareCutsceneAudioResources?.(payload.data);
    if(!flow.active||flow.generation!==generation)return;
    return new Promise((resolve,reject)=>{this.rejectMovie=reject;this.cutscene.play(payload.data,{onDone:()=>{this.rejectMovie=null;if(flow.active&&generation===flow.generation)this.enterScreen();resolve()},skippable:true})});
  }
  async resumeMovie(){try{await this.movie?.play();this.message=''}catch{this.message='Tap / press Space to play movie'}}
  async launchRace(ref,parameters){
    if(this.preview)this.game.playtestActive=true;
    this.cleanupScreen();this.game.menuParameters=structuredClone(parameters);
    const ok=await this.game.startRaceTravel({raceName:ref,carSelection:parameters.carRef?'specific':'choose',carRef:parameters.carRef,menuConfiguration:parameters,menuFlow:this.flow,garage:this.resources.garage});if(!ok)throw Error(`Could not start race: ${ref}`);
  }
  async launchLevel(ref,parameters){
    const flow=this.flow,generation=flow.generation;
    const payload=await hydrateProjectFilePayload('levels',ref);if(!flow.active||this.flow!==flow||flow.generation!==generation)return;if(!payload?.data)throw Error(`Level not found: ${ref}`);
    this.cleanupScreen();this.game.menuParameters=structuredClone(parameters);this.game.applyWorldData(payload.data);this.game.gameMode='story';this.game.storyData=this.game.buildWorldData();this.game.playtestActive=this.preview;this.game.simulationActive=false;this.game.resetRun({playtest:this.preview,startWithEverything:true});this.game.transitionTo('playing');this.game.startSpawnPause();
  }
}
