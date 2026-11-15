// Let deferred artwork invalidate/build meshes while the loading screen covers
// the race. Keep a bounded escape for an unresponsive optional-art worker.
export const RACE_STARTUP_ART_WAIT_MS = 30000;
export function raceStartupWarmupReady(warm, session, now) {
 const elapsed=now-warm.started;
 if(session.deferredArtWorker){warm.artReadyFrames=0;return elapsed>=RACE_STARTUP_ART_WAIT_MS&&warm.frames>=3;}
 warm.artReadyFrames=(warm.artReadyFrames||0)+1;
 return elapsed>=1000&&warm.frames>=3&&warm.artReadyFrames>=3;
}
