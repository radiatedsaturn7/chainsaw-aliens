// Enabled only by a detailed recording. Keep aggregate counters in place and
// retain bounded slow-stage samples, not a new record for every tire contact.
export function createTrackEventQueueProbe(now, startedAt = 0) {
  const stages = Object.fromEntries(['normalize','lookup','idInsert','queueInsert'].map(name =>
    [name, {calls:0,totalMs:0,maxMs:0}]));
  const slow = [];
  return {now, stages, slow,
    end(name, start, track) {
      const end = now(), ms = Math.max(0, end - start), stage = stages[name];
      stage.calls++; stage.totalMs += ms; stage.maxMs = Math.max(stage.maxMs, ms);
      if (ms >= 4) {
        if (slow.length >= 48) slow.shift();
        slow.push({stage:name,atMs:start-startedAt,durationMs:ms,
          ids:track.eventIds.size,pending:track.pendingEvents.length,
          history:track.eventHistory.length,cells:track.cells.size});
      }
      return end;
    },
    snapshot() {
      return {stages:Object.fromEntries(Object.entries(stages).map(([k,v])=>[k,{...v}])),
        slow:slow.map(row=>({...row}))};
    }
  };
}
