import {boundedContext} from './RaceCarDepthSprites.js';

// Shared resting artwork, independent of vehicle position, speed and suspension.
// Cold misses fall back to the live painter; only two new variants are baked per
// frame, and the LRU has a hard pixel budget (including emissive artwork).
export class RaceCarRestFrames {
 constructor(){this.frames=new Map();this.oversized=new Set();this.signatures=new WeakMap();this.pixels=0;this.models=new Map();this.modelSequence=0;this.scratchSizes=new Map();}
 begin(){this.builds=0;this.hits=0;this.deferred=0;}
 identity(car){
  let saved=this.signatures.get(car);
  if(!saved||saved.art!==car.art||saved.setup!==car.setup||saved.compound!==car.setup?.defaultTireCompound){
   const signature=JSON.stringify([car.art,car.setup]);
   let key=this.models.get(signature);
   if(!key){key=++this.modelSequence;this.models.set(signature,key);}
   if(this.models.size>128)this.models.delete(this.models.keys().next().value);
   saved={art:car.art,setup:car.setup,compound:car.setup?.defaultTireCompound,key};this.signatures.set(car,saved);
  }
  return saved.key;
 }
 get(key,paint,{bodyWidth=128}={}){
  const hit=this.frames.get(key);
  if(hit){this.frames.delete(key);this.frames.set(key,hit);this.hits++;return hit;}
  if(this.oversized.has(key))return null;
  if(this.builds>=2){this.deferred++;return null;}
  this.builds++;
  const size=bodyWidth===256?1024:512,widthPx=size/4,center=size/2;
  let scratch=this.scratchSizes.get(size);
  if(!scratch){
   scratch={canvas:document.createElement('canvas'),emission:document.createElement('canvas')};
   for(const canvas of Object.values(scratch))canvas.width=canvas.height=size;
   this.scratchSizes.set(size,scratch);
  }
  const {canvas,emission}=scratch;
  canvas.getContext('2d').clearRect(0,0,size,size);emission.getContext('2d').clearRect(0,0,size,size);
  const recorder=boundedContext(canvas.getContext('2d'),emission.getContext('2d'));
  paint(recorder.context,center,widthPx);
  const box=recorder.bounds();
  // Do not store truncated custom artwork. Its live renderer remains available.
  if(!box||box.left<2||box.top<2||box.right>size-2||box.bottom>size-2){
   this.oversized.add(key);if(this.oversized.size>96)this.oversized.delete(this.oversized.values().next().value);
   return null;
  }
  const left=Math.floor(box.left)-2,top=Math.floor(box.top)-2;
  const width=Math.ceil(box.right)-left+2,height=Math.ceil(box.bottom)-top+2;
  const crop=source=>{const out=document.createElement('canvas');out.width=width;out.height=height;
   out.getContext('2d').drawImage(source,left,top,width,height,0,0,width,height);return out;};
  const frame={canvas:crop(canvas),emission:recorder.hasEmission()?crop(emission):null,x:(left-center)/widthPx,y:(top-center)/widthPx,width:width/widthPx,height:height/widthPx};
  frame.pixels=width*height*(frame.emission?2:1);
  this.frames.set(key,frame);this.pixels+=frame.pixels;
  while(this.frames.size>96||this.pixels>4*1024*1024){const oldest=this.frames.keys().next().value;this.pixels-=this.frames.get(oldest).pixels;this.frames.delete(oldest);}
  return frame;
 }
 clear(){this.scratchSizes.clear();this.oversized.clear();this.scratch=null;this.emissionScratch=null;this.frames.clear();this.signatures=new WeakMap();this.pixels=0;this.models=new Map();this.modelSequence=0;}
}

export function useRestCarFrame(previous,distanceM,rollRad=0,pitchRad=0){
 // Hysteresis prevents repeated detail switches near the cutoff. Crashes and
 // steep attitudes always retain live artwork rather than depicting upright cars.
 return Math.abs(rollRad)<.35&&Math.abs(pitchRad)<.35&&distanceM>(previous?30:40);
}

// Switch to sharper artwork promptly on approach; retreat thresholds overlap
// to avoid rebuilding textures when cars hover at a distance boundary.
export function raceCarArtworkTier(previous,distanceM,rollRad=0,pitchRad=0){
 if(!Number.isFinite(distanceM)||Math.abs(rollRad)>=.35||Math.abs(pitchRad)>=.35)return 'live';
 if(distanceM<=30)return 'live';
 if(previous==='far'&&distanceM>50)return 'far';
 if(distanceM>55)return 'far';
 if(previous==='live'&&distanceM<=32)return 'live';
 return 'medium';
}
