// Warm immutable surfaces and isolated weather profiles. Do not create active cells:
// their creation order and water flow are authoritative simulation state.
export function prepareRaceAheadSlice(editor, cursor, limit = 8) {
  const session = editor.playtestSession;
  const track = session?.trackState;
  if (!track?.prepareBaseSurface || !editor.getRaceWorldPoseAtDistance) return true;
  const distance = Number(session.projectedDistance ?? session.distance ?? 0);
  const speed = Math.abs(Number(session.groundSpeedMps ?? session.speedMps) || 0);
  const spacing = Math.max(2, track.cellSizeM);
  // Refresh the corridor when the player moves; a resumable bounded scan, not a map scan.
  const anchor = Math.floor(distance / (spacing * 4)) * spacing * 4;
  if (cursor.anchor !== anchor || cursor.track !== track) {
    cursor.anchor = anchor; cursor.track = track; cursor.index = 0;
  }
  let weatherStepsRemaining = 32;
  for (let count = 0; count < limit && cursor.index < 96; count++, cursor.index++) {
    const row = Math.floor(cursor.index / 3), lane = cursor.index % 3 - 1;
    const ahead = Math.min(100, Math.max(16, speed * 2));
    const at = anchor + 4 + row / 31 * ahead;
    const pose = editor.getRaceWorldPoseAtDistance(at, { runtimeType: session.routeRuntimeType });
    if (!pose || !Number.isFinite(pose.x)) continue;
    const px = pose.x, pz = Number(pose.z ?? pose.y), segment = pose.segment;
    const next = editor.getRaceWorldPoseAtDistance(at + 1, { runtimeType: session.routeRuntimeType });
    const dx = Number(next?.x) - px, dz = Number(next?.z ?? next?.y) - pz;
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) continue;
    const length = Math.hypot(dx, dz) || 1;
    const width = Math.min(3, Number(editor.getRaceRoadHalfWidthWorld?.(segment)) || 3);
    const point = { x: px + dz / length * lane * width,
      z: pz - dx / length * lane * width };
    track.prepareBaseSurface(point);
    const weather = track.prepareNewCellWeather?.(point, weatherStepsRemaining);
    weatherStepsRemaining -= weather?.steps || 0;
    // Resume this point on a later frame; never run a whole history on demand.
    if (weather && !weather.complete) return false;
  }
  return cursor.index >= 96;
}

export function prepareRaceLoadingSurfaceSlice(editor, warm) {
  try {
    warm.surfacePrepared = editor.withRaceGeometryReadCache(() => prepareRaceAheadSlice(
      editor, editor.playtestSession.aheadPreparationCursor ||= {}, 8));
  } catch (error) {
    // A cache warmup failure must not prevent an otherwise playable race loading.
    warm.surfacePreparationError = String(error?.message || error).slice(0, 160);
    warm.surfacePrepared = true;
  }
  return warm.surfacePrepared;
}
