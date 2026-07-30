import test from 'node:test';
import assert from 'node:assert/strict';

import LevelEditorCore from '../../src/ui/LevelEditorCore.js';

function createGameStub() {
  const world = new Proxy({
    width: 64,
    height: 64,
    tileSize: 32,
    rooms: [],
    enemies: [],
    powerups: [],
    decals: [],
    triggers: [],
    musicZones: [],
    getTile: () => '.',
    setTile: () => {},
    getRoomAt: () => null,
    getRoomKey: () => '0,0',
    ensureRoom: () => ({}),
    serialize: () => ({})
  }, {
    get: (target, prop) => (prop in target ? target[prop] : (() => null))
  });
  const game = {
    world,
    canvas: { width: 1280, height: 720 },
    input: { isGamepadConnected: () => false },
    camera: { x: 0, y: 0 },
    drawWorld: () => {},
    showSystemToast: () => {},
    audio: { playSfx: () => {}, playMusic: () => {}, stopMusic: () => {} }
  };
  return new Proxy(game, {
    get: (target, prop) => (prop in target ? target[prop] : (() => null))
  });
}

function createCanvasContextStub(canvas) {
  return new Proxy({ canvas }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'measureText') return (text) => ({ width: String(text || '').length * 7 });
      if (prop === 'getImageData') return () => ({ data: [0, 0, 0, 255] });
      return () => {};
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

test('Level Editor draw does not throw in desktop, portrait, or landscape layout', () => {
  const game = createGameStub();
  const ctx = createCanvasContextStub(game.canvas);
  const editor = new LevelEditorCore(game);
  editor.active = true;

  [
    { label: 'desktop', width: 1280, height: 720, mobile: false },
    { label: 'portrait', width: 390, height: 844, mobile: true },
    { label: 'landscape', width: 844, height: 390, mobile: true }
  ].forEach(({ label, width, height, mobile }) => {
    game.canvas.width = width;
    game.canvas.height = height;
    editor.isMobileLayout = () => mobile;
    assert.doesNotThrow(() => editor.draw(ctx, width, height), label);
  });
});

test('Level Editor Start Race trigger actions normalize and summarize car selection', () => {
  const game = createGameStub();
  game.raceEditor = {
    project: {
      cars: [
        { id: 'default-white', name: 'Default White' },
        { id: 'unnamed-built-in' }
      ]
    }
  };
  const editor = new LevelEditorCore(game);
  const action = editor.createTriggerAction('start-race');
  assert.deepEqual(action.params, {
    raceName: '',
    carSelection: 'player-chooses',
    carRef: null
  });

  const trigger = {
    condition: 'When player enters this location',
    actions: [{
      id: 'start-race-1',
      type: 'start-race',
      params: {
        raceName: 'Studio Sprint',
        carSelection: 'specific',
        carRef: '2022 Subaru WRX'
      }
    }]
  };
  editor.normalizeTrigger(trigger);
  assert.equal(
    editor.formatTriggerActionSummary(trigger.actions[0]),
    'Race: Studio Sprint · Car: 2022 Subaru WRX'
  );

  trigger.actions[0].params.carSelection = 'invalid';
  editor.normalizeTrigger(trigger);
  assert.equal(trigger.actions[0].params.carSelection, 'player-chooses');
  assert.equal(trigger.actions[0].params.carRef, null);

  const carNames = editor.getTriggerCarNames();
  assert.equal(carNames[0], 'Player Chooses');
  assert.equal(carNames.includes('Default White'), true);
  assert.equal(carNames.includes('unnamed-built-in'), true);
});

test('Level Editor draws an authoring-only outline over solid tile artwork', () => {
  const game = createGameStub();
  game.world.width = 4;
  game.world.height = 4;
  game.world.tiles = [
    '....',
    '.##.',
    '....',
    '....'
  ];
  game.world.getTile = (x, y) => game.world.tiles[y]?.[x] || '.';
  game.world.getTileProperties = (x, y) => ({
    solid: game.world.getTile(x, y) === '#'
  });
  const editor = new LevelEditorCore(game);
  editor.camera = { x: 0, y: 0 };
  editor.zoom = 1;

  const fills = [];
  let strokeCount = 0;
  const ctx = createCanvasContextStub(game.canvas);
  ctx.fillRect = (x, y, w, h) => fills.push({ x, y, w, h });
  ctx.stroke = () => {
    strokeCount += 1;
  };

  editor.drawSolidCollisionOverlay(ctx);

  assert.deepEqual(fills, [
    { x: 32, y: 32, w: 32, h: 32 },
    { x: 64, y: 32, w: 32, h: 32 }
  ]);
  assert.equal(strokeCount, 1);
  assert.equal(ctx.strokeStyle, 'rgba(120, 200, 255, 0.82)');
});

test('new Level Editor documents start with default art-free gray solids', () => {
  const game = createGameStub();
  const editor = new LevelEditorCore(game);

  const data = editor.buildEmptyLevelData(24, 24);

  assert.deepEqual(data.pixelArt, { tiles: {}, tileProperties: {} });
  assert.equal(data.tiles[0], '#'.repeat(24));
  assert.equal(data.tiles[12][12], '.');
});
