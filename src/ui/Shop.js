export default class Shop {
  constructor(upgrades) {
    this.upgrades = upgrades;
    this.selection = 0;
  }

  itemCount() {
    return this.upgrades.length + 1;
  }

  move(dir) {
    const count = this.itemCount();
    this.selection = (this.selection + dir + count) % count;
  }

  current() {
    return this.upgrades[this.selection];
  }

  draw(ctx, width, height, player) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = '20px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Chainsaw Workshop', width / 2, 60);

    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Credits: ${player.credits}`, 60, 100);
    ctx.fillText(`Loot: ${player.loot} (sell with SPACE on Sell line)`, 60, 120);

    const startY = 160;
    this.upgrades.forEach((upgrade, index) => {
      const y = startY + index * 22;
      const owned = player.equippedUpgrades.some((item) => item.id === upgrade.id);
      const prefix = index === this.selection ? '> ' : '  ';
      const status = owned ? '[E]' : '[ ]';
      ctx.fillText(`${prefix}${status} ${upgrade.name} (${upgrade.slot}) - ${upgrade.cost}c`, 60, y);
    });

    const sellY = startY + this.upgrades.length * 22 + 20;
    const sellPrefix = this.selection === this.upgrades.length ? '> ' : '  ';
    ctx.fillText(`${sellPrefix}Sell Loot: +5c each`, 60, sellY);

    ctx.textAlign = 'center';
    ctx.fillText('Arrow keys to browse, SPACE to buy/equip/sell, Esc to exit', width / 2, height - 40);
    ctx.restore();
  }
}
