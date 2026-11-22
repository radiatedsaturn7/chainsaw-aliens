// Terrain never bakes labels into the art. Named landmarks stay attached to
// editable race pins in both orientations, even if their road is moved.
const labels=new Map([
 ['Boston, MA — Landmark Run','Boston'],
 ['Providence, RI — Landmark Run','Providence']
]);

export function drawCampaignMapPlaces(ctx,bounds,nodes,positions,element,fontFamily){
 if(element.assetRef!=='Providence, RI — Landmark Run')return;
 const size=Math.max(12,Math.min(19,Math.min(bounds.w,bounds.h)*.052));
 for(const node of nodes){
  const label=labels.get(node.raceRef),p=positions.get(node.id);
  if(!label||!p)continue;
  ctx.save();
  ctx.font=`600 ${size}px ${fontFamily}`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  const w=Math.ceil(ctx.measureText(label).width)+size*.75,h=size*1.42;
  const x=Math.max(bounds.x+3,Math.min(bounds.x+bounds.w-w-3,p.x-w*.78));
  const top=bounds.y+3,bottom=bounds.y+bounds.h-39;
  const preferred=label==='Boston'?p.y-h-size*.88:p.y+size*.88;
  const y=Math.max(top,Math.min(bottom-h,preferred));
  ctx.fillStyle='#101e32';ctx.fillRect(x,y,w,h);
  ctx.strokeStyle='#8ebadf';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  ctx.fillStyle='#e7f3ff';ctx.fillText(label,x+w/2,y+h*.5);
  ctx.restore();
 }
}
