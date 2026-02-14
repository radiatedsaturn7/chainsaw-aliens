import {
  validateBarDurations,
  validateChordSymbolFormat,
  validatePatternLibrary,
  validatePatternReferences,
  validateRegisterRules,
  validateRequiredChordTypes,
  validateStructureSectionsPresent
} from './songGenerator.js';

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

const parsePatternYaml = (text) => {
  const lines = text.split(/\r?\n/);
  const parsed = {};
  let currentList = null;
  let currentItem = null;
  lines.forEach((rawLine) => {
    const cleaned = stripYamlComment(rawLine);
    if (!cleaned.trim()) return;
    if (cleaned.trim() === '---') return;
    const indent = cleaned.match(/^\s*/)[0].length;
    const trimmed = cleaned.trim();
    if (indent === 0 && trimmed.includes(':')) {
      const entry = parseKeyValue(trimmed);
      if (!entry) return;
      if (!entry.value) {
        parsed[entry.key] = [];
        currentList = entry.key;
        currentItem = null;
      } else {
        parsed[entry.key] = parseValue(entry.value);
        currentList = null;
        currentItem = null;
      }
      return;
    }
    if (currentList && indent === 2 && trimmed.startsWith('- ')) {
      const entry = parseKeyValue(trimmed.replace(/^-\s*/, ''));
      const item = {};
      if (entry) {
        item[entry.key] = parseValue(entry.value);
      }
      parsed[currentList].push(item);
      currentItem = item;
      return;
    }
    if (currentItem && indent >= 4 && trimmed.includes(':')) {
      const entry = parseKeyValue(trimmed);
      if (entry) {
        currentItem[entry.key] = parseValue(entry.value);
      }
    }
  });
  return parsed;
};

const parseSongIndexYaml = (text) => {
  const lines = text.split(/\r?\n/);
  const index = { songs: [], setlist_version: null };
  let inSongs = false;
  lines.forEach((rawLine) => {
    const cleaned = stripYamlComment(rawLine);
    if (!cleaned.trim()) return;
    if (cleaned.trim() === '---') return;
    const indent = cleaned.match(/^\s*/)[0].length;
    const trimmed = cleaned.trim();
    if (indent === 0) {
      const entry = parseKeyValue(trimmed);
      if (!entry) return;
      if (entry.key === 'songs') {
        inSongs = true;
        return;
      }
      index[entry.key] = parseValue(entry.value);
      inSongs = false;
      return;
    }
    if (inSongs && indent === 2 && trimmed.startsWith('-')) {
      const value = trimmed.replace(/^-\s*/, '');
      index.songs.push(parseValue(value));
    }
  });
  return index;
};

const parseSongYaml = (text) => {
  const lines = text.split(/\r?\n/);
  const root = {};
  const stack = [{ indent: -1, container: root }];
  lines.forEach((rawLine) => {
    const cleaned = stripYamlComment(rawLine);
    if (!cleaned.trim()) return;
    if (cleaned.trim() === '---') return;
    const indent = cleaned.match(/^\s*/)[0].length;
    const trimmed = cleaned.trim();
    const entry = parseKeyValue(trimmed);
    if (!entry) return;
    while (stack.length && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].container;
    if (!entry.value) {
      const next = {};
      parent[entry.key] = next;
      stack.push({ indent, container: next });
      return;
    }
    parent[entry.key] = parseValue(entry.value);
  });
  return root.song || root;
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

const splitEventsIntoBars = (events) => {
  const bars = [];
  let bar = [];
  let total = 0;
  events.forEach((entry) => {
    const match = entry.match(/\((w|h|q|e)\)\s*$/);
    const duration = match ? DURATION_VALUES[match[1]] : null;
    if (duration == null) return;
    if (total + duration > 4 && bar.length) {
      bars.push(bar);
      bar = [];
      total = 0;
    }
    bar.push(entry);
    total += duration;
    if (Math.abs(total - 4) < 0.001) {
      bars.push(bar);
      bar = [];
      total = 0;
    }
  });
  if (bar.length) bars.push(bar);
  return bars;
};

const convertV2SongToLegacy = (song, patternsLibrary) => {
  const sections = {};
  Object.entries(song.sections || {}).forEach(([sectionName, section]) => {
    const guitarEvents = section.guitar || [];
    const bars = splitEventsIntoBars(guitarEvents).map((bar) => fixBarDurations(bar));
    const normalizedSection = { ...section };
    if (bars.length) {
      normalizedSection.chords = bars;
    }
    sections[sectionName] = normalizedSection;
  });
  return {
    ...song,
    sections,
    patternsLibrary
  };
};

export const parseSetlistYaml = (text) => {
  const lines = text.split(/\r?\n/);
  const setlist = { definitions: {}, songs: [] };
  let currentSong = null;
  let currentSection = null;
  let currentNestedKey = null;
  let currentArrangementRegister = null;
  let currentPartKey = null;
  let currentPartSub = null;
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
        currentNestedKey = null;
        currentArrangementRegister = null;
        currentPartKey = null;
        currentPartSub = null;
        return;
      }
      if (!currentSong) return;
      if (indent === 4 && trimmed === 'sections:') {
        currentSong.sections = currentSong.sections || {};
        currentSection = null;
        currentNestedKey = null;
        return;
      }
      if (indent === 4 && trimmed.endsWith(':')) {
        const key = trimmed.slice(0, -1).trim();
        currentSong[key] = {};
        currentNestedKey = key;
        currentArrangementRegister = null;
        currentPartKey = null;
        currentPartSub = null;
        return;
      }
      if (indent === 4 && trimmed.includes(':')) {
        const entry = parseKeyValue(trimmed);
        if (entry) {
          currentSong[entry.key] = parseValue(entry.value);
        }
        return;
      }
      if (indent === 6 && currentNestedKey === 'arrangement') {
        if (trimmed.endsWith(':')) {
          const key = trimmed.slice(0, -1).trim();
          if (key === 'registers') {
            currentSong.arrangement.registers = {};
          }
          return;
        }
        const entry = parseKeyValue(trimmed);
        if (entry) {
          currentSong.arrangement[entry.key] = parseValue(entry.value);
        }
        return;
      }
      if (indent === 8 && currentNestedKey === 'arrangement') {
        if (!currentSong.arrangement.registers) currentSong.arrangement.registers = {};
        if (trimmed.endsWith(':')) {
          currentArrangementRegister = trimmed.slice(0, -1).trim();
          currentSong.arrangement.registers[currentArrangementRegister] = {};
        }
        return;
      }
      if (indent === 10 && currentNestedKey === 'arrangement' && currentArrangementRegister) {
        const entry = parseKeyValue(trimmed);
        if (entry) {
          currentSong.arrangement.registers[currentArrangementRegister][entry.key] = parseValue(entry.value);
        }
        return;
      }
      if (indent === 6 && currentNestedKey === 'parts') {
        if (trimmed.endsWith(':')) {
          currentPartKey = trimmed.slice(0, -1).trim();
          currentSong.parts[currentPartKey] = {};
          currentPartSub = null;
        }
        return;
      }
      if (indent === 8 && currentNestedKey === 'parts' && currentPartKey) {
        if (trimmed.endsWith(':')) {
          currentPartSub = trimmed.slice(0, -1).trim();
          currentSong.parts[currentPartKey][currentPartSub] = {};
          return;
        }
        const entry = parseKeyValue(trimmed);
        if (entry) {
          currentSong.parts[currentPartKey][entry.key] = parseValue(entry.value);
        }
        return;
      }
      if (indent === 10 && currentNestedKey === 'parts' && currentPartKey && currentPartSub) {
        const entry = parseKeyValue(trimmed);
        if (entry) {
          currentSong.parts[currentPartKey][currentPartSub][entry.key] = parseValue(entry.value);
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

const normalizeSetlistSong = (song, patternsLibrary) => {
  if (!song.sections) return song;
  const fixedSections = {};
  Object.entries(song.sections).forEach(([sectionName, bars]) => {
    if (Array.isArray(bars)) {
      fixedSections[sectionName] = bars.map((bar) => fixBarDurations(bar));
      return;
    }
    const normalizedSection = { ...bars };
    if (Array.isArray(bars?.chords)) {
      normalizedSection.chords = bars.chords.map((bar) => fixBarDurations(bar));
    } else if (Array.isArray(bars?.guitar)) {
      normalizedSection.chords = splitEventsIntoBars(bars.guitar).map((bar) => fixBarDurations(bar));
    }
    fixedSections[sectionName] = normalizedSection;
  });
  return { ...song, sections: fixedSections, patternsLibrary };
};

export const loadSetlistData = async () => {
  const patternsResponse = await fetch('data/robtersession_patterns.yaml');
  if (!patternsResponse.ok) {
    throw new Error(`Failed to load patterns: ${patternsResponse.status}`);
  }
  const patternsText = await patternsResponse.text();
  const patterns = parsePatternYaml(patternsText);
  const response = await fetch('data/robtersession_setlist_v2.yaml');
  if (!response.ok) {
    throw new Error(`Failed to load setlist: ${response.status}`);
  }
  const text = await response.text();
  const index = parseSongIndexYaml(text);
  const songResponses = await Promise.all(
    (index.songs || []).map(async (path) => {
      const songResponse = await fetch(path);
      if (!songResponse.ok) {
        throw new Error(`Failed to load song: ${songResponse.status}`);
      }
      const songText = await songResponse.text();
      return parseSongYaml(songText);
    })
  );
  const normalizedSongs = songResponses.map((song) => convertV2SongToLegacy(song, patterns));
  const normalized = {
    ...index,
    patterns,
    definitions: {},
    songs: normalizedSongs
  };
  validatePatternLibrary(patterns);
  validateRequiredChordTypes(normalized);
  normalized.songs.forEach((song) => {
    validateBarDurations(song);
    validateStructureSectionsPresent(song, SECTION_NAME_MAP);
    validateChordSymbolFormat(song);
    validatePatternReferences(song, patterns);
    validateRegisterRules(song);
  });
  return normalized;
};

export const buildSetlistSets = (setlist, mapDifficultyToTierNumber) => {
  if (!setlist?.songs?.length) return [];
  const songs = setlist.songs.map((song) => normalizeSetlistSong(song, setlist.patterns));
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
