import {
  generateStructuredSong,
  validateBarDurations,
  validateChordSymbolFormat,
  validateStructureSectionsPresent
} from '../../src/robtersession/songGenerator.js';

const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const collectRoots = (bars) => (
  bars.flat().map((entry) => entry.replace(/\((w|h|q|e)\)\s*$/, '').replace(/\(([^)]+)\)/g, '').split('/')[0])
);

for (let difficulty = 1; difficulty <= 10; difficulty += 1) {
  for (let i = 0; i < 20; i += 1) {
    const seed = `harness-${difficulty}-${i}`;
    const song = generateStructuredSong({ difficulty, seed });
    const barErrors = validateBarDurations(song);
    const structureErrors = validateStructureSectionsPresent(song);
    const chordErrors = validateChordSymbolFormat(song);
    assert(!barErrors.length, `Bar duration errors for difficulty ${difficulty} seed ${seed}.`);
    assert(!structureErrors.length, `Structure errors for difficulty ${difficulty} seed ${seed}.`);
    assert(!chordErrors.length, `Chord format errors for difficulty ${difficulty} seed ${seed}.`);
    assert(!song.key.toLowerCase().includes('locrian'), `Locrian key found for difficulty ${difficulty} seed ${seed}.`);
    const verseRoots = collectRoots(song.sections.verse || []);
    const chorusRoots = collectRoots(song.sections.chorus || []);
    const uniqueRoots = new Set([...verseRoots, ...chorusRoots]);
    assert(uniqueRoots.size >= 3, `Chord diversity failure for difficulty ${difficulty} seed ${seed}.`);
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('RobterSESSION song generator harness passed.');
