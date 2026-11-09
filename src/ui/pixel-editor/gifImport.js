// GIF87a/89a raster decoder. Frames are composited before being resized so
// partial updates, transparency, and restore-background/previous disposal work.
// Format reference: https://www.w3.org/Graphics/GIF/spec-gif89a.txt
function decodeLzw(bytes, minimum, count) {
  if (minimum < 2 || minimum > 8) throw Error('Invalid GIF code size');
  const clear = 1 << minimum, end = clear + 1;
  let table, size, next, previous = null, bit = 0, written = 0;
  const output = new Uint8Array(count);
  const reset = () => { table = Array.from({ length: clear }, (_, i) => [i]); size = minimum + 1; next = end + 1; previous = null; };
  reset();
  while (bit + size <= bytes.length * 8) {
    let code = 0;
    for (let i = 0; i < size; i++, bit++) code |= ((bytes[bit >> 3] >> (bit & 7)) & 1) << i;
    if (code === clear) { reset(); continue; }
    if (code === end) { if (written !== count) throw Error('Incomplete GIF frame'); return output; }
    const entry = code < next ? table[code] : code === next && previous ? [...previous, previous[0]] : null;
    if (!entry || written + entry.length > count) throw Error('Invalid GIF image data');
    output.set(entry, written); written += entry.length;
    if (previous && next < 4096) {
      table[next++] = [...previous, entry[0]];
      if (next === 1 << size && size < 12) size++;
    }
    previous = entry;
  }
  throw Error('Truncated GIF image data');
}

export function decodeGif(input, { maxDimension = 512, maxPixels = 32 * 1024 * 1024 } = {}) {
  const bytes = new Uint8Array(input);
  let pos = 0;
  const take = n => { if (pos + n > bytes.length) throw Error('Truncated GIF'); const b = bytes.subarray(pos, pos + n); pos += n; return b; };
  const u8 = () => take(1)[0];
  const u16 = () => { const b = take(2); return b[0] | b[1] << 8; };
  const text = b => String.fromCharCode(...b);
  if (!/^GIF8[79]a$/.test(text(take(6)))) throw Error('Invalid GIF header');
  const sourceWidth = u16(), sourceHeight = u16(), packed = u8(), background = u8(); u8();
  if (!sourceWidth || !sourceHeight || sourceWidth * sourceHeight > 16 * 1024 * 1024) throw Error('GIF canvas is too large');
  const palette = flags => Array.from({ length: 2 << (flags & 7) }, () => { const c = take(3); return (0xff000000 | c[2] << 16 | c[1] << 8 | c[0]) >>> 0; });
  const global = packed & 128 ? palette(packed) : null;
  const blocks = () => { const chunks = []; let length = 0, n; while ((n = u8())) { chunks.push(take(n)); length += n; } const result = new Uint8Array(length); let offset = 0; for (const c of chunks) { result.set(c, offset); offset += c.length; } return result; };
  const scale = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale)), height = Math.max(1, Math.round(sourceHeight * scale));
  let screen = new Uint32Array(sourceWidth * sourceHeight), control = {}, loop = false, work = 0;
  const frames = [];
  while (pos < bytes.length) {
    const marker = u8();
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const kind = u8();
      if (kind === 0xf9) {
        if (u8() !== 4) throw Error('Invalid GIF control block');
        const flags = u8(), delay = u16(), transparent = u8();
        if (u8() !== 0) throw Error('Invalid GIF control terminator');
        control = { disposal: (flags >> 2) & 7, durationMs: delay ? delay * 10 : 100, transparent: flags & 1 ? transparent : -1 };
      } else if (kind === 0xff) {
        const app = text(take(u8())), data = blocks();
        if (/^(NETSCAPE2.0|ANIMEXTS1.0)$/.test(app) && data[0] === 1) loop = true;
      } else { blocks(); if (kind === 1) control = {}; }
      continue;
    }
    if (marker !== 0x2c) throw Error('Invalid GIF block');
    const left = u16(), top = u16(), w = u16(), h = u16(), flags = u8();
    if (!w || !h || left + w > sourceWidth || top + h > sourceHeight) throw Error('Invalid GIF frame bounds');
    work += sourceWidth * sourceHeight;
    if ((frames.length + 1) * width * height > maxPixels || frames.length >= 1000 || work > 256 * 1024 * 1024) throw Error('GIF has too many pixels or frames to import');
    const colors = flags & 128 ? palette(flags) : global;
    if (!colors) throw Error('Missing GIF palette');
    const codeSize = u8();
    const indices = decodeLzw(blocks(), codeSize, w * h);
    const clearColor = control.transparent >= 0 ? 0 : (global?.[background] ?? 0);
    if (!frames.length) screen.fill(clearColor);
    const previous = control.disposal === 3 ? screen.slice() : null;
    const rows = [];
    if (flags & 64) { for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let y = start; y < h; y += step) rows.push(y); }
    else for (let y = 0; y < h; y++) rows.push(y);
    let i = 0;
    for (const y of rows) for (let x = 0; x < w; x++, i++) {
      const index = indices[i];
      if (index !== control.transparent) {
        if (colors[index] === undefined) throw Error('Invalid GIF palette index');
        screen[(top + y) * sourceWidth + left + x] = colors[index];
      }
    }
    const pixels = new Uint32Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels[y * width + x] = screen[Math.min(sourceHeight - 1, Math.floor((y + .5) * sourceHeight / height)) * sourceWidth + Math.min(sourceWidth - 1, Math.floor((x + .5) * sourceWidth / width))];
    frames.push({ pixels, durationMs: control.durationMs ?? 100 });
    if (control.disposal === 2) for (let y = top; y < top + h; y++) screen.fill(clearColor, y * sourceWidth + left, y * sourceWidth + left + w);
    if (previous) screen = previous;
    control = {};
  }
  if (!frames.length) throw Error('GIF contains no image frames');
  return { width, height, frames, loop, scale };
}
