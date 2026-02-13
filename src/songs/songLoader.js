import { createZip, loadZipFromBytes } from '../vendorBridge/zip.js';

const INSTRUMENT_PATTERNS = [
  { name: 'Bass', regex: /\bBass\b/i },
  { name: 'Guitar', regex: /\bGuitar\b/i },
  { name: 'Drums', regex: /\bDrums?\b/i },
  { name: 'Percussion', regex: /\bPercussion\b/i },
  { name: 'Keyboard', regex: /\bKeys?\b|\bKeyboard\b|\bPiano\b/i },
  { name: 'Synth', regex: /\bSynth\b|\bPad\b/i }
];

const detectInstrumentName = (filename) => {
  const clean = filename.replace(/\\/g, '/').split('/').pop() || filename;
  const base = clean.replace(/\.mid(i)?$/i, '');
  const normalized = base.replace(/[()_\-]/g, ' ');
  const match = INSTRUMENT_PATTERNS.find((entry) => entry.regex.test(normalized));
  return match?.name || 'Unknown';
};

export const loadZipSongFromBytes = async (bytes) => {
  const zip = await loadZipFromBytes(bytes);
  const stems = new Map();
  const files = [];
  const pending = [];
  zip.forEach((relativePath, file) => {
    if (file.dir) return;
    if (!/\.mid(i)?$/i.test(relativePath)) return;
    files.push(relativePath);
    pending.push(file.async('uint8array').then((bytes) => {
      const instrument = detectInstrumentName(relativePath);
      stems.set(instrument, { filename: relativePath, bytes });
    }));
  });
  await Promise.all(pending);
  return {
    stems,
    meta: {
      files,
      instruments: Array.from(stems.keys())
    }
  };
};

export const loadZipSong = async (zipUrl) => {
  const response = await fetch(zipUrl);
  if (!response.ok) {
    throw new Error(`Failed to load zip song: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return loadZipSongFromBytes(arrayBuffer);
};

export const buildZipFromStems = async (stems = []) => {
  const zip = createZip();
  stems.forEach((stem) => {
    if (!stem?.filename || !stem?.bytes) return;
    zip.file(stem.filename, stem.bytes);
  });
  return zip.generateAsync({ type: 'blob' });
};

export const getInstrumentFromFilename = detectInstrumentName;
