const STORAGE_KEY = 'pixelStudioCustomPalettes';

const BUILTIN_PRESETS = [
  {
    id: 'db16',
    name: 'DB16',
    file: './src/ui/pixel-editor/palettes/db16.json',
    colors: [
      '#140c1c', '#442434', '#30346d', '#4e4a4e', '#854c30', '#346524', '#d04648', '#757161',
      '#597dce', '#d27d2c', '#8595a1', '#6daa2c', '#d2aa99', '#6dc2ca', '#dad45e', '#deeed6'
    ]
  },
  {
    id: 'db32',
    name: 'DB32',
    file: './src/ui/pixel-editor/palettes/db32.json',
    colors: [
      '#000000', '#222034', '#45283c', '#663931', '#8f563b', '#df7126', '#d9a066', '#eec39a',
      '#fbf236', '#99e550', '#6abe30', '#37946e', '#4b692f', '#524b24', '#323c39', '#3f3f74',
      '#306082', '#5b6ee1', '#639bff', '#5fcde4', '#cbdbfc', '#ffffff', '#9badb7', '#847e87',
      '#696a6a', '#595652', '#76428a', '#ac3232', '#d95763', '#d77bba', '#8f974a', '#8a6f30'
    ]
  },
  {
    id: 'pico-8',
    name: 'PICO-8',
    file: './src/ui/pixel-editor/palettes/pico-8.json',
    colors: [
      '#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
      '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'
    ]
  },
  {
    id: 'gameboy',
    name: 'GameBoy',
    file: './src/ui/pixel-editor/palettes/gameboy.json',
    colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f']
  },
  {
    id: 'ega',
    name: 'EGA',
    file: './src/ui/pixel-editor/palettes/ega.json',
    colors: [
      '#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
      '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'
    ]
  }
];

const toHex = (value) => value.toString(16).padStart(2, '0');

export const rgbaToHex = (rgba) => `#${toHex(rgba.r)}${toHex(rgba.g)}${toHex(rgba.b)}`;

export const hexToRgba = (hex) => {
  if (!hex) return { r: 0, g: 0, b: 0, a: 0 };
  const normalized = hex.replace('#', '');
  const value = parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
    a: 255
  };
};

export const rgbaToUint32 = (rgba) => {
  const r = rgba?.r ?? 0;
  const g = rgba?.g ?? 0;
  const b = rgba?.b ?? 0;
  const a = rgba?.a ?? 0;
  return (a << 24) | (b << 16) | (g << 8) | r;
};

export const uint32ToRgba = (value) => ({
  r: value & 255,
  g: (value >> 8) & 255,
  b: (value >> 16) & 255,
  a: (value >> 24) & 255
});

export const normalizeHex = (hex) => {
  if (!hex) return null;
  const cleaned = hex.trim().replace(/^#/, '');
  if (cleaned.length === 3) {
    return `#${cleaned.split('').map((c) => c + c).join('')}`;
  }
  if (cleaned.length === 6) {
    return `#${cleaned.toLowerCase()}`;
  }
  return null;
};

export const buildPalette = (colors, name = 'Custom') => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  colors: colors.map((color, index) => {
    const hex = normalizeHex(color) || '#000000';
    return {
      id: `${name}-${index}`,
      hex,
      rgba: hexToRgba(hex)
    };
  })
});

export const loadPalettePresets = async () => {
  const presets = [];
  for (const preset of BUILTIN_PRESETS) {
    let colors = preset.colors;
    try {
      const response = await fetch(preset.file);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length) {
          colors = data;
        }
      }
    } catch (error) {
      console.warn(`[PixelStudio] Failed to load palette ${preset.name}. Using fallback.`, error);
    }
    presets.push(buildPalette(colors, preset.name));
  }
  return presets;
};

export const loadCustomPalettes = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.map((palette) => buildPalette(palette.colors || [], palette.name || 'Custom'));
  } catch (error) {
    console.warn('[PixelStudio] Failed to load custom palettes.', error);
    return [];
  }
};

export const saveCustomPalettes = (palettes) => {
  try {
    const payload = palettes.map((palette) => ({
      name: palette.name,
      colors: palette.colors.map((entry) => entry.hex)
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[PixelStudio] Failed to save custom palettes.', error);
  }
};

export const parsePaletteText = (text) => {
  if (!text) return [];
  return text
    .split(/\s+/)
    .map((token) => normalizeHex(token))
    .filter(Boolean);
};

export const paletteToHexList = (palette) => palette.colors.map((entry) => entry.hex).join('\n');

export const getNearestPaletteIndex = (palette, rgba) => {
  if (!palette?.colors?.length) return 0;
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  palette.colors.forEach((entry, index) => {
    const dr = entry.rgba.r - rgba.r;
    const dg = entry.rgba.g - rgba.g;
    const db = entry.rgba.b - rgba.b;
    const distance = Math.hypot(dr, dg, db);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
};

export const getPaletteSwatchHex = (palette, index) => palette.colors[index]?.hex || '#000000';
