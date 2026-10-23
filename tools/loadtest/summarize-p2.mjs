import fs from 'node:fs';
const path=process.argv[2]||'artifacts/p2loadtest/ci-lap-60hz.json';
const report=JSON.parse(fs.readFileSync(path));
const percentile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))]??null;};
const warmupFrames=Math.ceil(5/(report.updateDt||1/60));
const rows=report.frames.filter(f=>f.frame>=warmupFrames);
const stats=rows=>Object.fromEntries(['updateMs','renderPreparationMs'].map(key=>[key,{p50:percentile(rows.map(f=>f[key]),.5),p95:percentile(rows.map(f=>f[key]),.95),p99:percentile(rows.map(f=>f[key]),.99),max:percentile(rows.map(f=>f[key]),1)}]));
const summary={race:report.race,complete:report.complete,authority:report.authority,aiCount:report.aiCount,routeLengthM:report.routeLength,maximumDistanceM:report.maxDistance,simulatedSeconds:report.frames.length*report.updateDt,frames:report.frames.length,warmupSecondsExcluded:5,cpuMilliseconds:stats(rows),peakCells:report.frames.reduce((max,f)=>Math.max(max,f.cells||0),0),peakTireMarks:report.frames.reduce((max,f)=>Math.max(max,f.marks||0),0),checkpoint:report.checkpoint,failure:report.failure,ai:report.ai,sections:[]};
for(let km=0;km<Math.ceil(report.routeLength/1000);km++){
 const section=rows.filter(f=>f.distance>=km*1000&&f.distance<(km+1)*1000);
 if(section.length)summary.sections.push({km,frames:section.length,...stats(section)});
}
const bins=new Set(report.frames.map(f=>Math.floor(f.distance/100)));
summary.routeCoverage100m={visited:bins.size,expected:Math.ceil(report.routeLength/100),missing:Array.from({length:Math.ceil(report.routeLength/100)},(_,i)=>i).filter(i=>!bins.has(i))};
summary.maximumProjectionJumpM=report.frames.reduce((max,f,i)=>i?Math.max(max,Math.abs(f.distance-report.frames[i-1].distance)):max,0);
summary.integratedTravelM=report.frames.reduce((sum,f)=>sum+Math.abs(f.speed||0)*report.updateDt,0);
summary.lapCoverageVerified=Boolean(summary.complete && !summary.routeCoverage100m.missing.length && summary.integratedTravelM>=summary.routeLengthM*.98);
console.log(JSON.stringify(summary,null,2));
