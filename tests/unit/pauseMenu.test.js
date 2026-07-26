import test from 'node:test';
import assert from 'node:assert/strict';

import Pause from '../../src/ui/Pause.js';
import { drawInGameTextMenu } from '../../src/ui/shared/inGameTextMenu.js';

function createContext() {
  const calls = [];
  const noop = () => {};
  return {
    calls,
    save: noop,
    restore: noop,
    fillRect(x, y, w, h) { calls.push({ type: 'fillRect', x, y, w, h }); },
    strokeRect(x, y, w, h) { calls.push({ type: 'strokeRect', x, y, w, h }); },
    fillText(value, x, y) { calls.push({ type: 'text', value, x, y, font: this.font }); }
  };
}

test('pause menu exposes explicit navigable actions', () => {
  const pause = new Pause();

  assert.deepEqual(pause.getItems().map((item) => item.id), ['resume', 'exit']);
  assert.equal(pause.currentItem().id, 'resume');

  pause.move(1);
  assert.equal(pause.confirm(), 'exit');
  pause.move(1);
  assert.equal(pause.confirm(), 'resume');
});

test('pause menu exit confirmation defaults to no', () => {
  const pause = new Pause();

  pause.resetConfirm();
  assert.equal(pause.confirmExitChoice(), 'no');
  pause.moveConfirm(1);
  assert.equal(pause.confirmExitChoice(), 'yes');
  pause.moveConfirm(1);
  assert.equal(pause.confirmExitChoice(), 'no');
});

test('shared in-game text menu preserves Level pause reference metrics', () => {
  const ctx = createContext();
  const result = drawInGameTextMenu(ctx, {
    bounds: { x: 0, y: 0, w: 960, h: 540 },
    rows: [
      { id: 'resume', label: 'Return to Game' },
      { id: 'exit', label: 'Exit to Main Menu' }
    ],
    footer: 'D-pad: Navigate'
  });

  assert.equal(result.scale, 1);
  assert.deepEqual(result.rowBounds[0], { x: 320, y: 179, w: 320, h: 34, id: 'resume' });
  assert.equal(ctx.calls.find((call) => call.type === 'text' && call.value === 'Paused')?.font, '22px Courier New');
  assert.equal(ctx.calls.find((call) => call.type === 'text' && call.value === '> Return to Game')?.font, '16px Courier New');
});

test('shared in-game text menu scales Level metrics uniformly into handheld bounds', () => {
  const ctx = createContext();
  const result = drawInGameTextMenu(ctx, {
    bounds: { x: 10, y: 20, w: 390, h: 240 },
    rows: [{ id: 'resume', label: 'Return to Game' }]
  });

  assert.equal(Math.abs(result.scale - 0.40625) < 0.000001, true);
  assert.equal(result.contentBounds.x, 10);
  assert.equal(result.contentBounds.y > 20, true);
  assert.equal(result.rowBounds[0].w, 130);
  assert.equal(ctx.calls.find((call) => call.type === 'text' && call.value === 'Paused')?.font, '8.9375px Courier New');
});

test('Level pause delegates its rows and hit bounds to the shared text menu', () => {
  const pause = new Pause();
  const ctx = createContext();

  pause.draw(ctx, 960, 540, 'Reach the exit');

  assert.deepEqual(pause.itemBounds[0], { x: 320, y: 179, w: 320, h: 34, id: 'resume' });
  assert.deepEqual(pause.exitBounds, { x: 320, y: 223, w: 320, h: 34 });
  assert.equal(ctx.calls.some((call) => call.type === 'text' && call.value === 'Objective: Reach the exit'), true);
  assert.equal(ctx.calls.some((call) => call.type === 'text' && call.value.includes('START: Return')), true);
});
