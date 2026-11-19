import { readCachedProjectFile, staticShowroomArtVersion } from '../serverStorage.js';
import { hydrateProjectFilePayload, loadProjectFile } from '../projectFiles.js';
import { getArtDocumentFrames, normalizeArtFramePixels, parseArtPixelRgba } from './artDocumentPixels.js';

const pendingArtHydrations = new Map();
// A rendered frame remains usable even when the memory-bounded parsed document
// cache evicts its large source. Track source identity without parsing it again.
const canvasSources = new WeakMap();
const showroomFrames = new WeakMap();
const showroomByteLimit = 128 * 1024 * 1024;
function showroom(cache){
  if(!cache)return null;
  if(!showroomFrames.has(cache))showroomFrames.set(cache,{bytes:0,entries:new Map(),page:null});
  return showroomFrames.get(cache);
}
function removeShowroom(s,k,e){s.entries.delete(k);s.bytes-=e.bytes;}
function trimShowroom(s,limit,protectedRefs){
  for(const [key,e] of s.entries){
    if(e.version!==staticShowroomArtVersion(key)||s.bytes>limit&&!protectedRefs.has(key))removeShowroom(s,key,e);
  }
}
export function setShowroomArtPage(cache,protectedRefs){
  const s=showroom(cache);
  if(!s)return;
  s.page=protectedRefs;
  trimShowroom(s,showroomByteLimit,protectedRefs??new Set());
}
function getShowroomEntry(cache,ref){
  const s=showroomFrames.get(cache),e=s?.entries.get(ref);
  if(!e)return null;
  if(e.version!==staticShowroomArtVersion(ref)){removeShowroom(s,ref,e);return null;}
  s.entries.delete(ref);s.entries.set(ref,e);
  return e;
}
export function hasShowroomArtFrames(cache,ref){return !!getShowroomEntry(cache,ref);}
export function setShowroomArtFrames(cache,ref,payload,protectedRefs,documentRef=globalThis.document){
  const s=showroom(cache);
  if(!s||!documentRef||!payload?.showroomVersion||payload.showroomVersion!==staticShowroomArtVersion(ref))return false;
  const {frames,source}=getArtDocumentFrames(payload.data);
  if(!frames.length)return false;
  const hintedWidth=Number(source?.width||source?.editor?.width||source?.size),hintedHeight=Number(source?.height||source?.editor?.height||source?.size);
  const dimensions=frames.map(frame=>{
    if(hintedWidth>0&&hintedHeight>0)return Math.round(hintedWidth)*Math.round(hintedHeight)*4;
    const pixels=normalizeArtFramePixels(frame,source)||normalizeArtFramePixels(source,source);
    const width=Math.max(1,Math.round(Number(source?.width||source?.editor?.width||source?.size||Math.sqrt(pixels?.length)||16)));
    const height=Math.max(1,Math.round(Number(source?.height||source?.editor?.height||source?.size||Math.ceil(pixels?.length/width)||width)));
    return width*height*4;
  });
  const bytes=dimensions.reduce((n,b)=>n+b,0),old=s.entries.get(ref);
  if(old)removeShowroom(s,ref,old);
  // Prune before allocation. Active page backing is a soft ceiling so the
  // product still displays a legitimately large visible page without eviction.
  trimShowroom(s,Math.max(0,showroomByteLimit-bytes),protectedRefs);
  const canvases=frames.map((_,frameIndex)=>getRaceArtSpriteCanvasShared(ref,{frameIndex,documentRef,showroomPayload:payload,showroomArt:false}));
  if(canvases.some(x=>!x)||payload.showroomVersion!==staticShowroomArtVersion(ref))return false;
  s.entries.set(ref,{canvases,bytes,version:payload.showroomVersion});s.bytes+=bytes;
  return true;
}
export function showroomArtResidency(cache){
  const s=showroom(cache);return {bytes:s?.bytes||0,refs:s?.entries.size||0};
}

export function hydrateRaceArtSpriteShared(artRef = '') {
  const clean = String(artRef || '').trim();
  if (!clean) return Promise.resolve(null);
  const cached = loadProjectFile('art', clean, {allowSyncFetch:false});
  if (cached) return Promise.resolve(cached);
  const pending = pendingArtHydrations.get(clean);
  if (pending) return pending;
  const hydration = hydrateProjectFilePayload('art', clean, {hydrateDependencies:false})
    .catch(() => null)
    .finally(() => pendingArtHydrations.delete(clean));
  pendingArtHydrations.set(clean, hydration);
  return hydration;
}

export function getRaceArtSpriteCanvasShared(artRef = '', {
  frameIndex = 0,
  cache = null,
  documentRef = typeof document !== 'undefined' ? document : null,
  playtestSession = null,
  racePreloadingArt = false,
  preparedFrames = null,
  allowStorageLoad = true,
  allowSyncFetch = true,
  getNowMs = () => 0,
  onRuntimeMiss = null,
  showroomPayload = null,
  showroomArt = undefined
} = {}) {
  const clean = String(artRef || '').trim();
  if (!clean || !documentRef) return null;
  const requestedFrameIndex = Math.max(0, Math.round(Number(frameIndex) || 0));
  const prepared = preparedFrames?.get?.(`${clean}:frame:${requestedFrameIndex}`)
    || preparedFrames?.get?.(`${clean}:frame:0`)
    || null;
  if (prepared) return prepared;
  if (allowStorageLoad === false) return null;
  const raw = cache ? readCachedProjectFile('art', clean, {allowSyncFetch}) : null;
  let sources = cache ? canvasSources.get(cache) : null;
  const previous = sources?.get(clean);
  // Normal project/editor data always wins. Preview canvases are not used for
  // race preload or any active race and have no shared payload ownership.
  // The passive no-sync readiness probe only observes an active showroom
  // lease. All product rendering supplies an explicit showroom flag.
  const showroomRead=showroomArt===true||(showroomArt===undefined&&allowSyncFetch===false);
  if(showroomRead&&!raw&&!showroomPayload&&!playtestSession&&!racePreloadingArt&&showroomFrames.get(cache)?.page?.has(clean)){
    const e=getShowroomEntry(cache,clean);
    if(e)return e.canvases[requestedFrameIndex%e.canvases.length];
  }
  if (raw && previous?.raw === raw) {
    const index = previous.frameCount ? requestedFrameIndex % previous.frameCount : 0;
    const key = `${clean}:${previous.savedAt}:frame:${index}`;
    if (cache.has(key)) return cache.get(key);
  }
  if (previous && previous.raw !== raw) {
    const prefix = `${clean}:${previous.savedAt}:frame:`;
    for (const key of cache.keys()) if (key.startsWith(prefix)) cache.delete(key);
    sources.delete(clean);
  }
  const missStartMs = playtestSession && !racePreloadingArt ? getNowMs() : 0;
  const payload = showroomPayload || loadProjectFile('art', clean, {allowSyncFetch});
  if (!payload) return null;
  let data = payload?.data || payload;
  if (payload?.__chainsawStorage && typeof payload.data === 'string' && payload.encoding === 'json') {
    try {
      data = JSON.parse(payload.data);
    } catch (_error) {
      data = null;
    }
  }
  const { frames: rawFrames, source } = getArtDocumentFrames(data);
  data = source || data;
  const resolvedFrameIndex = rawFrames.length ? requestedFrameIndex % rawFrames.length : 0;
  const cacheKey = `${clean}:${Number(payload?.savedAt || 0)}:frame:${resolvedFrameIndex}`;
  if (cache && raw) {
    if (!sources) { sources = new Map(); canvasSources.set(cache, sources); }
    sources.set(clean, { raw, savedAt: Number(payload?.savedAt || 0), frameCount: rawFrames.length });
  }
  if (cache?.has?.(cacheKey)) return cache.get(cacheKey);
  const frame = rawFrames[resolvedFrameIndex] || rawFrames[0] || null;
  const pixels = normalizeArtFramePixels(frame, data) || normalizeArtFramePixels(data, data);
  if (!Array.isArray(pixels) || !pixels.length) {
    cache?.set?.(cacheKey, null);
    return null;
  }
  const width = Math.max(1, Math.round(Number(data?.width || data?.editor?.width || data?.size || Math.sqrt(pixels.length) || 16)));
  const height = Math.max(1, Math.round(Number(data?.height || data?.editor?.height || data?.size || Math.ceil(pixels.length / width) || width)));
  const canvas = documentRef.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.__raceArtCacheKey = cacheKey;
  const artCtx = canvas.getContext('2d');
  if (!artCtx) {
    cache?.set?.(cacheKey, null);
    return null;
  }
  if (typeof artCtx.createImageData === 'function' && typeof artCtx.putImageData === 'function') {
    const imageData = artCtx.createImageData(width, height);
    for (let i = 0; i < width * height; i += 1) {
      const color = parseArtPixelRgba(pixels[i]);
      const base = i * 4;
      if (!color || color.a === 0) {
        imageData.data[base + 3] = 0;
        continue;
      }
      imageData.data[base] = color.r;
      imageData.data[base + 1] = color.g;
      imageData.data[base + 2] = color.b;
      imageData.data[base + 3] = color.a;
    }
    artCtx.putImageData(imageData, 0, 0);
  } else {
    pixels.forEach((value, index) => {
      const color = parseArtPixelRgba(value);
      if (!color || color.a === 0) return;
      artCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
      artCtx.fillRect(index % width, Math.floor(index / width), 1, 1);
    });
  }
  cache?.set?.(cacheKey, canvas);
  if (missStartMs > 0 && typeof onRuntimeMiss === 'function') {
    onRuntimeMiss(Math.max(0, getNowMs() - missStartMs));
  }
  return canvas;
}
