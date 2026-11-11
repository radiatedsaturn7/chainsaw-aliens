import {loadCampaignSaves} from './CampaignSaves.js';
import {GarageEnginePreview} from './GarageEnginePreview.js';
import {drawDisplayModeInBounds} from '../ui/shared/displayModes.js';
import {openWheelSettings} from '../hardware/wheels/WheelSettings.js';
import {MenuScreenMusic} from './MenuScreenMusic.js';
import {selectableIndex,nextSelectableIndex,selectableGridIndex} from './MenuSelection.js';
import {GarageDialogueState,garageDialogueContext} from '../garage/GarageDialogue.js';
import {MenuScreenTransition} from './MenuScreenTransition.js';
import {musicMediaVolume} from '../audio/musicVolume.js';
import {GarageTuner} from '../garage/GarageTuning.js';
import {drawGarageTuner} from './MenuTuningRenderer.js';
import {menuCodeValue,cycleCodeLetter} from './MenuCodeEntry.js';
import {redeemGarageCheat,GARAGE_CHEAT_CODES} from '../garage/GarageCheats.js';
import {loadMenuProgress,commitMenuCar,setMenuProgress} from './MenuProgress.js';
import {raceCompletionKey,worldMapNodes,worldMapNodePoint,worldMapRaceNodes,worldMapSelection,worldMapDirectionalNode} from './MenuWorldMap.js';
import {showroomPage,garageBrowserRows,garageCardBounds,garageGridBounds,upgradeGridArea} from './MenuGarageWidgets.js';
import {createMenuRepeatState,resetMenuRepeatState,getMenuRepeatDirection} from '../ui/shared/menuRepeat.js';
import {ItemSystem} from '../items/ItemSystem.js';
import {runGarageAction} from '../garage/GarageMenu.js';
import {drawSharedPlayStopButton} from '../ui/uiSuite.js';
import {MenuPreviewSurface} from './MenuPreviewSurface.js';
import {menuPaintOrder,menuElementVisible,fitMenuCanvas} from './MenuLayout.js';
import {MenuFlow} from './MenuFlow.js';
import {MenuResources} from './MenuResources.js';
import {drawMenuScreen,menuElementBounds,menuElementInteractive,menuHit} from './MenuRenderer.js';
import {normalizeMenuDocument,menuElementPose} from './MenuDocument.js';
import {MenuSettings} from './MenuSettings.js';
import {CutscenePlayer} from '../ui/CutsceneEditor.js';
import {hydrateProjectFilePayload} from '../ui/projectFiles.js';

export default class MenuPlayer {
  constructor(game){this.screenMusic=new MenuScreenMusic(game,hydrateProjectFilePayload);this.garageDialogue=new GarageDialogueState();this.screenTransition=new MenuScreenTransition();this.lastDrawCanvas=null;this.game=game;this.surface=new MenuPreviewSurface(game);this.resources=new MenuResources(game);this.settings=new MenuSettings(game);this.videos=new Map();this.cutscene=new CutscenePlayer(game);this.mediaGeneration=0;this.focus=0;this.screenFocus=new Map();this.widgetStates=new Map();this.navigationRepeat=createMenuRepeatState();this.preview=false;this.message='';this.flow=null;}
  async open(document,{preview=false,screenId=null}={}){
    if(this.flow){this.flow.active=false;this.flow.generation++;}
    this.restorePreview();this.cleanup();if(typeof window!=='undefined'){this.tabListener=event=>{if(this.game.state==='menu-player'&&event.code==='Tab'&&!this.capturing)event.preventDefault();};window.addEventListener('keydown',this.tabListener);}
    this.preview=preview;this.paused=false;this.message='';this.focus=0;this.screenFocus.clear();
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
    if(!preview)await loadCampaignSaves(this.game);
    this.flow=new MenuFlow(document,{
      newGame:preview?undefined:target=>this.openSaveSlots('new',target),
      continueGame:()=>this.openSaveSlots('continue'),
      wheelSettings:()=>openWheelSettings(this.game.wheelService),
      haptics:target=>target==='test'?this.game.raceHaptics?.test():this.openHaptics(target==='effects'),
      saveSlot:(action,index)=>this.saveSlotAction(action,index),
      cheatCode:code=>this.redeemCheat(code),
      parameterChanged:(key,value)=>{void (key.startsWith('haptics.')?this.setHaptic(key.slice(8),value):this.settings.set(key,value)).catch(error=>{if(this.flow)this.flow.error=error.message})},
      screenLeaving:screen=>{this.screenFocus.set(screen.id,this.interactive()[this.focus]?.id);},
      screenChanged:()=>this.enterScreen(),stop:()=>{this.cleanup();this.restorePreview();this.game.transitionTo(this.preview?'menu-editor':'title',{forceCleanup:true})},
      garageAction:async(type,ref,params)=>{
        if(type==='garage-tune'){this.openTuner(params.carRef,{modal:true});return;}
        const context=this.dialogueContext(),garage=this.resources.garage;
        const before=Number(garage?.items.game?.player?.credits??garage?.items.savedStats?.credits)||0;
        this.garageDialogue.say('confirming',context);
        try{await runGarageAction(garage,type,ref,params,{resolveCar:async name=>{const selected=await this.game.resolveRaceTravelCarAsync(name);return selected?.car;},autoCatalog:()=>this.resources.garageCatalog(),evaluate:car=>this.resources.performance(car)});}
        catch(error){if(/Not enough scrap/.test(error.message))this.garageDialogue.say('insufficient',context);throw error;}
        this.resources.garageCars.clear();this.message='';
        const after=Number(garage?.items.game?.player?.credits??garage?.items.savedStats?.credits)||0;
        this.garageDialogue.say(before>0&&after===0?'broke':'installed',context);
      },
      playMovie:(ref)=>this.playMovie(ref),launchRace:(ref,params)=>this.launchRace(ref,params),launchLevel:(ref,params)=>this.launchLevel(ref,params)
    });
    if(preview&&this.flow.document.screens.some(s=>s.id===screenId))this.flow.screenId=screenId;
    Object.assign(this.flow.parameters,await loadMenuProgress(this.game),this.settings.parameters());if(!preview&&this.game.menuProgress.selectedGameCar){this.flow.lockCar(this.game.menuProgress.selectedGameCar);if(this.flow.isCarSelection(this.flow.screenId))this.flow.screenId='world-map';}this.refreshSaveButtons();const openingFlow=this.flow;this.pendingScreenEntry=true;
    await this.resources.prepareScreen(openingFlow.document,openingFlow.screen,openingFlow.parameters,{bounds:this.bounds,isCurrent:()=>this.flow===openingFlow&&openingFlow.active});
    if(this.flow!==openingFlow||!openingFlow.active)return;
    this.game.transitionTo('menu-player',{forceCleanup:true});this.enterScreen({prepared:true});
  }
  refreshSaveButtons(){}
  showOptionsScreen(id,title,rows,{remember=true,details=[]}={}){
    const screen=normalizeMenuDocument({screens:[{id,name:title,background:'#000000',useDefaultBackground:false,effect:'none',musicMode:'continue',elements:[
      {id:'heading',type:'text',label:title,x:.06,y:.03,w:.88,h:.1,fontSize:32},
      ...rows.map((row,i)=>({id:`row-${i}`,type:'button',x:.06,y:.17+i*.09,w:.88,h:.08,fontSize:26,...row,
        color:'#ffffff',background:'#000000',selectionIndicator:'cursor',cursorText:'>',useDefaultFont:true})),
      ...details.map((element,i)=>({id:`detail-${i}`,type:'text',x:.06,w:.88,fontSize:20,color:'#ffffff',useDefaultFont:true,...element}))
    ]}]}).screens[0];
    const existing=this.flow.document.screens.findIndex(s=>s.id===id);
    if(existing<0)this.flow.document.screens.push(screen);else this.flow.document.screens[existing]=screen;
    this.screenFocus.delete(id);this.flow.goTo(id,{remember});
  }
  openSaveSlots(mode='start',target='cars'){
    if(this.preview){this.flow.goTo(target);return;}
    this.saveCarScreen=target;
    this.showSaveSlots('start');
  }
  showSaveSlots(mode,source=null){
    const saves=this.game.campaignSaves,action=(target,value)=>({type:'save-slot',target,value});
    const rows=saves.slots.map((slot,index)=>({x:.02,w:.76,y:.17+index*.13,h:.11,label:'',
      disabled:(mode==='clear'||mode==='copy')&&!slot||mode==='destination'&&index===source,
      action:action(mode,{index,source})}));
    if(mode==='start')rows.push({label:'Clear',disabled:!saves.slots.some(Boolean),action:action('clear-menu')},{label:'Copy',disabled:!saves.slots.some(Boolean),action:action('copy-menu')});
    rows.push({label:'Back',action:{type:'back'}});
    rows.slice(3).forEach((row,i)=>{row.x=.06;row.w=.16;row.y=.62+i*.09;});
    const details=saves.slots.flatMap((slot,index)=>{
      const summary=saves.describeSlot(index),y=.17+index*.13,h=.11;
      return [
        {label:`CAR ${'ABC'[index]}`,x:.06,w:.16,y,h,fontSize:26},
        ...(summary?[
          ...(summary.car?[{type:'car-preview',assetRef:summary.car,property:'stock',animation:'none',angle:135,x:.23,y,w:.16,h}]:[{label:'—',x:.23,y,w:.16,h}]),
          {label:`${summary.condition}%`,x:.40,w:.13,y,h,fontSize:26},
          {label:summary.time,x:.54,w:.24,y,h,fontSize:26}
        ]:[{label:'Empty',x:.23,w:.55,y,h,fontSize:26}])
      ];
    });
    this.showOptionsScreen(`saves-${mode}`,{start:'Start',clear:'Clear Save',copy:'Copy Save',destination:'Copy To'}[mode],rows,{details});
  }
  async saveSlotAction(action,value={}){
    const saves=this.game.campaignSaves,{index,source}=value||{};
    if(action==='clear-menu'||action==='copy-menu'){this.showSaveSlots(action.split('-')[0]);return;}
    if(action==='start'){await this.selectSaveSlot(saves.slots[index]?'continue':'new',index,this.saveCarScreen);return;}
    if(action==='copy'){this.showSaveSlots('destination',index);return;}
    if(action==='clear'||action==='destination'){
      const label=action==='clear'?`Clear Slot ${'ABC'[index]}?`:`Copy ${'ABC'[source]} to ${'ABC'[index]}${saves.slots[index]?' — Overwrite':''}?`;
      this.showOptionsScreen('saves-confirm',label,[{label:'Cancel',action:{type:'back'}},{label:'Confirm',action:{type:'save-slot',target:action==='clear'?'clear-confirm':'copy-confirm',value}}]);return;
    }
    if(action==='clear-confirm')await saves.clear(index);
    else if(action==='copy-confirm')await saves.copySlot(source,index);
    else throw Error('Unknown save action');
    // Return directly to the slot menu; Back must not revisit a completed confirmation.
    const history=this.flow.history,root=history.indexOf('saves-start');
    if(root>=0)this.flow.history=history.slice(0,root);
    this.showSaveSlots('start');this.flow.history=this.flow.history.filter(id=>!id.startsWith('saves-'));
  }
  openHaptics(detail=false){
    const haptics=this.game.raceHaptics;if(!haptics)return;
    Object.assign(this.flow.parameters,Object.fromEntries(Object.entries(haptics.settings).map(([k,v])=>[`haptics.${k}`,v])));
    const slider=(key,label,min=0,max=1,step=.05)=>({type:'slider',label,binding:`haptics.${key}`,min,max,step});
    const rows=detail?[
      ...[['road','Road'],['slip','Skids'],['braking','ABS'],['impacts','Impacts']].map(([key,label])=>slider(key,label)),slider('phonePulse','Phone Pulse',8,30,1)
    ]:[{type:'toggle',label:'Vibration',binding:'haptics.enabled'},
      {type:'choice',label:'Output',binding:'haptics.output',options:['auto','phone','controller'].map(value=>({value,label:value[0].toUpperCase()+value.slice(1)}))},
      slider('strength','Strength'),{label:'Effects',action:{type:'haptics',target:'effects'}},
      {label:'Test',action:{type:'haptics',target:'test'}},{label:'Wheel / Pedals',action:{type:'wheel-settings'}}];
    rows.push({label:'Back',action:{type:'back'}});
    this.showOptionsScreen(detail?'vibration-effects':'vibration',detail?'Vibration Effects':'Vibration',rows);
  }
  async setHaptic(key,value){
    const haptics=this.game.raceHaptics;if(!haptics||this.preview)return;
    haptics.setSettings({...haptics.settings,[key]:value});
    const snapshot=structuredClone(haptics.settings);
    this.hapticSave=(this.hapticSave||Promise.resolve()).catch(()=>{}).then(async()=>{
      const result=await haptics.savePreference('race-haptics',snapshot);
      if(result?.ok===false)throw Error('Could not save vibration settings');
    });return this.hapticSave;
  }
  async redeemCheat(code){
    const normalized=String(code).toUpperCase();
    if(!GARAGE_CHEAT_CODES.includes(normalized))throw Error('Invalid cheat code');
    if(!this.preview&&!this.game.campaignSaves?.hasActive){
      (this.game.pendingMenuCheats||=[]).push(normalized);
      this.message=`${normalized} — Choose a save slot to apply`;return;
    }
    const garage=this.resources.garage;if(!garage)throw Error('Garage unavailable');
    const carRef=this.flow.lockedCarRef||'',stock=carRef?(await this.game.resolveRaceTravelCarAsync(carRef))?.car:null;
    this.message=await redeemGarageCheat(garage,normalized,{carRef,stock});
    await this.applyOpeningSkip();
    this.resources.garageCars.clear();
    if(this.preview)this.message+=' (preview only)';
  }
  async applyOpeningSkip(){
    if(!this.resources.garage?.items.progress.unlocks['cheat.skipme'])return;
    const opening=this.flow.document.parameters.campaignOpeningRace||'Tower Hill Road';
    const key=raceCompletionKey(opening);
    if(this.preview)this.flow.setParameter(key,true);
    else await setMenuProgress(this.game,{[key]:true});
    this.flow.pendingOpeningRace='';
  }
  async selectSaveSlot(mode,index,target='cars',overwrite=false){
    const flow=this.flow;
    const snapshot=mode==='new'?await this.game.campaignSaves.startNew(index,{overwrite}):await this.game.campaignSaves.resume(index);
    if(this.flow!==flow||!flow.active)return;
    this.cleanupScreen();this.widgetStates.clear();this.screenFocus.clear();this.resources.garageCars.clear();
    flow.parameters={...structuredClone(flow.document.parameters),...(mode==='new'?{difficulty:flow.parameters.difficulty}:{}),...snapshot.parameters,...snapshot.progress,...this.settings.parameters()};
    flow.lockedCarRef='';flow.history=[];
    const car=snapshot.progress.selectedGameCar;
    if(car)flow.lockCar(car);else flow.newGameSelection=true;
    // Codes entered before selecting a save belong to the next selected slot.
    while(this.game.pendingMenuCheats?.length){
      await this.redeemCheat(this.game.pendingMenuCheats[0]);
      this.game.pendingMenuCheats.shift();
    }
    this.refreshSaveButtons();
    // A slot with no chosen car is still an unfinished new game.
    flow.pendingOpeningRace=!car?flow.document.parameters.campaignOpeningRace||'':'';
    await this.applyOpeningSkip();
    flow.goTo(car?'world-map':target,{remember:!car});
  }
  restorePreview(){const snapshot=this.previewSnapshot;if(!snapshot)return;this.previewSnapshot=null;if(snapshot.worldData)this.game.applyWorldData(snapshot.worldData);for(const key of ['menuParameters','storyData','gameMode','playtestActive','simulationActive'])this.game[key]=snapshot[key];this.game.raceEditorPlaytestReturn=false;this.game.raceTravelSession=null;}
  releasePauseAudio(){const context=this.pausedAudioContext;this.pausedAudioContext=null;if(context)void context.resume().catch(()=>{});}
  togglePause(){if(!this.preview||(this.flow.busy&&!this.cutscene.active&&!this.movie))return;this.paused=!this.paused;if(this.paused){this.tuner?.stopRev();this.slider=null;this.cancelKeyCapture();const context=this.game.audio?.ctx;if(context?.state==='running'){this.pausedAudioContext=context;void context.suspend().catch(()=>{});}this.pausedVideos=[...this.videos.values(),this.movie,...(this.game.musicPlayers||[]).map(p=>p.media)].filter(v=>v&&!v.paused);for(const v of this.pausedVideos)v.pause();}else{this.releasePauseAudio();for(const v of this.pausedVideos||[])void v.play().catch(()=>{});this.pausedVideos=[];}}
  cleanupScreen({keepMusic=false,immediateMusic=false}={}){this.tuner?.dispose();this.tuner=null;this.tunerModal=false;this.mediaGeneration++;this.choicePopup=null;this.slider=null;if(!keepMusic)this.screenMusic.stop(immediateMusic?{fadeOut:0}:{});for(const video of this.videos.values()){video.pause();video.removeAttribute('src');video.load();}this.videos.clear();}
  cleanup(){this.screenEntryGeneration=(this.screenEntryGeneration||0)+1;this.screenEntryTask=null;this.pendingScreenSnapshot=null;this.enteredTransitionGroup=null;this.screenTransition.reset();this.lastDrawCanvas=null;this.lastDrawTransform=null;this.pendingScreenEntry=false;this.transitionBlackDrawn=false;resetMenuRepeatState(this.navigationRepeat);this.releasePauseAudio();if(this.tabListener&&typeof window!=='undefined')window.removeEventListener('keydown',this.tabListener);this.tabListener=null;this.surface.reset();this.resources.carPreview.dispose();this.cleanupScreen({immediateMusic:true});this.cancelKeyCapture();if(this.cutscene.active){this.cutscene.onDone=null;this.cutscene.stop();}if(this.movie){this.movie.pause();this.movie.removeAttribute('src');this.movie.load();this.movie=null;}this.rejectMovie?.(Error('Playback cancelled'));this.rejectMovie=null;this.resolveMovie=null;}
  enterScreen({prepared=false}={}){
    this.screenEntryGeneration=(this.screenEntryGeneration||0)+1;
    this.screenEntryTask=null;this.pendingScreenSnapshot=null;
    const group=this.flow.screen.transitionGroup;
    if(group&&group===this.enteredTransitionGroup){
      this.screenTransition.reset();
      const capture=new MenuScreenTransition();capture.start(this.lastDrawCanvas,this.bounds,undefined,{transform:this.lastDrawTransform});
      this.pendingScreenSnapshot=capture.snapshot;
    }else this.screenTransition.start(this.lastDrawCanvas,this.bounds,undefined,{transform:this.lastDrawTransform,hold:true});
    this.enteredTransitionGroup=group;
    this.pendingScreenEntry=true;this.transitionBlackDrawn=false;
    resetMenuRepeatState(this.navigationRepeat);this.surface.reset();
    if(prepared){this.finishEnterScreen();return;}
    if(!this.screenTransition.active)this.prepareScreenEntry();
  }
  prepareScreenEntry(){
    if(this.screenEntryTask)return;
    const generation=this.screenEntryGeneration,flow=this.flow,screen=flow.screen;
    const isCurrent=()=>generation===this.screenEntryGeneration&&this.flow===flow&&flow.active&&flow.screen===screen;
    const task=this.resources.prepareScreen(flow.document,screen,flow.parameters,{bounds:this.bounds,isCurrent});
    if(!task){this.finishEnterScreen();return;}
    this.screenEntryTask=task;
    task.then(()=>{if(isCurrent())this.finishEnterScreen();},error=>{
      if(isCurrent()){this.finishEnterScreen();flow.error=`Menu artwork could not load: ${error.message}`;}
    });
  }
  finishEnterScreen(){
    this.pendingScreenEntry=false;this.flow.time=0;
    this.cleanupScreen({keepMusic:true});this.widgetStates.clear();this.focus=0;this.message='';const flow=this.flow,screen=flow.screen,generation=this.mediaGeneration;
    for(const e of screen.elements){if(['choice','car-showroom'].includes(e.type)&&e.binding){const choices=e.type==='car-showroom'?this.resources.choices('cars',flow.document,flow.parameters):e.source?this.resources.choices(e.source,flow.document,flow.parameters):e.options;if(choices.length&&!choices.some(o=>JSON.stringify(o.value)===JSON.stringify(flow.parameters[e.binding])))flow.setParameter(e.binding,choices[0].value);}
      if(e.type==='world-map'){const node=worldMapSelection(worldMapNodes(e,this.resources,flow.document,flow.parameters),flow.parameters[e.binding]);flow.setParameter(e.binding,node?.raceRef||'');}
      if(e.type==='car-showroom')this.widgetStates.set(e.id,{value:flow.parameters[e.binding],selectedAt:flow.time});
      if(e.type==='video'&&e.videoUrl&&typeof document!=='undefined'){const video=document.createElement('video');video.src=e.videoUrl;video.loop=e.loop;video.playsInline=true;video.muted=true;video.onerror=()=>{flow.error=`Video could not load: ${e.videoUrl}`};this.videos.set(e.id,video);void video.play().catch(()=>{this.message='Tap to play video'});}
    }
    const tuner=screen.elements.find(e=>e.type==='garage-tuner');if(tuner){this.openTuner(flow.parameters[tuner.binding]);this.widgetStates.set(tuner.id,{tuner:this.tuner});}
    this.focus=Math.max(0,this.interactive().findIndex(e=>e.id===this.screenFocus.get(screen.id)));
    this.garageDialogue.enter(screen,flow.parameters,this.dialogueContext());
    void this.screenMusic.enter(screen).catch(error=>{flow.error=error.message});
    if(this.tuner?.readyTask&&!this.tuner.ready){
      const entryGeneration=this.screenEntryGeneration;
      this.pendingScreenEntry=true;this.screenEntryTask=this.tuner.readyTask;
      this.screenEntryTask.then(()=>{
        if(this.screenEntryGeneration!==entryGeneration||this.flow!==flow||!flow.active)return;
        this.pendingScreenEntry=false;this.pendingScreenSnapshot=null;flow.time=0;
      });
    }else this.pendingScreenSnapshot=null;
  }
  openTuner(carRef,{modal=false}={}){
    this.tuner?.dispose();this.tunerModal=modal;
    this.tuner=new GarageTuner({garage:this.resources.garage,carRef,enginePreview:new GarageEnginePreview(this.game),evaluate:car=>this.resources.performance(car),
      resolveCar:async ref=>(await this.game.resolveRaceTravelCarAsync(ref))?.car,
      onExit:()=>{if(this.tunerModal){this.tuner?.dispose();this.tuner=null;this.tunerModal=false;}else this.flow.back();},
      onSaved:()=>{this.resources.garageCars.clear();}
    });
  }
  dialogueContext(){return garageDialogueContext(this.flow.screen,this.resources,this.flow.parameters,this.widgetStates,this.interactive()[this.focus]?.id);}
  interactive(){return (this.flow?menuPaintOrder(this.flow.screen.elements).filter(e=>menuElementVisible(e,this.flow.screen.elements)&&!e.disabled&&menuElementInteractive(e)).sort((a,b)=>(a.tabOrder||Infinity)-(b.tabOrder||Infinity)):[])||[]}
  moveHorizontal(items,direction){
    const current=items[this.focus];if(!current)return;
    if(['code-entry','world-map','car-showroom','garage-browser','choice','slider','toggle'].includes(current.type)){void this.activate(current,direction);return;}
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
  async activate(element,direction=1,{choose=false,mapDirection=null}={}){
    if(element?.disabled)return;
    if(!element||this.paused||this.flow.busy||this.capturing)return;
    if(element.type==='code-entry'){
      const state=this.widgetStates.get(element.id)||{index:0};
      this.flow.setParameter(element.binding,menuCodeValue(this.flow.parameters[element.binding],element.codeLength));
      if(choose)return this.flow.run(element.action);
      state.index=((state.index||0)+direction+element.codeLength)%element.codeLength;this.widgetStates.set(element.id,state);return;
    }
    if(element.type==='world-map'){
      const nodes=worldMapNodes(element,this.resources,this.flow.document,this.flow.parameters),value=this.flow.parameters[element.binding];
      const selected=worldMapSelection(nodes,value);
      if(!selected){this.flow.setParameter(element.binding,'');return;}
      if(choose){
        this.flow.setParameter(element.binding,selected.raceRef);
        // A stale disabled selection must not launch a different race on Confirm.
        if(value&&selected.raceRef!==value)return;
        return this.flow.run(element.action);
      }
      const bounds=menuElementBounds(element,this.bounds||{x:0,y:0,w:960,h:540},menuElementPose(element,this.flow.time||0));
      const node=worldMapDirectionalNode(nodes,value,mapDirection||(direction<0?'left':'right'),bounds,element);
      this.flow.setParameter(element.binding,node.raceRef);return;
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
  cycleCode(element,direction){
    const index=this.widgetStates.get(element.id)?.index||0;
    this.flow.setParameter(element.binding,cycleCodeLetter(this.flow.parameters[element.binding],index,direction,element.codeLength));
    this.flow.error='';this.message='';
  }
  selectShowroomCar(element,value){
    if(this.flow.lockedCarRef)return;
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
      if(choose){
        const flow=this.flow,ref=flow.parameters[element.binding],openingRace=flow.pendingOpeningRace;flow.busy=true;
        try{
          if(openingRace)flow.setParameter('raceRef',openingRace);
          const committed=this.preview?ref:await commitMenuCar(this.game,ref,{newGame:flow.newGameSelection});
          if(!flow.active||this.flow!==flow)return;
          flow.lockCar(committed);
          if(openingRace){
            await this.game.campaignSaves.save();
            if(!flow.active||this.flow!==flow)return;
            await this.launchRace(openingRace,{...flow.parameters,carRef:committed});
            flow.pendingOpeningRace='';
            return;
          }
        }catch(error){flow.error=error.message;return;}
        finally{flow.busy=false;}
        return flow.run(element.action);
      }
      this.selectShowroomCar(element,choices[(index+direction+choices.length)%choices.length].value);return;
    }
    const rows=garageBrowserRows(this.resources,this.flow.parameters,state);
    if(!rows.length)return;
    const previousIndex=state.index||0;
    state.index=Math.max(0,Math.min(rows.length-1,previousIndex));
    if(choose&&state.index!==previousIndex){this.widgetStates.set(element.id,state);return;}
    if(state.index<0)return;
    if(!choose)state.index=nextSelectableIndex(rows.map(r=>({...r,disabled:false})),state.index,direction);
    const row=rows[state.index];
    if(choose){
      if(row.children){state.path=[...(state.path||[]),row.id];state.breadcrumbs=[...(state.breadcrumbs||[]),row.label];state.index=0;this.widgetStates.set(element.id,state);return;}
      if(row.disabled){this.flow.error=row.reason||'This part is unavailable';return;}
      if(!state.section){state.sectionParent={path:state.path||[],breadcrumbs:state.breadcrumbs||[],index:state.index};state.path=[];state.breadcrumbs=[];state.section=row.value;state.index=0;this.flow.setParameter('partSection',row.value);}
      else if(row.package){this.flow.setParameter('packageCost',row.cost);this.flow.setParameter('packageQuote',row.quote||'');this.flow.setParameter(element.binding,row.value);await this.flow.run(element.action);}
      else if(!state.slot){state.slotParent={path:state.path||[],breadcrumbs:state.breadcrumbs||[],index:state.index};state.path=[];state.breadcrumbs=[];state.slot=row.value;state.index=0;this.flow.setParameter('partSlot',row.value);this.flow.setParameter(element.binding,'');}
      else{this.flow.setParameter('partSlot',state.slot);this.flow.setParameter(element.binding,row.value);await this.flow.run(element.action);}
    }else if(!row.children){
      this.flow.setParameter(state.slot?element.binding:state.section?'partSlot':'partSection',row.value);
      if(element.onSelect)await this.flow.run(element.onSelect);
    }
    this.widgetStates.set(element.id,state);
  }
  backGarageWidget(){
    const element=this.interactive()[this.focus];
    if(element?.type!=='garage-browser')return false;
    const state=this.widgetStates.get(element.id);if(!state?.section&&!state?.path?.length)return false;
    if(state.path?.length){state.path.pop();state.breadcrumbs?.pop();state.index=0;}
    else if(state.slot){delete state.slot;Object.assign(state,state.slotParent||{path:[],breadcrumbs:[],index:0});delete state.slotParent;}
    else{delete state.section;Object.assign(state,state.sectionParent||{path:[],breadcrumbs:[],index:0});delete state.sectionParent;}
    return true;
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
    if(this.cutscene.active){
      this.cutscene.handleInput(input,dt,{skipHeld:this.surface.controls.isHeld('jump'),confirmPressed:pressed('KeyG')||pad('jump')});
      this.cutscene.update(dt);return;
    }
    if(this.raceFinishCutscene||this.raceIntroCutscene)return;
    flow.update(dt);
    if(this.screenTransition.active||this.pendingScreenEntry||this.movie||this.cutscene.active||flow.busy)this.tuner?.stopRev();
    if(this.screenTransition.active){
      this.screenTransition.update(dt);
      if(this.pendingScreenEntry&&this.transitionBlackDrawn)this.prepareScreenEntry();
      return;
    }
    if(this.pendingScreenEntry){this.prepareScreenEntry();return;}
    if(this.capturing)return;
    if(this.choicePopup){const popup=this.choicePopup;if(pressed('Escape')||pad('cancel')){this.choicePopup=null;return;}if(pressed('ArrowDown')||navigation==='down')popup.index=(popup.index+1)%popup.choices.length;if(pressed('ArrowUp')||navigation==='up')popup.index=(popup.index-1+popup.choices.length)%popup.choices.length;if(pressed('Space')||pressed('Enter')||pad('gamepadStart')||pad('jump'))this.choosePopupItem(popup.index);return;}
    if(this.tuner&&!this.movie&&!this.cutscene.active&&!flow.busy){
      const directions={...held};for(const [direction,code] of Object.entries({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}))directions[direction]||=Boolean(input?.isDownCode?.(code)||pressed(code));
      this.tuner.update({held:directions,confirmHeld:Boolean(input?.isDownCode?.('Enter')||input?.isDownCode?.('Space')||input?.isGamepadDown?.('jump')||touchHeld.jump),confirm:pressed('Enter')||pressed('Space')||pad('jump'),cancel:pressed('Escape')||pad('cancel')},dt);return;
    }
    if(pressed('Escape')||pad('cancel')){if(flow.busy){flow.stop();return;}if(!this.backGarageWidget())flow.back();return;}
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
    const map=items[this.focus];
    if(map?.type==='world-map'&&!pressed('Tab')){
      const direction=['up','down','left','right'].find(d=>pressed({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[d])||navigation===d);
      if(direction){void this.activate(map,1,{mapDirection:direction});return;}
    }
    const codeEntry=items[this.focus];
    if(codeEntry?.type==='code-entry'&&!pressed('Tab')){
      const direction=pressed('ArrowUp')||navigation==='up'?1:pressed('ArrowDown')||navigation==='down'?-1:0;
      if(direction){this.cycleCode(codeEntry,direction);return;}
    }
    if(items[this.focus]?.type==='garage-browser'&&!pressed('Tab')){
      const direction=pressed('ArrowDown')||navigation==='down'?1:pressed('ArrowUp')||navigation==='up'?-1:0;
      if(direction){
        const e=items[this.focus],state=this.widgetStates.get(e.id)||{},rows=garageBrowserRows(this.resources,flow.parameters,state),index=selectableGridIndex(rows.map(r=>({...r,disabled:false})),state.index||0,direction<0?'up':'down');
        if(index===null)this.focus=(this.focus+1)%Math.max(1,items.length);
        else if(index>=0&&index!==(state.index||0))void this.activate(e,index-(state.index||0));
        return;
      }
    }
    if(pressed('ArrowDown')||(pressed('Tab')&&!input?.isShiftDown?.())||navigation==='down')this.focus=(this.focus+1)%Math.max(1,items.length);
    if(pressed('ArrowUp')||(pressed('Tab')&&input?.isShiftDown?.())||navigation==='up')this.focus=(this.focus-1+items.length)%Math.max(1,items.length);
    if(pressed('ArrowLeft')||navigation==='left')this.moveHorizontal(items,-1);
    if(pressed('ArrowRight')||navigation==='right')this.moveHorizontal(items,1);
    if(pressed('Space')||pressed('Enter')||pad('gamepadStart')||pad('jump')){if(items[this.focus])void this.activate(items[this.focus],1,{choose:true});else if(flow.screen.startAction)void flow.start();}
  }
  draw(ctx,width,height){
    this.viewportBounds={x:0,y:0,w:width,h:height};const handheld=this.surface.layout(width,height);this.bounds=fitMenuCanvas(handheld?.screen||this.viewportBounds);if(!this.flow)return;ctx.fillStyle='#060b10';ctx.fillRect(0,0,width,height);this.surface.draw(ctx);
    if(this.raceFinishCutscene||this.raceIntroCutscene){
      const b=this.bounds;ctx.fillStyle='#000';ctx.fillRect(b.x,b.y,b.w,b.h);
      if(this.cutscene.active){ctx.save();ctx.translate(b.x,b.y);this.cutscene.draw(ctx,b.w,b.h);ctx.restore();}
      drawDisplayModeInBounds(this.game,ctx,b);return;
    }
    if(!this.pendingScreenEntry){
    for(const e of this.flow.screen.elements.filter(e=>e.type==='garage-dialogue'))this.widgetStates.set(e.id,{text:this.garageDialogue.text(this.dialogueContext())});
    if(this.tunerModal)drawGarageTuner(ctx,this.bounds,this.tuner,this.resources.font(this.flow.document.defaultFont),{},this.resources);
    else drawMenuScreen(ctx,this.bounds,this.flow.document,this.flow.screen,this.flow.parameters,{resources:this.resources,time:this.flow.time,focus:this.interactive()[this.focus]?.id,videos:this.videos,widgetStates:this.widgetStates});
    if(this.cutscene.active){const b=this.bounds;ctx.save();ctx.translate(b.x,b.y);this.cutscene.draw(ctx,b.w,b.h);ctx.restore();}
    if(this.movie){const b=this.bounds;ctx.fillStyle='#000';ctx.fillRect(b.x,b.y,b.w,b.h);if(this.movie.readyState>=2){const scale=Math.min(b.w/this.movie.videoWidth,b.h/this.movie.videoHeight);ctx.drawImage(this.movie,b.x+(b.w-this.movie.videoWidth*scale)/2,b.y+(b.h-this.movie.videoHeight*scale)/2,this.movie.videoWidth*scale,this.movie.videoHeight*scale);}}
    const status=this.flow.error||this.message;
    if(status){ctx.save();ctx.fillStyle='#000000';ctx.fillRect(0,height-64,width,64);ctx.fillStyle=this.flow.error?'#ffb1a6':'#fff';ctx.font='15px system-ui';ctx.textAlign='center';ctx.fillText(status,width/2,height-32,width-20);ctx.restore();}
    if(this.choicePopup){const b=this.bounds;ctx.save();ctx.translate(b.x,b.y);ctx.scale(b.w/960,b.h/540);this.drawChoices(ctx,960,540);ctx.restore();this.choiceRows=this.choiceRows.map(r=>({...r,x:b.x+r.x*b.w/960,y:b.y+r.y*b.h/540,w:r.w*b.w/960,h:r.h*b.h/540}));}
    }
    // Captured outgoing frames are already filtered; only filter freshly drawn content.
    if(!this.pendingScreenEntry)drawDisplayModeInBounds(this.game,ctx,this.bounds);
    if(this.pendingScreenEntry&&this.pendingScreenSnapshot)ctx.drawImage(this.pendingScreenSnapshot,this.bounds.x,this.bounds.y,this.bounds.w,this.bounds.h);
    this.screenTransition.draw(ctx,this.bounds);
    if(this.screenTransition.active&&this.screenTransition.elapsed>=.15){
      if(this.pendingScreenEntry)this.transitionBlackDrawn=true;
      else this.screenTransition.release();
    }
    this.lastDrawCanvas=ctx.canvas;this.lastDrawTransform=ctx.getTransform?.();
    if(this.preview){this.playPauseBounds={x:Math.max(0,width-214),y:0,w:72,h:36};drawSharedPlayStopButton(ctx,this.playPauseBounds,{isActive:true});ctx.save();ctx.fillStyle='#101c28';ctx.fillRect(width-130,0,130,36);ctx.fillStyle='#fff';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('Exit Preview',width-65,23);ctx.restore();}
  }
  hitElement(point,includeDisabled=false){return menuPaintOrder(this.flow.screen.elements).reverse().find(e=>{if(!menuElementVisible(e,this.flow.screen.elements)||(!includeDisabled&&e.disabled)||!menuElementInteractive(e))return false;const pose=menuElementPose(e,this.flow.time),b=menuElementBounds(e,this.bounds,pose),dx=point.x-(b.x+b.w/2),dy=point.y-(b.y+b.h/2),a=-pose.rotation*Math.PI/180;return menuHit({x:(dx*Math.cos(a)-dy*Math.sin(a))/pose.scale+b.x+b.w/2,y:(dx*Math.sin(a)+dy*Math.cos(a))/pose.scale+b.y+b.h/2},b)})}
  handlePointerDown(point){
    if(this.cutscene.active||this.raceFinishCutscene||this.raceIntroCutscene){
      this.surface.down(point);return;
    }
    if(!this.flow||!this.bounds)return;if(this.preview&&this.playPauseBounds&&menuHit(point,this.playPauseBounds)){this.flow.stop();return;}if(this.preview&&point.x>=(this.viewportBounds?.w||this.bounds.w)-130&&point.y<36){this.flow.stop();return;}
    if(this.screenTransition.active||this.pendingScreenEntry)return;
    if(!menuHit(point,this.bounds)&&this.surface.down(point))return;
    if(this.paused)return;
    if(this.choicePopup){const row=this.choiceRows?.find(row=>menuHit(point,row));if(row){if(row.page){this.choicePopup.index=Math.max(0,Math.min(this.choicePopup.choices.length-1,this.choicePopup.index+row.page));}else this.choosePopupItem(row.index);}else this.choicePopup=null;return;}
    if(this.movie){void this.resumeMovie();return;}if(this.flow.busy||!menuHit(point,this.bounds))return;
    for(const video of this.videos.values())if(video.paused)void video.play().catch(()=>{});
    if(this.tuner){this.tuner.pointerDown(point);return;}
    if(this.hitElement(point,true)?.disabled)return;
    const e=this.hitElement(point);if(e){this.focus=this.interactive().indexOf(e);if(e.type==='code-entry'){const b=menuElementBounds(e,this.bounds,menuElementPose(e,this.flow.time));if(point.y>b.y+b.h*.75){void this.activate(e,1,{choose:true});return;}this.widgetStates.set(e.id,{index:Math.max(0,Math.min(e.codeLength-1,Math.floor((point.x-b.x)/b.w*e.codeLength)))});if(point.y<b.y+b.h*.24)this.cycleCode(e,1);else if(point.y>b.y+b.h*.48)this.cycleCode(e,-1);return;}if(e.type==='world-map'){const b=menuElementBounds(e,this.bounds,menuElementPose(e,this.flow.time)),nodes=worldMapRaceNodes(worldMapNodes(e,this.resources,this.flow.document,this.flow.parameters));const node=nodes.map(n=>{const p=worldMapNodePoint(n,b,e);return {node:n,distance:Math.hypot(point.x-p.x,point.y-p.y)}}).filter(n=>n.distance<Math.max(22,Math.min(b.w,b.h)*.07)).sort((a,b)=>a.distance-b.distance)[0]?.node;if(node&&!node.locked&&!node.disabled){const selected=this.flow.parameters[e.binding]===node.raceRef;this.flow.setParameter(e.binding,node.raceRef);if(selected)void this.activate(e,1,{choose:true});}return;}if(['car-showroom','garage-browser'].includes(e.type)){this.pointerGarageWidget(e,point);return;}if(e.type==='slider'){this.slider={id:point.id,element:e};this.handlePointerMove(point);}else void this.activate(e,1,{choose:true});}else if(this.flow.screen.startAction)void this.flow.start();
  }
  pointerGarageWidget(element,point){
    const b=menuElementBounds(element,this.bounds,menuElementPose(element,this.flow.time));
    const state=this.widgetStates.get(element.id)||{};
    if(element.type==='car-showroom'&&point.y>b.y+b.h-24){
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
      const rows=garageBrowserRows(this.resources,this.flow.parameters,state),start=0,visible=rows.slice(start,start+8);
      const index=visible.findIndex((_,i)=>menuHit(point,garageGridBounds(upgradeGridArea(b),i)));
      if(index<0)return;state.index=start+index;this.widgetStates.set(element.id,state);void this.activate(element,1,{choose:true});
    }
  }
  choosePopupItem(index){const popup=this.choicePopup;if(!popup||this.flow.busy)return;
    if(popup.onChoose){const flow=this.flow;this.choicePopup=null;flow.busy=true;return Promise.resolve().then(()=>popup.onChoose(popup.choices[index].value)).catch(error=>{flow.error=error.message;}).finally(()=>{flow.busy=false;});}
this.flow.setParameter(popup.element.binding,popup.choices[index].value);this.choicePopup=null;if(popup.element.action)void this.flow.run(popup.element.action);}
  drawChoices(ctx,width,height){
    const p=this.choicePopup,w=Math.min(width-24,560),x=(width-w)/2,rowHeight=48,count=Math.max(1,Math.floor((height-150)/rowHeight)),start=Math.floor(p.index/count)*count,y=60;
    this.choiceRows=[];ctx.save();ctx.fillStyle='#000000';ctx.fillRect(0,0,width,height);ctx.font=`26px ${this.resources.font(this.flow.document.defaultFont)}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(p.element.label,x+w/2,28,w-20);
    const rows=p.choices.slice(start,start+count);for(const [offset,item] of rows.entries()){const index=start+offset,b={x,y:y+offset*rowHeight,w,h:rowHeight,index};ctx.fillStyle='#000000';ctx.fillRect(b.x,b.y,b.w,b.h-2);ctx.fillStyle='#fff';ctx.fillText(`${index===p.index?'> ':''}${item.label}`,b.x+b.w/2,b.y+b.h/2,b.w-20);this.choiceRows.push(b);}
    if(p.choices.length>count){for(const [side,page,name] of [[0,-count,'Previous'],[1,count,'Next']]){const b={x:x+side*w/2,y:y+rows.length*rowHeight+8,w:w/2,h:44,page};ctx.fillStyle='#000000';ctx.fillRect(b.x,b.y,b.w-2,b.h);ctx.fillStyle='#fff';ctx.fillText(name,b.x+b.w/2,b.y+22);this.choiceRows.push(b);}}
    ctx.restore();
  }
  hoverGarage(point){
    if(this.tuner&&!this.tuner.busy&&!this.tuner.dragging){
      const hit=this.tuner.hitAreas?.find(a=>(['category','row'].includes(a.kind)||(this.tuner.mode==='repair'&&['apply','exit'].includes(a.kind)))&&menuHit(point,a));
      if(hit){if(this.tuner.mode==='repair'&&['apply','exit'].includes(hit.kind)){this.tuner.repairAction=hit.kind;}else if(hit.kind==='category'){if(this.tuner.enabled(hit.index))this.tuner.index=hit.index;}else if(this.tuner.sectionRows()[hit.index])this.tuner.rowIndex=hit.index;}return;
    }
    const element=this.hitElement(point);
    if(this.flow.screen.id==='garage'&&element?.type==='button'){this.focus=this.interactive().indexOf(element);return;}
    if(element?.type!=='garage-browser')return;
    const state=this.widgetStates.get(element.id)||{},rows=garageBrowserRows(this.resources,this.flow.parameters,state),start=0;
    const b=menuElementBounds(element,this.bounds,menuElementPose(element,this.flow.time));
    const index=rows.slice(start,start+8).findIndex((_,i)=>menuHit(point,garageGridBounds(upgradeGridArea(b),i)));
    if(index>=0){state.index=start+index;this.widgetStates.set(element.id,state);this.focus=this.interactive().indexOf(element);}
  }
  handlePointerMove(point){if(this.screenTransition.active||this.pendingScreenEntry)return;this.surface.move(point);if(!this.paused&&!this.flow?.busy&&this.bounds&&(!point.buttons)&&(point.pointerType==='mouse'||point.buttons===0))this.hoverGarage(point);if(this.tuner){this.tuner.pointerMove(point);return;}if(!this.slider||!this.bounds)return;if(this.slider.id!==undefined&&point.id!==undefined&&point.id!==this.slider.id)return;const e=this.slider.element,b=menuElementBounds(e,this.bounds,menuElementPose(e,this.flow.time));if(!e.binding)return;const fraction=Math.max(0,Math.min(1,(point.x-b.x)/b.w)),value=e.min+Math.round(fraction*(e.max-e.min)/e.step)*e.step;this.flow.setParameter(e.binding,Math.min(e.max,value));}
  handlePointerUp(point={}){this.surface.up(point);this.tuner?.pointerUp();const action=this.slider?.element.action;this.slider=null;if(action)void this.flow.run(action);}
  async playMovie(ref,{restoreScreen=true}={}){
    this.cleanupScreen();const flow=this.flow,generation=flow.generation;
    if(/^(https?:|\/|data:video\/|blob:)/i.test(ref)){
      const video=document.createElement('video');video.src=ref;video.playsInline=true;video.volume=musicMediaVolume(this.game.audio);this.movie=video;
      return new Promise((resolve,reject)=>{this.resolveMovie=resolve;this.rejectMovie=reject;video.onended=()=>{video.pause();video.removeAttribute('src');video.load();this.movie=null;this.resolveMovie=null;this.rejectMovie=null;this.message='';if(restoreScreen&&flow.active&&generation===flow.generation)this.enterScreen();resolve()};video.onerror=()=>{this.movie=null;this.rejectMovie=null;reject(Error(`Movie could not load: ${ref}`))};void this.resumeMovie();});
    }
    const payload=await hydrateProjectFilePayload('cutscenes',ref);if(!flow.active||flow.generation!==generation)return;if(!payload?.data)throw Error(`Movie not found: ${ref}`);
    const assets=payload.data.assets||[],references=new Map();
    for(const asset of assets){const folder={art:'art',music:'music',sfx:'sfx',actor:'actors'}[asset.type];if(folder&&asset.ref)references.set(`${folder}:${asset.ref}`,{folder,ref:asset.ref});if(asset.actorRef)references.set(`actors:${asset.actorRef}`,{folder:'actors',ref:asset.actorRef});}
    for(const clip of payload.data.clips||[])if(['music','sfx'].includes(clip.type)){const asset=assets.find(a=>a.id===clip.assetId),name=asset?.ref||clip.assetId;if(name)references.set(`${clip.type}:${name}`,{folder:clip.type,ref:name});}
    const loads=await Promise.allSettled([...references.values()].map(async asset=>{const value=await hydrateProjectFilePayload(asset.folder,asset.ref);if(!value?.data)throw Error(`Movie asset not found: ${asset.ref}`);return value}));
    const failure=loads.find(result=>result.status==='rejected');if(failure)throw failure.reason;
    await this.game.prepareCutsceneAudioResources?.(payload.data);
    if(!flow.active||flow.generation!==generation)return;
    return new Promise((resolve,reject)=>{this.rejectMovie=reject;this.cutscene.play(payload.data,{onDone:()=>{this.rejectMovie=null;if(restoreScreen&&flow.active&&generation===flow.generation)this.enterScreen();resolve()},skippable:true})});
  }
  async resumeMovie(){try{await this.movie?.play();this.message=''}catch{this.message='Tap / press Space to play movie'}}
  async launchRace(ref,parameters){
    const flow=this.flow;
    if(this.preview)this.game.playtestActive=true;
    this.raceIntroCutscene=true;
    this.cleanupScreen();this.game.menuParameters=structuredClone(parameters);
    try{
      const ok=await this.game.startRaceTravel({raceName:ref,carSelection:parameters.carRef?'specific':'choose',carRef:parameters.carRef,menuConfiguration:parameters,menuFlow:flow,garage:this.resources.garage});
      if(!ok)throw Error(this.game.lastRaceTravelError||`Could not start race: ${ref}`);
    }finally{
      this.raceIntroCutscene=false;
    }
  }
  async launchLevel(ref,parameters){
    const flow=this.flow,generation=flow.generation;
    const payload=await hydrateProjectFilePayload('levels',ref);if(!flow.active||this.flow!==flow||flow.generation!==generation)return;if(!payload?.data)throw Error(`Level not found: ${ref}`);
    this.cleanupScreen();this.game.menuParameters=structuredClone(parameters);this.game.applyWorldData(payload.data);this.game.gameMode='story';this.game.storyData=this.game.buildWorldData();this.game.playtestActive=this.preview;this.game.simulationActive=false;this.game.resetRun({playtest:this.preview,startWithEverything:true});this.game.transitionTo('playing');this.game.startSpawnPause();
  }
}
