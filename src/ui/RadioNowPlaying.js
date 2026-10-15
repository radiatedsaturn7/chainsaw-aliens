import {getRaceArtSpriteCanvasShared,hydrateRaceArtSpriteShared} from './shared/raceArtSpriteCanvas.js';

// Uses the same 960×540 content rectangle as both gameplay pause menus.
export class RadioNowPlaying {
  constructor(){this.images=new Map();this.art=new Map();this.pending=new Set();}
  image(source){
    if(source?.artRef){
      const cached=getRaceArtSpriteCanvasShared(source.artRef,{cache:this.art});
      if(cached)return cached;
      if(!this.pending.has(source.artRef)){this.pending.add(source.artRef);void hydrateRaceArtSpriteShared(source.artRef).finally(()=>this.pending.delete(source.artRef));}
    }
    if(source?.url && typeof Image!=='undefined'){
      let image=this.images.get(source.url);if(!image){image=new Image();image.src=source.url;this.images.set(source.url,image);}
      return image.complete&&image.naturalWidth?image:null;
    }
    return null;
  }
  draw(ctx,radio,menu){
    const {contentBounds:b,scale:s}=menu,station=radio.library.stations.find(entry=>entry.id===radio.stationId),track=radio.currentTrack;
    ctx.save();ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle='#fff';ctx.font=`${15*s}px Courier New`;
    const detail=track?[track.artist,track.album].filter(Boolean).join(' · '):'Collect mix tapes to unlock more songs';
    ctx.fillText(detail,b.x+b.w/2,b.y+145*s,390*s);
    if(radio.error){ctx.fillStyle='#ffb1a6';ctx.fillText(radio.error,b.x+b.w/2,b.y+165*s,540*s);}
    for(const [source,x,label] of [[station?.logo,210,'Station'],[track?.image,678,'Album']]){
      const size=72*s,y=b.y+84*s,left=b.x+x*s;ctx.fillStyle='#15231e';ctx.fillRect(left,y,size,size);
      const image=this.image(source);
      if(image){const factor=Math.min(size/image.width,size/image.height);ctx.drawImage(image,left+(size-image.width*factor)/2,y+(size-image.height*factor)/2,image.width*factor,image.height*factor);}
      else{ctx.fillStyle='#b9c8c0';ctx.font=`${12*s}px Courier New`;ctx.fillText(label,left+size/2,y+size/2,size-6*s);}
    }
    ctx.restore();
  }
}
