// Severity follows rally convention: 6 is fastest, 1 is tightest.
export const PACE_NOTE_COLORS={1:'#ef4444',2:'#f97316',3:'#fbbf24',4:'#d4df43',5:'#8ddd58',6:'#42db83'};
export function paceNoteIcon(note={}){
 const text=String(note.body||note.text||'').replace(/^Brake,\s*/i,''),first=text.split(/,?\s+(?:into|and)\s+/i)[0];
 const direction=String(note.direction||first.match(/\b(left|right)\b/i)?.[1]||'').toLowerCase();
 const shape=String(note.shape||first.match(/\b(hairpin|acute|square)\b/i)?.[1]||'').toLowerCase();
 const number=Number(note.severity||first.match(/\b(?:left|right)\s+([1-6])\b/i)?.[1]||first.match(/\b([1-6])\s+(?:left|right)\b/i)?.[1]);
 const severity=(shape==='hairpin'||shape==='acute')?1:shape==='square'?2:number>=1&&number<=6?number:null;
 const kind=direction?'turn':/crest/i.test(first)?'crest':/dip/i.test(first)?'dip':'caution';
 const modifiers=note.modifiers||[...first.matchAll(/don't cut|tightens(?:\s+[1-6])?|opens|long/gi)].map(m=>m[0]);
 return {kind,direction,shape,severity,color:PACE_NOTE_COLORS[severity]||'#fbbf24',modifiers,text:first};
}
export function drawPaceNoteIcon(ctx,note,x,y,size=90){
 const icon=paceNoteIcon(note),scale=size/90;
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 ctx.fillStyle='rgba(0,0,0,.76)';ctx.fillRect(-45,-45,90,90);
 ctx.strokeStyle=icon.color;ctx.fillStyle=icon.color;ctx.lineWidth=6;ctx.lineCap='round';ctx.lineJoin='round';
 if(icon.kind==='turn'){
  const sign=icon.direction==='right'?1:-1;
  const degrees=icon.shape==='hairpin'?165:icon.shape==='acute'?135:icon.shape==='square'?90:({1:120,2:95,3:70,4:50,5:35,6:20}[icon.severity]||60);
  const angle=degrees*Math.PI/180,radius=48/angle;
  const endX=sign*radius*(1-Math.cos(angle)),endY=24-radius*Math.sin(angle);
  const startX=-endX/2;
  ctx.beginPath();ctx.moveTo(startX,31);ctx.lineTo(startX,24);
  if(icon.shape==='square'){ctx.lineTo(startX,endY);ctx.lineTo(startX+endX,endY);}
  else for(let i=1;i<=24;i++){const t=angle*i/24;ctx.lineTo(startX+sign*radius*(1-Math.cos(t)),24-radius*Math.sin(t));}
  ctx.stroke();
  const ex=startX+endX,ey=endY,dx=sign*Math.sin(angle),dy=-Math.cos(angle);
  ctx.beginPath();ctx.moveTo(ex-dx*9-dy*6,ey-dy*9+dx*6);ctx.lineTo(ex,ey);ctx.lineTo(ex-dx*9+dy*6,ey-dy*9-dx*6);ctx.stroke();
  if(icon.severity){ctx.font='900 16px sans-serif';ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText(String(icon.severity),37,-37);}
 }else if(icon.kind==='crest'||icon.kind==='dip'){
  ctx.beginPath();ctx.moveTo(-28,icon.kind==='crest'?12:-12);ctx.quadraticCurveTo(0,icon.kind==='crest'?-35:35,28,icon.kind==='crest'?12:-12);ctx.stroke();
 }else{
  ctx.beginPath();ctx.moveTo(0,-27);ctx.lineTo(28,23);ctx.lineTo(-28,23);ctx.closePath();ctx.stroke();
  ctx.font='900 30px sans-serif';ctx.textAlign='center';ctx.fillText('!',0,17);
 }
 ctx.restore();return icon;
}
