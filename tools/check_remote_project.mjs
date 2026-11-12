// Live integration smoke: use the real storage loader against commit-pinned GitHub files.
// Usage: node tools/check_remote_project.mjs /path/to/site/data/server-storage/files/manifest.json
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {hydrateProjectFile, clearCachedProjectFilesForTests} from '../src/ui/serverStorage.js';
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.ok(manifest.documentRoot, 'Build with --remote-repository and --remote-commit first');
const network = globalThis.fetch;
const requests = [];
globalThis.fetch = async (url, options) => {
  if (String(url).includes('/__storage/')) return new Response('Static site', {status: 404});
  if (url === '/data/server-storage/files/manifest.json') return Response.json(manifest);
  assert.ok(String(url).startsWith(manifest.documentRoot + '/'), `Unexpected request: ${url}`);
  const response = await network(url, options);
  requests.push({url, status: response.status, cors: response.headers.get('access-control-allow-origin')});
  return response;
};
try {
  for (const [folder, name] of [
    ['cars', 'RTG-001'],
    ['races', 'Mount Washington Auto Road — point-to-point'],
    ['music', Object.keys(manifest.folders.music).find(name => name.toLowerCase().endsWith('.mp3'))]
  ]) {
    const started = performance.now();
    const file = await hydrateProjectFile(folder, name);
    assert.ok(file?.data, `Missing ${folder}/${name}`);
    assert.equal(file.storageSource, 'static');
    console.log(JSON.stringify({folder, name, seconds: (performance.now() - started) / 1000, requests: requests.length}));
  }
  assert.ok(requests.length > 0);
  assert.ok(requests.every(request => request.status === 200 && request.cors === '*'));
  console.log(`PASS: ${requests.length} real GitHub document/media requests, all HTTP 200 with cross-origin access`);
} finally {
  globalThis.fetch = network;
  clearCachedProjectFilesForTests();
}
