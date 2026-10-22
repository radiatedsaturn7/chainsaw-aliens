import AudioSystem from '../game/Audio.js';
import MidiSongPlayer from '../game/MidiSongPlayer.js';
// A media-like transport lets radio seeking, cue drops, pause, repeat and volume
// use MIDI as well as MP3. Its own bus stays audible while radio ducks game MIDI.
export class MidiMedia{
 constructor(song,{engine=new AudioSystem(),schedule=setInterval,cancel=clearInterval}={}){
  this.engine=engine;this.engine.volume=1;this.engine.midiBusVolume=1;
  this.song=song;this.player=new MidiSongPlayer(engine);this.player.setSong(song,'radio-midi',{loop:false});
  this.schedule=schedule;this.cancel=cancel;this.paused=true;this.ended=false;this.readyState=4;this._volume=1;this.token=0;
 }
 get duration(){return this.player.getLoopTicks()/this.player.getTicksPerSecond();}
 get currentTime(){return this.player.playheadTick/this.player.getTicksPerSecond();}
 set currentTime(value){this.silence();this.player.setSong(this.song,'radio-midi',{loop:false,offsetMs:Math.max(0,Number(value)||0)*1000});this.player.setFade(1,0);this.ended=false;}
 get volume(){return this._volume;}
 set volume(value){this._volume=Math.max(0,Math.min(1,Number(value)||0));this.engine.setVolume(this._volume);}
 silence(){for(const voice of this.engine.midiVoices||[])this.engine.stopMidiVoiceEntry(voice);this.engine.midiVoices=[];}
 async play(){
  const token=++this.token;this.engine.ensure();
  await this.engine.preloadSongResources?.(this.song);
  if(token!==this.token)return;
  if(this.ended)this.currentTime=0;
  this.player.resetAudioAnchor();this.player.setFade(1,0);this.engine.setVolume(this._volume);this.paused=false;
  this.cancel(this.timer);let last=performance.now();
  this.timer=this.schedule(()=>{const now=performance.now();this.player.update((now-last)/1000);last=now;if(this.player.finished){this.ended=true;this.pause();this.onended?.();}},20);
  this.onplaying?.();
 }
 pause(){this.token++;this.cancel(this.timer);this.timer=null;this.paused=true;this.silence();this.onpause?.();}
 removeAttribute(){this.pause();}
 load(){this.pause();}
}
