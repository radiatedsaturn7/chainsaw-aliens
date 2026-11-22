import {placeLandmarksByRoad,regionalRoadCorridors} from './CampaignMapRoadClearance.js';
import {CAMPAIGN_LANDMARKS,CAMPAIGN_LANDMARK_BY_STAGE} from './CampaignMapLandmarkLayout.js';

const TILE_W=192,TILE_H=160,ANCHOR_X=96,ANCHOR_Y=112;
const atlases=new Map();
const regionalPlacementCache=new WeakMap();
const HERO_MULTIPLIER=1.15;
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
export function mapLandmarkPlacements(element,nodes,positions,b,atlas=undefined,progression=null){
 if(element.property!=='campaign-path')return [];
 // A different terrain backplate does not move or replace the region's sights.
 // assetRef is the exact authored boss race, independent of world travel order.
 const authored=progression?.regions?.find(r=>r.bossRef===element.assetRef);
 const ref=(authored&&CAMPAIGN_LANDMARK_BY_STAGE[authored.stage])||element.artRef;
 if(!Object.hasOwn(CAMPAIGN_LANDMARKS,ref))return [];
 const layout=CAMPAIGN_LANDMARKS[ref];
 const image=atlas===undefined?atlasFor(ref):atlas;
 if(!image)return [];
 const areaHeight=Math.max(1,b.h-36);
 const nominal=Math.min(b.w*.415,areaHeight*.54,285);
 const previousNominal=Math.min(b.w*.188,areaHeight*.255,144);
 const ordered=[];
 for(const node of nodes){
  const entry=layout[node.id],p=positions.get(node.id);
  if(!entry||!p||entry[0]!==node.raceRef)continue;
  const [,index,depth,weight=1,ink=[0,0,TILE_W,TILE_H]]=entry;
  let separation=Infinity;
  for(const other of positions.values()){
   if(other!==p)separation=Math.min(separation,Math.hypot(p.x-other.x,p.y-other.y));
  }
  const previousWidth=Math.min(previousNominal*weight,Math.max(previousNominal*.69,separation*1.45));
  const width=Math.max(previousWidth*2,
   Math.min(nominal*weight*(weight>1?HERO_MULTIPLIER:1),Math.max(nominal*.83,separation*2.75)));
  const scale=width/TILE_W;
  // Clamp actual pixels, not the padded source cell. Preserve each ground
  // contact as closely as possible at the edges of the artwork.
  const lift=depth==='raised'?Math.min(width*.045,7):0;
  const [l,t,r,bt]=ink;
  const x=Math.max(b.x-l*scale,Math.min(b.x+b.w-r*scale,p.x-ANCHOR_X*scale));
  const y=Math.max(b.y-t*scale,Math.min(b.y+areaHeight-bt*scale,p.y-ANCHOR_Y*scale-lift));
  ordered.push({image,index,depth,width,height:TILE_H*scale,x,y,ink,sortY:p.y,pinY:p.y,nodeId:node.id,priority:weight,groundX:x+ANCHOR_X*scale,groundY:y+ANCHOR_Y*scale,locked:node.locked});
 }
 return ordered.sort((a,c)=>a.sortY-c.sortY);
}

// Cache stable screen geometry, but don't cache an atlas that is still loading.
export function regionalLandmarkPlacements(element,nodes,positions,b,progression,roadNodes,links,style,atlas){
 const signature=JSON.stringify([b.x,b.y,b.w,b.h,element.artRef,element.assetRef,style.lineWidth,style.linePattern,
  nodes.map(n=>[n.id,n.raceRef,n.locked,positions.get(n.id)?.x,positions.get(n.id)?.y]),links]);
 const cache=atlas===undefined?regionalPlacementCache.get(element):null;
 if(cache?.signature===signature)return cache.placements;
 const base=mapLandmarkPlacements(element,nodes,positions,b,atlas,progression);
 if(!base.length)return base;
 const corridors=regionalRoadCorridors(b,roadNodes,links,style);
 const placements=placeLandmarksByRoad(base,b,corridors,positions);
 if(atlas===undefined)regionalPlacementCache.set(element,{signature,placements});
 return placements;
}

export function drawMapLandmarkLayer(ctx,placements,foreground,car=null){
 if(!placements.length){if(foreground)car?.draw();return;}
 let pendingCar=foreground?car:null;
 const inheritedAlpha=ctx.globalAlpha??1;
 ctx.save();
 ctx.imageSmoothingEnabled=false;
 for(const p of placements){
  // All art belongs in the plate. Repaint only the occluding portion above
  // the road, so a large tower does not bury the player's node or approach.
  if(foreground&&p.depth==='ground')continue;
  if(pendingCar&&pendingCar.y<p.groundY){ctx.globalAlpha=inheritedAlpha;pendingCar.draw();pendingCar=null;}
  ctx.globalAlpha=inheritedAlpha*(p.locked?.83:1);
  if(foreground){
   ctx.save();
   ctx.beginPath();
   const cut=p.groundY-(p.depth==='underpass'?1:Math.min(9,p.height*.09));
   ctx.rect(p.x,p.y,p.width,Math.max(0,cut-p.y));
   ctx.clip();
  }
  ctx.drawImage(p.image,p.index%4*TILE_W,Math.floor(p.index/4)*TILE_H,TILE_W,TILE_H,
   Math.round(p.x),Math.round(p.y),Math.round(p.width),Math.round(p.height));
  if(foreground)ctx.restore();
 }
 ctx.globalAlpha=inheritedAlpha;
 pendingCar?.draw();
 ctx.restore();
}
