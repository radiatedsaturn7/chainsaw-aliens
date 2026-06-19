import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../src/ui/ProjectBrowserModal.js', import.meta.url), 'utf8');
const gameCoreSource = readFileSync(new URL('../../src/game/GameCore.js', import.meta.url), 'utf8');
const devServerSource = readFileSync(new URL('../../tools/dev_server.py', import.meta.url), 'utf8');

test('project browser version restore requires confirmation and explains backup behavior', () => {
  assert.equal(source.includes('Restore this version? Current file will be backed up first.'), true);
  assert.equal(source.includes('Confirm Restore'), true);
  assert.equal(source.includes('restoreConfirmTarget = version.id'), true);
});

test('project browser refreshes versions after confirmed restore', () => {
  assert.equal(source.includes('versionEntries = await listProjectFileVersions(folder, name);'), true);
  assert.equal(source.includes('before-version-restore'), false);
});

test('project browser open hydrates and does not call onOpen with missing data', () => {
  assert.equal(source.includes('async function openFile(folder, name)'), true);
  assert.equal(source.includes('loading: false'), true);
  assert.equal(source.includes('syncing: true'), true);
  assert.equal(source.includes('await hydrateProjectFilePayload(folder, name);'), true);
  assert.equal(source.includes('await hydrateServerStorage();'), false);
  assert.equal(source.includes('if (!payload?.data)'), true);
  assert.equal(source.includes('openError = openError || `Could not load ${name}`;'), true);
  assert.equal(source.includes('onOpen?.({ folder, name, payload });'), true);
  assert.equal(source.indexOf('if (!payload?.data)') < source.indexOf('onOpen?.({ folder, name, payload });'), true);
});

test('project browser defers hydration previews and keeps versions lazy', () => {
  assert.equal(source.includes('function schedulePreview(folder, name, preview)'), true);
  assert.equal(source.includes("preview.textContent = '...';"), true);
  assert.equal(source.includes('void openVersions(folder, entry.name);'), true);
  assert.equal(source.includes('versionEntries = await listProjectFileVersions(folder, name);'), true);
  assert.equal(source.includes('const payload = loadProjectFile(folder, entry.name);'), false);
  assert.equal(source.includes('const hydrationOptions = fixedFolder ? { folder: fixedFolder } : {};'), true);
});

test('dev server storage index does not scan versions for every listed file', () => {
  const listStart = devServerSource.indexOf('def _list_exported_files');
  const manifestStart = devServerSource.indexOf('def _write_manifest', listStart);
  const listBody = devServerSource.slice(listStart, manifestStart);
  const versionsStart = devServerSource.indexOf('def _list_exported_versions');
  const streamStart = devServerSource.indexOf('def _stream_exported_version', versionsStart);
  const versionsBody = devServerSource.slice(versionsStart, streamStart);

  assert.equal(listBody.includes('_list_exported_versions'), false);
  assert.equal(versionsBody.includes('versions_dir.iterdir()'), true);
});

test('title project browser opens animation art through Pixel Studio animation loader', () => {
  const openStart = gameCoreSource.indexOf('openProjectBrowserFromTitle()');
  const openEnd = gameCoreSource.indexOf('stopProjectBrowserMusicPreview()', openStart);
  const openSource = gameCoreSource.slice(openStart, openEnd);
  assert.equal(openSource.includes("folder === 'art'"), true);
  assert.equal(openSource.includes('this.pixelStudio.shouldLoadArtAsAnimationDocument(payload.data)'), true);
  assert.equal(openSource.includes('this.pixelStudio.loadAnimationArtDocument(payload.data);'), true);
  assert.equal(openSource.includes('this.pixelStudio.loadTileData({ skipRestore: true });'), true);
});

test('project browser overlay remains interactive under shared non-interactive root', () => {
  assert.equal(source.includes("root.style.pointerEvents = 'none';"), true);
  assert.equal(source.includes("overlay.style.pointerEvents = 'auto';"), true);
  assert.equal(source.includes("isOpening ? 'Opening...' : 'Open'"), true);
});
