import RaceEditor from './RaceEditor.js';
import { createTireDefinition, normalizeTireDefinition } from '../racing/raceTires.js';
import { drawWheelCylinder } from '../racing/CarWheelCylinder.js';
import { RACE_CAR_SHELL_FRAME_SLOTS } from '../racing/raceData.js';
import { getEditorMenuSpec } from './shared/editorMenuSpec.js';
import { drawSharedDesktopContextPanel } from './uiSuite.js';
import { openTireLibrary, openTireProperties } from './TireLibrary.js';
import { openProjectBrowser } from './ProjectBrowserModal.js';
import { saveProjectFileAndConfirm, sanitizeProjectFileName } from './projectFiles.js';

export default class TireEditor extends RaceEditor {
  constructor(game) {
    super(game,{mode:'car'});
    this.tire=createTireDefinition();this.currentTireDocumentName='';
    this.carArtActiveComponent='tires';this.activeRootId='art';this.activeAction='tire-graphics';
    this.previewSpin=0;this.previewPlaying=true;
    this.setTire(this.tire);
  }
  get editorId(){return 'tire';}
  get title(){return 'Tire Editor';}
  setTire(tire,name='') {
    this.tireUndo=[];this.tireRedo=[];
    this.tire=normalizeTireDefinition(tire);this.currentTireDocumentName=name;
    this.selectedCar.name=this.tire.name;this.selectedCar.art=structuredClone(this.tire.graphics);
    this.selectedCar.setup.defaultTireCompound=this.tire.baseCompound;
    this.selectedCar.setup.tireCompoundByWheel={fl:this.tire.baseCompound,fr:this.tire.baseCompound,rl:this.tire.baseCompound,rr:this.tire.baseCompound};
    this.raceArtSpriteCache?.clear?.();this.racePreparedArtFrames?.clear?.();this.syncCarAnglePreviewArt();
    this.status=name?`Opened ${name}`:`${this.tire.name} template`;
  }
  recordTireChange(before) {
    if(JSON.stringify(before)===JSON.stringify(this.getTireDocument()))return;
    this.tireUndo.push(before);if(this.tireUndo.length>50)this.tireUndo.shift();this.tireRedo=[];
  }
  restoreTireHistory(redo=false) {
    const from=redo?this.tireRedo:this.tireUndo,to=redo?this.tireUndo:this.tireRedo;
    if(!from.length){this.status=redo?'Nothing to redo':'Nothing to undo';return;}
    to.push(this.getTireDocument());const tire=from.pop();
    const undo=this.tireUndo,forward=this.tireRedo;
    this.setTire(tire,this.currentTireDocumentName);this.tireUndo=undo;this.tireRedo=forward;
    this.status=redo?'Tire change restored':'Tire change undone';
  }
  applyProperties(tire) {
    const before=this.getTireDocument();this.tire=normalizeTireDefinition(tire);this.selectedCar.name=this.tire.name;
    this.recordTireChange(before);this.status='Tire properties updated; save to keep changes';
  }
  getTireDocument(){return normalizeTireDefinition({...this.tire,graphics:this.selectedCar.art});}
  async chooseTire(){const picked=await openTireLibrary({currentRef:this.currentTireDocumentName});if(picked)this.setTire(picked.tire,picked.ref.startsWith('builtin:')?'':picked.ref);}
  async saveTire(forceSaveAs=false) {
    let name=this.currentTireDocumentName;
    if(!name||forceSaveAs){
      const picked=await openProjectBrowser({fixedFolder:'tires',initialFolder:'tires',mode:'saveAs',initialName:this.tire.name,title:'Save Tire'});
      if(picked?.action!=='saveAs'||!picked.name)return;name=picked.name;
    }
    return this.saveTireToName(name);
  }
  async saveTireToName(name) {
    const clean=sanitizeProjectFileName(name);if(!clean)throw new Error('Enter a tire name');
    this.status='Saving tire…';
    try {
      const tire=this.getTireDocument();tire.name=clean;tire.compound.label=clean;
      await saveProjectFileAndConfirm('tires',clean,tire,{timeoutMs:60000});
      this.tire=tire;this.selectedCar.name=clean;this.currentTireDocumentName=clean;
      this.status=`Saved ${clean}`;return tire;
    }catch(error){this.status=`Tire save failed: ${error.message}`;throw error;}
  }
  getMenuItems(rootId) {
    const spec=getEditorMenuSpec('tire');
    return (spec.sections[rootId]?.actions||[]).map(id=>({id,label:spec.actions[id].label,disabled:false,onSelect:()=>this.handleMenuAction(id)}));
  }
  isActionAvailable(id){return Boolean(getEditorMenuSpec('tire').actions[id]);}
  getRaceActionLabel(id){return getEditorMenuSpec('tire').actions[id]?.label || super.getRaceActionLabel(id);}
  handleMenuAction(id) {
    this.activeAction=id;
    const run=promise=>Promise.resolve(promise).catch(error=>{this.status=error.message;});
    if(id==='new'){this.setTire(createTireDefinition());return;}
    if(id==='undo'||id==='redo')return this.restoreTireHistory(id==='redo');
    if(id==='open'||id==='import'||id==='tire-select')return run(this.chooseTire());
    if(id==='save'||id==='save-as'||id==='export')return run(this.saveTire(id!=='save'));
    if(id==='tire-import')return run(this.importCarGraphic({lockComponent:'tires'},'tires'));
    if(id==='tire-graphics')return run(this.openCarGraphicPickerForComponent('tires'));
    if(id==='tire-properties')return openTireProperties(this.getTireDocument(),tire=>this.applyProperties(tire));
    if(id==='exit-main')return this.exitToMainMenu();
    if(id==='zoom-fit'){this.previewZoom=1;return;}
    if(id==='tire-spin')this.previewPlaying=!this.previewPlaying;
  }
  async importCarGraphic(initial=null){
    const before=this.getTireDocument();await super.importCarGraphic({...initial,lockComponent:'tires'},'tires');
    this.recordTireChange(before);
    if(JSON.stringify(before)!==JSON.stringify(this.getTireDocument()))this.status='Imported tire graphics. Save the tire to keep changes.';
  }
  async openCarGraphicPickerForComponent(){
    const before=this.getTireDocument();await super.openCarGraphicPickerForComponent('tires');
    // Sheet import records its own change; single-frame selection is recorded here.
    if(JSON.stringify(this.tireUndo.at(-1))!==JSON.stringify(before))this.recordTireChange(before);
    if(JSON.stringify(before)!==JSON.stringify(this.getTireDocument()))this.status='Tire graphics updated. Save the tire to keep changes.';
  }
  openCarArtPickerForComponent(){return this.openCarGraphicPickerForComponent('tires');}
  update(input,dt){super.update(input,dt);if(this.previewPlaying)this.previewSpin+=Math.max(0,Number(dt)||0)*2;}
  updateCarEditorPreviewPlaytest(){}
  updateCarEditorPreviewSelectHold(){return false;}
  ensureCarEditorPreviewPlaytestSession(){return null;}
  exitToMainMenu(){this.game?.exitTireEditor?.();}
  getRacePortraitContextAction(){return {id:'tire-properties',label:'Props',onClick:()=>this.handleMenuAction('tire-properties')};}
  getDesktopContextActions(){return ['tire-select','tire-properties','tire-import'].map(id=>({id,label:this.getRaceActionLabel(id),contextPanelCommand:true,onClick:()=>this.handleMenuAction(id)}));}
  drawDesktopContext(ctx,bounds){drawSharedDesktopContextPanel(ctx,bounds,{title:this.title,lines:[`Tire: ${this.tire.name}`,`Base: ${this.tire.baseCompound}`,`Tread: ${this.tire.compound.treadDepthMm} mm`,`Wear: ${this.tire.compound.wearRate}x`,`Pressure: ${this.tire.pressurePsi} PSI`],contentRoles:['document-summary','active-tool-summary','status'],status:this.status});}
  drawCarEditorWorkSurface(ctx,bounds) {
    this.carArtSliderRegions=[];
    ctx.save();ctx.fillStyle='#15231d';ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);
    ctx.fillStyle='#eef4ed';ctx.font='16px system-ui';ctx.textAlign='center';
    ctx.fillText(this.tire.name,bounds.x+bounds.w/2,bounds.y+24,bounds.w-20);
    const slot=RACE_CAR_SHELL_FRAME_SLOTS.indexOf(this.selectedCarShellFrameSlot||'front');
    const art=this.selectedCar.art,tread=art.tireSurfaces?.tread,wheel=art.tireSurfaces?.wheel;
    const treadCanvas=tread?.artRef?this.getRaceArtSpriteCanvas(tread.artRef,{frameIndex:tread.frameIndex||0}):null;
    const wheelCanvas=wheel?.artRef?this.getRaceArtSpriteCanvas(wheel.artRef,{frameIndex:wheel.frameIndex||0}):null;
    const h=Math.max(24,Math.min(bounds.h-160,bounds.w*0.7));
    ctx.save();ctx.translate(bounds.x+bounds.w/2,bounds.y+45+h/2);
    if(treadCanvas&&wheelCanvas)drawWheelCylinder(ctx,{tread:treadCanvas,wheel:wheelCanvas,treadBounds:tread.bounds,wheelBounds:wheel.bounds,width:h*this.tire.size.widthMm/(this.tire.size.wheelDiameterIn*25.4+2*this.tire.size.widthMm*this.tire.size.aspectRatio/100),height:h,bearing:Math.max(0,slot)*Math.PI/4,spin:this.previewSpin});
    else {
      const entry=this.getCarTireArtEntry(this.getCarEditorAngleCar());
      const canvas=entry?.artRef?this.getRaceArtSpriteCanvas(entry.artRef,{frameIndex:entry.frameIndex||0}):null;
      if(canvas)ctx.drawImage(canvas,-h/2,-h/2,h,h);
      else {ctx.fillStyle='#080b09';ctx.beginPath();ctx.ellipse(0,0,h*0.26,h*0.5,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#86948c';ctx.fillText('Add tire graphics',0,0,bounds.w-24);}
    }
    ctx.restore();
    const y=bounds.y+bounds.h-98,gap=6,w=(bounds.w-24-gap*2)/3;
    [['tire-prev','← 45°',()=>this.cycleCarShellFrameSlot(-1)],['tire-spin',this.previewPlaying?'Pause':'Spin',()=>this.handleMenuAction('tire-spin')],['tire-next','45° →',()=>this.cycleCarShellFrameSlot(1)]].forEach(([id,label,onClick],i)=>this.registerDrawnButton(ctx,{x:bounds.x+12+i*(w+gap),y,w,h:30},{id,label,onClick,formatLabel:false}));
    [['tire-select','Select Tire'],['tire-properties','Properties'],['tire-import','Import Graphic']].forEach(([id,label],i)=>this.registerDrawnButton(ctx,{x:bounds.x+12+i*(w+gap),y:y+36,w,h:34},{id,label,onClick:()=>this.handleMenuAction(id),formatLabel:false}));
    ctx.restore();
  }
}
