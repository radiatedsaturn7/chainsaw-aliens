export const PIXEL_SIZE_PRESETS = [16, 32, 64, 128, 256];

export const createDitherMask = (pattern) => {
  if (pattern === 'checker') {
    return [[0, 1], [1, 0]];
  }
  if (pattern === 'bayer4') {
    return [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5]
    ];
  }
  return [[0, 2], [3, 1]];
};
