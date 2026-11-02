// Deliberate synchronous boundaries, not every helper or per-triangle operation.
const editorMethods = [
 'updateRaceSceneryCollisions','updateRaceWearAndDamage','updateRaceDiagnostics',
 'stepRaceTireFxParticles','updateRaceEngineAudio','updateRaceTireAudio',
 'recordRaceGhostSample','updateRaceTriggers','updateRaceEdgeCenterResetFade',
 'updateRaceCheckpointProgress','getRaceTrackStateVisualCells',
 'updateRaceAiVehiclePhysics','getRaceAiContactState','getRaceAiLookaheadSeverity',
 'getRaceRuntimeTopSpeedLimitMps','getRaceSetupPhysicsModifiers','getRaceCompositedSurfaceAtWorldPoint',
 'getRaceThreeStaticWorldKey','clearRaceThreeStaticWorld','getRaceThreeDoodadSceneKey',
 'getRaceDoodadWorldQuad','addRaceThreeMeshGroups','getRaceThreePackedTerrainGeometry',
 'getRaceGroundElevationAtWorldPoint','updateRaceSnowParticleField',
 'drawRaceProjectedAiCars','drawRaceThirdPersonCar','drawRaceProjectedProceduralCar',
 'drawRaceProjectedCarSprite','drawRaceCarBillboardLayers','getRaceAiRestArtwork'
];
const runnerMethods = ['runStep','integrateChassis','sampleSurfaceConsistency',
 'createSweptWheelCylinders','createWheelCollisionSupportFeatures',
 'recoverFromPenetration','resetAuthoritativeState','recordNonPenetratingState','createSnapshot'];
export function attachDetailedPerformance(capture) {
 const e=capture.editor,s=e.playtestSession;
 // These CPU durations distinguish driver uploads/compilation from the rest
 // of render submission. They are not GPU execution timings. Avoid per-draw
 // wrappers, which would perturb every frame on mobile.
 const gl=e.raceThreeWorldRenderer?.threeRenderer?.getContext?.();
 for(const key of ['texImage2D','texSubImage2D','texStorage2D','compressedTexImage2D',
  'compressedTexSubImage2D','bufferData','bufferSubData','compileShader','linkProgram']) {
  try { capture.wrap(gl,key,`webgl.${key}`,{trace:false}); } catch { /* Some hosts forbid method overrides. */ }
 }
 for(const key of editorMethods)capture.wrap(e,key,`editor.${key}`);
 for(const key of ['evaluateTrackStateAiCandidates'])capture.wrap(e.raceSimulationSystems?.surface,key,`AIplanning.${key}`);
 // High-frequency per-cell work gets aggregate timings, not hundreds of
 // thousands of trace entries that would end a minute-long capture early.
 for(const key of ['catchUpCellWeather','applyEvent','getOrCreateCell','queueAccumulatedTireContact'])capture.wrap(s?.trackState,key,`trackState.${key}`,{trace:false});
 for(const key of ['createCellAtCoordinates','getBaseSurfaceForCoordinates','catchUpNewDryCellWeather','catchUpNewWetCellWeather','replaySharedCellWeather'])capture.wrap(s?.trackState,key,`trackState.${key}`,{trace:false});
 capture.wrap(s?.trackState?.contactAccumulator,'flushStep','trackState.flushContacts');
 for(const key of ['getVisualCells'])capture.wrap(s?.trackState,key,`trackState.${key}`);
 capture.wrap(e.game?.audio,'playWeatherThunder','audio.thunder');
 for(const key of ['getRaceRouteProjectionForWorldPoint','getRaceWheelSurfaceState','getRaceWheelContactState','getRaceRoadbedProfile','getRaceRouteLength'])
  capture.wrap(e,key,`editor.${key}`,{trace:false});
 // General surface lookup is separate from the prepared physics query frame.
 // Aggregate these boundaries so slow contact construction is attributable
 // without creating a trace span for every wheel or terrain triangle.
 for(const key of ['sampleWorld','sampleTrack','sampleRawTerrain','sampleBakedSurface'])
  capture.wrap(e.raceSurfaceModel,key,`surfaceLookup.${key}`,{trace:false});
 for(const key of ['getWheelContactState','getWheelSurfaceState'])
  capture.wrap(e.raceSimulationSystems?.surface,key,`surfaceLookup.${key}`,{trace:false});
 capture.wrap(s?.trackState,'sample','trackState.sample',{trace:false});
 const runners=[['player',s?.vehicleDynamicsRunner],...(s?.aiRuntime||[]).map((ai,i)=>[`AI[${i}]`,ai.vehicleDynamicsRunner])];
 for(const [label,runner] of runners){
  for(const key of runnerMethods)capture.wrap(runner,key,`${label}.${key}`,{trace:!capture.compactTrace || key==='resetAuthoritativeState'});
  for(const key of ['tireContactSubsystem','bodyCollision'])capture.wrap(runner?.[key],'step',`${label}.${key}.step`,{trace:!capture.compactTrace});
  const body=runner?.bodyCollision;
  for(const key of ['stepTerrain','findSweepImpact','prepareAdaptiveSupportCandidates'])
    capture.wrap(body,key,`${label}.collision.${key}`,{trace:!capture.compactTrace});
  for(const key of ['samplePosePenetration','sampleLowerHullMaximumPenetrationM','getAdaptiveSupportWorldUnprofiled'])
    capture.wrap(body,key,`${label}.collision.${key}`,{trace:false});
  capture.wrap(body?.staticColliderCollision,'step',`${label}.collision.staticColliders`,{trace:!capture.compactTrace});
 }
 for(const key of ['draw','end','paintScratch','clearScratch','paintArtwork','getOrCreateEntry','resizeTexture','copyTexture','updateTexture','fitPaintDepth','place'])capture.wrap(e.raceThreeWorldRenderer?.carDepthSprites,key,`carSprites.${key}`);
}
