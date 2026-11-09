// Remove a matte color and recover edge colors instead of leaving pale fringes.
// Pixels use the editor's packed ABGR representation; existing alpha is retained.
export function colorToAlpha(pixels, color) {
  const background = [color & 255, (color >>> 8) & 255, (color >>> 16) & 255];
  let changed = 0;
  for (let i = 0; i < pixels.length; i++) {
    const pixel = pixels[i], originalAlpha = pixel >>> 24;
    if (!originalAlpha) continue;
    const channels = [pixel & 255, (pixel >>> 8) & 255, (pixel >>> 16) & 255];
    const alpha = Math.max(...channels.map((c, j) => c > background[j]
      ? (c - background[j]) / (255 - background[j])
      : c < background[j] ? (background[j] - c) / background[j] : 0));
    const recovered = channels.map((c, j) => alpha ? Math.max(0, Math.min(255, Math.round((c - background[j] * (1 - alpha)) / alpha))) : 0);
    const next = ((Math.round(originalAlpha * alpha) << 24) | (recovered[2] << 16) | (recovered[1] << 8) | recovered[0]) >>> 0;
    if (next !== pixel) { pixels[i] = next; changed++; }
  }
  return changed;
}
