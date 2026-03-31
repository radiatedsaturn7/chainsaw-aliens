const W = 56;
const H = 28;
const FLOOR_Y = 24;

function makeGrid(fill = '.') {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => fill));
}

function solidRect(grid, x, y, w, h, tile = '#') {
  for (let yy = y; yy < y + h; yy += 1) {
    for (let xx = x; xx < x + w; xx += 1) {
      if (yy >= 0 && yy < H && xx >= 0 && xx < W) grid[yy][xx] = tile;
    }
  }
}

function baseScenario(name) {
  const grid = makeGrid('.');
  solidRect(grid, 0, FLOOR_Y, W, H - FLOOR_Y, '#');
  return {
    name,
    tileSize: 32,
    width: W,
    height: H,
    spawn: { x: 4, y: FLOOR_Y - 1 },
    tiles: grid,
    elevators: [],
    elevatorPaths: [],
    enemies: [],
    regions: []
  };
}

function toWorldData(spec) {
  return {
    schemaVersion: 1,
    tileSize: spec.tileSize,
    width: spec.width,
    height: spec.height,
    spawn: spec.spawn,
    tiles: spec.tiles.map((row) => row.join('')),
    regions: spec.regions || [],
    enemies: spec.enemies || [],
    elevators: spec.elevators || [],
    elevatorPaths: spec.elevatorPaths || []
  };
}

function buildScenarios() {
  const scenarios = [];

  {
    const s = baseScenario('Empty room');
    scenarios.push(s);
  }
  {
    const s = baseScenario('3x3 solid box');
    solidRect(s.tiles, 26, FLOOR_Y - 3, 3, 3);
    scenarios.push(s);
  }
  {
    const s = baseScenario('5x3 solid box');
    solidRect(s.tiles, 25, FLOOR_Y - 3, 5, 3);
    scenarios.push(s);
  }
  {
    const s = baseScenario('3x5 solid box');
    solidRect(s.tiles, 26, FLOOR_Y - 5, 3, 5);
    scenarios.push(s);
  }
  {
    const s = baseScenario('3x1 hazard strip');
    solidRect(s.tiles, 26, FLOOR_Y, 3, 1, '!');
    scenarios.push(s);
  }
  {
    const s = baseScenario('Elevator up 10 with 10x3 column');
    solidRect(s.tiles, 24, FLOOR_Y - 10, 10, 3);
    for (let y = FLOOR_Y - 11; y <= FLOOR_Y - 1; y += 1) {
      s.elevatorPaths.push({ x: 20, y });
    }
    s.elevators.push({ x: 20, y: FLOOR_Y - 1 });
    scenarios.push(s);
  }
  {
    const s = baseScenario('10x3 column + staggered one-way runs');
    solidRect(s.tiles, 24, FLOOR_Y - 10, 10, 3);
    for (let y = FLOOR_Y - 3; y >= FLOOR_Y - 12; y -= 3) {
      solidRect(s.tiles, 18 + ((FLOOR_Y - y) % 2 === 0 ? 0 : 6), y, 8, 1, '=');
    }
    scenarios.push(s);
  }
  {
    const s = baseScenario('10x10 staircase + drop');
    for (let i = 0; i < 10; i += 1) {
      solidRect(s.tiles, 20 + i, FLOOR_Y - i - 1, 1, i + 1);
    }
    solidRect(s.tiles, 34, FLOOR_Y - 8, 2, 8);
    scenarios.push(s);
  }
  {
    const s = baseScenario('1x10 hazard + moving platform above');
    solidRect(s.tiles, 27, FLOOR_Y, 1, 10, '!');
    for (let x = 20; x <= 36; x += 1) {
      s.elevatorPaths.push({ x, y: FLOOR_Y - 6 });
    }
    s.elevators.push({ x: 20, y: FLOOR_Y - 6 });
    scenarios.push(s);
  }

  return scenarios.map((scenario) => ({
    name: scenario.name,
    data: toWorldData(scenario),
    playerTile: { x: W - 4, y: FLOOR_Y - 1 },
    companionTile: { x: 3, y: FLOOR_Y - 1 }
  }));
}

export default class AITestHarness {
  constructor() {
    this.active = false;
    this.index = 0;
    this.scenarios = buildScenarios();
    this.success = false;
    this.elapsed = 0;
  }

  enable(game, index = 0) {
    this.active = true;
    this.index = Math.max(0, Math.min(this.scenarios.length - 1, index));
    this.loadCurrent(game);
  }

  disable() {
    this.active = false;
  }

  loadCurrent(game) {
    const entry = this.scenarios[this.index];
    if (!entry) return;
    game.world.applyData(entry.data);
    game.minimap = game.minimap || null;
    game.player.x = (entry.playerTile.x + 0.5) * game.world.tileSize;
    game.player.y = (entry.playerTile.y + 0.5) * game.world.tileSize;
    game.player.vx = 0;
    game.player.vy = 0;
    game.enemies = [];
    game.projectiles = [];
    game.effects = [];
    game.spawnFriendlyCompanion((entry.companionTile.x + 0.5) * game.world.tileSize, (entry.companionTile.y + 0.5) * game.world.tileSize, { assistEnabled: false });
    this.success = false;
    this.elapsed = 0;
    game.showSystemToast(`AI Test: ${entry.name}`);
  }

  update(input, game, dt) {
    if (!this.active) return;
    this.elapsed += dt;
    if (input.wasPressed('cancel')) {
      this.disable();
      game.transitionTo('title');
      return;
    }
    if (input.wasPressed('left')) {
      this.index = (this.index - 1 + this.scenarios.length) % this.scenarios.length;
      this.loadCurrent(game);
      return;
    }
    if (input.wasPressed('right')) {
      this.index = (this.index + 1) % this.scenarios.length;
      this.loadCurrent(game);
      return;
    }
    const c = game.friendlyCompanion;
    if (c && Math.hypot(c.x - game.player.x, c.y - game.player.y) < game.world.tileSize * 1.5) {
      this.success = true;
    }
  }

  draw(ctx, width) {
    if (!this.active) return;
    const entry = this.scenarios[this.index];
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(16, 16, 520, 88);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(16, 16, 520, 88);
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.fillText(`AI TEST ${this.index + 1}/${this.scenarios.length}: ${entry?.name || ''}`, 28, 42);
    ctx.fillText(`Status: ${this.success ? 'PASS' : 'RUNNING'}  Time: ${this.elapsed.toFixed(1)}s`, 28, 62);
    ctx.fillText('Left/Right: scenario  Backspace: exit', 28, 82);
    ctx.restore();
  }
}
