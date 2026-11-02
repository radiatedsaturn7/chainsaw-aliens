import test from 'node:test';
import assert from 'node:assert/strict';
import {pidCollections} from './fixtures/pidDescriptor.js';
import {PID,parsePidLayout,buildReport,unpackReport,forceToRaw,selectorValue} from '../../src/hardware/wheels/vendor/PidDescriptor.js';
import {inspectPidDevice,PidWheelDriver,EFFECT_DURATION_MS} from '../../src/hardware/wheels/PidWheelDriver.js';
import {calibratedSteering,calibratedPedal,WheelInput,normalizeWheelSettings} from '../../src/hardware/wheels/WheelInput.js';
import {WheelForceModel,readWheelTelemetry} from '../../src/hardware/wheels/WheelTelemetry.js';
import {WheelService} from '../../src/hardware/wheels/WheelService.js';
import {MockWheelDriver} from '../../src/hardware/wheels/MockWheelDriver.js';
function device(collections=pidCollections()){
 const log=[],layout=parsePidLayout(collections);
 return {collections,log,opened:true,productName:'Mock PID fixture',vendorId:123,productId:456,
  async open(){this.opened=true;},async close(){this.opened=false;},
  async sendReport(id,data){log.push({id,data:[...data],kind:'output'});},async sendFeatureReport(id,data){log.push({id,data:[...data],kind:'feature'});},
  async receiveFeatureReport(){const r=buildReport(layout.blockLoad,{[PID.EFFECT_BLOCK_INDEX]:3,[PID.BLOCK_LOAD_STATUS]:1});return new DataView(r.data.buffer);}};
}
const flush=()=>new Promise(r=>setImmediate(r));
test('descriptor discovery and signed encoding adapted from LibreCorsa fixtures',()=>{
 const l=parsePidLayout(pidCollections({nested:true}));assert.equal(l.constantForce.reportId,5);assert.equal(l.effectOperation.reportId,10);
 const r=buildReport(l.constantForce,{[PID.EFFECT_BLOCK_INDEX]:3,[PID.MAGNITUDE]:-10000});assert.deepEqual([...r.data],[3,0xf0,0xd8]);
 assert.equal(unpackReport(l.constantForce,r.data)[PID.MAGNITUDE],-10000);
 assert.equal(forceToRaw(l.constantForce.fields[PID.MAGNITUDE],NaN),0);
 assert.equal(forceToRaw(l.constantForce.fields[PID.MAGNITUDE],100),10000);
 assert.equal(inspectPidDevice(device()).forceFeedback,true);
 assert.equal(inspectPidDevice(device([])).forceFeedback,false);
 assert.equal(inspectPidDevice(device(pidCollections({noCreateNewEffect:true}))).forceFeedback,false);
 const unsigned=pidCollections({magnitude:{usages:[PID.MAGNITUDE],reportSize:8,reportCount:1,logicalMinimum:0,logicalMaximum:255}});
 assert.equal(inspectPidDevice(device(unsigned)).forceFeedback,false);
});
test('no output before explicit initialization; finite duration, single loop and torque clipping',async()=>{
 const d=device(),driver=new PidWheelDriver(d);await driver.write(.2);assert.equal(d.log.length,0);
 await driver.initialize();assert.equal(driver.armed,true);
 const l=driver.capabilities.layout;
 const set=d.log.find(x=>x.id===l.setEffect.reportId);assert.equal(unpackReport(l.setEffect,new Uint8Array(set.data))[PID.DURATION],EFFECT_DURATION_MS);
 await driver.write(10);
 const force=d.log.filter(x=>x.id===5).at(-1);assert.equal(unpackReport(l.constantForce,new Uint8Array(force.data))[PID.MAGNITUDE],-3500);
 const op=d.log.filter(x=>x.id===10).at(-1);assert.equal(unpackReport(l.effectOperation,new Uint8Array(op.data))[PID.LOOP_COUNT],1);
 await driver.stop();assert.equal(driver.armed,false);const n=d.log.length;await driver.write(.1);assert.equal(d.log.length,n);
});
test('stop during an in-flight magnitude write prevents a subsequent start command',async()=>{
 const d=device(),driver=new PidWheelDriver(d);await driver.initialize();d.log.length=0;
 let release;d.sendReport=async(id,data)=>{d.log.push({id,data:[...data]});if(id===5&&!release)await new Promise(r=>{release=r;});};
 const sending=driver.write(.2),stopping=driver.stop();release();await sending;await stopping;
 const l=driver.capabilities.layout,starts=d.log.filter(x=>x.id===10).map(x=>unpackReport(l.effectOperation,new Uint8Array(x.data))[PID.EFFECT_OPERATION]);
 assert.ok(!starts.includes(selectorValue(l.effectOperation.fields[PID.EFFECT_OPERATION],PID.OP_EFFECT_START)));
});
test('failed allocation never arms; transport failure shuts down without throwing to game',async()=>{
 const d=device();d.receiveFeatureReport=async()=>new DataView(new Uint8Array([0]).buffer);
 const a=new PidWheelDriver(d);await assert.rejects(()=>a.initialize(),/response/);assert.equal(a.armed,false);
 const b=device(),driver=new PidWheelDriver(b);await driver.initialize();b.sendReport=async()=>{throw Error('gone');};await driver.write(.1);assert.equal(driver.armed,false);assert.match(driver.error,/gone/);
});
test('calibration supports asymmetric/reversed steering and pedals with graceful missing-input fallback',()=>{
 const s=normalizeWheelSettings({rotation:900,gameRotation:900,deadzone:0});
 const b={left:1,center:.1,right:-1};assert.equal(calibratedSteering(1,b,s),-1);assert.equal(calibratedSteering(-1,b,s),1);assert.equal(calibratedSteering(.1,b,s),0);
 assert.equal(calibratedSteering(.1,{left:0,center:0,right:0},s),null);
 assert.equal(calibratedPedal(-1,{idle:1,full:-1}),1);assert.equal(calibratedPedal(0,{idle:1,full:-1}),.5);
 const pad={index:0,id:'Wheel',connected:true,axes:[0],buttons:[]};const input=new WheelInput({getGamepads:()=>[pad]});
 s.enabled=true;s.steer={channel:input.channels()[0].key,left:-1,center:0,right:1};assert.equal(input.read(s).steer,0);
 pad.connected=false;assert.equal(input.read(s),null);
});
test('physics force uses tire moment, clips, goes lighter with lost aligning torque and rejects invalid data',()=>{
 const m=new WheelForceModel(),settings=normalizeWheelSettings({strength:1,limit:.2,smoothing:.01});
 const t={aligning:150,speed:20,load:6000,compression:[0,0],reset:0};let result=m.calculate(t,settings,.1);assert.ok(result.torque<0&&result.torque>=-.2);assert.equal(result.clipped,true);
 const before=Math.abs(result.torque);result=m.calculate({...t,aligning:0},settings,.1);assert.ok(Math.abs(result.torque)<before);
 assert.equal(m.calculate({...t,aligning:NaN},settings,.02).torque,0);
 assert.equal(readWheelTelemetry({speedMps:NaN}),null);
});
test('unsupported browser is safe; stale telemetry, disconnect and focus loss disarm mock output',async()=>{
 let now=0;const events={};const pad={index:0,id:'Wheel',connected:true,axes:[.4],buttons:[]};
 const service=new WheelService({navigator:{getGamepads:()=>[pad]},now:()=>now,window:{addEventListener:(name,fn)=>events[name]=fn},document:null,setTimer:()=>1,clearTimer(){}});
 assert.equal(service.supported(),false);await assert.rejects(()=>service.connect(),/WebHID unavailable/);
 service.settings=normalizeWheelSettings({enabled:true});service.settings.steer={channel:service.input.channels()[0].key,left:-1,center:0,right:1};
 await service.mock();service.readInput();await service.arm();
 const session={speedMps:20,vehicleDynamicsRunner:{stepIndex:1,state:{contactPatches:{fl:{selfAligningMomentNm:30,normalLoadN:3000},fr:{selfAligningMomentNm:30,normalLoadN:3000}}}}};
 service.update(session,true);service.tick();assert.ok(service.driver.samples.at(-1)<0);
 now=101;service.tick();await flush();assert.equal(service.enabled,false);assert.equal(service.driver.samples.at(-1),0);
 await service.arm();events.blur();await flush();assert.equal(service.enabled,false);
 events.focus();await service.arm();pad.connected=false;service.active=true;service.tick();await flush();assert.equal(service.enabled,false);
 await service.dispose();
});

test('reject duration units we cannot safely interpret, absent disable and out-of-range allocation',async()=>{
 const cols=pidCollections();cols[1].outputReports[0].items[2].unitExponent=0;
 assert.equal(inspectPidDevice(device(cols)).forceFeedback,false);
 const noDisable=pidCollections();noDisable[1].outputReports=noDisable[1].outputReports.filter(r=>r.reportId!==12);
 assert.equal(inspectPidDevice(device(noDisable)).forceFeedback,false);
 const d=device();d.receiveFeatureReport=async()=>new DataView(new Uint8Array([255,1,0,0]).buffer);
 const driver=new PidWheelDriver(d);await assert.rejects(()=>driver.initialize(),/out of range/);assert.equal(driver.armed,false);
});
test('HID input descriptors decode steering independently of feedback capability; disconnect removes values',()=>{
 let handler;const d=device();d.addEventListener=(_name,fn)=>{handler=fn;};d.removeEventListener=()=>{};
 const input=new WheelInput({});input.addHid(d);const channel=input.channels().find(c=>!c.button);assert.ok(channel);assert.equal(channel.value,null);
 handler({reportId:2,data:new DataView(new Uint8Array([255,255]).buffer)});
 assert.equal(input.channels()[0].value,1);
 const settings=normalizeWheelSettings({enabled:true,steer:{channel:channel.key,left:-1,center:0,right:1}});
 assert.equal(input.read(settings).steer,1);
 input.removeHid(d);assert.equal(input.read(settings),null);
});
test('quiet serializes with output, allows resumed force; disconnect rejects further writes',async()=>{
 const d=device(),driver=new PidWheelDriver(d);await driver.initialize();
 await driver.write(.1);await driver.quiet();assert.equal(driver.armed,true);
 await driver.write(.15);driver.disconnect();const count=d.log.length;await driver.write(.1);assert.equal(d.log.length,count);
});
test('missing or stalled device operations time out and never leave software armed',async()=>{
 const d=device(),driver=new PidWheelDriver(d,{timeoutMs:5});
 d.sendFeatureReport=()=>new Promise(()=>{});await assert.rejects(()=>driver.initialize(),/timed out/);assert.equal(driver.armed,false);
});
test('connect requests permission before awaiting, sends no forces, and disconnect notification disarms',async()=>{
 const d=device();let requested=false,disconnect;
 const hid={requestDevice(){requested=true;return Promise.resolve([d]);},addEventListener:(name,fn)=>{disconnect=fn;},removeEventListener(){}};
 const service=new WheelService({navigator:{hid},window:null,document:null});
 const pending=service.connect();assert.equal(requested,true);await pending;
 assert.equal(d.log.length,0);assert.equal(service.driver.armed,false);
 disconnect({device:d});assert.equal(service.enabled,false);assert.equal(service.driver,null);
 await service.dispose();
});
test('mock can inspect physics with keyboard/touch and no wheel connected; inactive frames are quiet',async()=>{
 let now=0;const service=new WheelService({navigator:{},window:null,document:null,now:()=>now,setTimer:()=>1,clearTimer(){}});
 await service.mock();await service.arm();service.update(null,false);service.tick();assert.equal(service.enabled,true);
 const session={speedMps:10,vehicleDynamicsRunner:{stepIndex:1,state:{contactPatches:{fl:{selfAligningMomentNm:20,normalLoadN:1000},fr:{selfAligningMomentNm:20,normalLoadN:1000}}}}};
 service.update(session,true);service.tick();assert.ok(service.driver.samples.at(-1)<0);
 service.update(session,false);await flush();assert.equal(service.driver.samples.at(-1),0);assert.equal(service.enabled,true);
 now=200;service.update(session,true);service.tick();await flush();assert.equal(service.enabled,false);
 await service.dispose();
});
test('wheel race adapter preserves keyboard/touch overrides and releases disconnected clutch/handbrake',async()=>{
 const {applyWheelRaceInput}=await import('../../src/hardware/wheels/applyWheelRaceInput.js');
 const frame={steer:.7,throttle:.3,brake:.2,clutch:.5,held:{handbrake:true},pressed:{upshift:true}};
 let shifts=0;const editor={raceInput:{rawThrottleAxis:1,rawBrakeAxis:0,keyboardSteer:-1},game:{wheelService:{frame}},shiftRaceGear:n=>shifts+=n};
 applyWheelRaceInput(editor);assert.equal(editor.raceInput.wheelSteeringActive,false);assert.equal(editor.raceInput.rawThrottleAxis,1);assert.equal(shifts,1);
 editor.raceInput.keyboardSteer=0;applyWheelRaceInput(editor);assert.equal(editor.raceInput.analogSteeringIntent,.7);assert.equal(shifts,1);
 editor.game.wheelService.frame=null;applyWheelRaceInput(editor);assert.equal(editor.raceInput.clutchAxis,0);assert.equal(editor.raceInput.handbrake,false);
});
test('gamepad filtering leaves a second controller available and does not change default bindings',async()=>{
 const {default:Input}=await import('../../src/game/Input.js');
 const originalNavigator=globalThis.navigator;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>[
  {index:0,id:'Wheel',connected:true,mapping:'',axes:[1],buttons:[]},
  {index:1,id:'Backbone',connected:true,mapping:'standard',axes:[.3,0,0,0],buttons:[]}]}});
 try{
  const input=Object.create(Input.prototype);Object.assign(input,{gamepadIndex:0,gamepadAvailable:true,gamepadPressed:new Set(),gamepadReleased:new Set(),gamepadPrevActions:{},wheelPadIndices:()=>new Set([0]),gamepadDeadzone:.3});
  input.updateGamepad();assert.equal(input.gamepadIndex,1);assert.equal(input.gamepadAxes.leftX,.3);
  input.wheelPadIndices=null;input.gamepadIndex=0;input.updateGamepad();assert.equal(input.gamepadAxes.leftX,1);
 }finally{Object.defineProperty(globalThis,'navigator',{configurable:true,value:originalNavigator});}
});

test('physical output disarms if a calibrated input disappears, even while paused',async()=>{
 const pad={index:0,id:'Wheel',connected:true,axes:[0],buttons:[]};
 const service=new WheelService({navigator:{getGamepads:()=>[pad]},window:null,document:null,setTimer:()=>1,clearTimer(){}});
 service.settings=normalizeWheelSettings({enabled:true});service.settings.steer={channel:service.input.channels()[0].key,left:-1,center:0,right:1};
 service.driver=new PidWheelDriver(device());service.readInput();await service.arm();service.pause();
 pad.connected=false;service.tick();await flush();assert.equal(service.enabled,false);assert.equal(service.driver.armed,false);
 await service.dispose();
});
test('malformed HID input report invalidates its channels instead of holding an old throttle',()=>{
 let handler;const d=device();d.addEventListener=(_name,fn)=>{handler=fn;};d.removeEventListener=()=>{};
 const input=new WheelInput({});input.addHid(d);
 handler({reportId:2,data:new DataView(new Uint8Array([255,255]).buffer)});assert.equal(input.channels()[0].value,1);
 handler({reportId:2,data:new DataView(new Uint8Array([255]).buffer)});assert.equal(input.channels()[0].value,null);
});
test('disable during initialization prevents enabling and starting the actuator',async()=>{
 const d=device(),driver=new PidWheelDriver(d);let release;
 d.sendFeatureReport=async()=>new Promise(r=>{release=r;});
 const initializing=driver.initialize();await flush();assert.equal(typeof release,'function');
 const stopping=driver.stop();release();await assert.rejects(()=>initializing,/cancelled/);await stopping;
 const l=driver.capabilities.layout;
 const controls=d.log.filter(x=>x.id===12).map(x=>unpackReport(l.deviceControl,new Uint8Array(x.data))[PID.DEVICE_CONTROL]);
 assert.ok(!controls.includes(selectorValue(l.deviceControl.fields[PID.DEVICE_CONTROL],PID.DC_ENABLE_ACTUATORS)));
 assert.equal(driver.armed,false);
});
test('wheel form retains calibration numbers, optional controls and distinct button bindings',async()=>{
 const {wheelSettingsFromForm}=await import('../../src/hardware/wheels/WheelSettings.js');
 const settings=wheelSettingsFromForm({enabled:true,rotation:'900',gameRotation:'540',deadzone:'.02',strength:'.5',limit:'.2',smoothing:'.04',steerChannel:'wheel/x',steer_left:'1',steer_center:'.1',steer_right:'-1',brakeChannel:'pedals/y',brake_idle:'1',brake_full:'-1',button_upshift:'wheel/button/3'},normalizeWheelSettings());
 const saved=normalizeWheelSettings(settings);assert.equal(saved.rotation,900);assert.equal(saved.steer.center,.1);assert.equal(saved.brake.full,-1);assert.equal(saved.clutch,null);assert.equal(saved.buttons.upshift,'wheel/button/3');
});
test('suspension asymmetry and directional collision are telemetry-driven, bounded and single event',()=>{
 const model=new WheelForceModel(),s=normalizeWheelSettings({strength:1});
 const t={aligning:0,speed:20,load:6000,compression:[0,0],reset:0,collision:0,impactSequence:0};model.calculate(t,s,.02);
 const changed={...t,compression:[.1,0],collision:.15,impactSequence:1};const hit=model.calculate(changed,s,.02);
 assert.ok(hit.bumps>0&&hit.bumps<=.08);assert.equal(hit.collision,.15);
 const repeated=model.calculate(changed,s,.02);assert.equal(repeated.collision,0);assert.equal(repeated.bumps,0);
});
