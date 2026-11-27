const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const rootDir = path.resolve(__dirname, '../..');
const port = Number(process.env.PORT || 4173);
const storageRoot = path.join(rootDir, 'data/server-storage/files');
const storageFolders = ['levels', 'art', 'music', 'actors', 'sfx', 'cutscenes', 'races', 'cars', 'tires', 'models', 'menus', 'doodads', 'items', 'fonts', 'settings'];
const storageOverlay = new Map();
const changedStock = new Set();
const COMPACT_STORAGE_MARKER = '__chainsawStorage';
const COMPACT_STORAGE_VERSION = 'compact-v1';
const COMPACT_STORAGE_ENCODING = 'json-gzip-base64';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp':'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0'
  });
  res.end(JSON.stringify(payload));
}

function normalizeName(value) {
  // Curated landmark IDs must round-trip exactly; other filenames retain the legacy cap.
  const raw = String(value || '');
  const limit = raw.length <= 80 && /^landmark-city-[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw) ? 80 : 64;
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, limit);
}

function isValidStorageFolder(folder) {
  return storageFolders.includes(String(folder || ''));
}

function storageKey(folder, name) {
  return `${folder}/${name}`;
}

function getStoredFilePath(folder, name) {
  if (!isValidStorageFolder(folder)) return null;
  const clean = normalizeName(name);
  if (!clean) return null;
  const filePath = path.normalize(path.join(storageRoot, folder, clean, 'document.json'));
  if (!filePath.startsWith(storageRoot)) return null;
  return filePath;
}

function decodeStoredDocument(payload) {
  if (!payload || typeof payload !== 'object' || payload[COMPACT_STORAGE_MARKER] !== COMPACT_STORAGE_VERSION) {
    return payload;
  }
  if (payload.encoding !== COMPACT_STORAGE_ENCODING || typeof payload.data !== 'string') {
    throw new Error('Unsupported compact storage document');
  }
  return JSON.parse(zlib.gunzipSync(Buffer.from(payload.data, 'base64')).toString('utf8'));
}

function readStoredFile(folder, name) {
  const clean = normalizeName(name);
  if (!isValidStorageFolder(folder) || !clean) return null;
  const overlay = storageOverlay.get(storageKey(folder, clean));
  if (overlay) return overlay;
  const filePath = getStoredFilePath(folder, clean);
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const payload = decodeStoredDocument(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    const data = Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
    return {
      version: Number(payload.version || 1),
      folder,
      name: clean,
      savedAt: Number(payload.savedAt || fs.statSync(filePath).mtimeMs || Date.now()),
      data
    };
  } catch (error) {
    return null;
  }
}

function readStoredMetadata(directory) {
  const documentPath = path.join(directory, 'document.json');
  if (!fs.existsSync(documentPath)) return null;
  const stat = fs.statSync(documentPath);
  let metadata = {};
  try { metadata = JSON.parse(fs.readFileSync(path.join(directory, 'metadata.json'), 'utf8')); } catch {}
  if (metadata.deleted) return null;
  return { updatedAt: Number(metadata.savedAt || stat.mtimeMs || 0), size: stat.size,
    ...(metadata.systemFile === true ? {systemFile:true} : {}) };
}

function listStorageIndex(folder = null) {
  const folders = folder && isValidStorageFolder(folder) ? [folder] : storageFolders;
  const index = Object.fromEntries(storageFolders.map((id) => [id, {}]));
  for (const folderId of folders) {
    const folderPath = path.join(storageRoot, folderId);
    if (fs.existsSync(folderPath)) {
      for (const name of fs.readdirSync(folderPath)) {
        const metadata = readStoredMetadata(path.join(folderPath, name));
        if (metadata) index[folderId][name] = metadata;
      }
    }
  }
  for (const file of storageOverlay.values()) {
    if (!folders.includes(file.folder)) continue;
    index[file.folder][file.name] = {
      updatedAt: Number(file.savedAt || 0),
      size: JSON.stringify(file).length
    };
  }
  return index;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

let previewCatalog,previewCatalogKey;
function previewSources(revision,id,name,carId){
  if(typeof id!=='string'||!(/^[a-z0-9][a-z0-9_-]{0,127}$/i).test(id))return null;
  if(typeof name!=='string'||typeof carId!=='string')return null;
  const manifest=path.join(rootDir,'assets/car-previews/manifest.json');
  try{
    const status=fs.lstatSync(manifest);
    if(!status.isFile()||status.size>8*1024*1024)return null;
    const key=`${status.mtimeMs}:${status.size}`;
    if(previewCatalogKey!==key){previewCatalog=JSON.parse(fs.readFileSync(manifest,'utf8'));previewCatalogKey=key;}
    if(previewCatalog?.schemaVersion!==1||previewCatalog?.releaseRevision!==revision)return null;
    const names=previewCatalog.carsByName||{};
    if(!Object.hasOwn(names,name)||names[name]!==id||Object.values(names).filter(k=>k===id).length!==1)return null;
    if(!Object.hasOwn(previewCatalog.previews||{},id))return null;
    const row=previewCatalog.previews[id];
    if((row.carId??id)!==carId)return null;
    const cars=Array.isArray(row.stockSources)?row.stockSources.filter(s=>s?.folder==='cars').map(s=>s.name):[];
    return cars.length===1&&cars[0]===name?row.stockSources:null;
  }catch{return null;}
}

function isStockPreview(revision,sources){
  if(typeof revision!=='string'||!(/^[0-9a-f]{64}$/).test(revision)||!Array.isArray(sources)||sources.length<1||sources.length>32)return false;
  const seen=new Set();let cars=0;
  for(const row of sources){
    const {folder,name,sha256}=row||{};
    if(!['cars','art','tires','models'].includes(folder)||typeof name!=='string'||name.length<1||
      name.length>128||name!==normalizeName(name)||name==='.'||name==='..'||!(/^[0-9a-f]{64}$/).test(sha256||''))return false;
    const key=storageKey(folder,name);
    if(seen.has(key)||changedStock.has(key)||storageOverlay.has(key))return false;
    seen.add(key);if(folder==='cars')cars++;
    const document=getStoredFilePath(folder,name),directory=path.dirname(document);
    const sidecar=path.join(directory,'metadata.json');
    try{
      if(fs.lstatSync(directory).isSymbolicLink()||fs.lstatSync(path.dirname(directory)).isSymbolicLink()||
        !fs.lstatSync(sidecar).isFile()||fs.statSync(sidecar).size>8192||!fs.lstatSync(document).isFile())return false;
      const metadata=JSON.parse(fs.readFileSync(sidecar,'utf8'));
      if(metadata?.deleted||metadata?.folder!==folder||metadata?.name!==name||
        metadata?.stockPreviewReleaseRevision!==revision||metadata?.stockPreviewSha256!==sha256||
        metadata?.stockPreviewBytes!==fs.statSync(document).size)return false;
    }catch{return false;}
  }
  return cars===1;
}

async function handleStorageRequest(req, res, url) {
  if(url.pathname==='/__storage/preview-stock'&&req.method==='POST'){
    try{
      const length=Number(req.headers['content-length']);
      if(!Number.isSafeInteger(length)||length<1||length>8192){sendJson(res,400,{ok:false,verified:false});return true;}
      const {revision,id,name,carId}=JSON.parse(await readRequestBody(req));
      sendJson(res,200,{ok:true,revision,id,name,carId,verified:isStockPreview(revision,previewSources(revision,id,name,carId))});
    }catch{sendJson(res,400,{ok:false,verified:false});}
    return true;
  }

  if (url.pathname === '/__storage/index' && req.method === 'GET') {
    const folder = url.searchParams.get('folder');
    sendJson(res, 200, { ok: true, index: listStorageIndex(folder) });
    return true;
  }

  if (url.pathname === '/__storage/file' && req.method === 'GET') {
    const folder = url.searchParams.get('folder');
    const name = normalizeName(url.searchParams.get('name'));
    const file = readStoredFile(folder, name);
    if (!file) {
      sendJson(res, 404, { ok: false, error: 'File not found' });
      return true;
    }
    sendJson(res, 200, { ok: true, file });
    return true;
  }

  if (url.pathname === '/__storage/file' && req.method === 'POST') {
    try {
      const payload = JSON.parse(await readRequestBody(req) || '{}');
      const folder = String(payload.folder || '');
      const name = normalizeName(payload.name);
      if (!isValidStorageFolder(folder) || !name) {
        sendJson(res, 400, { ok: false, error: 'Missing folder or name' });
        return true;
      }
      const file = {
        version: Number(payload.version || 1),
        folder,
        name,
        savedAt: Number(payload.savedAt || Date.now()),
        data: payload.data
      };
      changedStock.add(storageKey(folder,name));
      storageOverlay.set(storageKey(folder, name), file);
      sendJson(res, 200, { ok: true, file });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
    }
    return true;
  }

  if (url.pathname === '/__storage/file' && req.method === 'DELETE') {
    const folder = url.searchParams.get('folder');
    const name = normalizeName(url.searchParams.get('name'));
    changedStock.add(storageKey(folder,name));
    storageOverlay.delete(storageKey(folder, name));
    sendJson(res, 200, { ok: true });
    return true;
  }

  if (url.pathname === '/__storage/rename' && req.method === 'POST') {
    try {
      const payload = JSON.parse(await readRequestBody(req) || '{}');
      const folder = String(payload.folder || '');
      const oldName = normalizeName(payload.oldName);
      const newName = normalizeName(payload.newName);
      const file = readStoredFile(folder, oldName);
      if (!file || !newName) {
        sendJson(res, 404, { ok: false, error: 'File not found' });
        return true;
      }
      const renamed = { ...file, name: newName, savedAt: Date.now() };
      changedStock.add(storageKey(folder,oldName));changedStock.add(storageKey(folder,newName));
      storageOverlay.delete(storageKey(folder, oldName));
      storageOverlay.set(storageKey(folder, newName), renamed);
      sendJson(res, 200, { ok: true, file: renamed });
    } catch (error) {
      sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
    }
    return true;
  }

  if (url.pathname === '/__storage/versions' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, versions: [] });
    return true;
  }

  if (url.pathname === '/__storage/version') {
    sendJson(res, 404, { ok: false, error: 'Version not found' });
    return true;
  }

  if (url.pathname === '/__storage/restore-version' && req.method === 'POST') {
    sendJson(res, 404, { ok: false, error: 'Version not found' });
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  if (url.pathname.startsWith('/__storage/')) {
    handleStorageRequest(req, res, url).then((handled) => {
      if (!handled) sendJson(res, 404, { ok: false, error: 'Not found' });
    }).catch((error) => {
      sendJson(res, 500, { ok: false, error: String(error?.message || error) });
    });
    return;
  }
  let pathname;
  try { pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); res.end('Invalid URL encoding'); return; }
  const safePath = path.normalize(path.join(rootDir, pathname));

  if (!safePath.startsWith(rootDir + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(safePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': contentTypes[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store, max-age=0'
  });
  fs.createReadStream(safePath).pipe(res);
});

if (require.main === module) {
  server.listen(port, '127.0.0.1', () => {
    // eslint-disable-next-line no-console
    console.log(`Static server running at http://127.0.0.1:${port}`);
  });
}

module.exports = { decodeStoredDocument, readStoredMetadata, server };
