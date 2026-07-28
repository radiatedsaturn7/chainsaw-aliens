const DEFAULT_MANIFEST_URL = 'assets/songs/manifest.json';

const LEGACY_SONG_ALIASES = {
  'MIDI 2.zip': {
    filename: 'Jenny by The Fire Temples.zip',
    title: 'Jenny by The Fire Temples'
  }
};

const normalizeEntry = (entry) => {
  if (!entry) return null;
  let filename = entry.filename || entry.file || entry.zip;
  if (!filename) return null;
  const legacy = LEGACY_SONG_ALIASES[filename];
  if (legacy?.filename) {
    filename = legacy.filename;
  }
  let title = entry.title || entry.name || filename.replace(/\.zip$/i, '');
  if (legacy?.title) {
    title = legacy.title;
  }
  if (title === 'MIDI 2') {
    title = 'Jenny by The Fire Temples';
  }
  return {
    filename,
    title
  };
};

export const loadSongManifest = async (url = DEFAULT_MANIFEST_URL) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load song manifest: ${response.status}`);
  }
  const data = await response.json();
  const songs = Array.isArray(data?.songs) ? data.songs : [];
  return songs.map(normalizeEntry).filter(Boolean);
};

export const getDefaultManifestUrl = () => DEFAULT_MANIFEST_URL;
