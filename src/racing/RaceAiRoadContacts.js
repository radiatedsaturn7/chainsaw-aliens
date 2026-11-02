import {createRaceWheelContactStateFromSamples} from './RaceVehicleSurfaceContact.js';
import {RACE_THREE_ELEVATION_M} from './simulation/RaceSimulationConfig.js';
import {RACE_WHEEL_IDS} from './simulation/SimulationMath.js';

// Use the same baked geometry contract as the authoritative solver. The legacy
// visual sampler also computed neighbouring raw terrain heights/normals for each
// wheel, even when that wheel was supported entirely by the road mesh.
export function sampleRaceAiWheelContacts(editor, ai, {car,tuning,session}) {
  const model=editor.getRaceSurfaceModel?.();
  if (!editor.playtestSession?.worldBake?.surfaceSampler || !model?.samplePhysicsGeometry
    || !editor.getRaceWheelWorldPositions || editor.playtestSession?.debugAiLegacyContacts) {
    return editor.getRaceWheelContactState({car,tuning,session});
  }
  const positions=editor.getRaceWheelWorldPositions({car,tuning,session});
  const surfaceSamples={};
  const request={runtimeType:session.routeRuntimeType,weatherState:editor.getRaceWeatherState()};
  // Resolve the immutable road profile once for this four-wheel batch. Each
  // point still projects independently (including bridges) and reads live grip.
  // Do not retain this context across updates, editor changes or bake swaps.
  const context=typeof model.createPhysicsQueryContext==='function'
    ? {...model.createPhysicsQueryContext(request)} : request;
  const bake=editor.playtestSession.worldBake;
  if (!editor.playtestSession.debugAiNoContactCache) {
    context.localCandidateRevision=bake.surfaceRevision ?? bake.revision ?? bake.key ?? 0;
  }
  for(const id of RACE_WHEEL_IDS) surfaceSamples[id]=model.samplePhysicsGeometry(positions[id],context);
  const contacts=createRaceWheelContactStateFromSamples({positions,surfaceSamples,tuning,
    carDimensions:editor.getRaceCarDimensions(car),trackState:session.trackState,
    elevationScaleM:RACE_THREE_ELEVATION_M});
  contacts.surfaceSamples=surfaceSamples;
  return contacts;
}
