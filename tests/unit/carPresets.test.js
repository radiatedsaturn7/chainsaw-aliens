import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {CAR_PRESETS,createCarFromPreset,isUserRaceCar} from '../../src/racing/CarPresets.js';
import {selectEligibleRaceAiCars} from '../../src/racing/CarPerformance.js';
import {selectRaceAiCars} from '../../src/racing/RaceAiDriving.js';
import {listProjectFiles,loadProjectFile,saveProjectFile,resetProjectFilesForTests} from '../../src/ui/projectFiles.js';

test('sports presets are independent native car documents with calibrated drivetrains',()=>{
 for(const preset of CAR_PRESETS){
  const document=JSON.parse(readFileSync(new URL(`../../data/system/car-presets/${preset.id}.json`,import.meta.url)));
  assert.equal(document.kind,'race-car');assert.equal(document.systemFile,true);
  const car=createCarFromPreset(preset.id);
  assert.equal(car.name,preset.label);assert.equal(car.tuning.drivetrain,preset.id);
  assert.ok(car.tuning.powerHp>100);assert.ok(car.dimensions.wheelbaseM>2);
  car.transmissions.manual.gearRatios[0]=999;car.art.turnFrames.left='changed';
  assert.notEqual(createCarFromPreset(preset.id).transmissions.manual.gearRatios[0],999);
  assert.equal(createCarFromPreset(preset.id).art.turnFrames.left,null);
 }
});

test('loading a preset replaces the editor draft without writing files or modifying the opened car',()=>{
 resetProjectFilesForTests();
 const e=new RaceEditor({}, {mode:'car'});
 e.applyLoadedCarDocument(createCarFromPreset('awd'),{name:'My Existing Car'});
 const prior=structuredClone(e.selectedCar),priorId=e.project.selectedCarId;
 e.loadCarPreset('rwd');
 assert.equal(e.selectedCar.tuning.drivetrain,'rwd');assert.equal(e.currentCarDocumentName,'');
 assert.deepEqual(e.findRaceProjectCarById(priorId),prior);
 assert.deepEqual(listProjectFiles('cars'),[]);
 e.selectedCar.tuning.powerHp=900;e.loadCarPreset('rwd');
 assert.notEqual(e.selectedCar.tuning.powerHp,900);
 assert.deepEqual(e.getSavedRaceCarEntriesForPlaytest(),[]);
 assert.deepEqual(selectRaceAiCars(e.project.cars.filter(c=>c.__playtestId!==priorId),5),[]);
});

test('saving a preset creates an ordinary selectable car while system documents remain hidden',()=>{
 resetProjectFilesForTests();
 const e=new RaceEditor({}, {mode:'car'});e.loadCarPreset('fwd');
 const payload=e.serializeSelectedCarDocument();
 assert.equal(payload.car.__editorDraft,undefined);assert.equal(payload.car.systemFile,undefined);
 saveProjectFile('cars','My FWD',payload);
 saveProjectFile('cars','Internal Template',{...payload,systemFile:true});
 assert.deepEqual(listProjectFiles('cars').map(f=>f.name),['My FWD']);
 assert.ok(loadProjectFile('cars','Internal Template'));
 const entries=e.getSavedRaceCarEntriesForPlaytest();assert.equal(entries.length,1);
 assert.equal(entries[0].name,'My FWD');assert.equal(isUserRaceCar(entries[0].car),true);
 assert.equal(selectEligibleRaceAiCars([...e.project.cars,entries[0].car],3).length,3);
 assert.deepEqual(selectEligibleRaceAiCars(e.project.cars,3,{selection:{defaultCarId:'starter-rwd'}}),[]);
 resetProjectFilesForTests();
});
