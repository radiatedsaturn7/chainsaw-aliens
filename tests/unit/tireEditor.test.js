import test from 'node:test';
import assert from 'node:assert/strict';
import TireEditor from '../../src/ui/TireEditor.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createTireDefinition,applyTireDefinition} from '../../src/racing/raceTires.js';
import {buildRacePortraitMenuModel} from '../../src/ui/RaceEditor.js';

const game={deviceIsMobile:false,isMobile:false};
const context=()=>new Proxy({measureText:value=>({width:String(value).length*7}),createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>k in o?o[k]:()=>{}});

test('tire property changes undo and redo without losing graphics or document identity',()=>{
  const editor=new TireEditor(game),tire=createTireDefinition('dirt');
  tire.graphics.angleLayers={front:{tires:{artRef:'tread',frameIndex:0}}};
  editor.setTire(tire,'My Dirt');
  const next=editor.getTireDocument();next.compound.surfaceGrip.dirt=1.8;next.name='Soft Dirt';
  editor.applyProperties(next);
  assert.equal(editor.getTireDocument().compound.surfaceGrip.dirt,1.8);
  editor.handleMenuAction('undo');
  assert.equal(editor.getTireDocument().compound.surfaceGrip.dirt,tire.compound.surfaceGrip.dirt);
  assert.equal(editor.currentTireDocumentName,'My Dirt');
  editor.handleMenuAction('redo');
  assert.equal(editor.getTireDocument().compound.surfaceGrip.dirt,1.8);
  assert.equal(editor.getTireDocument().graphics.angleLayers.front.tires.artRef,'tread');
});

test('custom tire grip changes the physical wheel grip, without changing another car',()=>{
  const editor=new RaceEditor(game,{mode:'car'}),car=editor.selectedCar;
  const tire=createTireDefinition('dirt');
  applyTireDefinition(car,tire);
  const grip=()=>editor.getRaceWheelGripForSurface({car,surfaceId:'dirt',weather:'clear'});
  const before=grip();tire.compound.surfaceGrip.dirt*=0.5;applyTireDefinition(car,tire);
  assert.ok(Math.abs(grip()-before*0.5)<1e-9);
});

for(const [width,height,mobile] of [[390,844,true],[844,390,true],[1280,800,false]])test(`tire editor draws shared shell and usable controls at ${width}x${height}`,()=>{
  const editor=new TireEditor({...game,isMobile:mobile,deviceIsMobile:mobile});
  editor.draw(context(),width,height);
  for(const id of ['tire-prev','tire-next','tire-select','tire-properties','tire-import']) {
    const button=editor.buttons.find(b=>b.id===id)?.bounds;
    assert.ok(button,`Missing ${id}`);
    assert.ok(button.w>0 && button.h>0,`${id} has no hit area`);
    assert.ok(button.x>=0 && button.y>=0 && button.x+button.w<=width+1 && button.y+button.h<=height+1,`${id} out of bounds`);
  }
  if(width<height)assert.deepEqual(buildRacePortraitMenuModel('tire').bottomRailActions,['menu','undo','redo','tire-properties']);
  assert.equal(editor.getRacePortraitContextAction().id,'tire-properties');
});

test('car tire artwork and import commands open tire selection',async()=>{
  const editor=new RaceEditor(game,{mode:'car'});let selected=0;
  editor.selectCarTire=()=>{selected++;};
  await editor.openCarArtPickerForComponent('tires');
  await editor.importCarGraphic(null,'tires');
  await editor.openCarArtPicker('tires');
  await editor.openCarArtPicker('tire-dirt');
  assert.equal(selected,4);
});

test('tire editor gamepad menus expose the same artwork and property commands',()=>{
  const editor=new TireEditor({...game,isMobile:true,deviceIsMobile:true,input:{isGamepadConnected:()=>true}});
  editor.mobileRootOpen=false;editor.gamepadSubmenuOpen=true;editor.activeRootId='art';
  assert.equal(editor.getGamepadMenuState(844,390).isLandscapeMenuMode,true);
  editor.draw(context(),844,390);
  assert.deepEqual(editor.getMenuItems('art').map(item=>item.id),['tire-select','tire-graphics','tire-import','tire-spin']);
  assert.ok(editor.buttons.some(button=>button.id==='tire-properties'));
});

test('opening a saved tire hydrates every referenced artwork before selection finishes',async()=>{
  const {loadSavedTire}=await import('../../src/ui/TireLibrary.js');
  const {clearCachedProjectFilesForTests}=await import('../../src/ui/serverStorage.js');
  const {resetProjectFilesForTests,loadProjectFile}=await import('../../src/ui/projectFiles.js');
  clearCachedProjectFilesForTests();resetProjectFilesForTests();
  const tire=createTireDefinition('dirt');
  tire.graphics.tireSurfaces={tread:{artRef:'Hydrate Tread',frameIndex:0},wheel:{artRef:'Hydrate Rim',frameIndex:0}};
  tire.graphics.angleLayers={front:{tires:{artRef:'Hydrate Tread',frameIndex:0}}};
  const previousFetch=globalThis.fetch,requests=[];
  globalThis.fetch=async url=>{
    const params=new URL(url,'http://localhost').searchParams,folder=params.get('folder'),name=params.get('name');
    requests.push(`${folder}/${name}`);
    return {ok:true,json:async()=>({ok:true,file:{folder,name,data:folder==='tires'?tire:{width:1,height:1,frames:[['#ffffff']]}}})};
  };
  try{
    const loaded=await loadSavedTire('Hydration Test');
    assert.equal(loaded.baseCompound,'dirt');
    assert.deepEqual(requests.sort(),['art/Hydrate Rim','art/Hydrate Tread','tires/Hydration Test']);
    assert.ok(loadProjectFile('art','Hydrate Rim').data.frames.length);
  }finally{globalThis.fetch=previousFetch;clearCachedProjectFilesForTests();resetProjectFilesForTests();}
});

test('player and AI physics receive their own saved tire compounds',async()=>{
  const {updateRaceAiVehiclePhysics}=await import('../../src/racing/RaceAiSimulation.js');
  const editor=new RaceEditor(game);
  editor.preloadSelectedRaceArtRefs=()=>{};editor.prewarmRacePlaytestRenderResources=()=>{};
  editor.selectedRace.road.segments=[{length:1600,curve:0,elevation:0,surface:'dirt',turn:'smooth',hazardIds:[]}];
  const playerCar=editor.selectedCar,aiCar=editor.project.cars.find(car=>car.id!==playerCar.id);
  const playerTire=createTireDefinition('dirt'),aiTire=createTireDefinition('dirt');
  playerTire.compound.surfaceGrip.dirt=1.35;aiTire.compound.surfaceGrip.dirt=0.55;
  applyTireDefinition(playerCar,playerTire);applyTireDefinition(aiCar,aiTire);
  editor.selectedRace.competition={mode:'ai-race',aiDrivers:[{id:'custom-tires-ai',carId:aiCar.id,difficulty:'easy',skill:1,enabled:true}]};
  editor.startPlaytest(playerCar.id,{hydrateCars:false});
  const ai=editor.playtestSession.aiRuntime[0];
  // The race grid shuffles car models; pin this fixture before its first step.
  ai.carId=aiCar.id;
  editor.updatePlaytest(1/60);
  updateRaceAiVehiclePhysics(editor,ai,{car:aiCar,seconds:1/60});
  assert.equal(editor.vehicleDynamicsAuthority.tireConfigByWheel.fl.compound.surfaceGrip.dirt,1.35);
  assert.equal(ai.tireConfigByWheel.fl.compound.surfaceGrip.dirt,0.55);
});

test('applying Offroad updates the car and preview, preserves placement, and identifies the tire',()=>{
  const editor=new RaceEditor(game,{mode:'car'}),car=editor.selectedCar;
  car.art.angleLayers={front:{tires:{transforms:{tireScaleX:1.7,frontTireOffsetX:2}}}};
  editor.carEditorPreviewPlaytest={carId:car.id,session:{runtimeCar:structuredClone(car)}};
  const tire=createTireDefinition('offroad');
  tire.graphics.angleLayers={front:{tires:{artRef:'Offroad art',frameIndex:0,cylinder:true}}};
  tire.graphics.tireSurfaces={tread:{artRef:'Offroad art',frameIndex:0},wheel:{artRef:'Offroad art',frameIndex:2}};
  editor.applySelectedCarTire(tire,'Offroad');
  assert.equal(editor.getSelectedCarTireLabel(),'Offroad');assert.match(editor.status,/Applied Offroad/);
  assert.equal(car.setup.tireDefinition.ref,'Offroad');
  assert.equal(car.art.angleLayers.front.tires.transforms.tireScaleX,1.7);
  assert.equal(car.art.angleLayers.front.tires.transforms.frontTireOffsetX,2);
  assert.equal(editor.carEditorPreviewPlaytest.session.runtimeCar.art.tireSurfaces.tread.artRef,'Offroad art');
  assert.equal(editor.carEditorPreviewPendingTuningRevision,editor.getCarEditorPreviewTuningRevision(car));
  const saved=editor.normalizeLoadedCarDocument(editor.serializeSelectedCarDocument().car);
  assert.equal(saved.setup.tireDefinition.ref,'Offroad');assert.equal(saved.art.tireSurfaces.wheel.frameIndex,2);
});
