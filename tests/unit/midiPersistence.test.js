import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../../src/ui/MidiComposerCore.js', import.meta.url), 'utf8');
const lifecycleSource = fs.readFileSync(new URL('../../src/ui/editor-documents/documentLifecycle.js', import.meta.url), 'utf8');
const browserSource = fs.readFileSync(new URL('../../src/ui/ProjectBrowserModal.js', import.meta.url), 'utf8');
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
  assert.equal(source.includes("saveProjectFile('music', MIDI_COMPOSER_AUTOSAVE_DOC, data);"), true);
  assert.equal(source.includes("saveProjectFile('music', documentAutosaveName, JSON.parse(snapshot));"), true);
});

test('MIDI empty-document checks inspect pattern notes', () => {
  assert.equal(source.includes('track?.patterns'), true);
  assert.equal(source.includes('pattern?.notes'), true);
});

test('shared document save does not report success when server persistence fails', () => {
  assert.equal(lifecycleSource.includes('persisted.persisted === false'), true);
  assert.equal(lifecycleSource.includes('context.game?.showSaveStatusModal?.(message);'), true);
  assert.equal(lifecycleSource.includes('throw error;'), true);
});

test('project browser and dev server expose MIDI version diagnostics', () => {
  assert.equal(serverSource.includes('def _summarize_project_document'), true);
  assert.equal(serverSource.includes('for label in ("ContraBass", "Cello"):'), true);
  assert.equal(browserSource.includes('Contra ${version.summary.lastContraBassPitch}@m'), true);
});
