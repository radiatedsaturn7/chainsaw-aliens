// Reconcile a narrow strip at the panorama join without modifying saved artwork.
// Equal boundary colors remove authored seams; periodic gutters give the canvas
// resampler real neighboring pixels instead of transparent texture edges.
export function blendSkyboxEdges(pixels, width, height) {
  const band = Math.min(Math.floor(width / 2), Math.max(2, Math.round(width * .04)));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < band; x++) {
      const t = band > 1 ? x / (band - 1) : 0;
      const weight = .5 * (1 - t * t * (3 - 2 * t));
      const left = (y * width + x) * 4;
      const right = (y * width + width - 1 - x) * 4;
      for (let channel = 0; channel < 4; channel++) {
        const a = pixels[left + channel], b = pixels[right + channel];
        pixels[left + channel] = Math.round(a + (b - a) * weight);
        pixels[right + channel] = Math.round(b + (a - b) * weight);
      }
    }
  }
  return pixels;
}

export function prepareSkyboxTexture(canvas) {
  const ctx = canvas.getContext('2d');
  const {width, height} = canvas;
  const pixels = ctx.getImageData(0, 0, width, height);
  blendSkyboxEdges(pixels.data, width, height);
  ctx.putImageData(pixels, 0, 0);
  const padded = canvas.ownerDocument.createElement('canvas');
  padded.width = width + 2;
  padded.height = height;
  padded.skyboxGutter = 1;
  const output = padded.getContext('2d');
  output.drawImage(canvas, 1, 0);
  output.drawImage(canvas, width - 1, 0, 1, height, 0, 0, 1, height);
  output.drawImage(canvas, 0, 0, 1, height, width + 1, 0, 1, height);
  return padded;
}
