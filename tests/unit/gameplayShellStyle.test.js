import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../../src/game/GameCore.js', import.meta.url), 'utf8');

function methodBody(name, nextName) {
  const start = source.indexOf(`  ${name}(`);
  const end = source.indexOf(`  ${nextName}(`, start + 1);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('gameplay handheld shells do not draw old amber text or stagger marks', () => {
  const portrait = methodBody('drawPortraitHandheldShell', 'drawDisplayModeFilter');
  const landscape = methodBody('drawLandscapeHandheldShell', 'updateControlScheme');
  const shellSource = `${portrait}\n${landscape}`;

  assert.equal(source.includes('drawLandscapeGameGearOverlay('), false);
  assert.equal(shellSource.includes('TACTICAL DISPLAY'), false);
  assert.equal(shellSource.includes('rgba(214,193,96'), false);
  assert.equal(shellSource.includes('rgba(214, 193, 96'), false);
  assert.equal(shellSource.includes('device.h - 18'), false);
  assert.equal(shellSource.includes('height - bottomH + 4'), false);
});
