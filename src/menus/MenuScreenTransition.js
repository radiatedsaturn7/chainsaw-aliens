// Snapshot once per screen change; ordinary frames need no extra canvas copy.
export class MenuScreenTransition {
  constructor(){this.reset();}
  reset(){this.snapshot=null;this.elapsed=0;this.hold=false;}
  get active(){return Boolean(this.snapshot);}
  start(canvas,bounds,createCanvas=()=>globalThis.document?.createElement('canvas'),{transform=null,hold=false}={}){
    this.reset();if(!canvas||!bounds?.w||!bounds?.h)return;
    const snapshot=createCanvas();if(!snapshot)return;
    const sx=transform?.a??1,sy=transform?.d??1,tx=transform?.e??0,ty=transform?.f??0;
    const source={x:bounds.x*sx+tx,y:bounds.y*sy+ty,w:bounds.w*sx,h:bounds.h*sy};
    snapshot.width=Math.ceil(source.w);snapshot.height=Math.ceil(source.h);
    const ctx=snapshot.getContext('2d');if(!ctx)return;
    ctx.drawImage(canvas,source.x,source.y,source.w,source.h,0,0,snapshot.width,snapshot.height);
    this.snapshot=snapshot;this.hold=hold;
  }
  update(dt){if(!this.active)return;this.elapsed+=Math.max(0,Number(dt)||0);if(this.hold)this.elapsed=Math.min(.15,this.elapsed);if(this.elapsed>=.3)this.reset();}
  release(){this.hold=false;}
  draw(ctx,bounds){
    if(!this.active)return;
    const outgoing=this.elapsed<.15;
    const progress=outgoing?this.elapsed/.15:1-(this.elapsed-.15)/.15;
    // Smoothstep keeps both ends gentle and reaches complete black at midpoint.
    const alpha=progress*progress*(3-2*progress);
    ctx.save();ctx.globalAlpha=1;
    if(outgoing)ctx.drawImage(this.snapshot,bounds.x,bounds.y,bounds.w,bounds.h);
    ctx.fillStyle=`rgba(0,0,0,${alpha})`;ctx.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.restore();
  }
}
