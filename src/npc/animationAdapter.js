const IMAGE_CACHE = new Map();
const JSON_CACHE = new Map();

const loadImage = (src) => {
  if (!src) return Promise.resolve(null);
  if (IMAGE_CACHE.has(src)) return IMAGE_CACHE.get(src);
  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  }).catch((error) => {
    console.warn('[NpcAnimationAdapter] Failed to load image.', src, error);
    return null;
  });
  IMAGE_CACHE.set(src, promise);
  return promise;
};

const loadJson = async (src) => {
  if (!src) return null;
  if (JSON_CACHE.has(src)) return JSON_CACHE.get(src);
  const promise = fetch(src)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      console.warn('[NpcAnimationAdapter] Failed to load metadata.', src, error);
      return null;
    });
  JSON_CACHE.set(src, promise);
  return promise;
};

const normalizeClip = (clip, metadata) => {
  if (!clip || !metadata?.frames?.length) return [];
  if (clip.type === 'indices') return clip.frames || [];
  if (clip.type === 'range') {
    const start = Number.isFinite(clip.start) ? clip.start : 0;
    const end = Number.isFinite(clip.end) ? clip.end : start;
    const frames = [];
    for (let index = start; index <= end; index += 1) frames.push(index);
    return frames;
  }
  return [];
};

export const resolveNpcAnimationSet = async (definition) => {
  const imageSrc = definition?.animationSet?.image || definition?.spriteSource?.image || '';
  const metadataSrc = definition?.animationSet?.metadata || definition?.spriteSource?.metadata || '';
  const [image, metadata] = await Promise.all([loadImage(imageSrc), loadJson(metadataSrc)]);
  return { image, metadata, imageSrc, metadataSrc };
};

export const getNpcAnimationFrame = ({ definition, resolvedAnimation, role = 'idle', elapsed = 0 }) => {
  const metadata = resolvedAnimation?.metadata;
  if (!metadata?.frames?.length) return null;
  const roles = definition?.animationSet?.roles || {};
  const clips = definition?.animationSet?.clips || {};
  const clipId = roles[role] || roles.idle || 'idle';
  const clip = clips[clipId] || clips.idle || { type: 'indices', frames: [0], fps: 8 };
  const frameIndices = normalizeClip(clip, metadata);
  if (!frameIndices.length) return metadata.frames[0] || null;
  const fps = Number.isFinite(clip.fps) ? clip.fps : 8;
  const index = Math.floor(elapsed * fps) % frameIndices.length;
  return metadata.frames[frameIndices[index]] || metadata.frames[0] || null;
};

export const validateNpcAnimationRefs = async (definition) => {
  const resolved = await resolveNpcAnimationSet(definition);
  const warnings = [];
  if (!resolved.image) warnings.push('Sprite sheet image could not be loaded.');
  if (!resolved.metadata) warnings.push('Sprite sheet metadata could not be loaded.');
  const roles = definition?.animationSet?.roles || {};
  const clips = definition?.animationSet?.clips || {};
  ['idle', 'walk'].forEach((role) => {
    const clipId = roles[role];
    if (clipId && !clips[clipId]) warnings.push(`Animation role "${role}" points to missing clip "${clipId}".`);
  });
  return { resolved, warnings };
};
