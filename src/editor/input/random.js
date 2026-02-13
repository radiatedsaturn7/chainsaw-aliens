export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
export const pickOne = (list) => list[randInt(0, list.length - 1)];
