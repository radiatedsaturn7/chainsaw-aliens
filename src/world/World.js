const FALLBACK_WORLD = {
  tileSize: 32,
  width: 64,
  height: 36,
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
    "#######################.......S...H.................S.....B...##",
    "#######################....############...###.................##",
    "#######################.....a.......a.....###.................##",
    "#######################...m...............###.................##",
    "################################a###################.###########",
    "################################P###################R###########",
    "################################.###################.###########",
    "##.................####.......##.##.......###.......#####.....##",
    "##............a.a..####...................###...a.............##",
    "##........................#....##..................####.......##",
    "##....g...S.......H..........S......$...p..G......S.....$.....##",
    "#######################.....#.#...#...#.#.###.#.#.#.#...#.#.#.##",
    "##.................####...................###.................##",
    "##.................####...................###.................##",
    "################################.###############################",
    "################################M###############################",
    "################################.###############################",
    "#######################...................######################",
    "#######################...r...H...........######################",
    "#######################...#############...######################",
    "#######################.......S...........######################",
    "#######################...................######################",
    "#######################...................######################",
    "#######################...................######################",
    "################################################################",
    "################################################################",
    "################################################################"
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

export default class World {
  constructor() {
    this.tileSize = 32;
    this.width = 0;
    this.height = 0;
    this.tiles = [];
    this.regions = [];
    this.abilityPickups = [];
    this.healthUpgrades = [];
    this.savePoints = [];
    this.shops = [];
    this.anchors = [];
    this.gates = [];
    this.bossGate = null;
    this.data = null;
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
    this.healthUpgrades = [];
    this.savePoints = [];
    this.shops = [];
    this.anchors = [];
    this.gates = [];
    this.bossGate = null;
    this.data = data;

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
        if (tile === 'g' || tile === 'p' || tile === 'm' || tile === 'r') {
          const ability = { g: 'grapple', p: 'phase', m: 'magboots', r: 'resonance' }[tile];
          this.abilityPickups.push({ id: `ability-${ability}`, x: worldX, y: worldY, ability, collected: false });
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
        if (['G', 'P', 'M', 'R'].includes(tile)) {
          this.gates.push({ x: worldX, y: worldY, type: tile });
        }
        if (tile === 'B') {
          this.bossGate = { id: 'boss-gate', x: worldX, y: worldY };
        }
      }
    }
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

  isSolid(x, y, abilities) {
    const tile = this.getTile(x, y);
    if (tile === '#') return true;
    if (tile === 'G') return !abilities.grapple;
    if (tile === 'P') return !abilities.phase;
    if (tile === 'M') return !abilities.magboots;
    if (tile === 'R') return !abilities.resonance;
    if (tile === 'B') return !(abilities.grapple && abilities.phase && abilities.magboots && abilities.resonance);
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
