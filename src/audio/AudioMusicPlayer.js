import {musicMediaVolume} from './musicVolume.js';
export default class AudioMusicPlayer{
 constructor(audio,{createAudio=()=>new Audio()}={}){this.engine=audio;this.media=createAudio();this.volume=0;this.targetVolume=0;this.fadeSpeed=0;this.finished=false;}
 setSong(song,trackId,{loop=true,offsetMs=0}={}){
  this.trackId=trackId;this.media.src=song.src;this.media.loop=loop;this.media.preload='auto';this.media.volume=0;
  this.media.onloadedmetadata=()=>{if(offsetMs>0)this.media.currentTime=Math.min(offsetMs/1000,this.media.duration||Infinity);};
  this.media.onended=()=>{this.finished=true;this.volume=this.targetVolume=0;};
  this.media.onerror=()=>{this.error='Could not play music';this.dispose();};
  this.media.play().catch(error=>{this.error=error.message;this.dispose();});
 }
 setFade(target,duration){this.targetVolume=Math.max(0,Math.min(1,target));this.fadeSpeed=duration>0?(this.targetVolume-this.volume)/duration:0;if(!duration)this.volume=this.targetVolume;this.applyVolume();if(!duration&&target===0)this.dispose();}
 applyVolume(){this.media.volume=this.volume*musicMediaVolume(this.engine);}
 update(dt){if(this.finished)return;if(this.fadeSpeed){const next=this.volume+this.fadeSpeed*dt;this.volume=this.fadeSpeed>0?Math.min(next,this.targetVolume):Math.max(next,this.targetVolume);}this.applyVolume();if(this.volume===0&&this.targetVolume===0)this.dispose();}
 dispose(){this.media.pause();this.media.removeAttribute('src');this.media.load();this.finished=true;this.volume=this.targetVolume=0;}
}
