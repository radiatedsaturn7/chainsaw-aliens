import { validateBarDurations, validateChordSymbolFormat, validateStructureSectionsPresent } from './songGenerator.js';

const SECTION_NAME_MAP = {
  I: 'intro',
  V: 'verse',
  P: 'prechorus',
  C: 'chorus',
  B: 'bridge',
  S: 'solo',
  O: 'outro'
};

const DURATION_VALUES = { w: 4, h: 2, q: 1, e: 0.5 };

const stripYamlComment = (line) => {
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    }
    if (!inQuotes && char === '#') {
      return line.slice(0, i).trimEnd();
    }
  }
  return line;
};

const parseInlineArray = (value) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map((entry) => parseValue(entry.trim()));
};

const parseInlineObject = (value) => {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return {};
  const obj = {};
  inner.split(',').forEach((entry) => {
    const [key, raw] = entry.split(':').map((part) => part.trim());
    if (!key) return;
    obj[key] = parseValue(raw ?? '');
  });
  return obj;
};

const parseValue = (value) => {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return '';
  const array = parseInlineArray(trimmed);
  if (array) return array;
  const obj = parseInlineObject(trimmed);
  if (obj) return obj;
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  const num = Number(trimmed);
  if (!Number.isNaN(num)) return num;
  return trimmed;
};

const parseBarLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('-')) return null;
  const content = trimmed.replace(/^-\s*/, '');
  const parsed = parseInlineArray(content);
  return Array.isArray(parsed) ? parsed : null;
};

const parseKeyValue = (line) => {
  const index = line.indexOf(':');
  if (index === -1) return null;
  const key = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim();
  return { key, value };
};

const fixBarDurations = (bar) => {
  const durations = bar.map((entry) => {
    const match = entry.match(/\((w|h|q|e)\)\s*$/);
    return match ? DURATION_VALUES[match[1]] : null;
  });
  if (durations.some((value) => value == null)) return bar;
  const total = durations.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 4) < 0.001) return bar;
  const target = 4 - (total - durations[durations.length - 1]);
  const closestToken = Object.entries(DURATION_VALUES).reduce((best, [token, value]) => {
    const diff = Math.abs(value - target);
    if (!best || diff < best.diff) return { token, diff };
    return best;
  }, null);
  if (!closestToken) return bar;
  const updated = [...bar];
  updated[updated.length - 1] = updated[updated.length - 1].replace(/\((w|h|q|e)\)\s*$/, `(${closestToken.token})`);
  return updated;
};

export const parseSetlistYaml = (text) => {
  const lines = text.split(/\r?\n/);
  const setlist = { definitions: {}, songs: [] };
  let currentSong = null;
  let currentSection = null;
  let inDefinitions = false;
  let inSongs = false;
  lines.forEach((rawLine) => {
    const cleaned = stripYamlComment(rawLine);
    if (!cleaned.trim()) return;
    if (cleaned.trim() === '---') return;
    const indent = cleaned.match(/^\s*/)[0].length;
    const trimmed = cleaned.trim();
    if (indent === 0) {
      const top = parseKeyValue(trimmed);
      if (top) {
        if (top.key === 'definitions') {
          inDefinitions = true;
          inSongs = false;
          return;
        }
        if (top.key === 'songs') {
          inDefinitions = false;
          inSongs = true;
          return;
        }
        setlist[top.key] = parseValue(top.value);
      }
      return;
    }
    if (inDefinitions && indent === 2) {
      const entry = parseKeyValue(trimmed);
      if (entry) {
        setlist.definitions[entry.key] = parseValue(entry.value);
      }
      return;
    }
    if (inSongs) {
      if (indent === 2 && trimmed.startsWith('- ')) {
        const entry = parseKeyValue(trimmed.replace(/^-\s*/, ''));
        currentSong = { sections: {} };
        setlist.songs.push(currentSong);
        if (entry) {
          currentSong[entry.key] = parseValue(entry.value);
        }
        currentSection = null;
        return;
      }
      if (!currentSong) return;
      if (indent === 4 && trimmed === 'sections:') {
        currentSong.sections = currentSong.sections || {};
        return;
      }
      if (indent === 4 && trimmed.endsWith(':')) {
        const key = trimmed.slice(0, -1).trim();
        currentSong[key] = {};
        return;
      }
      if (indent === 4 && trimmed.includes(':')) {
        const entry = parseKeyValue(trimmed);
        if (entry) {
          currentSong[entry.key] = parseValue(entry.value);
        }
        return;
      }
      if (indent === 6 && trimmed.endsWith(':')) {
        currentSection = trimmed.slice(0, -1).trim();
        currentSong.sections[currentSection] = [];
        return;
      }
      if (indent >= 8 && trimmed.startsWith('-')) {
        const bar = parseBarLine(trimmed);
        if (bar && currentSection) {
          currentSong.sections[currentSection].push(bar);
        }
      }
    }
  });
  return setlist;
};

const normalizeSetlistSong = (song) => {
  if (!song.sections) return song;
  const fixedSections = {};
  Object.entries(song.sections).forEach(([sectionName, bars]) => {
    fixedSections[sectionName] = bars.map((bar) => fixBarDurations(bar));
  });
  return { ...song, sections: fixedSections };
};

export const loadSetlistData = async () => {
  const response = await fetch('data/robtersession_setlist.yaml');
  if (!response.ok) {
    throw new Error(`Failed to load setlist: ${response.status}`);
  }
  const text = await response.text();
  const parsed = parseSetlistYaml(text);
  const normalizedSongs = parsed.songs.map((song) => normalizeSetlistSong(song));
  const normalized = { ...parsed, songs: normalizedSongs };
  normalized.songs.forEach((song) => {
    validateBarDurations(song);
    validateStructureSectionsPresent(song, SECTION_NAME_MAP);
    validateChordSymbolFormat(song);
  });
  return normalized;
};

export const buildSetlistSets = (setlist, mapDifficultyToTierNumber) => {
  if (!setlist?.songs?.length) return [];
  const songs = setlist.songs.map((song) => normalizeSetlistSong(song));
  const sets = [];
  const setSize = 5;
  for (let i = 0; i < songs.length; i += setSize) {
    const group = songs.slice(i, i + setSize);
    const setIndex = Math.floor(i / setSize) + 1;
    const avgDifficulty = group.reduce((sum, entry) => sum + (entry.difficulty || 1), 0) / group.length;
    const tier = mapDifficultyToTierNumber ? mapDifficultyToTierNumber(avgDifficulty) : 1;
    sets.push({
      id: `setlist-${setIndex}`,
      title: `Setlist ${setIndex}`,
      tier,
      songs: group.map((entry) => ({
        name: entry.title,
        instrument: 'guitar',
        hint: `${entry.band} • ${entry.key} • ${entry.style_tags?.join('/') || 'rock'}`,
        difficulty: entry.difficulty,
        schema: entry
      }))
    });
  }
  return sets;
};

export const getSectionNameFromLetter = (letter) => SECTION_NAME_MAP[letter.toUpperCase()];
