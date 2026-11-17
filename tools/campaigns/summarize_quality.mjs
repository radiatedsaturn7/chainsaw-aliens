import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p)),root='artifacts/campaign-quality/';
const inventory=read(root+'inventory.json'),roads=read(root+'road-runtime.json'),progression=read(root+'progression.json'),cities=read(root+'city-junctions.json'),loading=read(root+'main-loading.json'),timing=read(root+'timing-lines.json');
const names=new Set(inventory.races.map(r=>r.name));
const report={checkedAt:new Date().toISOString(),environment:'Android/Termux; background CPU scheduling. Load durations are diagnostic wall times, not foreground gameplay benchmarks.',loadingRetryNotes:loading.retryNotes||[],
 inventory:{count:inventory.count,errors:inventory.errors,warnings:inventory.warnings},
 runtimeRoads:{count:roads.count,errors:roads.errors,probes:roads.results.reduce((n,r)=>n+(r.probes||0),0),issues:roads.results.filter(r=>r.errors.length)},
 progression:{count:progression.count,errors:progression.errors,issues:progression.results.filter(r=>r.errors.length)},
 cityJunctions:{cities:cities.cityCount,junctions:cities.junctionCount,passed:cities.passed,failures:cities.failures},
 mainLoading:loading.results.map(r=>({id:r.id,ok:r.ok,seconds:r.seconds,peakRssKB:r.peakRssKB,error:r.error,unresolvedTerrainHeightSamples:r.terrainStats?.unresolvedHeightErrors||0})),
 timingReview:(Array.isArray(timing)?timing:timing.races).filter(r=>names.has(r.name)&&['manual-review','too-short'].includes(r.status)),
 economy:read(root+'economy.json'),featuredRewards:read('src/content/campaign-featured-rewards.json'),
 limitations:[
  'Medal targets are class-based planning estimates from road geometry and conditions, not measured driver or AI lap benchmarks.',
  'Economy scenario applies synthetic damage/service costs; it is not a complete driven campaign.',
  'Every catalogued event received road-mesh/contact, ordered checkpoint/projection, and dependency checks. Full terrain/worker load validation covered the eleven main missions, plus focused Burlington/Miami regressions.',
  'Terrain refinement may reach its resolution limit at some off-road samples; successful load checks do not imply every terrain approximation is exact.',
  'Real road geometry was preserved where timing-line audits found no nearby straight. Those entries remain manual-review items.',
  'Interactive mobile/browser presentation and human medal-time calibration remain playtest checks.'
 ]};
report.passed=inventory.errors===0&&roads.errors===0&&progression.errors===0&&roads.count===inventory.count&&progression.count===inventory.count&&cities.passed&&loading.results.length===11&&loading.results.every(r=>r.ok);
fs.writeFileSync('data/campaigns/america/progression-quality-report.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,events:inventory.count,timingReview:report.timingReview.length}));if(!report.passed)process.exitCode=1;
