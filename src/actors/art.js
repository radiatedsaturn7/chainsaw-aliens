import { vfsLoad } from '../ui/vfs.js';
import { ACTOR_ART_TILE_SLOTS } from './definitions.js';

const buildPixelsFromFrame = (frame, size) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  frame.forEach((hex, index) => {
    if (!hex) return;
    ctx.fillStyle = hex;
    ctx.fillRect(index % size, Math.floor(index / size), 1, 1);
  });
  return canvas;
};

export const listActorArtSlots = () => ACTOR_ART_TILE_SLOTS.map((entry) => ({ ...entry }));

export const listArtDocuments = () => {
  try {
    const index = JSON.parse(window.localStorage.getItem('robter:vfs:index') || 'null') || {};
    return Object.keys(index.art || {}).sort();
  } catch {
    return [];
  }
};

export const loadActorArtSource = (visuals = {}) => {
  if (!visuals.artDocument || !visuals.artTile) return null;
  const payload = vfsLoad('art', visuals.artDocument);
  const data = payload?.data || payload;
  const pixelData = data?.tiles?.[visuals.artTile];
  if (!pixelData) return null;
  const frames = pixelData.frames || [];
  return {
    documentName: visuals.artDocument,
    tileChar: visuals.artTile,
    size: pixelData.size || 16,
    fps: pixelData.fps || 8,
    frames,
    buildFrameCanvas(index = 0) {
      return buildPixelsFromFrame(frames[index] || frames[0] || Array((pixelData.size || 16) ** 2).fill(null), pixelData.size || 16);
    }
  };
};
