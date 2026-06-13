import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../src/ui/ProjectBrowserModal.js', import.meta.url), 'utf8');

test('project browser version restore requires confirmation and explains backup behavior', () => {
  assert.equal(source.includes('Restore this version? Current file will be backed up first.'), true);
  assert.equal(source.includes('Confirm Restore'), true);
  assert.equal(source.includes('restoreConfirmTarget = version.id'), true);
});

test('project browser refreshes versions after confirmed restore', () => {
  assert.equal(source.includes('versionEntries = await listProjectFileVersions(folder, name);'), true);
  assert.equal(source.includes('before-version-restore'), false);
});
