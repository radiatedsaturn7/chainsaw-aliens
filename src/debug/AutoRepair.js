import { MOVEMENT_MODEL } from '../game/MovementModel.js';

const DEFAULT_DATA = {
  enabled: false,
  spawnOverride: null,
  tilePatches: [],
  movementTweaks: {},
  autoFixes: []
};

export default class AutoRepair {
  constructor(world) {
    this.world = world;
    this.data = DEFAULT_DATA;
    this.logs = [];
    this.applied = new Set();
  }

  async load() {
    try {
      const response = await fetch('./src/content/repairs.json');
      if (!response.ok) return;
      this.data = await response.json();
    } catch (error) {
      this.data = DEFAULT_DATA;
    }
  }

  applyPersistentPatches() {
    this.logs = [];
    if (!this.data.enabled) return;
    if (this.data.movementTweaks) {
      this.applyMovementTweaks(this.data.movementTweaks);
    }
    if (this.data.tilePatches?.length) {
      this.data.tilePatches.forEach((patch) => {
        this.applyTilePatch(patch);
      });
      this.refreshWorld();
    }
  }

  applySpawnOverride(game) {
    if (!this.data.enabled) return false;
    const override = this.data.spawnOverride;
    if (!override) return false;
    const x = override.tx * this.world.tileSize + this.world.tileSize / 2;
    const y = override.ty * this.world.tileSize + this.world.tileSize / 2;
    game.spawnPoint = { x, y };
    game.player.x = x;
    game.player.y = y;
    this.logs.push(`Applied spawn override to ${override.tx},${override.ty}.`);
    return true;
  }

  applyMovementTweaks(tweaks) {
    Object.entries(tweaks).forEach(([key, value]) => {
      if (key in MOVEMENT_MODEL) {
        MOVEMENT_MODEL[key] = value;
        this.logs.push(`Movement tweak: ${key} -> ${value}`);
      }
    });
  }

  applyTilePatch(patch) {
    if (!patch?.changes?.length) return;
    if (this.applied.has(patch.id)) return;
    const tiles = this.world.data?.tiles;
    if (!tiles) return;
    patch.changes.forEach((change) => {
      const { x, y, value } = change;
      const row = tiles[y];
      if (!row) return;
      tiles[y] = row.substring(0, x) + value + row.substring(x + 1);
    });
    this.applied.add(patch.id);
    this.logs.push(`Patch applied: ${patch.id}`);
  }

  refreshWorld() {
    if (this.world.data) {
      this.world.applyData(this.world.data);
    }
  }

  runRepairLoop(runSuite, maxAttempts = 3) {
    let attempt = 0;
    let report = runSuite();
    while (report.overall === 'fail' && attempt < maxAttempts) {
      const applied = this.applyNextFix(report);
      if (!applied) break;
      this.refreshWorld();
      report = runSuite();
      attempt += 1;
    }
    if (report.overall === 'fail') {
      report.hardFail = true;
      report.lines.push('✗ Auto-repair exceeded attempts.');
    }
    const fixLines = this.logs.map((line) => `↺ ${line}`);
    report.lines.push(...fixLines);
    report.logs = [...(report.logs || []), ...this.logs];
    return report;
  }

  applyNextFix(report) {
    const fix = this.data.autoFixes?.find((entry) => !this.applied.has(entry.id));
    if (!fix) return false;
    if (fix.type === 'tilePatch') {
      const patch = this.data.tilePatches.find((p) => p.id === fix.ref);
      if (!patch) return false;
      this.applyTilePatch(patch);
      return true;
    }
    if (fix.type === 'movementTweaks') {
      this.applyMovementTweaks(fix.values || {});
      this.applied.add(fix.id);
      return true;
    }
    return false;
  }

  getSnapshot() {
    return {
      enabled: Boolean(this.data.enabled),
      spawnOverride: this.data.spawnOverride || null,
      tilePatches: Array.isArray(this.data.tilePatches) ? [...this.data.tilePatches] : [],
      movementTweaks: this.data.movementTweaks ? { ...this.data.movementTweaks } : {},
      autoFixes: Array.isArray(this.data.autoFixes) ? [...this.data.autoFixes] : []
    };
  }

  buildRepairData({ spawnOverride }) {
    const base = this.getSnapshot();
    if (spawnOverride) {
      base.spawnOverride = spawnOverride;
    }
    base.enabled = true;
    return base;
  }

  serializeRepairs(data) {
    const sortedMovement = {};
    Object.keys(data.movementTweaks || {})
      .sort()
      .forEach((key) => {
        sortedMovement[key] = data.movementTweaks[key];
      });
    const sortedPatches = [...(data.tilePatches || [])].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    const sortedFixes = [...(data.autoFixes || [])].sort((a, b) => (a.id || '').localeCompare(b.id || ''));
    const payload = {
      enabled: Boolean(data.enabled),
      spawnOverride: data.spawnOverride || null,
      tilePatches: sortedPatches,
      movementTweaks: sortedMovement,
      autoFixes: sortedFixes
    };
    return JSON.stringify(payload, null, 2);
  }

  async writeRepairs(data) {
    const body = this.serializeRepairs(data);
    try {
      const response = await fetch('/__repair__', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body
      });
      if (!response.ok) {
        return { ok: false, message: `Repair write failed (${response.status}).` };
      }
      this.data = data;
      return { ok: true, message: 'Repairs saved.' };
    } catch (error) {
      return { ok: false, message: 'Repair write unavailable (no dev server).' };
    }
  }
}
