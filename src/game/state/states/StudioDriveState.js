import RaceEditor from '../../../ui/RaceEditor.js';
import {createDefaultRaceProject} from '../../../racing/raceData.js';
import {resolveEditorViewportModeFlags} from '../../../ui/shared/editorMenuLayout.js';
import {modelAssets} from '../../../model3d/ModelAssets.js';

class StudioRaceEditor extends RaceEditor {
 isEditorPreviewPlaytestSession(session=this.playtestSession) {
  return !session?.studioDrive && super.isEditorPreviewPlaytestSession(session);
 }
 draw(ctx,width,height){
  if(!this.playtestSession?.studioDrive)return super.draw(ctx,width,height);
  this.raceEditorViewportSize={width,height};this.buttons=[];this.menuScrollRegions=[];
  this.syncRacePhysicalGamepad();
  const mobile=Boolean(this.game.deviceIsMobile||this.game.isMobile||globalThis.navigator?.maxTouchPoints>0);
  this.activeViewportMode=resolveEditorViewportModeFlags({editorId:'race',viewportWidth:width,viewportHeight:height,isMobile:mobile,
   gamepadConnected:this.hasPhysicalRaceGamepad()}).mode;
  if(mobile&&!this.hasPhysicalRaceGamepad()){
   this.drawMobileRacePlaytest(ctx,width,height);
  }else{
   this.editorBounds={x:0,y:0,w:width,h:height};
   this.drawRacePlaytestFrameSafely(ctx,this.editorBounds);
  }
 }
 // This is automotive validation: use full color irrespective of the user's
 // optional retro display filter, without changing their saved preference.
 drawRaceDisplayModeFilter(){return false;}
 // Stop/finish always return to the design, not the track authoring screen.
 showRaceResults(){if(this.game.studioDrive?.editor===this)finishStudioDrive(this.game);}
}
export function startStudioDrive(game,bundle){
 if(game.state!=='surface-studio'||game.studioDrive)throw Error('Already in a Studio drive');
 const original=game.raceEditor;
 const editor=new StudioRaceEditor(game,{mode:'race'}),project=createDefaultRaceProject(),car=bundle.car.car;
 const releases=[];
 try{
  for(const [ref,doc] of Object.entries(bundle.models))releases.push(modelAssets.adoptTemporary(ref,doc));
  const race=project.races[0];
  race.name='Studio Test Loop';
  race.competition={...race.competition,aiDrivers:[]};
  race.hazards=[];
  race.raceStart={...race.raceStart,countdown:false,rollingStart:false};
  race.weather={...race.weather,type:'clear',intensity:0};
  race.codriver={...race.codriver,enabled:false};
  project.cars=[car];project.races=[race];project.selectedCarId=car.id;project.selectedRaceId=race.id;
  editor.project=project;
  editor.normalizeRaceProjectData();
  game.studioDrive={editor,original,releases};
  game.raceEditor=editor;
  editor.startPlaytest(car.id,{hydrateCars:false,carEditorPreview:true,runtimeCarOverrides:car});
  if(!editor.playtestSession?.running)throw Error(editor.status||'Could not start test drive');
  editor.playtestSession.studioDrive=true;
  editor.playtestSession.activeGhost=null;
  editor.raceInput.driftScoreVisible=false;
  editor.raceInput.raceViewMode='three';
  editor.playtestSession.runtimeCar.art.bodyModel.position=[...car.art.bodyModel.position];
  editor.playtestSession.cameraView='third-person';editor.raceInput.cameraView='third-person';editor.raceInput.autoShift=true;
  game.enterRaceEditor();
  if(typeof document!=='undefined'){
   const button=document.createElement('button');button.id='return-to-car-design';button.type='button';button.textContent='‹ Car Design';
   button.style.cssText='position:fixed;top:max(10px,env(safe-area-inset-top));right:12px;z-index:11999;min-height:44px;padding:0 14px;background:#1b242f;color:white;border:1px solid #75c9b8;border-radius:7px';
   button.onclick=()=>finishStudioDrive(game);document.body.append(button);game.studioDrive.button=button;
  }
  return true;
 }catch(error){
  editor.disposeRaceEditorSessions?.('studio-drive-failed');releases.forEach(release=>release());
  game.raceEditor=original;game.studioDrive=null;
  if(game.state==='race-editor')game.enterSurfaceStudio();
  throw error;
 }
}
export function finishStudioDrive(game){
 const active=game.studioDrive;if(!active)return false;
 game.studioDrive=null;
 try{active.editor.endPlaytest();active.editor.disposeRaceEditorSessions?.('studio-drive-closed');}
 finally{
  active.button?.remove();active.releases.forEach(release=>release());game.raceEditor=active.original;
  game.enterSurfaceStudio();
 }
 return true;
}
