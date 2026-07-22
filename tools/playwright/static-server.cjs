const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');
const port = Number(process.env.PORT || 4173);
const storageRoot = path.join(rootDir, 'data/server-storage/files');
const storageFolders = ['levels', 'art', 'music', 'actors', 'sfx', 'cutscenes', 'races', 'cars', 'doodads', 'settings'];
const storageOverlay = new Map();

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
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
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .slice(0, 64);
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

function readStoredFile(folder, name) {
  const clean = normalizeName(name);
  if (!isValidStorageFolder(folder) || !clean) return null;
  const overlay = storageOverlay.get(storageKey(folder, clean));
  if (overlay) return overlay;
  const filePath = getStoredFilePath(folder, clean);
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function listStorageIndex(folder = null) {
  const folders = folder && isValidStorageFolder(folder) ? [folder] : storageFolders;
  const index = Object.fromEntries(storageFolders.map((id) => [id, {}]));
  for (const folderId of folders) {
    const folderPath = path.join(storageRoot, folderId);
    if (fs.existsSync(folderPath)) {
      for (const name of fs.readdirSync(folderPath)) {
        const file = readStoredFile(folderId, name);
        if (file) {
          index[folderId][file.name] = {
            updatedAt: Number(file.savedAt || 0),
            size: JSON.stringify(file).length
          };
        }
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

async function handleStorageRequest(req, res, url) {
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
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = path.normalize(path.join(rootDir, pathname));

  if (!safePath.startsWith(rootDir)) {
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

server.listen(port, '127.0.0.1', () => {
  // eslint-disable-next-line no-console
  console.log(`Static server running at http://127.0.0.1:${port}`);
});
