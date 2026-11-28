import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';

function fixture(name, assisted, automatic=true) {
  const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
  const doc=JSON.parse(readFileSync(new URL(`../../data/server-storage/files/cars/${name}/document.json`,import.meta.url)));
  const car=editor.normalizeLoadedCarDocument(doc);
  editor.project.cars=[car];editor.project.selectedCarId=car.id;
  editor.raceInput.transmissionMode=automatic?'automatic':'manual';
  editor.startPlaytest(car.id);
  const session=editor.playtestSession;
  session.countdownRemainingMs=0;session.launchLockMs=0;session.elapsedMs=1000;
  editor.raceInput.brakeAssistEnabled=assisted;
  editor.raceInput.digitalThrottleMode=assisted?'on':'off';
  editor.raceInput.absEnabled=assisted;session.absEnabled=assisted;
  session.tractionControlEnabled=assisted;
  return editor;
}
function holdBrake(editor,frames=90) {
  editor.raceInput.activeBrakePointerId='reverse-test';editor.raceInput.rawBrakeAxis=1;
  const tuning=editor.getRaceCarTuning(editor.getRaceSessionCar());
  for(let i=0;i<frames;i++) {
    editor.updateRacePedalAxes(1/60,{tuning});editor.updatePlaytest(1/60);
  }
}
for(const name of ['Field Forgetmenot 2004','RTG-001','CT-86','BUSE-019','PZ-24','2005 Flint Coupe','2018 Kestrel 660','Alkanet 2015']) {
  for(const assisted of [false,true]) test(`${name}: automatic brake-to-reverse, adaptive pedals/ABS/TC ${assisted?'on':'off'}`,()=>{
    const e=fixture(name,assisted);
    assert.equal(e.getRaceSessionCar().id,e.selectedCar.id);
    assert.equal(e.raceInput.autoShift,true);
    holdBrake(e);
    assert.equal(e.raceInput.gear,-1);
    assert.ok(e.playtestSession.speedMps<-.5,`reverse speed ${e.playtestSession.speedMps}`);
    e.raceInput.activeBrakePointerId=null;e.raceInput.rawBrakeAxis=0;
    e.raceInput.activeThrottlePointerId='forward-test';e.raceInput.rawThrottleAxis=1;
    for(let i=0;i<20;i++) {
      e.updateRacePedalAxes(1/60,{tuning:e.getRaceCarTuning(e.getRaceSessionCar())});e.updatePlaytest(1/60);
    }
    assert.equal(e.raceInput.gear,1);
  });
}
test('manual driving mode does not turn the brake pedal into reverse throttle',()=>{
  const e=fixture('Field Forgetmenot 2004',true,false);
  holdBrake(e,45);
  assert.equal(e.raceInput.autoShift,false);
  assert.equal(e.raceInput.gear,1);
  assert.ok(Math.abs(e.playtestSession.speedMps)<.5);
});
