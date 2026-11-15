// Summarize retained actual driving samples; never infer visual acceptance.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const roots=process.argv.slice(2);assert.ok(roots.length,'Provide retained driving capture directories');
const ledger=JSON.parse(fs.readFileSync('data/race-environments/ledger.json')),files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(['driving-state.json','failure-state.json'].includes(e.name))files.push(p);}}
roots.forEach(walk);
const successes=[],failures=[];
for(const file of files){const d=JSON.parse(fs.readFileSync(file));if(file.endsWith('failure-state.json')){failures.push({file,...d});continue;}
 const row=ledger.rows.find(r=>r.raceRef===d.race),a=d.before.session,b=d.after.session;assert.ok(row?.binding);
 const displacementM=Math.hypot(b.worldX-a.worldX,b.worldZ-a.worldZ);assert.ok(displacementM>.5,'No measured movement');
 assert.ok(b.running&&!b.pending&&b.elapsed>2000&&b.speed>1,'Not a live driving sample');assert.equal(d.after.sky,row.binding.skyboxArtRef);
 assert.equal(d.after.fx.skyBrightness,row.authoredEnvironment.visualFx.skyBrightness,'Authored capture exposure differs');assert.equal(d.after.weather.id,row.authoredEnvironment.weather,'Authored weather differs');
 const png=fs.readFileSync(path.join(path.dirname(file),'authored-driving-b.png')),viewport={width:png.readUInt32BE(16),height:png.readUInt32BE(20)};
 successes.push({file,race:d.race,device:d.device||'See captured viewport and runner case',viewport,displacementM,elapsedMs:b.elapsed,speedMps:b.speed,sky:d.after.sky,brightness:d.after.fx.skyBrightness,missingArtRefs:d.after.diagnostics?.missingArtRefs,errors:d.errors,network:d.network});
}
console.log(JSON.stringify({scope:'Short real-travel and driving samples only. Inspect retained authored frames separately; no route-wide or visual acceptance inferred.',successes,failures,successfulSamples:successes.length,failedSamples:failures.length,distinctSuccessfulRaces:new Set(successes.map(r=>r.race)).size},null,2));
