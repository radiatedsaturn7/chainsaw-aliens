// A stationary sound preview: uses the built car, never its saved condition.
export class GarageEnginePreview {
 constructor(game){this.game=game;this.active=false;this.rpm=0;}
 update(car,throttle,dt){
  const editor=this.game.carEditor||this.game.raceEditor;
  const tuning=editor?.getRaceCarTuning?.(car)||{...car.tuning,...car.transmissions?.[car.defaultTransmissionType]};
  const idle=Number(tuning.idleRpm)||850,limit=Math.max(idle+100,Number(tuning.revLimitRpm)||Number(tuning.redlineRpm)||6500);
  if(!this.active){this.rpm=idle;this.active=true;}
  const step=Math.max(0,Math.min(.1,Number(dt)||0)),inertia=Math.max(.05,Number(tuning.engineInertiaKgM2)||.3);
  this.rpm=throttle?Math.min(limit,this.rpm+3500*(.3/inertia)*step):idle+(this.rpm-idle)*Math.exp(-step*3*(.3/inertia));
  if(!throttle&&this.rpm<idle+40){this.stop();return idle;}
  const audio=this.game.audio,settings=car.audio||{},soundId=settings.engineSoundId||tuning.engineSoundId;
  if(this.soundId&&this.soundId!==soundId){this.game.stopSfxById?.(this.soundId,{key:'garage-engine'});this.soundId=null;}
  if(soundId&&this.game.playSfxById){
   if(audio?.engineRevActive)audio.setEngineRev(false);
   this.soundId=soundId;
   const redline=Number(tuning.redlineRpm)||limit;
   const pitchCents=editor?.getRaceEngineSfxPitchCents?.({rpm:this.rpm,tuning})??Math.max(-260,Math.min(2350,1200*Math.log2((38+this.rpm/redline*190)/(38+idle/redline*190))));
   this.game.playSfxById(soundId,{key:'garage-engine',loop:true,volume:(.32+throttle*.28)*Math.max(0,Math.min(2,Number(settings.engineSfxVolume??1))),pitchCents});
  }else audio?.setEngineRev?.(true,{rpm:this.rpm,redlineRpm:limit,throttle,load:0,profile:tuning.engineConversion==='v8'?'v8':settings.engineProfile||tuning.engineProfile||'flat-four'});
  audio?.setVehicleSound?.(true,{rpm:this.rpm,redlineRpm:limit,throttle,settings});
  return this.rpm;
 }
 stop(){
  if(this.soundId)this.game.stopSfxById?.(this.soundId,{key:'garage-engine'});
  if(this.active)this.game.audio?.setEngineRev?.(false);
  this.soundId=null;this.active=false;this.rpm=0;
 }
}
