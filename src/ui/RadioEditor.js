import RaceEditor from './RaceEditor.js';
import { openEditorForm, chooseEditorFiles } from './shared/editorForm.js';
import { chooseImage } from './MenuDesignerForms.js';
import { createRadioId, normalizeRadioLibrary } from '../radio/RadioLibrary.js';
import { RaceRadioDirector } from '../radio/RaceRadioDirector.js';
import { RadioPlayer } from '../radio/RadioPlayer.js';
import { RadioNowPlaying } from './RadioNowPlaying.js';
import { getEditorMenuSpec, getEditorControllerRootMenuEntries } from './shared/editorMenuSpec.js';
import { EditorInputActionNormalizer, EDITOR_INPUT_ACTIONS as INPUT } from './shared/input/editorInputActions.js';
import { drawSharedDesktopContextPanel, drawSharedPanel, drawSharedPlayStopButton, drawSharedTransportPopover, UI_SUITE } from './uiSuite.js';

const text = (id, label, value = '') => ({id, label, value, type:'text'});
const select = (id, label, value, options) => ({id, label, value, options});
const yesNo = [{value:'yes',label:'Yes'},{value:'no',label:'No'}];
const readFile = file => new Promise((resolve,reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(Error('Could not read audio file'));
  reader.readAsDataURL(file);
});
const labels = {
  new:'New Library', save:'Save Library', 'save-as':'Save Library As', open:'Open Library', export:'Export Library', import:'Import Library',
  'radio-focus-stations':'Focus Stations', 'radio-focus-tracks':'Focus Tracks',
  'radio-import':'Upload MP3', 'radio-play':'Play / Pause Song',
  'radio-loop':'Repeat', 'radio-restart':'Rewind to Start', 'radio-stop':'Stop Preview', 'radio-next':'Next Track', 'radio-previous':'Previous Track',
  'station-new':'New Station', 'station-properties':'Station Properties', 'station-logo':'Station Logo',
  'track-drops':'Music Drops', 'track-start-here':'Set Start Drop at Playhead', 'track-end-here':'Set Finish Drop at Playhead', 'radio-preview-start':'Preview Race Start', 'radio-preview-end':'Preview Race Finish',
  'station-delete':'Delete Station', 'track-properties':'Track Properties', 'track-art':'Album Artwork',
  'track-membership':'Add / Remove from Station', 'track-up':'Move Earlier', 'track-down':'Move Later',
  'track-delete':'Delete Track', 'exit-main':'Exit to Main Menu', undo:'Undo', redo:'Redo'
};

export class RadioEditor extends RaceEditor {
  constructor(game) {
    super(game,{mode:'car'});
    this.opened = false;
    this.library = normalizeRadioLibrary();
    this.stationId = '';
    this.trackId = '';
    this.undoLibraries = [];
    this.redoLibraries = [];
    this.activeRootId = 'stations';
    this.focusList = 'stations';
    this.radioInput = new EditorInputActionNormalizer();
    this.artworkDisplay = new RadioNowPlaying();
    // Audition uses its own progress: locked songs can be heard without unlocking them.
    this.preview = new RadioPlayer({load:async()=>({}),save:async()=>({ok:true}),onChange:()=>{
      this.game.audio?.setRadioPlaying?.(Boolean(this.preview?.playing || this.game.radio?.playing));
      if(this.preview?.playing && this.preview.trackId)this.trackId=this.preview.trackId;
    }});
    this.cueDirector=new RaceRadioDirector(this.preview);
    this.preview.repeatMode='off';
    this.status = 'Select a station or upload an MP3.';
  }
  get editorId() { return 'radio'; }
  get title() { return 'Radio Editor'; }
  get station() { return this.library.stations.find(s=>s.id===this.stationId); }
  get track() { return this.library.tracks.find(t=>t.id===this.trackId); }
  get visibleTracks() {
    const ids = this.station?.trackIds || [];
    return [...ids.map(id=>this.library.tracks.find(t=>t.id===id)).filter(Boolean),...this.library.tracks.filter(t=>!ids.includes(t.id))];
  }
  async run(task) {
    if(this.opened)return;
    this.opened=true;
    try { return await task(); }
    catch(error) { this.status=error.message;this.game.showSystemToast?.(error.message); }
    finally { this.opened=false;this.game.input?.reset?.(); }
  }
  open() {
    this.game.transitionTo('radio-editor');
    return this.run(async()=>{
      await this.game.radio.load();await this.preview.load();
      this.library=normalizeRadioLibrary(this.game.radio.library);
      this.undoLibraries=[];this.redoLibraries=[];this.syncSelection();this.syncPreview();
      this.status='Tap Play; hold for transport controls. Changes save automatically.';
    });
  }
  syncSelection() {
    if(!this.station)this.stationId=this.library.stations[0]?.id||'';
    if(!this.track)this.trackId=this.visibleTracks[0]?.id||'';
  }
  syncPreview() {
    this.clearCuePreview();
    this.preview.stop();
    this.preview.library=this.library;
    this.preview.progress={enabled:true,stationId:this.stationId,unlocked:this.library.tracks.map(t=>t.id),disabled:[]};
    this.preview.setContext(true);
  }
  async commit(library) {
    const next=normalizeRadioLibrary(library);
    if(JSON.stringify(next)===JSON.stringify(this.library))return;
    const before=this.library;
    await this.game.radio.saveLibrary(next);
    this.library=next;this.undoLibraries.push(before);
    if(this.undoLibraries.length>50)this.undoLibraries.shift();
    this.redoLibraries=[];this.syncSelection();this.syncPreview();this.status='Library saved';
  }
  async history(redo=false) {
    const from=redo?this.redoLibraries:this.undoLibraries,to=redo?this.undoLibraries:this.redoLibraries;
    if(!from.length)return;
    const next=from.at(-1);
    await this.game.radio.saveLibrary(next);
    to.push(this.library);this.library=from.pop();this.syncSelection();this.syncPreview();
    this.status=redo?'Change restored and saved':'Change undone and saved';
  }
  selectStation(id) {this.stationId=id;this.trackId=this.station?.trackIds[0]||this.library.tracks[0]?.id||'';this.focusList='stations';this.syncPreview();}
  selectTrack(id) {
    this.clearCuePreview();
    if(id!==this.trackId)this.preview.stop();
    this.trackId=id;this.focusList='tracks';
  }
  async togglePreview() {
    if(this.preview.playing){this.preview.pause();return;}
    if(!this.track){this.status='Select a song before playing.';return;}
    if(!this.preview.audio)this.preparePreviewQueue();
    await this.preview.play(this.trackId);this.status=this.preview.error||`Previewing ${this.track.title}`;
  }
  preparePreviewQueue() {
    // Audition unassigned songs without adding them to the saved station.
    const station=this.station||{id:'preview',name:'Preview',trackIds:[]};
    const trackIds=station.trackIds.includes(this.trackId)?station.trackIds:this.visibleTracks.map(track=>track.id);
    this.preview.library={...this.library,stations:[{...station,trackIds}]};
    this.preview.progress.stationId=station.id;
    this.preview.setVolume(this.game.audio?.midiBusVolume??0.8);
  }
  async stepPreview(direction) {
    if(!this.preview.audio){this.preparePreviewQueue();this.preview.trackId=this.trackId;}
    return direction<0?this.preview.rewind():this.preview.skip();
  }
  exitToMainMenu() {this.clearCuePreview();this.cancelTransportHold();this.closeTransportPopover();this.preview.stop();this.game.transitionTo('title',{forceCleanup:true});}
  options() {return this.run(async()=>{
    const radio=this.game.radio;await radio.load();
    const result=await openEditorForm('Radio Options',[select('enabled','Enable radio',radio.progress.enabled?'yes':'no',yesNo)]);
    if(result)await radio.setEnabled(result.enabled==='yes');
  });}
  async newLibrary() {
    const result=await openEditorForm('New Radio Library',[select('clear','Start an empty library?','no',yesNo)],{description:'Undo restores the current library. Export it first to keep a separate copy.'});
    if(result?.clear==='yes')await this.commit(normalizeRadioLibrary());
  }
  async openLibrary() {
    const [file]=await chooseEditorFiles('application/json,.json');if(!file)return;
    const data=JSON.parse(await file.text());
    if(!Array.isArray(data.tracks)||!Array.isArray(data.stations))throw Error('Choose a Radio library JSON file.');
    await this.commit(data);
  }
  async exportLibrary(chooseName=false) {
    const result=chooseName?await openEditorForm('Save Radio Library As',[text('name','Filename','radio-library')]):{name:'radio-library'};
    if(!result)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(this.library,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=(result.name.trim()||'radio-library').replace(/\.json$/i,'')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    this.status='Library exported';
  }
  async importTrack() {
    const [file]=await chooseEditorFiles('audio/mpeg,.mp3');if(!file)return;
    if(!/\.mp3$/i.test(file.name)&&file.type!=='audio/mpeg')throw Error('Choose an MP3 audio file.');
    const fields=await openEditorForm('Import Radio Track',[text('title','Song title',file.name.replace(/\.mp3$/i,'')),text('artist','Artist'),text('album','Album'),select('initiallyUnlocked','Available without a mix tape?','no',yesNo)]);
    if(!fields)return;
    const library=structuredClone(this.library),id=createRadioId();
    library.tracks.push({id,...fields,initiallyUnlocked:fields.initiallyUnlocked==='yes',src:await readFile(file),image:{artRef:'',url:''}});
    const station=library.stations.find(s=>s.id===this.stationId);
    if(station)station.trackIds.push(id);
    await this.commit(library);this.selectTrack(id);
  }
  async editStation(create=false) {
    if(!create&&!this.station)return;
    const station=create?{id:createRadioId(),name:'New station',logo:{artRef:'',url:''},trackIds:[]}:this.station;
    const fields=await openEditorForm(create?'New Radio Station':'Station Properties',[text('name','Station name',station.name)]);
    if(!fields)return;
    const library=structuredClone(this.library);
    if(create)library.stations.push({...station,name:fields.name});
    else library.stations.find(s=>s.id===station.id).name=fields.name;
    await this.commit(library);this.selectStation(station.id);
  }
  async editTrack() {
    if(!this.track)return;
    const track=this.track;
    const fields=await openEditorForm('Track Properties',[text('title','Song title',track.title),text('artist','Artist',track.artist),text('album','Album',track.album),select('initiallyUnlocked','Available without a mix tape?',track.initiallyUnlocked?'yes':'no',yesNo)]);
    if(!fields)return;
    const library=structuredClone(this.library);
    Object.assign(library.tracks.find(t=>t.id===track.id),{...fields,initiallyUnlocked:fields.initiallyUnlocked==='yes'});
    await this.commit(library);
  }
  clearCuePreview() {this.cueDirector?.reset(false);this.cueSession=null;}
  async editMusicDrops() {
    const track=this.track;if(!track)return;
    const cues=track.raceCues||{start:3,end:null};
    const result=await openEditorForm('Music Drops',[
      {id:'start',label:'Race start drop (seconds into song)',value:cues.start,min:0,step:0.01},
      {id:'endEnabled',label:'Use race finish drop',type:'checkbox',value:cues.end!==null},
      {id:'end',label:'Race finish / chorus (seconds into song)',value:cues.end??0,min:0,step:0.01}
    ],{description:'The start cue lands on GO after a 3-second fade-in. At results, the song fades out for 0.6 seconds, then jumps to the finish cue at full volume.'});
    if(!result)return;
    const library=structuredClone(this.library);
    library.tracks.find(t=>t.id===track.id).raceCues={start:result.start,end:result.endEnabled?result.end:null};
    await this.commit(library);
  }
  async markMusicDrop(kind) {
    if(!this.track||this.preview.trackId!==this.trackId||!this.preview.audio)return;
    const library=structuredClone(this.library),track=library.tracks.find(t=>t.id===this.trackId);
    track.raceCues={...(track.raceCues||{start:3,end:null}),[kind]:Math.round(this.preview.audio.currentTime*100)/100};
    await this.commit(library);
  }
  async previewMusicDrop(kind) {
    if(!this.track)return;
    this.clearCuePreview();this.preview.stop();this.preparePreviewQueue();
    const track=this.track;
    this.cueSession={running:true,countdownRemainingMs:kind==='start'?4000:0,raceResults:kind==='end'};
    if(kind==='end'){
      if(track.raceCues?.end==null){this.cueSession=null;this.status='Set a finish drop in Tracks → Music Drops first.';return;}
      await this.preview.play(track.id,{position:Math.max(0,track.raceCues.end-5),gain:1});
      this.cueDirector.session=this.cueSession;this.cueDirector.started=true;this.cueDirector.go=true;
    }else{this.preview.trackId=track.id;this.cueDirector.update(this.cueSession);}
    this.status=kind==='start'?'Race start preview: 3 seconds to GO':'Race finish preview';
  }
  async chooseArtwork(station=false) {
    const selected=station?this.station:this.track;if(!selected)return;
    const key=station?'logo':'image',element={artRef:selected[key]?.artRef};
    await chooseImage({element,change:fn=>fn()});
    if(element.artRef===selected[key]?.artRef)return;
    const library=structuredClone(this.library);
    library[station?'stations':'tracks'].find(item=>item.id===selected.id)[key]={artRef:element.artRef||'',url:''};
    await this.commit(library);
  }
  async membership() {
    if(!this.station||!this.track)return;
    const library=structuredClone(this.library),station=library.stations.find(s=>s.id===this.stationId);
    if(station.trackIds.includes(this.trackId))station.trackIds=station.trackIds.filter(id=>id!==this.trackId);
    else station.trackIds.push(this.trackId);
    await this.commit(library);
  }
  async moveTrack(direction) {
    const library=structuredClone(this.library),ids=library.stations.find(s=>s.id===this.stationId)?.trackIds;
    const index=ids?.indexOf(this.trackId)??-1;
    if(index<0||index+direction<0||index+direction>=ids.length)return;
    [ids[index],ids[index+direction]]=[ids[index+direction],ids[index]];await this.commit(library);
  }
  async remove(station=false) {
    const selected=station?this.station:this.track;if(!selected)return;
    const result=await openEditorForm(station?'Delete Station':'Delete Track',[select('remove',`Delete ${selected.name||selected.title}?`,'no',yesNo)],{description:station?'Songs remain in the library.':'Mix tapes that reference this track will need another track. Undo can restore it.'});
    if(result?.remove!=='yes')return;
    const library=structuredClone(this.library),key=station?'stations':'tracks';
    library[key]=library[key].filter(item=>item.id!==selected.id);await this.commit(library);
  }
  getMenuItems(root) {const spec=getEditorMenuSpec(this.editorId);return(spec.sections[root]?.actions||[]).map(id=>({id,label:this.getRaceActionLabel(id),disabled:!this.isActionAvailable(id),onSelect:()=>this.handleMenuAction(id)}));}
  getRaceActionLabel(id) {
    if(id==='radio-loop')return 'Repeat: '+({off:'Off',all:'All',one:'Song'}[this.preview.repeatMode]);
    return labels[id]||id;
  }
  isActionAvailable(id) {
    if(this.opened)return false;
    if(id==='undo')return this.undoLibraries.length>0;
    if(id==='redo')return this.redoLibraries.length>0;
    if(['track-start-here','track-end-here'].includes(id))return !!this.preview.audio&&this.preview.trackId===this.trackId;
    if(id==='radio-play')return !!this.track;
    if(['station-properties','station-logo','station-delete'].includes(id))return !!this.station;
    if(['track-properties','track-art','track-delete','track-drops','radio-preview-start','radio-preview-end'].includes(id))return !!this.track;
    if(['track-membership','track-up','track-down'].includes(id))return !!this.station&&!!this.track;
    return !!getEditorMenuSpec(this.editorId).actions[id];
  }
  handleMenuAction(id) {
    if(!this.isActionAvailable(id))return;
    if(['radio-play','radio-stop','radio-next','radio-previous','radio-restart'].includes(id))this.clearCuePreview();
    const actions={
      undo:()=>this.history(),redo:()=>this.history(true),'radio-import':()=>this.importTrack(),
      new:()=>this.newLibrary(),open:()=>this.openLibrary(),import:()=>this.openLibrary(),'save-as':()=>this.exportLibrary(true),export:()=>this.exportLibrary(),
      'radio-focus-stations':()=>{this.focusList='stations';},'radio-focus-tracks':()=>{this.focusList='tracks';},
      save:async()=>{await this.game.radio.saveLibrary(this.library);this.status='Library saved';},
      'station-new':()=>this.editStation(true),'station-properties':()=>this.editStation(),'station-logo':()=>this.chooseArtwork(true),'station-delete':()=>this.remove(true),
      'track-drops':()=>this.editMusicDrops(),'track-start-here':()=>this.markMusicDrop('start'),'track-end-here':()=>this.markMusicDrop('end'),
      'radio-preview-start':()=>this.previewMusicDrop('start'),'radio-preview-end':()=>this.previewMusicDrop('end'),
      'track-properties':()=>this.editTrack(),'track-art':()=>this.chooseArtwork(),'track-delete':()=>this.remove(),
      'track-membership':()=>this.membership(),'track-up':()=>this.moveTrack(-1),'track-down':()=>this.moveTrack(1),
      'radio-loop':()=>{const modes=['off','all','one'];this.preview.repeatMode=modes[(modes.indexOf(this.preview.repeatMode)+1)%3];},
      'radio-restart':()=>{if(this.preview.audio)this.preview.audio.currentTime=0;},
      'radio-play':()=>this.togglePreview(),'radio-stop':()=>this.preview.stop(),'radio-next':()=>this.stepPreview(1),'radio-previous':()=>this.stepPreview(-1),
      'exit-main':()=>this.exitToMainMenu()
    };
    return this.run(actions[id]||(()=>{}));
  }
  getRacePortraitContextAction() {return{id:'radio-play',label:this.preview.playing?'Pause':'Play',onClick:()=>this.handleMenuAction('radio-play')};}
  getTransportActions() {
    return [
      ['radio-previous','⏮',0,0],['radio-restart','⏪',0,1],
      ['radio-next','⏭',0,2],['radio-stop','■',0,3],
      ['radio-play',this.preview.playing?'❚❚':'▶',1,1],
      ['radio-loop',this.preview.repeatMode==='one'?'↻1':'∞',1,2]
    ].map(([id,label,col,row])=>({id,label,col,row,primary:id==='radio-play',
      active:id==='radio-loop'?this.preview.repeatMode!=='off':id==='radio-play'&&this.preview.playing,
      action:()=>this.handleMenuAction(id)}));
  }
  openTransportPopover(anchor) {this.transportPopover={anchor:{...anchor}};}
  closeTransportPopover() {this.transportPopover=null;this.transportPopoverButtons=[];}
  cancelTransportHold() {clearTimeout(this.transportHold?.timer);this.transportHold=null;}
  draw(ctx,width,height) {
    super.draw(ctx,width,height);
    if(this.transportPopover){
      const layout=drawSharedTransportPopover(ctx,this.transportPopover.anchor,{x:0,y:0,w:width,h:height},this.getTransportActions(),{columns:2,columnWidth:54,rowHeight:42});
      this.transportPopoverButtons=layout.buttons.map(b=>({id:b.id,bounds:b.bounds,onClick:b.action}));
      this.buttons.push(...this.transportPopoverButtons);
    }
  }
  handlePointerDown(payload={}) {
    const inside=b=>payload.x>=b.x&&payload.x<=b.x+b.w&&payload.y>=b.y&&payload.y<=b.y+b.h;
    if(this.transportPopover){
      const hit=this.transportPopoverButtons?.find(b=>inside(b.bounds));
      this.closeTransportPopover();hit?.onClick();return;
    }
    const hit=[...this.buttons].reverse().find(b=>inside(b.bounds));
    if(hit?.id==='radio-play'&&!this.opened){
      this.cancelTransportHold();
      const hold={x:payload.x,y:payload.y,button:hit,fired:false};
      hold.timer=setTimeout(()=>{hold.fired=true;this.openTransportPopover(hit.bounds);},500);
      this.transportHold=hold;return;
    }
    return super.handlePointerDown(payload);
  }
  handlePointerMove(payload={}) {
    if(this.transportHold){
      if(Math.hypot(payload.x-this.transportHold.x,payload.y-this.transportHold.y)>12){
        clearTimeout(this.transportHold.timer);this.transportHold.fired=true;
      }
      return;
    }
    return super.handlePointerMove(payload);
  }
  handlePointerUp(payload={}) {
    if(this.transportHold){
      const hold=this.transportHold;this.cancelTransportHold();
      const b=hold.button.bounds;
      if(!hold.fired&&payload.x>=b.x&&payload.x<=b.x+b.w&&payload.y>=b.y&&payload.y<=b.y+b.h)hold.button.onClick?.();return;
    }
    return super.handlePointerUp(payload);
  }
  getDesktopContextActions() {return [];}
  drawDesktopContext(ctx,bounds) {drawSharedDesktopContextPanel(ctx,bounds,{title:this.title,lines:[`Station: ${this.station?.name||'None'}`,`Track: ${this.track?.title||'None'}`,this.track?.artist||'',this.track?.album||'',`${this.library.stations.length} stations · ${this.library.tracks.length} tracks`],contentRoles:['document-summary','active-tool-summary','status'],status:this.preview.error||this.status});}
  drawLandscapeToolOptions(ctx,bounds) {drawSharedDesktopContextPanel(ctx,bounds,{title:this.station?.name||this.title,lines:[],contentRoles:['status'],status:this.preview.error||this.status});}
  drawRaceTopPlayControl(ctx,bounds) {
    drawSharedPlayStopButton(ctx,bounds,{isActive:this.preview.playing});
    this.buttons.push({id:'radio-play',bounds:{...bounds},onClick:()=>this.handleMenuAction('radio-play')});
  }
  drawCarEditorWorkSurface(ctx,bounds) {
    // The shared gamepad help bar overlays the bottom of the work surface.
    if(this.activeViewportMode==='gamepad')bounds={...bounds,h:Math.max(80,bounds.h-36)};
    this.carArtSliderRegions=[];this.radioBounds={...bounds};
    drawSharedPanel(ctx,bounds,{fill:UI_SUITE.colors.bg,border:UI_SUITE.colors.border});
    ctx.save();ctx.fillStyle=UI_SUITE.colors.text;ctx.font=`14px ${UI_SUITE.font.family}`;ctx.textAlign='left';
    const compact=bounds.h<360;
    const repeat=this.getRaceActionLabel('radio-loop');
    const title=this.preview.currentTrack?`${this.preview.playing?'Playing':'Paused'}: ${this.preview.currentTrack.title}`:'Station preview';
    if(!compact)ctx.fillText(title+' · '+repeat,bounds.x+12,bounds.y+64,bounds.w-24);
    ctx.font=`12px ${UI_SUITE.font.family}`;ctx.fillStyle=UI_SUITE.colors.muted;
    ctx.fillText(this.preview.error||this.status,bounds.x+12,bounds.y+(compact?54:84),bounds.w-24);
    const wide=bounds.w>=620||compact,top=bounds.y+(compact?66:100),height=Math.max(80,bounds.h-(compact?116:160));
    const stationBounds={x:bounds.x+8,y:top,w:wide?bounds.w*0.32-12:bounds.w-16,h:wide?height:Math.min(150,height*0.38)};
    const tracksBounds=wide?{x:bounds.x+bounds.w*0.32+4,y:top,w:bounds.w*0.68-12,h:height}:{x:bounds.x+8,y:top+stationBounds.h+8,w:bounds.w-16,h:Math.max(60,height-stationBounds.h-8)};
    for(const [b,title] of [[stationBounds,'Stations'],[tracksBounds,'Tracks · ✓ in selected station']]){ctx.fillStyle=UI_SUITE.colors.text;ctx.font=`bold 13px ${UI_SUITE.font.family}`;ctx.fillText(title,b.x+8,b.y+16,b.w-16);}
    this.drawActionRows(ctx,{...stationBounds,y:stationBounds.y+25,h:stationBounds.h-25},[
      {id:'station-new',label:'+ New Station',onClick:()=>this.handleMenuAction('station-new')},
      ...this.library.stations.map(s=>({id:`station:${s.id}`,label:s.name,active:s.id===this.stationId,onClick:()=>this.selectStation(s.id)}))
    ],1,{scrollKey:'radio:stations'});
    this.drawActionRows(ctx,{...tracksBounds,y:tracksBounds.y+25,h:tracksBounds.h-25},[
      {id:'radio-import',label:'+ Upload MP3',onClick:()=>this.handleMenuAction('radio-import')},
      ...this.visibleTracks.map(t=>({id:`track:${t.id}`,label:`${this.station?.trackIds.includes(t.id)?'✓':'＋'} ${t.title}${t.artist?' — '+t.artist:''}`,active:t.id===this.trackId,onClick:()=>this.selectTrack(t.id)}))
    ],1,{scrollKey:'radio:tracks'});
    const footerY=bounds.y+bounds.h-42,buttonW=(bounds.w-32)/3;
    const footer=[['station-properties','Station'],['track-properties','Track'],['track-membership',this.station?.trackIds.includes(this.trackId)?'Remove':'Add to station']];
    footer.forEach(([id,label],i)=>this.registerDrawnButton(ctx,{x:bounds.x+8+i*(buttonW+8),y:footerY,w:buttonW,h:34},{id,label,disabled:!this.isActionAvailable(id),onClick:()=>this.handleMenuAction(id)}));
    for(const [source,x] of [[this.station?.logo,bounds.x+12],[this.track?.image,bounds.x+(this.activeViewportMode==='desktop'?64:bounds.w-60)]]){
      const art=this.artworkDisplay.image(source);
      if(art){const factor=Math.min(40/art.width,40/art.height);ctx.drawImage(art,x,bounds.y+8,art.width*factor,art.height*factor);}
    }
    ctx.restore();
  }
  updateCarEditorPreviewPlaytest() {}
  updateCarEditorPreviewSelectHold() {return false;}
  ensureCarEditorPreviewPlaytestSession() {return null;}
  updateRaceMapThumbstickPan(dt) {
    const stick=this.portraitThumbstick;
    if(!stick.active){this.stickRepeat=0;return;}
    if(Math.abs(stick.dx)>Math.abs(stick.dy)&&Math.abs(stick.dx)>0.35)this.focusList=stick.dx<0?'stations':'tracks';
    else if(Math.abs(stick.dy)>0.35){this.stickRepeat=(this.stickRepeat||0)-dt;if(this.stickRepeat<=0){this.navigate(stick.dy<0?-1:1);this.stickRepeat=0.18;}}
  }
  navigate(direction) {
    const list=this.focusList==='stations'?this.library.stations:this.visibleTracks;
    if(!list.length)return;
    const current=this.focusList==='stations'?this.stationId:this.trackId,index=list.findIndex(item=>item.id===current);
    const next=list[(index+direction+list.length)%list.length];
    if(this.focusList==='stations')this.selectStation(next.id);else this.selectTrack(next.id);
    this.menuScrollState[`radio:${this.focusList}`]=Math.max(0,((index+direction+list.length)%list.length));
  }
  cancel() {
    if(this.transportPopover){this.closeTransportPopover();return;}
    if(this.desktopDropdown){this.closeEditorMenus();return;}
    if(this.gamepadSubmenuOpen){this.gamepadSubmenuOpen=false;this.mobileRootOpen=true;return;}
    if(this.mobileRootOpen){this.mobileRootOpen=false;return;}
    this.exitToMainMenu();
  }
  update(input,dt) {
    if(this.opened)return;
    this.preview.setVolume(this.game.audio?.midiBusVolume??0.8);
    if(this.cueSession){
      this.cueSession.countdownRemainingMs=Math.max(0,this.cueSession.countdownRemainingMs-dt*1000);
      this.cueDirector.update(this.cueSession,{dt});
      if(!this.cueSession.raceResults)this.status=this.cueSession.countdownRemainingMs>1000?'Race start in '+Math.ceil((this.cueSession.countdownRemainingMs-1000)/1000):'GO — start drop';
    }
    this.updateRaceMapThumbstickPan(dt);
    const cmd=['ControlLeft','ControlRight','MetaLeft','MetaRight'].some(code=>input?.isDownCode?.(code));
    for(const [code,action] of Object.entries({KeyZ:'undo',KeyY:'redo',KeyS:'save'}))if(input?.wasCommandPressedCode?.(code)||(cmd&&input?.wasPressedCode?.(code)))void this.handleMenuAction(action);
    if(input?.wasPressedCode?.('Escape'))this.cancel();
    if(input?.wasPressedCode?.('Space'))void this.handleMenuAction('radio-play');
    if(input?.wasPressedCode?.('ArrowUp'))this.navigate(-1);
    if(input?.wasPressedCode?.('ArrowDown'))this.navigate(1);
    if(input?.wasPressedCode?.('ArrowLeft'))this.focusList='stations';
    if(input?.wasPressedCode?.('ArrowRight'))this.focusList='tracks';
    if(input?.wasPressedCode?.('Enter'))void this.handleMenuAction(this.focusList==='stations'?'station-properties':'track-properties');
    const pad=this.radioInput.updateGamepad(input,dt,{includePanIntent:true}),roots=getEditorControllerRootMenuEntries(this.editorId);
    const panAllowed=!this.mobileRootOpen&&!this.gamepadSubmenuOpen;
    const navX=pad.axes.leftX||(panAllowed?pad.axes.rightX:0),navY=pad.axes.leftY||(panAllowed?pad.axes.rightY:0);
    const stick=Math.abs(navX)>Math.abs(navY)?(Math.abs(navX)>0.5?(navX<0?INPUT.NAV_LEFT:INPUT.NAV_RIGHT):null):(Math.abs(navY)>0.5?(navY<0?INPUT.NAV_UP:INPUT.NAV_DOWN):null);
    if(!stick){this.padStickDirection=null;this.padStickRepeat=0;}
    else {this.padStickRepeat=(this.padStickRepeat||0)-dt;if(stick!==this.padStickDirection||this.padStickRepeat<=0){pad.actions.push({type:stick});this.padStickDirection=stick;this.padStickRepeat=0.2;}}
    for(const action of pad.actions){
      if(action.type===INPUT.MENU){this.mobileRootOpen=!this.mobileRootOpen;this.gamepadSubmenuOpen=false;this.activeRootId=roots[0]?.id;this.gamepadFocusedItemId=this.activeRootId;}
      else if(action.type===INPUT.CANCEL)this.cancel();
      else if(action.type===INPUT.FOCUS_TOGGLE){this.focusList=this.focusList==='stations'?'tracks':'stations';}
      else if(action.type===INPUT.PANEL_PREV||action.type===INPUT.PANEL_NEXT){
        const index=Math.max(0,roots.findIndex(root=>root.id===this.activeRootId)),step=action.type===INPUT.PANEL_PREV?-1:1;
        this.activeRootId=roots[(index+step+roots.length)%roots.length].id;
        this.gamepadFocusedItemId=this.mobileRootOpen?this.activeRootId:this.getMenuItems(this.activeRootId)[0]?.id;
      }
      else if(action.type===INPUT.UNDO)void this.handleMenuAction('undo');
      else if(action.type===INPUT.REDO)void this.handleMenuAction('redo');
      else if(this.mobileRootOpen||this.gamepadSubmenuOpen){
        const entries=this.mobileRootOpen?roots:this.getMenuItems(this.activeRootId);let index=Math.max(0,entries.findIndex(e=>e.id===this.gamepadFocusedItemId));
        if([INPUT.NAV_UP,INPUT.NAV_LEFT,INPUT.NAV_DOWN,INPUT.NAV_RIGHT].includes(action.type)){index=(index+([INPUT.NAV_UP,INPUT.NAV_LEFT].includes(action.type)?-1:1)+entries.length)%entries.length;this.gamepadFocusedItemId=entries[index]?.id;}
        if(action.type===INPUT.CONFIRM&&entries[index]){if(this.mobileRootOpen){this.activeRootId=entries[index].id;this.mobileRootOpen=false;this.gamepadSubmenuOpen=true;this.gamepadFocusedItemId=this.getMenuItems(this.activeRootId)[0]?.id;}else void this.handleMenuAction(entries[index].id);}
      }else{
        if(action.type===INPUT.NAV_UP)this.navigate(-1);
        if(action.type===INPUT.NAV_DOWN)this.navigate(1);
        if(action.type===INPUT.NAV_LEFT)this.focusList='stations';
        if(action.type===INPUT.NAV_RIGHT)this.focusList='tracks';
        if(action.type===INPUT.CONFIRM)void this.handleMenuAction(this.focusList==='stations'?'station-properties':'track-properties');
      }
    }
  }
}
