export const KEY_LABELS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAME_ALIASES = { 'C#': 1, Db: 1, 'D#': 3, Eb: 3, 'F#': 6, Gb: 6, 'G#': 8, Ab: 8, 'A#': 10, Bb: 10 };

export const parseChordToken = (token) => {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const quality = /dim/i.test(trimmed)
    ? 'dim'
    : /m(in)?$/i.test(trimmed) || trimmed === trimmed.toLowerCase()
      ? 'min'
      : 'maj';
  const rootToken = trimmed.replace(/(dim|maj|min|m)$/i, '');
  const normalized = rootToken.length > 1 ? `${rootToken[0].toUpperCase()}${rootToken[1]}` : rootToken.toUpperCase();
  const root = NOTE_NAME_ALIASES[normalized] ?? KEY_LABELS.indexOf(normalized);
  if (root < 0) return null;
  return { root, quality };
};

export const parseChordProgressionInput = (input, loopBars) => {
  if (!input) return null;
  const segments = input.split(/[\n;]+/).map((segment) => segment.trim()).filter(Boolean);
  if (!segments.length) return null;
  const progression = [];
  segments.forEach((segment) => {
    const tokens = segment.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return;
    const [startRaw, endRaw] = tokens[0].split('-').map((value) => parseInt(value, 10));
    const startBar = Number.isInteger(startRaw) ? Math.max(1, startRaw) : 1;
    const endBar = Number.isInteger(endRaw) ? Math.max(startBar, endRaw) : startBar;
    const chords = tokens.slice(1).map(parseChordToken).filter(Boolean);
    if (!chords.length) return;
    const maxBars = Math.max(endBar, loopBars || endBar);
    for (let bar = startBar; bar <= Math.min(endBar, maxBars); bar += 1) {
      const chord = chords[(bar - startBar) % chords.length] || chords[chords.length - 1];
      if (!chord) continue;
      progression.push({ root: chord.root, quality: chord.quality, startBar: bar, lengthBars: 1 });
    }
  });
  return progression.length ? progression : null;
};

export const formatChordToken = (chord) => {
  if (!chord) return '';
  const name = KEY_LABELS[chord.root] || 'C';
  if (chord.quality === 'min') return `${name}m`;
  if (chord.quality === 'dim') return `${name}dim`;
  return name;
};
