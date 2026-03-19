import { normalizeMidiTracks } from '../editor/adapters/editorDataContracts.js';

const FALLBACK_WORLD = {
  schemaVersion: 1,
  tileSize: 32,
  width: 64,
  height: 36,
  spawn: { x: 28, y: 19 },
  tiles: [
    "################################################################",
    "################################################################",
    "################################################################",
    "################################################################",
    "################################################################",
    "################################################################",
    "#######################...................###.................##",
    "#######################...................###.................##",
    "#######################...................###.................##",
    "#######################.......S...H.................S.........##",
    "#######################....############...###.................##",
    "#######################.....a.......a.....###.................##",
    "#######################...m...............###.................##",
    "################################a###################.###########",
    "################################.###################.###########",
    "################################.###################.###########",
    "##.................####.......##.##.......###.......#####.....##",
    "##............a.a..####...................###...a.............##",
    "##........................#....##..................####.......##",
    "##....g...S.......H..........S......$...p.T.......S.....$.....##",
    "#######################.....#.#...#...#.#.###.#.#.#.#...#.#.#.##",
    "##.................####...................###.................##",
    "##.................####...................###.................##",
    "################################.###############################",
    "################################.###############################",
    "################################.###############################",
    "#######################.........T.........######################",
    "#######################...r...H...........######################",
    "#######################...#############...######################",
    "#######################.......S...........######################",
    "#######################...................######################",
    "#######################...................######################",
    "#######################...................######################",
    "################################################################",
    "################################################################",
    "################################################################",
  ],
  regions: [
    { id: 'hub', name: 'Hub', rect: [22, 15, 20, 8] },
    { id: 'tangle', name: 'Tangle', rect: [1, 15, 18, 8] },
    { id: 'foundry', name: 'Foundry', rect: [44, 15, 18, 8] },
    { id: 'spire', name: 'Spire', rect: [22, 5, 20, 8] },
    { id: 'hollow', name: 'Hollow', rect: [22, 25, 20, 8] },
    { id: 'rift', name: 'Rift', rect: [44, 5, 18, 8] }
  ]
};

const DEFAULT_SPAWN = { x: 28, y: 19 };
const DOOR_TILE = 'D';
const ROOM_BLOCKERS = new Set(['#', 'F', 'R', '^', 'v', 'B', 'W', 'X', 'C', 'U', 'I', '<', '>', 'N', 'P', 'Q', 'E', 'G', 'J', 'V']);
const SOLID_TILES = new Set(['#', 'F', 'R', '^', 'v', 'B', 'W', 'X', 'C', 'U', 'I', '<', '>', 'N', 'P', 'Q', 'E', 'G', 'J', 'V']);
const ONE_WAY_TILES = new Set(['=', 's']);
const HAZARD_TILES = new Set(['!', 'A', 'L', '*', 'e']);
const DEFAULT_DYNAMIC_STATE = () => ({
  lockedDoors: new Set(),
  solidZones: []
});

const isRoomTile = (tile) => tile && tile !== DOOR_TILE && !ROOM_BLOCKERS.has(tile);
const DOOR_CAP_DEPTH = 2;

export default class World {
  constructor() {
    this.tileSize = 32;
    this.width = 0;
    this.height = 0;
    this.tiles = [];
    this.regions = [];
    this.spawn = null;
    this.spawnPoint = null;
    this.abilityPickups = [];
    this.mapPickups = [];
    this.healthUpgrades = [];
    this.savePoints = [];
    this.shops = [];
    this.anchors = [];
    this.bossGate = null;
    this.objectives = [];
    this.enemies = [];
    this.boxes = [];
    this.elevatorPaths = [];
    this.elevatorPathSet = new Set();
    this.elevators = [];
    this.elevatorSet = new Set();
    this.pixelArt = { tiles: {} };
    this.musicZones = [];
    this.midiTracks = [];
    this.triggers = [];
    this.decals = [];
    this.data = null;
    this.rooms = [];
    this.roomIndexByTile = [];
    this.dynamicState = DEFAULT_DYNAMIC_STATE();
  }

  async load() {
    let data = null;
    try {
      const response = await fetch('./src/content/world.json');
      if (!response.ok) {
        throw new Error('world.json not found');
      }
      data = await response.json();
    } catch (error) {
      data = FALLBACK_WORLD;
    }
    this.applyData(data);
  }

  applyData(data) {
    this.tileSize = data.tileSize;
    this.width = data.width;
    this.height = data.height;
    const normalizedTiles = this.normalizeDoorTiles((data.tiles || []).map((row) => row.replace(/Y/g, 'K')));
    this.tiles = [...normalizedTiles];
    this.regions = data.regions || [];
    const spawn = data.spawn || DEFAULT_SPAWN;
    this.spawn = { x: spawn.x ?? DEFAULT_SPAWN.x, y: spawn.y ?? DEFAULT_SPAWN.y };
    this.spawnPoint = {
      x: (this.spawn.x + 0.5) * this.tileSize,
      y: (this.spawn.y + 0.5) * this.tileSize
    };
    this.abilityPickups = [];
    this.mapPickups = [];
    this.healthUpgrades = [];
    this.savePoints = [];
    this.shops = [];
    this.anchors = [];
    this.bossGate = null;
    this.objectives = [];
    this.enemies = (data.enemies || []).map((enemy) => ({ ...enemy }));
    this.elevatorPaths = (data.elevatorPaths || []).map((path) => ({ ...path }));
    this.elevatorPathSet = new Set(this.elevatorPaths.map((path) => `${path.x},${path.y}`));
    this.elevators = (data.elevators || []).map((elevator) => ({ ...elevator }));
    this.elevatorSet = new Set(this.elevators.map((elevator) => `${elevator.x},${elevator.y}`));
    this.pixelArt = data.pixelArt ? { ...data.pixelArt, tiles: { ...(data.pixelArt.tiles || {}) } } : { tiles: {} };
    this.musicZones = (data.musicZones || []).map((zone) => ({ ...zone }));
    this.midiTracks = normalizeMidiTracks(data.midiTracks || [], 'piano');
    this.triggers = (data.triggers || []).map((trigger) => ({
      ...trigger,
      actions: Array.isArray(trigger.actions) ? trigger.actions.map((action) => ({
        ...action,
        params: { ...(action?.params || {}) }
      })) : []
    }));
    this.decals = (data.decals || []).map((decal) => ({ ...decal }));
    this.data = { ...data, tiles: [...normalizedTiles] };
    if (this.data) {
      this.data.elevatorPaths = this.elevatorPaths;
      this.data.elevators = this.elevators;
      this.data.pixelArt = this.pixelArt;
      this.data.musicZones = this.musicZones;
      this.data.midiTracks = this.midiTracks;
      this.data.triggers = this.triggers;
      this.data.decals = this.decals;
    }
    this.dynamicState = DEFAULT_DYNAMIC_STATE();
    this.rebuildCaches();
  }


  normalizeDoorTiles(rows) {
    const tiles = rows.map((row) => row.split(''));
    const visited = new Set();
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const inBounds = (x, y) => y >= 0 && y < tiles.length && x >= 0 && x < (tiles[y]?.length || 0);

    const inferWallTile = (cluster) => {
      const counts = new Map();
      for (let y = cluster.minY - 1; y <= cluster.maxY + 1; y += 1) {
        for (let x = cluster.minX - 1; x <= cluster.maxX + 1; x += 1) {
          if (!inBounds(x, y)) continue;
          if (x >= cluster.minX && x <= cluster.maxX && y >= cluster.minY && y <= cluster.maxY) continue;
          const tile = tiles[y][x];
          if (!tile || tile === DOOR_TILE || tile === '.') continue;
          if (!ROOM_BLOCKERS.has(tile)) continue;
          counts.set(tile, (counts.get(tile) || 0) + 1);
        }
      }
      return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '#';
    };

    for (let y = 0; y < tiles.length; y += 1) {
      for (let x = 0; x < (tiles[y]?.length || 0); x += 1) {
        if (tiles[y][x] !== DOOR_TILE) continue;
        const key = `${x},${y}`;
        if (visited.has(key)) continue;
        const stack = [{ x, y }];
        const cluster = [];
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        while (stack.length) {
          const current = stack.pop();
          const currentKey = `${current.x},${current.y}`;
          if (visited.has(currentKey)) continue;
          visited.add(currentKey);
          cluster.push(current);
          minX = Math.min(minX, current.x);
          maxX = Math.max(maxX, current.x);
          minY = Math.min(minY, current.y);
          maxY = Math.max(maxY, current.y);
          dirs.forEach(([dx, dy]) => {
            const nextX = current.x + dx;
            const nextY = current.y + dy;
            if (!inBounds(nextX, nextY) || tiles[nextY][nextX] !== DOOR_TILE) return;
            const nextKey = `${nextX},${nextY}`;
            if (!visited.has(nextKey)) stack.push({ x: nextX, y: nextY });
          });
        }

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        const isRectangular = cluster.length === width * height;
        const majorAxisLength = Math.max(width, height);
        if (!isRectangular || majorAxisLength <= DOOR_CAP_DEPTH * 2) continue;

        const fillerTile = inferWallTile({ minX, minY, maxX, maxY });
        if (height >= width) {
          for (let fillY = minY + DOOR_CAP_DEPTH; fillY <= maxY - DOOR_CAP_DEPTH; fillY += 1) {
            for (let fillX = minX; fillX <= maxX; fillX += 1) {
              tiles[fillY][fillX] = fillerTile;
            }
          }
        } else {
          for (let fillX = minX + DOOR_CAP_DEPTH; fillX <= maxX - DOOR_CAP_DEPTH; fillX += 1) {
            for (let fillY = minY; fillY <= maxY; fillY += 1) {
              tiles[fillY][fillX] = fillerTile;
            }
          }
        }
      }
    }

    return tiles.map((row) => row.join(''));
  }

  rebuildCaches() {
    this.abilityPickups = [];
    this.mapPickups = [];
    this.healthUpgrades = [];
    this.savePoints = [];
    this.shops = [];
    this.anchors = [];
    this.bossGate = null;
    this.objectives = [];
    this.boxes = [];
    this.rooms = [];
    this.roomIndexByTile = [];
    let saveIndex = 0;
    let healthIndex = 0;

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const tile = this.getTile(x, y);
        const worldX = x * this.tileSize + this.tileSize / 2;
        const worldY = y * this.tileSize + this.tileSize / 2;
        if (tile === 'S') {
          const region = this.regionAt(worldX, worldY).id;
          this.savePoints.push({
            id: `save-${region}-${saveIndex}`,
            x: worldX,
            y: worldY,
            active: false
          });
          saveIndex += 1;
        }
        if (tile === '$') {
          this.shops.push({ x: worldX, y: worldY });
        }
        if (tile === 'O') {
          this.objectives.push({ x: worldX, y: worldY });
        }
        if (tile === 'g' || tile === 'p' || tile === 'm' || tile === 'r' || tile === 'i' || tile === 'f') {
          const ability = {
            g: 'anchor',
            p: 'flame',
            m: 'magboots',
            r: 'resonance',
            i: 'ignitir',
            f: 'flamethrower'
          }[tile];
          this.abilityPickups.push({ id: `ability-${ability}`, x: worldX, y: worldY, ability, collected: false });
        }
        if (tile === 'M') {
          this.mapPickups.push({
            id: `map-${x}-${y}`,
            x: worldX,
            y: worldY,
            collected: false
          });
        }
        if (tile === 'H') {
          const region = this.regionAt(worldX, worldY).id;
          this.healthUpgrades.push({
            id: `vital-${region}-${healthIndex}`,
            x: worldX,
            y: worldY,
            collected: false
          });
          healthIndex += 1;
        }
        if (tile === 'a') {
          this.anchors.push({ x: worldX, y: worldY });
        }
        if (tile === 'B') {
          this.bossGate = { id: 'boss-gate', x: worldX, y: worldY };
        }
        if (tile === 'K') {
          this.boxes.push({ x: worldX, y: worldY });
        }
      }
    }

    const roomIndexByTile = Array.from({ length: this.height }, () => Array(this.width).fill(-1));
    const rooms = [];
    const directions = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ];

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (roomIndexByTile[y][x] !== -1) continue;
        const tile = this.getTile(x, y);
        if (!isRoomTile(tile)) continue;
        const queue = [{ x, y }];
        roomIndexByTile[y][x] = rooms.length;
        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        while (queue.length) {
          const current = queue.shift();
          minX = Math.min(minX, current.x);
          maxX = Math.max(maxX, current.x);
          minY = Math.min(minY, current.y);
          maxY = Math.max(maxY, current.y);
          directions.forEach(([dx, dy]) => {
            const nx = current.x + dx;
            const ny = current.y + dy;
            if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) return;
            if (roomIndexByTile[ny][nx] !== -1) return;
            const neighborTile = this.getTile(nx, ny);
            if (!isRoomTile(neighborTile)) return;
            roomIndexByTile[ny][nx] = rooms.length;
            queue.push({ x: nx, y: ny });
          });
        }
        rooms.push({ minX, maxX, minY, maxY });
      }
    }

    this.rooms = rooms;
    this.roomIndexByTile = roomIndexByTile;
  }

  reset() {
    if (this.data) {
      this.applyData(this.data);
    }
  }

  getTile(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return '#';
    }
    return this.tiles[y][x];
  }

  isSolid(x, y, abilities, options = {}) {
    const tile = this.getTile(x, y);
    if (tile === DOOR_TILE && this.isDoorLocked(x, y)) return true;
    if (this.isTileInsideSolidZone(x, y)) return true;
    if (SOLID_TILES.has(tile)) return true;
    if (ONE_WAY_TILES.has(tile)) return !options.ignoreOneWay;
    return false;
  }

  isEnemySolid(x, y, abilities, options = {}) {
    const tile = this.getTile(x, y);
    if (tile === DOOR_TILE) return true;
    return this.isSolid(x, y, abilities, options);
  }

  isHazard(x, y) {
    return HAZARD_TILES.has(this.getTile(x, y));
  }

  isOneWay(x, y) {
    return ONE_WAY_TILES.has(this.getTile(x, y));
  }


  isDoorLocked(x, y) {
    return this.dynamicState?.lockedDoors?.has(`${x},${y}`) || false;
  }

  setDoorLocked(x, y, locked = true) {
    const key = `${x},${y}`;
    if (!this.dynamicState) this.dynamicState = DEFAULT_DYNAMIC_STATE();
    if (locked) {
      this.dynamicState.lockedDoors.add(key);
    } else {
      this.dynamicState.lockedDoors.delete(key);
    }
  }

  clearDoorLocks() {
    if (!this.dynamicState) this.dynamicState = DEFAULT_DYNAMIC_STATE();
    this.dynamicState.lockedDoors.clear();
  }

  setSolidZone(rect, active = true) {
    if (!this.dynamicState) this.dynamicState = DEFAULT_DYNAMIC_STATE();
    const normalized = Array.isArray(rect) && rect.length >= 4
      ? [Math.floor(rect[0]), Math.floor(rect[1]), Math.max(1, Math.floor(rect[2])), Math.max(1, Math.floor(rect[3]))]
      : null;
    if (!normalized) return false;
    const key = normalized.join(',');
    const zones = this.dynamicState.solidZones;
    const index = zones.findIndex((zone) => zone.key === key);
    if (active) {
      if (index >= 0) return false;
      zones.push({ key, rect: normalized });
    } else if (index >= 0) {
      zones.splice(index, 1);
    }
    return true;
  }

  clearSolidZones() {
    if (!this.dynamicState) this.dynamicState = DEFAULT_DYNAMIC_STATE();
    this.dynamicState.solidZones = [];
  }

  isTileInsideSolidZone(x, y) {
    const zones = this.dynamicState?.solidZones || [];
    return zones.some(({ rect }) => x >= rect[0] && x < rect[0] + rect[2] && y >= rect[1] && y < rect[1] + rect[3]);
  }

  setTile(x, y, char, { persist = true } = {}) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const row = this.tiles[y];
    const next = `${row.substring(0, x)}${char}${row.substring(x + 1)}`;
    this.tiles[y] = next;
    if (persist && this.data?.tiles) {
      this.data.tiles[y] = next;
    }
    return true;
  }

  setSpawnTile(x, y) {
    this.spawn = { x, y };
    this.spawnPoint = {
      x: (x + 0.5) * this.tileSize,
      y: (y + 0.5) * this.tileSize
    };
    if (this.data) {
      this.data.spawn = { x, y };
    }
  }

  hasElevatorPath(x, y) {
    return this.elevatorPathSet.has(`${x},${y}`);
  }

  hasElevatorPlatform(x, y) {
    return this.elevatorSet.has(`${x},${y}`);
  }

  setElevatorPath(x, y, active = true) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const key = `${x},${y}`;
    if (active) {
      if (this.elevatorPathSet.has(key)) return false;
      this.elevatorPathSet.add(key);
      this.elevatorPaths.push({ x, y });
    } else {
      if (!this.elevatorPathSet.has(key)) return false;
      this.elevatorPathSet.delete(key);
      this.elevatorPaths = this.elevatorPaths.filter((path) => !(path.x === x && path.y === y));
    }
    if (this.data) {
      this.data.elevatorPaths = this.elevatorPaths;
    }
    return true;
  }

  setElevatorPlatform(x, y, active = true) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const key = `${x},${y}`;
    if (active) {
      if (this.elevatorSet.has(key)) return false;
      this.elevatorSet.add(key);
      this.elevators.push({ x, y });
    } else {
      if (!this.elevatorSet.has(key)) return false;
      this.elevatorSet.delete(key);
      this.elevators = this.elevators.filter((platform) => !(platform.x === x && platform.y === y));
    }
    if (this.data) {
      this.data.elevators = this.elevators;
    }
    return true;
  }

  enemyAt(tileX, tileY) {
    return this.enemies.find((enemy) => enemy.x === tileX && enemy.y === tileY) || null;
  }

  setEnemy(tileX, tileY, type) {
    const existing = this.enemyAt(tileX, tileY);
    if (existing) {
      existing.type = type;
    } else {
      this.enemies.push({ x: tileX, y: tileY, type });
    }
    if (this.data) {
      this.data.enemies = this.enemies;
    }
  }

  removeEnemy(tileX, tileY) {
    const before = this.enemies.length;
    this.enemies = this.enemies.filter((enemy) => !(enemy.x === tileX && enemy.y === tileY));
    if (this.enemies.length !== before && this.data) {
      this.data.enemies = this.enemies;
    }
  }

  expandToInclude(tileX, tileY, fillChar = '.') {
    const left = Math.max(0, -tileX);
    const top = Math.max(0, -tileY);
    const right = Math.max(0, tileX - (this.width - 1));
    const bottom = Math.max(0, tileY - (this.height - 1));
    if (left + top + right + bottom === 0) {
      return { offsetX: 0, offsetY: 0 };
    }

    const newWidth = this.width + left + right;
    const newHeight = this.height + top + bottom;
    const fillRow = fillChar.repeat(newWidth);
    const nextTiles = [];
    for (let y = 0; y < top; y += 1) {
      nextTiles.push(fillRow);
    }
    const leftFill = fillChar.repeat(left);
    const rightFill = fillChar.repeat(right);
    this.tiles.forEach((row) => {
      nextTiles.push(`${leftFill}${row}${rightFill}`);
    });
    for (let y = 0; y < bottom; y += 1) {
      nextTiles.push(fillRow);
    }

    this.tiles = nextTiles;
    this.width = newWidth;
    this.height = newHeight;

    if (left || top) {
      if (this.spawn) {
        this.spawn = { x: this.spawn.x + left, y: this.spawn.y + top };
        this.spawnPoint = {
          x: (this.spawn.x + 0.5) * this.tileSize,
          y: (this.spawn.y + 0.5) * this.tileSize
        };
      }
      this.regions.forEach((region) => {
        const [rx, ry, rw, rh] = region.rect;
        region.rect = [rx + left, ry + top, rw, rh];
      });
      this.enemies.forEach((enemy) => {
        enemy.x += left;
        enemy.y += top;
      });
      this.elevatorPaths.forEach((path) => {
        path.x += left;
        path.y += top;
      });
      this.elevators.forEach((platform) => {
        platform.x += left;
        platform.y += top;
      });
      if (this.elevatorPaths.length) {
        this.elevatorPathSet = new Set(this.elevatorPaths.map((path) => `${path.x},${path.y}`));
      }
      if (this.elevators.length) {
        this.elevatorSet = new Set(this.elevators.map((platform) => `${platform.x},${platform.y}`));
      }
    }

    if (this.data) {
      this.data.tiles = this.tiles;
      this.data.width = this.width;
      this.data.height = this.height;
      if (this.spawn) {
        this.data.spawn = { x: this.spawn.x, y: this.spawn.y };
      }
      this.data.enemies = this.enemies;
      this.data.elevatorPaths = this.elevatorPaths;
      this.data.elevators = this.elevators;
    }

    return { offsetX: left, offsetY: top };
  }

  regionAt(x, y) {
    const tileX = Math.floor(x / this.tileSize);
    const tileY = Math.floor(y / this.tileSize);
    const region = this.regions.find(({ rect }) => {
      const [rx, ry, rw, rh] = rect;
      return tileX >= rx && tileX <= rx + rw && tileY >= ry && tileY <= ry + rh;
    });
    return region || { id: 'wilds', name: 'Unknown' };
  }

  roomAtTile(tileX, tileY) {
    if (tileX < 0 || tileY < 0 || tileX >= this.width || tileY >= this.height) {
      return null;
    }
    const index = this.roomIndexByTile?.[tileY]?.[tileX];
    if (index === undefined || index === -1) return null;
    return index;
  }

  getRoomBounds(index) {
    const room = this.rooms?.[index];
    if (!room) return null;
    return { ...room };
  }
}
