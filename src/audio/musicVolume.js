export const DEFAULT_MUSIC_VOLUME = 0.4;
export const DEFAULT_MASTER_VOLUME = 0.4;
const level=(value,fallback)=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):fallback;
// HTML media bypasses the Web Audio master bus. Apply both user controls once;
// RadioPlayer applies its independent race fade gain afterward.
export function musicMediaVolume(audio) {
  return level(audio?.volume,DEFAULT_MASTER_VOLUME)*level(audio?.midiBusVolume,DEFAULT_MUSIC_VOLUME);
}
