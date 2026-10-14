import MobileControls from '../ui/MobileControls.js';
import {getPortraitHandheldLayout,getLandscapeHandheldLayout} from '../ui/shared/canvasViewportLayout.js';

// The same handheld geometry, shell and controls used by level/race playtests.
export class MenuPreviewSurface {
  constructor(game){this.game=game;this.controls=new MobileControls();this.previous={};}
  reset(){this.controls.reset();this.previous={};}
  layout(width,height){
    const touch=Boolean(this.game.deviceIsMobile&&!this.game.input?.isGamepadConnected?.());
    const key=`${width}:${height}:${touch}`;
    if(key!==this.key){this.reset();this.key=key;this.handheld=touch?(height>width?getPortraitHandheldLayout(width,height):getLandscapeHandheldLayout(width,height)):null;this.controls.setViewport({width,height,isMobile:touch,controlsBounds:this.handheld?.controlsDeck,controlsLayout:this.handheld});
      for(const b of this.controls.buttons){if(b.id==='jump')b.label='A';if(b.id==='attack')b.label='B';}
    }
    return this.handheld;
  }
  draw(ctx){if(!this.handheld)return;const draw=this.handheld.device.h>this.handheld.device.w?this.game.drawPortraitHandheldShell:this.game.drawLandscapeHandheldShell;draw?.call(this.game,ctx,this.handheld);this.controls.draw(ctx,'pause');}
  pressed(){const now=this.controls.getActions('pause'),previous=this.previous;this.previous=now;return action=>Boolean(now[action]&&!previous[action]);}
  down(point){return this.handheld&&this.controls.handlePointerDown(point,'pause');}
  move(point){if(this.handheld)this.controls.handlePointerMove(point,'pause');}
  up(point){if(this.handheld)this.controls.handlePointerUp(point,'pause');}
}
