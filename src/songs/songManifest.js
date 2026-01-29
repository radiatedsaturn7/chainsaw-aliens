const DEFAULT_MANIFEST_URL = 'assets/songs/manifest.json';

const normalizeEntry = (entry) => {
  if (!entry) return null;
  const filename = entry.filename || entry.file || entry.zip;
  if (!filename) return null;
  return {
    filename,
    title: entry.title || entry.name || filename.replace(/\.zip$/i, '')
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
