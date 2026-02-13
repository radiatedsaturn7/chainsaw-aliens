const ZIP_SCRIPT_PATH = 'vendor/jszip.min.js';

export const getJSZip = () => {
  const JSZip = globalThis?.JSZip;
  if (!JSZip) {
    throw new Error(
      `ZIP support is unavailable. Expected script "${ZIP_SCRIPT_PATH}" to be loaded before ZIP operations.`
    );
  }
  return JSZip;
};

export const loadZipFromBytes = async (bytes) => {
  const JSZip = getJSZip();
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return JSZip.loadAsync(data);
};

export const createZip = () => {
  const JSZip = getJSZip();
  return new JSZip();
};
