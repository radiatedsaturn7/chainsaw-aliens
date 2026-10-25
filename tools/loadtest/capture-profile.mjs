import fs from 'node:fs';
const [target]=await (await fetch('http://127.0.0.1:9229/json/list')).json();
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0;const pending=new Map();
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);pending.get(m.id)?.(m.result);pending.delete(m.id);});
const send=method=>new Promise(resolve=>{pending.set(++id,resolve);ws.send(JSON.stringify({id,method}));});
await send('Profiler.enable');await send('Profiler.start');
await new Promise(resolve=>setTimeout(resolve,Number(process.argv[2]||10000)));
const {profile}=await send('Profiler.stop');ws.close();
fs.writeFileSync(process.argv[3]||'artifacts/p2loadtest/runtime.cpuprofile',JSON.stringify(profile));
const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const counts=new Map();
for(const id of profile.samples||[]){const frame=nodes.get(id).callFrame,key=`${frame.functionName} (${frame.url.split('/').at(-1)}:${frame.lineNumber+1})`;counts.set(key,(counts.get(key)||0)+1);}
console.log([...counts].sort((a,b)=>b[1]-a[1]).slice(0,20));
