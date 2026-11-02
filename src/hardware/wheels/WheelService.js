import {WheelInput,normalizeWheelSettings} from './WheelInput.js';
import {PidWheelDriver} from './PidWheelDriver.js';
import {MockWheelDriver} from './MockWheelDriver.js';
import {readWheelTelemetry,WheelForceModel} from './WheelTelemetry.js';
import {loadServerPreferenceAsync,saveServerPreference} from '../../ui/serverPreferences.js';

export class WheelService {
 constructor({navigator=globalThis.navigator,window=globalThis.window,document=globalThis.document,now=()=>performance.now(),setTimer=setInterval,clearTimer=clearInterval}={}){
  Object.assign(this,{navigator,window,document,now,setTimer,clearTimer});
  this.input=new WheelInput(navigator,now);this.settings=normalizeWheelSettings();this.model=new WheelForceModel();
  this.driver=null;this.status='Disconnected';this.enabled=false;this.active=false;this.frame=null;this.lastFresh=-Infinity;this.revision=0;this.epoch=0;
  this.onBlur=()=>{this.suspended=true;void this.stop('Focus lost — enable feedback again to resume');};
  this.onFocus=()=>{this.suspended=false;};
  this.onVisibility=()=>{if(document.hidden)this.onBlur();};
  this.onDisconnect=e=>{this.input.removeHid(e.device);if(this.driver?.device===e.device){this.driver.disconnect();void this.stop('Wheel disconnected');this.driver=null;}};
  window?.addEventListener?.('blur',this.onBlur);window?.addEventListener?.('focus',this.onFocus);window?.addEventListener?.('pagehide',this.onBlur);
  document?.addEventListener?.('visibilitychange',this.onVisibility);navigator?.hid?.addEventListener?.('disconnect',this.onDisconnect);
 }
 async load(){const revision=this.revision;try{const value=await loadServerPreferenceAsync('wheel-settings',{});if(revision===this.revision)this.settings=normalizeWheelSettings(value);}catch{}}
 async configure(value){await this.stop('Settings changed — feedback off');this.revision++;this.settings=normalizeWheelSettings(value);const saved=await saveServerPreference('wheel-settings',this.settings);if(saved?.ok===false)throw Error('Could not save wheel settings');}
 supported(){return Boolean(this.navigator?.hid?.requestDevice)&&globalThis.isSecureContext!==false;}
 async connect(){
  if(!this.supported())throw Error('WebHID unavailable. Calibrated Gamepad input and existing controls still work.');
  // Must run before any await, while the Connect click has user activation.
  const selection=this.navigator.hid.requestDevice({filters:[{usagePage:1,usage:4},{usagePage:1,usage:5},{usagePage:2},{usagePage:15}]});
  const [device]=await selection;if(!device)return;
  await this.disconnect();
  const epoch=++this.epoch;this.status='Opening device (feedback off)';
  try{if(!device.opened)await device.open();if(epoch!==this.epoch){await device.close();return;}
   this.input.addHid(device);this.driver=new PidWheelDriver(device);this.status=this.driver.capabilities.reason;
  }catch(error){this.status=error.message;throw error;}
 }
 async connectInput(){
  if(!this.supported())throw Error('WebHID unavailable; use a Gamepad API device instead');
  const [device]=await this.navigator.hid.requestDevice({filters:[{usagePage:1,usage:4},{usagePage:1,usage:5},{usagePage:2}]});
  if(!device)return;if(!device.opened)await device.open();this.input.addHid(device);
 }
 async mock(){await this.disconnect();this.driver=new MockWheelDriver();this.status='Mock backend selected; no hardware output';}
 async arm(){
  if(this.stopping)await this.stopping;
  if(this.suspended||this.document?.hidden)throw Error('Focus the game before enabling feedback');
  if(!this.driver?.capabilities.forceFeedback)throw Error(this.driver?.capabilities.reason||'Connect a feedback device first');
  if(!(this.driver instanceof MockWheelDriver)&&(!this.settings.enabled||!this.input.read(this.settings)))throw Error('Enable and calibrate wheel input first');
  const epoch=++this.epoch,driver=this.driver;
  await driver.initialize();
  if(epoch!==this.epoch||this.suspended||this.document?.hidden){await driver.stop();return;}
  this.enabled=true;this.status='Armed; forces only during active driving';this.model.reset();
  if(!this.timer)this.timer=this.setTimer(()=>this.tick(),20);
 }
 async stop(reason='Feedback disabled'){
  this.enabled=false;this.active=false;this.epoch++;this.model.reset();this.output={torque:0,clipped:false};
  if(this.timer){this.clearTimer(this.timer);this.timer=null;}this.status=reason;
  if(this.stopping)return this.stopping;
  this.stopping=Promise.resolve(this.driver?.stop()).finally(()=>{this.stopping=null;});return this.stopping;
 }
 async disconnect(){await this.stop('Disconnected');const driver=this.driver;this.driver=null;if(driver?.device)this.input.removeHid(driver.device);await driver?.dispose();}
 readInput(){this.frame=this.input.read(this.settings);return this.frame;}
 update(session,active){
  if(active&&this.enabled&&!this.frame&&!(this.driver instanceof MockWheelDriver)){void this.stop('Wheel input disconnected — feedback disabled');return;}
  this.active=active&&(Boolean(this.frame)||this.driver instanceof MockWheelDriver)&&!this.suspended&&!this.document?.hidden;
  if(!this.active){this.pause();return;}
  const telemetry=readWheelTelemetry(session);
  if(!telemetry){if(this.enabled)void this.stop('Invalid or missing tire telemetry');return;}
  if(this.session!==session||telemetry.step!==this.step||telemetry.reset!==this.reset){
   if(this.session!==session||telemetry.reset!==this.reset)this.model.reset();
   this.lastFresh=this.now();this.step=telemetry.step;this.reset=telemetry.reset;this.session=session;this.telemetry=telemetry;
  }
 }
 pause(){
  this.active=false;this.model.reset();this.output={torque:0,clipped:false};this.calculatedTelemetry=null;this.lastCalculation=0;
  if(this.enabled&&!this.quiet){this.quiet=true;void this.driver?.quiet?.();}
 }
 tick(){
  if(!this.enabled)return;
  if(!(this.driver instanceof MockWheelDriver)&&!this.input.read(this.settings,{consume:false})){void this.stop('Wheel input disconnected — feedback disabled');return;}
  if(!this.active){this.pause();return;}
  this.quiet=false;
  if(!this.active||(!(this.driver instanceof MockWheelDriver)&&(!this.frame||!this.input.read(this.settings,{consume:false})))||this.suspended||this.document?.hidden||this.now()-this.lastFresh>100){void this.stop('Stale telemetry / disconnected input — feedback disabled');return;}
  if(!this.driver?.armed){void this.stop(this.driver?.error||'Feedback driver stopped');return;}
  // Read physics at its own cadence; re-send current force to renew the finite
  // device effect, but don't differentiate the same suspension sample twice.
  if(this.calculatedTelemetry!==this.telemetry){
   const dt=this.lastCalculation?Math.max(.001,(this.lastFresh-this.lastCalculation)/1000):.02;
   this.output=this.model.calculate(this.telemetry,this.settings,dt);this.calculatedTelemetry=this.telemetry;this.lastCalculation=this.lastFresh;
  }
  void this.driver.write(this.output?.torque||0);
 }
 diagnostics(){return `${this.status}\n${this.driver?.device?.productName||'No physical feedback device'}\nWebHID: ${this.supported()?'available':'unavailable'}; feedback: ${this.enabled?'armed':'off'}\nTorque: ${(this.output?.torque||0).toFixed(3)}${this.output?.clipped?' (clipping)':''}\n${this.driver?.capabilities.reason||''}`;}
 async dispose(){await this.disconnect();for(const device of this.input.hidDevices.keys()){this.input.removeHid(device);try{await device.close();}catch{}}this.window?.removeEventListener?.('blur',this.onBlur);this.window?.removeEventListener?.('focus',this.onFocus);this.window?.removeEventListener?.('pagehide',this.onBlur);this.document?.removeEventListener?.('visibilitychange',this.onVisibility);this.navigator?.hid?.removeEventListener?.('disconnect',this.onDisconnect);}
}
