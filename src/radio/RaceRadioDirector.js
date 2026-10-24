import {RACE_INTRO_DURATION} from '../racing/RaceIntro.js';
const secondsToGo = session => Math.max(0,(Number(session.countdownRemainingMs||0)-1000)/1000)
  + (session.raceIntro?.active ? Math.max(0,RACE_INTRO_DURATION-session.raceIntro.elapsed) : 0);
// Musical transitions follow the visible countdown, whose final second is GO.
// Prepare before counting down; after the bounded wait, catch late media up to GO.
export class RaceRadioDirector {
  constructor(radio) {this.radio=radio;this.session=null;this.serial=0;}
  reset(stop=true) {
    this.serial++;
    if(this.session)this.session.raceMusicPending=false;
    if(stop&&this.session)this.radio.stop();
    if(this.radio.audio)this.radio.audio.playbackRate=1;
    this.earlyAudio=null;this.fadeElapsed=0;this.shortIntroCue=false;this.radio.setGain(1);this.radio.contextStationId='';this.session=null;this.starting=false;this.started=false;
    this.go=false;this.finishElapsed=null;this.heldAudio=null;this.waitSeconds=0;
  }
  update(session, {paused=false,dt=0}={}) {
    if(session!==this.session){this.reset(!session);this.session=session;}
    if(!session||!session.running||session.preparing||(session.startupFramePending&&!session.raceIntroVisible)||session.carEditorPreview)return;
    if(!this.radio.available){session.raceMusicPending=false;this.radio.setGain(1);return;}
    if(this.starting&&session.raceMusicPending){
      this.waitSeconds+=Math.max(0,dt);
      if(this.waitSeconds>=5)session.raceMusicPending=false;
    }
    if(!this.started&&!this.starting){
      this.starting=true;session.raceMusicPending=Number(session.countdownRemainingMs||0)>1000;
      const serial=this.serial;
      void this.start(session,serial).catch(error=>{
        if(serial!==this.serial)return;
        session.raceMusicPending=false;this.radio.error=error.message;this.starting=false;this.started=true;this.radio.setGain(1);
      });return;
    }
    if(!this.started)return;
    const remaining=secondsToGo(session);
    if(!session.raceResults&&!this.go){
      if(paused){if(this.radio.playing){this.heldAudio=this.radio.audio;this.radio.pause();}return;}
      if(this.heldAudio){if(this.heldAudio===this.radio.audio)void this.radio.play();this.heldAudio=null;}
      const cue=this.radio.currentTrack?.raceCues?.start;
      this.fadeElapsed+=Math.max(0,dt);
      if(cue==null || (session.raceIntro && this.shortIntroCue)){
        // No invented cue. Short marked tracks play through the showcase, then
        // hit their authored marker once at GO; unmarked tracks never seek.
        if(this.radio.playing)this.radio.setGain(Math.min(1,this.fadeElapsed/.6));
        if(remaining===0){
          if(cue!=null && this.radio.playing)this.radio.seek(cue);
          this.go=true;this.radio.setGain(1);
        }
        return this.updateFinish(session,dt);
      }
      if(this.earlyAudio&&remaining<=cue){
        if(this.earlyAudio===this.radio.audio)void this.radio.play(this.radio.trackId,{position:Math.max(0,cue-remaining)});
        this.earlyAudio=null;
      }
      if(this.radio.playing){
        const target=Math.max(0,cue-remaining);
        const error=target-Number(this.radio.audio?.currentTime||0);
        // Keep the MP3 decoder running continuously; correct small drift gently.
        this.radio.audio.playbackRate=Math.max(.96,Math.min(1.04,1+error*.08));
        if(remaining===0&&Math.abs(error)>.35)this.radio.seek(target);
        this.radio.setGain(session.raceIntro ? Math.min(1,this.fadeElapsed/.6) : cue<remaining?0:Math.max(0,Math.min(1,1-remaining/3)));
      }
      if(remaining===0){this.go=true;if(this.radio.audio)this.radio.audio.playbackRate=1;this.radio.setGain(1);}
    }
    this.updateFinish(session,dt);
  }
  updateFinish(session,dt){
    if(session.raceResults&&this.radio.playing){
      const cue=this.radio.currentTrack?.raceCues?.end;
      if(cue===null||cue===undefined)return;
      if(this.finishElapsed===null)this.finishElapsed=0;
      if(this.finishElapsed<0.6){
        this.finishElapsed+=Math.max(0,dt);
        this.radio.setGain(Math.max(0,1-this.finishElapsed/0.6));
        if(this.finishElapsed>=0.6){this.radio.seek(cue);this.radio.setGain(1);}
      }
    }
  }
  async start(session, serial) {
    await this.radio.load();
    if(serial!==this.serial||session!==this.session||!this.radio.available)return;
    this.radio.chooseRaceStation();
    const track=this.radio.tracks.find(t=>t.id===this.radio.trackId)||this.radio.randomTrack();
    if(!track){session.raceMusicPending=false;this.radio.error='No unlocked, enabled songs in the available race stations';this.radio.onChange();this.started=true;this.starting=false;return;}
    const remaining=secondsToGo(session);
    const cue=track.raceCues?.start;
    this.shortIntroCue=Boolean(session.raceIntro && cue!=null && cue<remaining);
    const played=await this.radio.play(track.id,{position:cue==null ? null : Math.max(0,cue-remaining),gain:remaining>0?0:1});
    if(serial!==this.serial)return;
    if(played&&cue!=null&&cue<remaining&&!session.raceIntro){this.earlyAudio=this.radio.audio;this.radio.pause();}
    session.raceMusicPending=false;this.starting=false;this.started=true;
    // A paused/blocked player is left alone; Play in the radio menu remains usable.
    if(played&&remaining===0)this.go=true;
  }
}
