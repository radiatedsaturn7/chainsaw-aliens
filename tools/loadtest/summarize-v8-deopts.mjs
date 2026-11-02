import fs from 'node:fs';
const [input,output]=process.argv.slice(2);
if(!input)throw Error('Usage: summarize-v8-deopts.mjs trace.log [output.json]');
let frame=-1,total=0,steady=0;
const reasons={},functions={},windows={};
for(const line of fs.readFileSync(input,'utf8').split('\n')){
 const marker=line.match(/^\{"frame":(\d+),/);
 if(marker)frame=Number(marker[1]);
 if(!line.includes('[bailout '))continue;
 total++;
 if(frame<300)continue;
 steady++;
 const reason=line.match(/reason: (.*?)\): begin/ )?.[1]||'unknown';
 const name=line.match(/<JSFunction (.*?) \(sfi/)?.[1]||'(anonymous)';
 reasons[reason]=(reasons[reason]||0)+1;
 functions[name]=(functions[name]||0)+1;
 const window=Math.floor(frame/600)*600;
 windows[window]=(windows[window]||0)+1;
}
const rank=x=>Object.entries(x).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}));
const result={method:'V8 trace bailout events after last logged frame >=300. Frame markers are approximate (every 10 frames); counts do not establish stall duration or causation.',lastLoggedFrame:frame,total,afterWarmup:steady,reasons:rank(reasons),functions:rank(functions),windows};
if(output)fs.writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
