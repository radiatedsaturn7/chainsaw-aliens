// Keep music loads alive across screens that continue the current track.
export class MenuScreenMusic {
  constructor(game, hydrate) { this.game=game; this.hydrate=hydrate; this.generation=0; this.ref=null; this.fadeOut=.4; }
  stop({fadeOut=this.fadeOut}={}) {
    this.generation++; this.ref=null;
    this.game.setActiveMusicTrack?.(null,{fadeOut});
  }
  async enter(screen) {
    const mode=screen.musicMode || (screen.musicRef?'track':'silent');
    if(mode==='continue')return;
    if(mode==='silent'||!screen.musicRef){this.stop();return;}
    if(this.ref===screen.musicRef)return;
    const generation=++this.generation, fadeOut=this.fadeOut;
    this.ref=screen.musicRef; this.fadeOut=screen.musicFadeOut??.4;
    try {
      const payload=await this.hydrate('music',screen.musicRef);
      if(generation!==this.generation)return;
      if(!payload?.data)throw Error('Music not found: '+screen.musicRef);
      this.game.setActiveMusicTrack?.(screen.musicRef,{restart:false,loop:screen.musicLoop,
        volume:screen.musicVolume,fadeIn:screen.musicFadeIn,fadeOut,offsetMs:screen.musicStart*1000});
    } catch(error) {
      if(generation!==this.generation)return;
      this.ref=null;throw error;
    }
  }
}
