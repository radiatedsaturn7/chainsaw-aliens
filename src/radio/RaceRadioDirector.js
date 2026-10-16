// Musical transitions follow the visible countdown, whose final second is GO.
// Media loading may be late: seek to the current countdown position, never move GO.
export class RaceRadioDirector {
  constructor(radio) {this.radio=radio;this.session=null;this.serial=0;}
  reset(stop=true) {
    this.serial++;
    if(stop&&this.session)this.radio.stop();
    this.radio.setGain(1);this.radio.contextStationId='';this.session=null;this.starting=false;this.started=false;
    this.go=false;this.finishElapsed=null;this.heldAudio=null;
  }
  update(session, {paused=false,dt=0}={}) {
    if(session!==this.session){this.reset();this.session=session;}
    if(!session||!session.running||session.preparing||session.startupFramePending||session.carEditorPreview)return;
    if(!this.radio.available){this.radio.setGain(1);return;}
    if(!this.started&&!this.starting){this.starting=true;void this.start(session,this.serial).catch(error=>{this.radio.error=error.message;this.starting=false;this.started=true;this.radio.setGain(1);});return;}
    if(!this.started)return;
    const remaining=Math.max(0,(Number(session.countdownRemainingMs||0)-1000)/1000);
    if(!session.raceResults&&!this.go){
      if(paused){if(this.radio.playing){this.heldAudio=this.radio.audio;this.radio.pause();}return;}
      if(this.heldAudio){if(this.heldAudio===this.radio.audio)void this.radio.play();this.heldAudio=null;}
      if(this.radio.playing){
        const cue=this.radio.currentTrack?.raceCues?.start??3;
        const target=Math.max(0,cue-remaining);
        if(Math.abs(Number(this.radio.audio?.currentTime||0)-target)>0.12||remaining===0)this.radio.seek(target);
        this.radio.setGain(cue<remaining?0:Math.max(0,Math.min(1,1-remaining/3)));
      }
      if(remaining===0){this.go=true;this.radio.setGain(1);}
    }
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
    const track=this.radio.tracks.find(t=>t.id===this.radio.trackId)||this.radio.tracks[0];
    if(!track){this.radio.error='No unlocked, enabled songs in the available race stations';this.radio.onChange();this.started=true;this.starting=false;return;}
    const remaining=Math.max(0,(Number(session.countdownRemainingMs||0)-1000)/1000);
    const cue=track.raceCues?.start??3;
    const played=await this.radio.play(track.id,{position:Math.max(0,cue-remaining),gain:remaining>0?0:1});
    if(serial!==this.serial)return;
    this.starting=false;this.started=true;
    // A paused/blocked player is left alone; Play in the radio menu remains usable.
    if(played&&remaining===0)this.go=true;
  }
}
