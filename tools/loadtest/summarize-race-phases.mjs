import fs from 'node:fs';
const [input,output]=process.argv.slice(2);
if(!input)throw Error('Usage: summarize-race-phases.mjs benchmark.json [output.json]');
const data=JSON.parse(fs.readFileSync(input));
const frames=(data.phaseFrames||[]).filter(f=>f.frame>=300);
const totals={};
for(const f of frames)for(const [name,ms] of Object.entries(f.ms)){
 const row=totals[name]||={name,ms:0,calls:0,work:0};
 row.ms+=ms;row.calls+=f.calls[name]||0;row.work+=f.work[name]||0;
}
const ranked=frames.map(f=>({...f,updateMs:data.rows[f.frame],
 cpuMs:(f.cpu.user+f.cpu.system)/1000})).sort((a,b)=>b.updateMs-a.updateMs);
const result={method:'Inclusive nested wall-time timers; do not sum phases. Process CPU includes all process threads.',
 frames:frames.length,totals:Object.values(totals).sort((a,b)=>b.ms-a.ms),worst:ranked.slice(0,20)};
if(output)fs.writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
