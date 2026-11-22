// Lightweight illustrated terrain drawn in the existing map widget. No texture
// downloads, new canvas allocations, or random changes between frames.
export function drawCampaignMapLandscape(ctx,b,stage=1){
 const snow=stage===2,desert=stage>=7&&stage<=10,city=stage===6;
 const ground=snow?'#526876':desert?'#76533a':city?'#343e49':'#334b43';
 ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();
 ctx.fillStyle=ground;ctx.fillRect(b.x,b.y,b.w,b.h);
 // Layered ridgelines leave a broad readable corridor for the itinerary.
 for(let layer=0;layer<3;layer++){
  ctx.fillStyle=snow?['#364a59','#71838b','#a5b4b7'][layer]:desert?['#4b3b36','#916646','#b17e51'][layer]:['#243734','#405b4c','#5a7058'][layer];
  ctx.beginPath();ctx.moveTo(b.x,b.y+b.h);
  for(let i=0;i<=16;i++){
   const h=.16+layer*.15+Math.sin(i*1.6+stage+layer)*.09;
   ctx.lineTo(b.x+i*b.w/16,b.y+b.h*h);
  }
  ctx.lineTo(b.x+b.w,b.y+b.h);ctx.closePath();ctx.fill();
 }
 // A river or dry wash gives the path a visible landscape to cross.
 ctx.strokeStyle=desert?'#d4a477':'#6b9fa4';ctx.lineWidth=Math.max(3,b.w*.018);ctx.beginPath();
 ctx.moveTo(b.x+b.w*.02,b.y+b.h*.56);
 ctx.bezierCurveTo(b.x+b.w*.35,b.y+b.h*.85,b.x+b.w*.60,b.y+b.h*.13,b.x+b.w*.98,b.y+b.h*.60);ctx.stroke();
 for(let i=0;i<18;i++){
  const x=b.x+b.w*((i*.137+stage*.03)%1),y=b.y+b.h*(.12+(i*.193% .76)),size=Math.max(4,b.w*.018);
  ctx.fillStyle=snow?'#d1d9d6':desert?'#573e32':city?'#18252e':'#1e3d32';
  if(city){ctx.fillRect(x,y,size,size*(1+i%3));continue;}
  ctx.beginPath();ctx.moveTo(x,y-size);ctx.lineTo(x+size*.7,y+size);ctx.lineTo(x-size*.7,y+size);ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
