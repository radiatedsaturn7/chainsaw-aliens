const FALLBACK_WORLD = {
  tileSize: 32,
  width: 64,
  height: 36,
  tiles: [
    "################################################################",
    "#..............................................................#",
    "#..............................................................#",
    "#..............................................................#",
    "#..............................................................#",
    "#..............................................................#",
    "#.........................##a##................................#",
    "#..............................................................#",
    "#.......................................######.................#",
    "#...........................m.................#.........B......#",
    "#.......................#################.....##################",
    "#...............................#..............................#",
    "#...........................a...#...a..........................#",
    "#...............................#..............................#",
    "#...............................M..............................#",
    "#...............................#..............................#",
    "#.....#######...................#.................#######......#",
    "#...............................#..............................#",
    "#.................##G###........#.......####P#.................#",
    "#.....g.S...................S.$.#...S...............$.p........#",
    "#.#################.....#################.....##################",
    "#...............................#..............................#",
    "#...............................#..............................#",
    "#...............................#..............................#",
    "#...............................#..............................#",
    "#...............................#..............................#",
    "#...............................R.#####........................#",
    "#...............................#..............................#",
    "#...............................#..............................#",
    "#...........................r...#..............................#",
    "#.......................#################......................#",
    "#..............................................................#",
    "#..............................................................#",
    "#..............................................................#",
    "#..............................................................#",
    "################################################################"
  ],
  regions: [
    { id: 'hub', name: 'Hub', rect: [24, 16, 17, 6] },
    { id: 'tangle', name: 'Tangle', rect: [2, 16, 17, 6] },
    { id: 'foundry', name: 'Foundry', rect: [46, 16, 17, 6] },
    { id: 'spire', name: 'Spire', rect: [24, 6, 17, 6] },
    { id: 'hollow', name: 'Hollow', rect: [24, 26, 17, 6] },
    { id: 'rift', name: 'Rift', rect: [46, 6, 17, 6] }
  ]
};

export default class World {
  constructor() {
    this.tileSize = 32;
    this.width = 0;
    this.height = 0;
    this.tiles = [];
    this.regions = [];
    this.abilityPickups = [];
    this.savePoints = [];
    this.shops = [];
    this.anchors = [];
    this.bossGate = null;
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
    this.tiles = data.tiles;
    this.regions = data.regions || [];
    this.abilityPickups = [];
    this.savePoints = [];
    this.shops = [];
    this.anchors = [];
    this.bossGate = null;

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const tile = this.getTile(x, y);
        const worldX = x * this.tileSize + this.tileSize / 2;
        const worldY = y * this.tileSize + this.tileSize / 2;
        if (tile === 'S') {
          this.savePoints.push({ x: worldX, y: worldY, active: false });
        }
        if (tile === '$') {
          this.shops.push({ x: worldX, y: worldY });
        }
        if (tile === 'g' || tile === 'p' || tile === 'm' || tile === 'r') {
          const ability = { g: 'grapple', p: 'phase', m: 'magboots', r: 'resonance' }[tile];
          this.abilityPickups.push({ x: worldX, y: worldY, ability, collected: false });
        }
        if (tile === 'a') {
          this.anchors.push({ x: worldX, y: worldY });
        }
        if (tile === 'B') {
          this.bossGate = { x: worldX, y: worldY };
        }
      }
    }
  }

  getTile(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return '#';
    }
    return this.tiles[y][x];
  }

  isSolid(x, y, abilities) {
    const tile = this.getTile(x, y);
    if (tile === '#') return true;
    if (tile === 'G') return !abilities.grapple;
    if (tile === 'P') return !abilities.phase;
    if (tile === 'M') return !abilities.magboots;
    if (tile === 'R') return !abilities.resonance;
    return false;
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
}
