export function racePerformanceStatus(capture) {
 if(!capture)return null;
 if(capture.active){
  const seconds=Math.min(Math.floor(capture.durationMs/1000),Math.floor((capture.now()-capture.started)/1000));
  return {text:`REC ${seconds}s / ${capture.durationMs/1000}s`,color:'#ff5252'};
 }
 if(capture.uploadState==='queued')return {text:'Capture ready · uploads when paused',color:'#ffd166'};
 if(capture.uploadState==='uploading')return {text:'Uploading capture…',color:'#ffd166'};
 if(capture.uploadState==='saved')return {text:'Capture submitted ✓',color:'#64e5ac'};
 if(capture.uploadState==='failed')return {text:'Upload failed · retry in Debug',detail:String(capture.uploadError||'').slice(0,240),color:'#ff8866'};
 return null;
}
export function drawRacePerformanceStatus(ctx,bounds,capture){
 const status=racePerformanceStatus(capture);if(!status)return;
 ctx.save();
 const fontSize=Math.max(9,Math.min(14,bounds.w/30));ctx.font=`bold ${fontSize}px sans-serif`;
 const lines=[status.text];
 if(status.detail){
  let line='';
  for(const word of status.detail.split(/\s+/)){
   const next=line?`${line} ${word}`:word;
   if(line&&ctx.measureText(next).width>bounds.w-42){lines.push(line);line=word;}
   else line=next;
  }
  if(line)lines.push(line);
 }
 const width=Math.min(bounds.w-12,Math.max(...lines.map(line=>ctx.measureText(line).width))+30),height=fontSize*lines.length+12;
 const x=bounds.x+(bounds.w-width)/2,y=bounds.y+6;
 ctx.globalAlpha=1;ctx.fillStyle='rgba(0,0,0,0.82)';ctx.fillRect(x,y,width,height);
 ctx.fillStyle=status.color;ctx.beginPath();ctx.arc(x+10,y+6+fontSize/2,3,0,Math.PI*2);ctx.fill();
 ctx.textAlign='left';ctx.textBaseline='middle';lines.forEach((line,index)=>ctx.fillText(line,x+20,y+6+fontSize*(index+.5),width-24));ctx.restore();
}
