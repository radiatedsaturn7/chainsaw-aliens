const PROJECT_FS_KEY = 'chainsaw-project-fs-v1';

const clone = (value) => JSON.parse(JSON.stringify(value));

const getStorage = () => {
  try {
    return window?.localStorage || null;
  } catch (error) {
    return null;
  }
};

const readFs = () => {
  const storage = getStorage();
  if (!storage) return { levels: {}, music: {}, pixelArt: {} };
  try {
    const parsed = JSON.parse(storage.getItem(PROJECT_FS_KEY) || '{}');
    return {
      levels: parsed.levels || {},
      music: parsed.music || {},
      pixelArt: parsed.pixelArt || {}
    };
  } catch (error) {
    return { levels: {}, music: {}, pixelArt: {} };
  }
};

const writeFs = (fsData) => {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(PROJECT_FS_KEY, JSON.stringify(fsData));
};

export const saveProjectAsset = (category, name, data) => {
  if (!category || !name) return;
  const fsData = readFs();
  if (!fsData[category]) fsData[category] = {};
  fsData[category][name] = {
    updatedAt: Date.now(),
    data: clone(data)
  };
  writeFs(fsData);
};

export const loadProjectAsset = (category, name) => {
  const fsData = readFs();
  const entry = fsData?.[category]?.[name];
  return entry ? clone(entry.data) : null;
};

export const listProjectAssets = (category) => {
  const fsData = readFs();
  const entries = Object.entries(fsData?.[category] || {});
  return entries
    .map(([name, entry]) => ({ name, updatedAt: entry.updatedAt || 0 }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
};

export const exportProjectBundleBlob = async () => {
  const JSZip = window?.JSZip;
  if (!JSZip) {
    throw new Error('JSZip is not available.');
  }
  const zip = new JSZip();
  zip.file('project-fs.json', JSON.stringify(readFs(), null, 2));
  return zip.generateAsync({ type: 'blob' });
};

export const importProjectBundleFile = async (file) => {
  const JSZip = window?.JSZip;
  if (!JSZip) {
    throw new Error('JSZip is not available.');
  }
  const bytes = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(bytes);
  const fsEntry = zip.file('project-fs.json');
  if (!fsEntry) {
    throw new Error('Bundle does not contain project-fs.json');
  }
  const text = await fsEntry.async('string');
  const parsed = JSON.parse(text);
  const fsData = {
    levels: parsed.levels || {},
    music: parsed.music || {},
    pixelArt: parsed.pixelArt || {}
  };
  writeFs(fsData);
  return fsData;
};

export { PROJECT_FS_KEY };
