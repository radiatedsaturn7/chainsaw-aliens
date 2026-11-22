// A small number of signposts highlights the attractions without obscuring
// roads. Anchoring them to editable pins keeps the artwork free of UI.
const attractions=new Map([
 ['Providence, RI — Landmark Run',[
  ['Boston, MA — Landmark Run','Boston',-1],
  ['Providence, RI — Landmark Run','Providence',1]
 ]],
 ['Mount Washington Auto Road — point-to-point',[
  ['Mount Washington Auto Road — point-to-point','Mt. Washington',-1],
 ]],
 ['Laurel Highlands Scenic Byway',[
  ['Laurel Highlands Scenic Byway','Laurel Highlands',1],
 ]],
 ['Ohio River Crossing',[
  ['Ohio River Crossing','Ohio River Crossing',1],
 ]],
 ['Ozark Backroads',[
  ['Ozark Backroads','Ozark Backroads',1],
 ]],
 ['Data Center City',[
  ['Data Center City','Data Center City',1],
 ]],
 ['Historic Route 66',[
  ['Historic Route 66','Historic Route 66',-1],
 ]],
 ['Pikes Peak Highway',[
  ['Pikes Peak Highway','Pikes Peak',-1],
 ]],
 ['Moki Dugway',[
  ['Moki Dugway','Moki Dugway',-1],
 ]],
 ['Oak Creek Canyon',[
  ['Oak Creek Canyon','Oak Creek Canyon',1],
 ]],
 ['Angeles Crest Highway',[
  ['Angeles Crest Highway','Angeles Crest',-1],
  ['Los Angeles, CA — Landmark Run','Los Angeles',1],
 ]]
]);

export function drawCampaignMapPlaces(ctx,bounds,nodes,positions,element,fontFamily){
 const labels=attractions.get(element.assetRef);
 if(!labels)return;
 const size=Math.max(10,Math.min(17,Math.min(bounds.w,bounds.h)*.047));
 const kept=[];
 for(const [ref,label,side] of labels){
  const n=nodes.find(node=>node.raceRef===ref),p=n&&positions.get(n.id);
  if(!p)continue;
  ctx.save();
  ctx.font=`600 ${size}px ${fontFamily}`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  const w=Math.ceil(ctx.measureText(label).width)+size*.75,h=size*1.42;
  const top=bounds.y+3,bottom=bounds.y+bounds.h-39;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const left=bounds.x+3,right=bounds.x+bounds.w-w-3;
  // Never cover the pin we are labeling; favor the open bank of the map.
  const gap=size*.92;
  const candidates=[[p.x-w*.6,side===1?p.y+gap:p.y-h-gap],
    [p.x-w*.6,side===1?p.y-h-gap:p.y+gap],
    [p.x+gap,p.y-h/2],[p.x-w-gap,p.y-h/2]];
  const blocks=[...positions.values()].map(q=>({x:q.x-gap*.69,y:q.y-gap*.69,w:gap*1.38,h:gap*1.38})).concat(kept);
  let best=null;
  for(const [xx,yy] of candidates){
   const x=clamp(xx,left,right),y=clamp(yy,top,bottom-h);
   const hit=blocks.reduce((sum,b)=>sum+Math.max(0,Math.min(x+w,b.x+b.w)-Math.max(x,b.x))*Math.max(0,Math.min(y+h,b.y+b.h)-Math.max(y,b.y)),0);
   const penalty=hit*10+Math.hypot(x+w/2-p.x,y+h/2-p.y);
   if(!best||penalty<best.penalty)best={x,y,penalty};
  }
  const {x,y}=best;kept.push({x,y,w,h});
  ctx.fillStyle='#111a2c';ctx.fillRect(x,y,w,h);
  ctx.strokeStyle='#8ebadf';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  ctx.fillStyle='#f3ecda';ctx.fillText(label,x+w/2,y+h*.5);
  ctx.restore();
 }
}
