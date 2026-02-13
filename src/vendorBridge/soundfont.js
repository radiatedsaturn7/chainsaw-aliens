const SOUNDFONT_SCRIPT_PATH = 'vendor/soundfont-player.js';

export const getSoundfontPlayer = () => {
  const player = globalThis?.Soundfont;
  if (!player) {
    throw new Error(
      `SoundFont player is unavailable. Expected script "${SOUNDFONT_SCRIPT_PATH}" to be loaded before playback.`
    );
  }
  if (typeof player.instrument !== 'function') {
    throw new Error(
      `SoundFont player is invalid. Expected "${SOUNDFONT_SCRIPT_PATH}" to expose Soundfont.instrument(...).`
    );
  }
  return player;
};
