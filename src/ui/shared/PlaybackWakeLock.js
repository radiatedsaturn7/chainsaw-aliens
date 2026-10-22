// Hold a screen wake lock only for active playback in a visible document.
export class PlaybackWakeLock {
  constructor({navigator=globalThis.navigator,document=globalThis.document}={}) {
    this.navigator=navigator;this.document=document;
    this.active=false;this.lock=null;this.pending=null;this.generation=0;
    this.status='idle';
    this.onVisibility=()=>{
      this.generation++;
      if(this.document?.visibilityState==='hidden')void this.release();
      else void this.acquire();
    };
  }
  get supported(){return typeof this.navigator?.wakeLock?.request==='function';}
  setActive(active){
    active=Boolean(active);
    if(active===this.active)return this.pending;
    this.active=active;this.generation++;
    if(active){this.document?.addEventListener('visibilitychange',this.onVisibility);return this.acquire();}
    this.document?.removeEventListener('visibilitychange',this.onVisibility);
    this.status='idle';return this.release();
  }
  async release(){
    const lock=this.lock;this.lock=null;
    if(lock&&!lock.released)try{await lock.release();}catch{/* The OS may have released it already. */}
  }
  acquire(){
    if(!this.active||this.document?.visibilityState==='hidden')return Promise.resolve();
    if(!this.supported){this.status='unavailable';return Promise.resolve();}
    if(this.lock||this.pending)return this.pending||Promise.resolve();
    const generation=this.generation;this.status='requesting';
    this.pending=(async()=>{
      try{
        const lock=await Promise.resolve().then(()=>this.navigator.wakeLock.request('screen'));
        if(!this.active||generation!==this.generation||this.document?.visibilityState==='hidden'){
          await lock.release();return;
        }
        this.lock=lock;this.status=lock.released?'released':'active';
        lock.addEventListener('release',()=>{
          if(this.lock===lock){this.lock=null;this.status=this.active?'released':'idle';}
        },{once:true});
        if(lock.released)this.lock=null;
      }catch{if(generation===this.generation)this.status='unavailable';}
      finally{
        this.pending=null;
        // A pause/resume or visibility change can occur while request() waits.
        if(generation!==this.generation&&this.active&&this.document?.visibilityState!=='hidden')void this.acquire();
      }
    })();
    return this.pending;
  }
}
