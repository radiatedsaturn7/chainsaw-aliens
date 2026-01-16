import { LEGEND } from '../content/legend.js';

export default class Checklist {
  constructor() {
    this.active = false;
    this.radius = 140;
  }

  toggle() {
    this.active = !this.active;
  }

  draw(ctx, game, width, height) {
    if (!this.active) return;
    const { player, enemies, world } = game;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(12, height - 260, 240, 248);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(12, height - 260, 240, 248);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('VISUAL READABILITY', 24, height - 238);
    const legendItems = [
      'player',
      'ability',
      'vitality',
      'save',
      'shop',
      'anchor',
      'wood',
      'metal',
      'brittle',
      'debris',
      'switch',
      'bossGate',
      'skitter',
      'spitter',
      'bulwark',
      'floater',
      'slicer',
      'hivenode',
      'sentinel',
      'finalboss'
    ];
    legendItems.forEach((key, index) => {
      const item = LEGEND[key];
      if (!item) return;
      ctx.fillText(`${item.glyph} ${item.label}`, 24, height - 218 + index * 12);
    });
    ctx.restore();

    this.drawHighlights(ctx, game);
  }

  drawHighlights(ctx, game) {
    const { player, enemies, world } = game;
    const highlight = (x, y, label, style = '#fff') => {
      ctx.save();
      ctx.strokeStyle = style;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = style;
      ctx.font = '12px Courier New';
      ctx.fillText(label, x + 24, y - 12);
      ctx.restore();
    };
    highlight(player.x, player.y - 12, LEGEND.player.label);
    enemies.forEach((enemy) => {
      if (enemy.dead) return;
      if (Math.hypot(enemy.x - player.x, enemy.y - player.y) < this.radius) {
        highlight(enemy.x, enemy.y - 12, LEGEND[enemy.type]?.label || 'Enemy');
      }
    });
    world.savePoints.forEach((save) => {
      if (Math.hypot(save.x - player.x, save.y - player.y) < this.radius) {
        highlight(save.x, save.y - 16, LEGEND.save.label);
      }
    });
    world.shops.forEach((shop) => {
      if (Math.hypot(shop.x - player.x, shop.y - player.y) < this.radius) {
        highlight(shop.x, shop.y - 16, LEGEND.shop.label);
      }
    });
    world.abilityPickups.forEach((pickup) => {
      if (pickup.collected) return;
      if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < this.radius) {
        highlight(pickup.x, pickup.y - 16, LEGEND.ability.label);
      }
    });
    world.healthUpgrades.forEach((upgrade) => {
      if (upgrade.collected) return;
      if (Math.hypot(upgrade.x - player.x, upgrade.y - player.y) < this.radius) {
        highlight(upgrade.x, upgrade.y - 16, LEGEND.vitality.label);
      }
    });
    world.anchors.forEach((anchor) => {
      if (Math.hypot(anchor.x - player.x, anchor.y - player.y) < this.radius) {
        highlight(anchor.x, anchor.y - 12, LEGEND.anchor.label);
      }
    });
    if (world.bossGate) {
      highlight(world.bossGate.x, world.bossGate.y - 16, LEGEND.bossGate.label);
    }

    const objective = game.getObjectiveTarget();
    if (objective) {
      highlight(objective.x, objective.y - 20, LEGEND.objective.label, 'rgba(255,255,255,0.9)');
    }
    const nearest = this.findNearestInteractable(game);
    if (nearest) {
      highlight(nearest.x, nearest.y - 18, nearest.label, 'rgba(255,255,255,0.7)');
    }
  }

  findNearestInteractable(game) {
    const { player, world } = game;
    const candidates = [];
    world.savePoints.forEach((save) => candidates.push({ x: save.x, y: save.y, label: LEGEND.save.label }));
    world.shops.forEach((shop) => candidates.push({ x: shop.x, y: shop.y, label: LEGEND.shop.label }));
    world.abilityPickups.forEach((pickup) => {
      if (!pickup.collected) {
        candidates.push({ x: pickup.x, y: pickup.y, label: LEGEND.ability.label });
      }
    });
    world.healthUpgrades.forEach((upgrade) => {
      if (!upgrade.collected) {
        candidates.push({ x: upgrade.x, y: upgrade.y, label: LEGEND.vitality.label });
      }
    });
    if (world.bossGate) candidates.push({ x: world.bossGate.x, y: world.bossGate.y, label: LEGEND.bossGate.label });
    let best = null;
    candidates.forEach((item) => {
      const dist = Math.hypot(item.x - player.x, item.y - player.y);
      if (!best || dist < best.dist) {
        best = { ...item, dist };
      }
    });
    return best;
  }
}
