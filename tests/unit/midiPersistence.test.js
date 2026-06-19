import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../src/ui/MidiComposerCore.js', import.meta.url), 'utf8');
const lifecycleSource = fs.readFileSync(new URL('../../src/ui/editor-documents/documentLifecycle.js', import.meta.url), 'utf8');
const projectFilesSource = fs.readFileSync(new URL('../../src/ui/projectFiles.js', import.meta.url), 'utf8');
const sfxSource = fs.readFileSync(new URL('../../src/ui/SfxEditor.js', import.meta.url), 'utf8');
const browserSource = fs.readFileSync(new URL('../../src/ui/ProjectBrowserModal.js', import.meta.url), 'utf8');
const preferencesSource = fs.readFileSync(new URL('../../src/ui/serverPreferences.js', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../../tools/dev_server.py', import.meta.url), 'utf8');

test('MIDI composer exposes a non-destructive rescue save action', () => {
  assert.equal(source.includes("const MIDI_RESCUE_PREFIX = 'Intro Rescue';"), true);
  assert.equal(source.includes('async rescueSaveSong()'), true);
  assert.equal(source.includes("action('rescue-save', 'Rescue Save'"), true);
  assert.equal(source.includes("{ id: 'rescue-save', label: 'Rescue Save' }"), true);
});

test('MIDI composer keeps per-document autosaves alongside global autosave', () => {
  assert.equal(source.includes("const MIDI_AUTOSAVE_SUFFIX = ' Autosave';"), true);
  assert.equal(source.includes('getDocumentAutosaveName()'), true);
  assert.equal(source.includes("saveProjectFile('music', MIDI_COMPOSER_AUTOSAVE_DOC, data, { createVersion: false });"), true);
  assert.equal(source.includes("saveProjectFile('music', documentAutosaveName, data, { createVersion: false });"), true);
  assert.equal(source.includes("replace(/(?: Autosave\\d*)+$/g, '')"), true);
  assert.equal(source.includes("saveProjectFile('music', documentAutosaveName, JSON.parse(snapshot));"), false);
  assert.equal(source.includes('const data = JSON.parse(snapshot);'), false);
});

test('MIDI manual save avoids redundant autosave, confirms server sync, and keeps Save As metadata', () => {
  const start = source.indexOf('async saveSongToLibrary(options = {})');
  const end = source.indexOf('buildRescueSongName', start);
  const body = source.slice(start, end);
  const adapterStart = source.indexOf('document: {');
  const adapterEnd = source.indexOf('history: {', adapterStart);
  const adapterBody = source.slice(adapterStart, adapterEnd);
  const afterSaveStart = source.indexOf('onAfterSave: (ctx, meta) => {');
  const afterSaveEnd = source.indexOf('history: {', afterSaveStart);
  const afterSaveBody = source.slice(afterSaveStart, afterSaveEnd);

  assert.equal(body.includes('this.flushPersist();'), false);
  assert.equal(body.includes('this.saveCurrentPersistentViewport();'), true);
  assert.equal(body.includes('const saved = await this.runtime.saveAsOrCurrent(options);'), true);
  assert.equal(adapterBody.includes('serialize: (ctx) => ctx.song'), true);
  assert.equal(adapterBody.includes('waitForSync: false'), false);
  assert.equal(adapterBody.includes('beforeSave: (ctx, meta) => {'), true);
  assert.equal(adapterBody.includes('ctx.song.name = meta.name;'), true);
  assert.equal(adapterBody.includes('JSON.parse(JSON.stringify(ctx.song))'), false);
  assert.equal(afterSaveBody.includes('ctx.persist({ commitHistory: true });'), false);
  assert.equal(afterSaveBody.includes('ctx.commitHistorySnapshot();'), true);
  assert.equal(afterSaveBody.includes('ctx.trackBackgroundSaveSync(meta.saved?.syncPromise);'), false);
  assert.equal(source.includes('trackBackgroundSaveSync(syncPromise)'), false);
  assert.equal(source.includes('const persisted = await saved?.syncPromise;'), true);
});

test('MIDI empty-document checks inspect pattern notes', () => {
  assert.equal(source.includes('track?.patterns'), true);
  assert.equal(source.includes('pattern?.notes'), true);
});

test('shared document save does not report success when server persistence fails', () => {
  assert.equal(projectFilesSource.includes('saveProjectFileAndConfirm'), true);
  assert.equal(projectFilesSource.includes('createVersion: options.createVersion !== false'), true);
  assert.equal(projectFilesSource.includes('persisted.persisted === false'), true);
  assert.equal(lifecycleSource.includes("import { saveProjectFileAndConfirm } from '../projectFiles.js';"), true);
  assert.equal(lifecycleSource.includes('const saved = await saveProjectFileAndConfirm(adapter.folder, name, data);'), true);
  assert.equal(lifecycleSource.includes('rollbackBeforeSave = adapter.beforeSave?.(context, { name }) || null;'), true);
  assert.equal(lifecycleSource.includes('rollbackBeforeSave'), true);
  assert.equal(lifecycleSource.includes('context.game?.showSaveStatusModal?.(message);'), true);
  assert.equal(lifecycleSource.includes('throw error;'), true);
});

test('autosaves and settings skip server version snapshots', () => {
  assert.equal(preferencesSource.includes('createVersion: false'), true);
  assert.equal(source.includes("saveProjectFile('music', MIDI_COMPOSER_AUTOSAVE_DOC, data, { createVersion: false });"), true);
  assert.equal(serverSource.includes('create_version = payload.get("createVersion") is not False'), true);
  assert.equal(serverSource.includes('if create_version:'), true);
  assert.equal(serverSource.includes('self._snapshot_exported_payload(folder, name, "before-save")'), true);
});

test('SFX manual save only reports saved after confirmed server persistence', () => {
  assert.equal(sfxSource.includes("import { loadProjectFile, saveProjectFileAndConfirm, sanitizeProjectFileName } from './projectFiles.js';"), true);
  assert.equal(sfxSource.includes("await saveProjectFileAndConfirm('sfx', name, data);"), true);
  assert.equal(sfxSource.includes("this.showMessage('Saved');"), true);
  assert.equal(sfxSource.includes('Saved locally; server sync pending'), false);
});

test('project browser and dev server expose MIDI version diagnostics', () => {
  assert.equal(serverSource.includes('def _summarize_project_document'), true);
  assert.equal(serverSource.includes('for label in ("ContraBass", "Cello"):'), true);
  assert.equal(browserSource.includes('Contra ${version.summary.lastContraBassPitch}@m'), true);
});
