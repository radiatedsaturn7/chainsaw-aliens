// Presentation-only timeline: never changes the player's chosen driving camera.
export const RACE_INTRO_DURATION = 5.7;
export function ensureRaceIntro(session) {
  if (session?.running && session.startupFramePending && !session.carEditorPreview
    && Number(session.countdownRemainingMs) > 0 && !session.raceIntro) {
    session.raceIntro = { elapsed: 0, active: true };
  }
  return session?.raceIntro;
}
export function advanceRaceIntro(session, dt) {
  const intro = session?.raceIntro;
  if (!intro?.active || session.startupFramePending) return;
  intro.elapsed = Math.min(RACE_INTRO_DURATION,
    Math.max(0, intro.elapsed) + Math.max(0, Math.min(.1, Number(dt) || 0)));
  // Never expose the camera/FOV switch if a slow frame steps over full black.
  if (!intro.handoffBlackDrawn && intro.elapsed >= 5.4) intro.elapsed = 5.4;
  if (intro.elapsed >= RACE_INTRO_DURATION) {
    intro.active = false;
    session.startupPhase = 'countdown';
  }
}
export function raceIntroShot(session) {
  const intro = session?.raceIntro;
  if (!intro?.active || intro.elapsed >= 5.4) return null;
  const shot = Math.min(2, Math.floor(intro.elapsed / 1.8));
  const t = (intro.elapsed - shot * 1.8) / 1.8;
  const ease = t * t * (3 - 2 * t);
  const angles = [[-55, -30], [100, 130], [205, 180]];
  return { shot, angle: (angles[shot][0] + (angles[shot][1] - angles[shot][0]) * ease) * Math.PI / 180,
    distance: [8, 8.5, 9][shot] + ease, height: 2, fov: 42 };
}
export function raceIntroFade(session) {
  const t = session?.raceIntro?.elapsed || 0;
  return session?.raceIntro?.active ? Math.max(0, 1 - Math.abs(t - 5.4) / .3) : 0;
}
