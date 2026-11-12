import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceDigitalThrottle,observeDrivingIntent} from '../../src/racing/DigitalThrottle.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const sti={torqueLbFt:664,gearRatios:[2.8,2.1,1.65,1.35,1.12,.95],finalDrive:4,wheelRadiusM:.33755,weightKg:1190,drivetrainEfficiency:.88};
const stock={...sti,torqueLbFt:250,weightKg:1500};
function pedal(seconds,{dt=1/120,...input}={}) {
 let state={};for(let i=0;i<Math.round(seconds/dt);i++)state=advanceDigitalThrottle(state,{mode:'adaptive',raw:1,dt,tuning:sti,...input});return state;
}
test('adaptive pedal grants finer travel to high wheel torque and reaches full demand when held',()=>{
 assert.ok(pedal(.2).output<pedal(.2,{tuning:stock}).output);
 assert.ok(pedal(.2).output<pedal(.2,{gear:6}).output);
 assert.ok(pedal(.2).output<.3);
 assert.equal(pedal(3).output,1);
});
test('pedal ramps are consistent across frame rates and reverse respects reverse gearing',()=>{
 const expected=pedal(.5).output;
 for(const dt of [1/30,1/60,1/120])assert.ok(Math.abs(pedal(.5,{dt}).output-expected)<1e-10);
 assert.equal(pedal(.5,{gear:-1,tuning:{...sti,reverseRatio:2.8}}).output,expected);
});
test('release and braking remove demand quickly; reapplication starts progressively',()=>{
 const full=pedal(3);
 const released=advanceDigitalThrottle(full,{mode:'adaptive',raw:0,dt:.1,tuning:sti});
 assert.equal(released.output,0);
 const braked=advanceDigitalThrottle(full,{mode:'adaptive',raw:1,brake:1,dt:1/60,tuning:sti});
 assert.equal(braked.output,0);
 assert.ok(advanceDigitalThrottle(braked,{mode:'adaptive',raw:1,dt:1/60,tuning:sti}).output<.02);
});
test('off and analog preserve existing input; countdown and launch control retain full requests',()=>{
 for(const extra of [{mode:'off'},{analog:true},{staging:true}]) {
  assert.equal(advanceDigitalThrottle({}, {mode:'adaptive',legacy:.73,raw:1,...extra}).output,.73);
 }
 const staged=advanceDigitalThrottle({}, {mode:'adaptive',raw:1,legacy:1,staging:true});
 assert.equal(advanceDigitalThrottle(staged,{mode:'adaptive',raw:1,launchEnabled:true,dt:1/60,tuning:sti}).output,1);
 assert.ok(advanceDigitalThrottle(staged,{mode:'adaptive',raw:1,launchEnabled:false,dt:1/60,tuning:sti}).output<.02);
});
test('repeated button taps feather low pedal travel without full-throttle impulses',()=>{
 let state={},peak=0;
 for(let i=0;i<240;i++){
  state=advanceDigitalThrottle(state,{mode:'adaptive',raw:i%36<24?1:0,dt:1/120,tuning:sti});
  peak=Math.max(peak,state.output);
 }
 assert.ok(peak>.05&&peak<.3);
});
function observe(input,previous={},seconds=.3){for(let i=0;i<seconds*120;i++)previous=observeDrivingIntent(previous,{dt:1/120,...input});return previous;}
test('sideways motion with throttle alone remains uncertain, not an assumed drift',()=>{
 const input={longitudinalSpeed:15,lateralSpeed:4,steering:-.4,throttle:1};
 const uncertain=observe(input);assert.equal(uncertain.label,'Uncertain slide');
 const entry=observe({...input,handbrake:1});
 const slide=observe(input,entry);assert.equal(slide.label,'Slide likely');
 const recovery=observe({...input,throttle:0},slide);assert.equal(recovery.label,'Recovery');
 assert.equal(observe({...input,lateralSpeed:0,steering:0},recovery).label,'Accelerating');
});
test('intent labels debounce and expire deliberate-slide evidence',()=>{
 const input={longitudinalSpeed:15,lateralSpeed:4,steering:-.4,throttle:1};
 const entry=observe({...input,handbrake:1});
 const slide=observe(input,entry);
 assert.equal(observe({...input,throttle:0},slide,.05).label,'Slide likely');
 assert.equal(observe(input,slide,3).label,'Uncertain slide');
});
test('intent preference never changes digital pedal output',()=>{
 for(const style of ['grip','rally','drift']){
  const intent=observe({style,longitudinalSpeed:15,lateralSpeed:4,throttle:1});
  assert.deepEqual(pedal(.5,{intent,style}),pedal(.5));
 }
});
test('editor integration applies digital modes, preserves analog, and caps debug menus',()=>{
 const e=new RaceEditor({});e.playtestSession={gear:1,speedMps:0};
 e.raceInput.rawThrottleAxis=1;e.raceInput.digitalThrottleMode='adaptive';
 e.updateRacePedalAxes(.1,{tuning:sti});assert.ok(e.raceInput.throttleAxis<.15);
 e.raceInput.analogThrottleActive=true;e.raceInput.rawThrottleAxis=.62;
 e.updateRacePedalAxes(.1,{tuning:sti});assert.equal(e.raceInput.throttleAxis,.62);
 const saved=[];e.saveDrivingPreference=p=>saved.push(p);
 e.cycleRaceDigitalThrottle();assert.equal(e.raceInput.digitalThrottleMode,'off');
 assert.deepEqual(saved.at(-1),{raceDigitalThrottle:'off'});
 for(const mode of ['debug','debug-input']) {e.raceInput.pauseMenuMode=mode;assert.ok(e.getRacePauseMenuRows().length<=8);}
 e.raceInput.pauseMenuMode='debug-input';const before=e.raceInput.throttleAxis;
 e.getRacePauseMenuRows().find(r=>r.id==='race-debug-input-style').onClick();assert.equal(e.raceInput.throttleAxis,before);
});
