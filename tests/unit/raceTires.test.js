import test from 'node:test';
import assert from 'node:assert/strict';
import { createTireDefinition, normalizeTireDefinition, applyTireDefinition } from '../../src/racing/raceTires.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import { saveProjectFile, loadProjectFile } from '../../src/ui/projectFiles.js';

test('saved tire documents round trip all physical properties and graphic regions',()=>{
  const tire=createTireDefinition('dirt');tire.name='Custom Dirt';tire.compound.surfaceGrip.dirt=1.7;
  tire.compound.wetEvacuationFactor=1.9;tire.compound.treadDepthMm=12;tire.compound.wearRate=0.8;
  tire.graphics.tireSurfaces={tread:{artRef:'tire-art',frameIndex:0,bounds:{x:1,y:2,width:20,height:40}},wheel:{artRef:'tire-art',frameIndex:2}};
  saveProjectFile('tires','Test Custom Dirt',tire);
  const loaded=normalizeTireDefinition(loadProjectFile('tires','Test Custom Dirt').data);
  assert.equal(loaded.compound.surfaceGrip.dirt,1.7);assert.equal(loaded.compound.treadDepthMm,12);
  assert.deepEqual(loaded.graphics.tireSurfaces,tire.graphics.tireSurfaces);
});

test('selecting a tire applies physics to that car and preserves its graphic transforms',()=>{
  const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
  const car=editor.selectedCar, tire=createTireDefinition('dirt');
  tire.compound.surfaceGrip.dirt=1.85;tire.compound.surfaceGrip['wet-gravel']=1.4;tire.compound.wearRate=0.8;
  tire.graphics.angleLayers={front:{tires:{artRef:'new-tire',frameIndex:0}}};
  car.art.angleLayers={front:{tires:{artRef:'old',transforms:{tireScaleX:2,frontTireOffsetY:3}}}};
  const original=createTireDefinition('dirt');
  applyTireDefinition(car,tire,'Dirt Special');
  assert.equal(editor.getRaceTireCompound('dirt',car).surfaceGrip.dirt,1.85);
  assert.equal(editor.getRaceTireCompound('dirt',{setup:{}}).surfaceGrip.dirt,original.compound.surfaceGrip.dirt);
  assert.equal(editor.getRaceTireWearMultiplier(car),0.8);
  assert.equal(car.art.angleLayers.front.tires.transforms.tireScaleX,2);
  assert.equal(car.art.angleLayers.front.tires.artRef,'new-tire');
  const loaded=editor.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(editor.serializeSelectedCarDocument())).car);
  assert.equal(loaded.setup.tireDefinition.ref,'Dirt Special');
  assert.equal(editor.getRaceTireCompound('dirt',loaded).surfaceGrip['wet-gravel'],1.4);
  tire.compound.surfaceGrip.dirt=0.1;
  assert.equal(editor.getRaceTireCompound('dirt',car).surfaceGrip.dirt,1.85);
});
