// Ignore near-transparent export padding when fitting panel art to controls.
const boundsCache=new WeakMap();
export function menuPanelArtBounds(image){
 if(boundsCache.has(image))return boundsCache.get(image);
 let bounds={x:0,y:0,w:image.width,h:image.height};
 try{
  const ctx=image.getContext?.('2d'),pixels=ctx?.getImageData(0,0,image.width,image.height)?.data;
  if(pixels){
   let left=image.width,top=image.height,right=-1,bottom=-1;
   for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>32){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
   if(right>=left)bounds={x:left,y:top,w:right-left+1,h:bottom-top+1};
  }
 }catch{/* An unreadable image still renders using its full bounds. */}
 boundsCache.set(image,bounds);return bounds;
}
export function drawMenuPanelArt(ctx,image,b){
 const source=menuPanelArtBounds(image);
 ctx.drawImage(image,source.x,source.y,source.w,source.h,b.x,b.y,b.w,b.h);
}
