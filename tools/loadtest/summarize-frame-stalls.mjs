import fs from 'node:fs';
const [input,output]=process.argv.slice(2);
if(!input)throw Error('Usage: summarize-frame-stalls.mjs benchmark.json [output.json]');
const data=JSON.parse(fs.readFileSync(input));
const frames=(data.frameSpans||[]).filter(f=>f.frame>=300);
const events=(data.gcEvents||[]).sort((a,b)=>a.start-b.start);
const rows=frames.map(frame=>{
 // Union overlapping GC intervals; do not count nested events twice.
 const intervals=events.filter(e=>e.start<frame.end && e.start+e.duration>frame.start)
  .map(e=>[Math.max(frame.start,e.start),Math.min(frame.end,e.start+e.duration)]);
 let gcMs=0,end=-Infinity;
 for(const [a,b] of intervals){gcMs+=Math.max(0,b-Math.max(end,a));end=Math.max(end,b);}
 return {frame:frame.frame,updateMs:data.rows[frame.frame],frameCpuMs:frame.end-frame.start,gcMs,gcEvents:intervals.length};
});
const total=rows.reduce((sum,r)=>sum+r.frameCpuMs,0);
const gc=rows.reduce((sum,r)=>sum+r.gcMs,0);
const slow=rows.filter(r=>r.updateMs>100);
const result={method:'GC event wall-time overlap with measured frame spans; not exact blocked CPU time. First 300 frames excluded.',
 frames:rows.length,totalFrameMs:total,gcOverlapMs:gc,gcOverlapPercent:total?100*gc/total:0,
 over100ms:slow.length,over100msWithGc:slow.filter(r=>r.gcMs>0).length,
 worst:rows.sort((a,b)=>b.updateMs-a.updateMs).slice(0,20)};
if(output)fs.writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
