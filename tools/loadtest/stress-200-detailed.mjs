// Diagnostic only. No production car limits or physics selection are changed.
// node tools/loadtest/stress-200-detailed.mjs [simulatedSeconds=5] [tag=200-detailed]
const seconds=Number(process.argv[2]||5);
if(!Number.isFinite(seconds)||seconds<=0||seconds>600)throw Error('Duration must be 0–600 simulated seconds');
const tag=process.argv[3]||'200-detailed';
Object.assign(process.env,{
 RTG_DETAILED_STRESS:'1',RTG_AI_COUNT:'200',RTG_AI_SPACED_GRID:'1',
 RTG_RACE_SOURCE:'data/server-storage/files/races/Mount Washington Auto Road %E2%80%94 point-to-point/document.json',
 RTG_FULL_CONVOY_PHYSICS:'1',RTG_AI_FULL_RATE:'1',RTG_PHASE_PROFILE:'1',
 RTG_AI_PROFILE:'1',RTG_PLAYER_PROFILE:'1',RTG_GC_PROFILE:'1',
 RTG_AUTODRIVE:'1',RTG_TIME_OF_DAY:'noon',RTG_BRIGHTNESS:'1',
 RTG_BENCHMARK_TAG:tag,RTG_CPU_PROFILE:'1',RTG_CPU_PROFILE_START_FRAME:'60'
});
process.argv[2]='clear';process.argv[3]=String(Math.ceil(seconds*60));
await import('./benchmark-mountain-stress.mjs');
