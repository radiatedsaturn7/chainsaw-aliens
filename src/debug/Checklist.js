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
    ctx.fillRect(12, height - 220, 240, 208);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(12, height - 220, 240, 208);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.fillText('VISUAL READABILITY', 24, height - 198);
    const legendItems = [
      'player',
      'ability',
      'save',
      'shop',
      'anchor',
      'gateG',
      'gateP',
      'gateM',
      'gateR',
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
      ctx.fillText(`${item.glyph} ${item.label}`, 24, height - 178 + index * 12);
    });
    ctx.restore();

    this.drawHighlights(ctx, player, enemies, world);
  }

  drawHighlights(ctx, player, enemies, world) {
    const highlight = (x, y, label) => {
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff';
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
    world.anchors.forEach((anchor) => {
      if (Math.hypot(anchor.x - player.x, anchor.y - player.y) < this.radius) {
        highlight(anchor.x, anchor.y - 12, LEGEND.anchor.label);
      }
    });
    if (world.bossGate) {
      highlight(world.bossGate.x, world.bossGate.y - 16, LEGEND.bossGate.label);
    }
  }
}
