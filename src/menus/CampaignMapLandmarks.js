import {CAMPAIGN_LANDMARKS} from './CampaignMapLandmarkLayout.js';

const TILE_W=192,TILE_H=160,ANCHOR_X=96,ANCHOR_Y=112;
const atlases=new Map();
function atlasFor(ref){
 if(typeof Image==='undefined')return null;
 let atlas=atlases.get(ref);
 if(!atlas){
  atlas=new Image();
  atlas.src=new URL('../../assets/campaign-map-landmarks/'+ref+'.png',import.meta.url).href;
  atlases.set(ref,atlas);
 }
 return atlas.complete&&atlas.naturalWidth===TILE_W*4&&atlas.naturalHeight===TILE_H*2?atlas:null;
}

// Race refs protect custom maps and editor reassignments from inheriting the
// wrong miniature. Node IDs remain stable when the authored travel order changes.
export function mapLandmarkPlacements(element,nodes,positions,b,atlas=undefined){
 const layout=element.property==='campaign-path'?CAMPAIGN_LANDMARKS[element.artRef]:null;
 if(!layout)return [];
 const image=atlas===undefined?atlasFor(element.artRef):atlas;
 if(!image)return [];
 const areaHeight=Math.max(1,b.h-36);
 const nominal=Math.min(b.w*.188,areaHeight*.255,144);
 const ordered=[];
 for(const node of nodes){
  const entry=layout[node.id],p=positions.get(node.id);
  if(!entry||!p||entry[0]!==node.raceRef)continue;
  const [,index,depth,weight=1]=entry;
  let separation=Infinity;
  for(const other of positions.values()){
   if(other!==p)separation=Math.min(separation,Math.hypot(p.x-other.x,p.y-other.y));
  }
  const width=Math.min(nominal*weight,Math.max(nominal*.69,separation*1.45));
  const scale=width/TILE_W;
  // Flip neither mini nor road. Near the top of the frame, move the painted
  // object just far enough down to retain its recognizable skyline silhouette.
  const lift=depth==='ground'?0:depth==='underpass'?0:Math.min(width*.10,9);
  const x=Math.max(b.x,Math.min(b.x+b.w-width,p.x-ANCHOR_X*scale));
  const y=Math.max(b.y,Math.min(b.y+areaHeight-TILE_H*scale,p.y-ANCHOR_Y*scale-lift));
  ordered.push({image,index,depth,width,height:TILE_H*scale,x,y,sortY:p.y,locked:node.locked});
 }
 return ordered.sort((a,c)=>a.sortY-c.sortY);
}

export function drawMapLandmarkLayer(ctx,placements,foreground){
 if(!placements.some(p=>(p.depth!=='ground')===foreground))return;
 ctx.save();
 ctx.imageSmoothingEnabled=false;
 for(const p of placements){
  if((p.depth!=='ground')!==foreground)continue;
  ctx.globalAlpha=p.locked?.84:1;
  ctx.drawImage(p.image,p.index%4*TILE_W,Math.floor(p.index/4)*TILE_H,TILE_W,TILE_H,
   Math.round(p.x),Math.round(p.y),Math.round(p.width),Math.round(p.height));
 }
 ctx.restore();
}
