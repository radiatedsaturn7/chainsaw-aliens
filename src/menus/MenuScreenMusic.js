// Regional maps inherit the overview soundtrack even when entered directly
// after a race, when there is no currently playing menu track to continue.
export function resolveMenuScreenMusic(screen,document){
 if(screen?.musicMode!=='continue'||!screen.elements?.some(e=>e.property==='campaign-path'))return screen;
 const overview=document?.screens?.find(s=>s.elements?.some(e=>e.type==='world-map'&&e.property!=='campaign-path')&&s.musicRef&&s.musicMode!=='silent');
 return overview?{...screen,...Object.fromEntries(Object.entries(overview).filter(([key])=>key.startsWith('music'))),musicMode:'track'}:screen;
}
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
