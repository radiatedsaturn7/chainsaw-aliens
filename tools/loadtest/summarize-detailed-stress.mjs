import fs from 'node:fs';
const path=process.argv[2];
if(!path)throw Error('Usage: node tools/loadtest/summarize-detailed-stress.mjs report.json [summary.json]');
const r=JSON.parse(fs.readFileSync(path));
if(!r.detailedStress)throw Error('Not a detailed stress capture');
const rank=(o,key)=>Object.entries(o||{}).map(([name,v])=>({name,...(typeof v==='number'?{value:v}:v)})).sort((a,b)=>(b[key]||0)-(a[key]||0));
const steps=Object.values(r.detailedSteps),cars=r.aiStates;
const progress=r.roadObservations;
const result={source:path,authority:r.authority,sourcePath:r.sourcePath,sourceDigest:r.sourceDigest,
 aiCount:r.aiCount,totalCars:r.totalCars,simulatedSeconds:r.simulatedSeconds,wallSeconds:r.wallMs/1000,
 updateMs:{median:r.p50Ms,p95:r.p95Ms,p99:r.p99Ms,maxSteady:Math.max(...r.rows.slice(r.warmupFrames)),maxIncludingStartup:Math.max(...r.rows)},
 detailedStepCount:{minimum:Math.min(...steps),maximum:Math.max(...steps),total:steps.reduce((a,b)=>a+b,0)},
 cheapCars:cars.filter(c=>c.detail==='distant').length,movingCars:cars.filter(c=>c.speedMps>1).length,
 stalledCars:cars.filter(c=>c.speedMps<1&&c.targetSpeedMps>1).length,
 resetCount:cars.reduce((n,c)=>n+c.resets,0),resetFailures:cars.filter(c=>c.resetError).map(c=>({id:c.id,error:c.resetError})),
 observations:{offRoad:progress.reduce((n,c)=>n+c.offRoadSamples,0),stalled:progress.reduce((n,c)=>n+c.stalledSamples,0),belowRoad:progress.reduce((n,c)=>n+c.belowRoadSamples,0)},
 phases:rank(r.steadyTotals,'value'),physicsExclusive:rank(r.detailedTotals,'exclusiveMs'),
 counters:r.detailedCounters,slowAiCalls:r.slowAiCalls.slice(0,12),
 gc:{events:r.gcEvents.length,totalMs:r.gcEvents.reduce((n,e)=>n+e.duration,0),maxMs:Math.max(0,...r.gcEvents.map(e=>e.duration))},
 topCars:r.perCarCosts.sort((a,b)=>(b.methods.updateRaceAiVehiclePhysics?.ms||0)-(a.methods.updateRaceAiVehiclePhysics?.ms||0)).slice(0,10)};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
