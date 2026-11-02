import { serviceRacePerformanceWork } from './RacePerformanceUpload.js';

const disposedSessions = new WeakSet();

// Call when releasing a session, after any finish/ghost snapshots that need its
// state. Shared world/art caches belong to the editor and are deliberately kept.
export function disposeRaceSessionResources(editor, session = editor?.playtestSession, { reason = 'session-ended' } = {}) {
  if (!session || disposedSessions.has(session)) return { disposed: false, errors: [] };
  disposedSessions.add(session);
  const errors = [];
  const release = (operation) => {
    try { operation(); } catch (error) { errors.push(error); }
  };
  session.running = false;
  const authority = editor?.vehicleDynamicsAuthority;
  if (authority && (authority.session === session
    || (session.vehicleDynamicsRunner && authority.runner === session.vehicleDynamicsRunner))) {
    release(() => authority.workerBridge?.close?.());
    if (editor.vehicleDynamicsAuthority === authority) editor.vehicleDynamicsAuthority = null;
  }
  const capture = editor?.racePerformanceCapture;
  if (capture?.active && (capture.session === session
    || (!capture.session && editor?.playtestSession === session))) {
    release(() => capture.stop(reason));
  }
  release(() => session.incrementalRoadReset?.return?.());
  session.incrementalRoadReset = null;
  release(() => session.deferredArtWorker?.terminate?.());
  session.deferredArtWorker = null;
  release(() => session.frameSimulationClock?.resetDebt?.());
  release(() => session.frameBudget?.jobs?.clear?.());
  serviceRacePerformanceWork(editor);
  return { disposed: true, errors };
}
