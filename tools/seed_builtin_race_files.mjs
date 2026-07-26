import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { createBuiltInTestRaces, applyStudioSprintGraphicSettings } from '../src/racing/raceData.js';

const EXPORT_ROOT = path.resolve('data/server-storage/files');
const COMPACT_STORAGE_MARKER = '__chainsawStorage';
const COMPACT_STORAGE_VERSION = 'compact-v1';
const COMPACT_STORAGE_ENCODING = 'json-gzip-base64';
const COMPACT_STORAGE_MIN_BYTES = 4096;

function sanitizeProjectFileName(name = '') {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 64);
}

function encodeDocument(value) {
  const raw = JSON.stringify(value, null, 0);
  if (Buffer.byteLength(raw, 'utf8') < COMPACT_STORAGE_MIN_BYTES) return value;
  return {
    [COMPACT_STORAGE_MARKER]: COMPACT_STORAGE_VERSION,
    encoding: COMPACT_STORAGE_ENCODING,
    data: zlib.gzipSync(Buffer.from(raw, 'utf8'), { level: 9 }).toString('base64')
  };
}

function readManifest() {
  const manifestPath = path.join(EXPORT_ROOT, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return { folders: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : { folders: {} };
  } catch (error) {
    return { folders: {} };
  }
}

function writeRaceFile(race, savedAt) {
  const cleanName = sanitizeProjectFileName(race.name || race.id);
  const raceDir = path.join(EXPORT_ROOT, 'races', cleanName);
  fs.mkdirSync(raceDir, { recursive: true });
  const payload = {
    schemaVersion: 1,
    kind: 'race-track',
    savedAt,
    selectedRaceId: race.id,
    race
  };
  fs.writeFileSync(
    path.join(raceDir, 'document.json'),
    `${JSON.stringify(encodeDocument(payload), null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(raceDir, 'metadata.json'),
    `${JSON.stringify({ name: cleanName, folder: 'races', savedAt, version: 1 }, null, 2)}\n`,
    'utf8'
  );
  return cleanName;
}

const savedAt = 1783855400000;
const names = createBuiltInTestRaces().map((race) => {
  applyStudioSprintGraphicSettings(race);
  return writeRaceFile(race, savedAt);
});

const manifest = readManifest();
manifest.folders = manifest.folders && typeof manifest.folders === 'object' ? manifest.folders : {};
manifest.folders.races = manifest.folders.races && typeof manifest.folders.races === 'object'
  ? manifest.folders.races
  : {};
names.forEach((name) => {
  manifest.folders.races[name] = `races/${encodeURIComponent(name).replace(/%20/g, ' ')}/document.json`;
});
fs.mkdirSync(EXPORT_ROOT, { recursive: true });
fs.writeFileSync(path.join(EXPORT_ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Seeded ${names.length} race files: ${names.join(', ')}`);
