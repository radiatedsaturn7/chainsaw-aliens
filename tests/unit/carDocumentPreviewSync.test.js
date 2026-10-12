import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {loadProjectFile,resetProjectFilesForTests} from '../../src/ui/projectFiles.js';

const makeEditor=()=>new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
function tireArt(e,scale,offset){
  e.selectedCar.art.angleLayers={right:{tires:{artRef:'Saved tire',frameIndex:1,cylinder:false,tireMode:'auto',
    transforms:{tireScaleX:scale,tireScaleY:1.46,tireSpacingScale:1.36,frontTireOffsetX:offset,frontTireOffsetY:-0.75,rearTireOffsetX:-3.32,rearTireOffsetY:7.82}}}};
}

test('reopening the same saved car discards stale preview transforms and pending preparation',()=>{
  const e=makeEditor();e.currentCarDocumentName='Saved Car';tireArt(e,2.12,-14.34);
  const saved=e.serializeSelectedCarDocument();
  e.applyLoadedCarDocument(saved,{name:'Saved Car'});
  tireArt(e,1,0);
  const revision=e.getCarEditorPreviewTuningRevision();
  assert.equal(revision,e.getCarEditorPreviewTuningRevision(saved.car),'placement does not restart physics while dragging');
  e.carEditorPreviewPlaytest={carId:e.selectedCar.id,key:revision,session:{runtimeCar:structuredClone(e.selectedCar)},input:{}};
  e.carEditorPreviewFrameCache={canvas:{},lastRenderMs:100};
  let terminated=false;
  const pending={worker:{terminate(){terminated=true;}},cancelled:false};e.carEditorPreviewPreparation=pending;
  e.applyLoadedCarDocument(saved,{name:'Saved Car'});
  assert.deepEqual(e.selectedCar.art.angleLayers,saved.car.art.angleLayers);
  assert.equal(e.carEditorPreviewPlaytest,null,'loaded artwork must not reuse the old runtime copy');
  assert.equal(e.carEditorPreviewFrameCache,null);
  assert.equal(e.carEditorPreviewPreparation,null);assert.equal(pending.cancelled,true);assert.equal(terminated,true);
});

test('saving snapshots tire data without replacing the car referenced by pending preview preparation',()=>{
  resetProjectFilesForTests();
  try{
    const e=makeEditor();tireArt(e,2.12,-14.34);
    const editingCar=e.selectedCar;
    e.saveSelectedCarToName('Tire Placement A');
    assert.equal(e.selectedCar,editingCar,'save must not detach a preparation callback from the edited car');
    const savedA=loadProjectFile('cars','Tire Placement A').data;
    assert.deepEqual(savedA.car.art.angleLayers,editingCar.art.angleLayers);
    e.selectedCarShellFrameSlot='right';e.setCarArtScaleValue('tire-x',3);
    assert.equal(editingCar.art.angleLayers.right.tires.transforms.tireScaleX,3);
    e.saveSelectedCarToName('Tire Placement B');
    const savedB=loadProjectFile('cars','Tire Placement B').data;
    assert.equal(savedA.car.art.angleLayers.right.tires.transforms.tireScaleX,2.12,'earlier save remains an independent snapshot');
    assert.equal(savedB.car.art.angleLayers.right.tires.transforms.tireScaleX,3);
    e.applyLoadedCarDocument(savedA,{name:'Tire Placement A'});
    assert.equal(e.getCarEditorAngleCar().art.tireScaleX,2.12);
    assert.equal(e.getCarEditorAngleCar().art.frontTireOffsetX,-14.34);
    e.applyLoadedCarDocument(savedB,{name:'Tire Placement B'});
    assert.equal(e.getCarEditorAngleCar().art.tireScaleX,3);
  }finally{resetProjectFilesForTests();}
});

for (const prepared of [true, false]) test(`a saved variant preview uses the correct document (prepared: ${prepared})`,()=>{
  const e=makeEditor();
  const original=e.selectedCar;
  const variant=e.withSavedRaceCarRuntimeIdentity(structuredClone(original),'Tire placement variant');
  variant.art.tireScaleX=2.8;
  variant.art.frontTireOffsetX=-7;
  e.upsertRaceProjectCar(variant);
  e.project.selectedCarId=e.getRaceCarProjectIdentity(variant);
  e.currentCarDocumentName='Tire placement variant';
  e.startPlaytest=(id)=>{
    const car=e.findRaceProjectCarById(id);
    e.playtestSession={runtimeCar:structuredClone(car)};
    e.raceInput={};
  };
  e.getCarEditorPreviewRace=()=>e.selectedRace;
  const preview=prepared
    ? e.installPreparedCarEditorPreview({car:variant,previewRace:e.selectedRace,worldBake:{}})
    : e.ensureCarEditorPreviewPlaytestSession();
  assert.equal(preview.session.runtimeCar.__playtestDocumentName,'Tire placement variant');
  assert.equal(preview.carId,e.getRaceCarProjectIdentity(variant));
  e.setCarArtScaleValue('tire-x',3.5);
  assert.equal(preview.session.runtimeCar.art.angleLayers.front.tires.transforms.tireScaleX,3.5);
  e.ensureCarEditorPreviewPlaytestSession=()=>preview;
  e.bindCarEditorPreviewPlaytest(()=>assert.equal(e.selectedCar,variant));
});
