import { drawInGameTextMenu } from './shared/inGameTextMenu.js';

export default class Pause {
  constructor() {
    this.shake = true;
    this.selection = 0;
    this.exitBounds = null;
    this.itemBounds = [];
    this.confirmSelection = 0;
    this.confirmBounds = [];
  }

  getItems() {
    return [
      { id: 'resume', label: 'Return to Game' },
      { id: 'exit', label: 'Exit to Main Menu' }
    ];
  }

  currentItem() {
    const items = this.getItems();
    return items[this.selection] || items[0];
  }

  move(dir) {
    const count = this.getItems().length;
    this.selection = (this.selection + dir + count) % count;
  }

  adjust(dir) {
    this.move(dir);
  }

  confirm() {
    const item = this.currentItem();
    if (!item) return null;
    return item.id;
  }

  moveConfirm(dir) {
    this.confirmSelection = (this.confirmSelection + dir + 2) % 2;
  }

  confirmExitChoice() {
    return this.confirmSelection === 1 ? 'yes' : 'no';
  }

  resetConfirm() {
    this.confirmSelection = 0;
  }

  draw(ctx, width, height, objective, { confirmExit = false } = {}) {
    const items = this.getItems();
    const menu = drawInGameTextMenu(ctx, {
      bounds: { x: 0, y: 0, w: width, h: height },
      title: 'Paused',
      rows: items,
      selectedIndex: this.selection,
      objective,
      footer: confirmExit
        ? 'D-pad: Choose   R/G: Confirm'
        : 'D-pad: Navigate   R/G: Select   START: Return'
    });
    this.itemBounds = menu.rowBounds.map((bounds, index) => ({
      ...bounds,
      id: items[index]?.id
    }));
    const exit = this.itemBounds.find((item) => item.id === 'exit');
    this.exitBounds = exit ? { x: exit.x, y: exit.y, w: exit.w, h: exit.h } : null;
    ctx.save();
    if (confirmExit) {
      const boxW = 360;
      const boxH = 150;
      const boxX = Math.round((width - boxW) / 2);
      const boxY = Math.round((height - boxH) / 2);
      ctx.fillStyle = 'rgba(4,8,7,0.94)';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = 'rgba(214,193,96,0.75)';
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxW, boxH);
      ctx.fillStyle = '#fff';
      ctx.font = '18px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('Exit to main menu?', width / 2, boxY + 44);
      const buttonW = 112;
      const buttonH = 34;
      const noBounds = { x: boxX + 54, y: boxY + 88, w: buttonW, h: buttonH, id: 'no' };
      const yesBounds = { x: boxX + boxW - 54 - buttonW, y: boxY + 88, w: buttonW, h: buttonH, id: 'yes' };
      this.confirmBounds = [noBounds, yesBounds];
      this.confirmBounds.forEach((bounds, index) => {
        ctx.fillStyle = index === this.confirmSelection ? 'rgba(214,193,96,0.32)' : 'rgba(0,0,0,0.72)';
        ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
        ctx.strokeStyle = index === this.confirmSelection ? '#d6c160' : 'rgba(255,255,255,0.5)';
        ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
        ctx.fillStyle = '#fff';
        ctx.font = '15px Courier New';
        ctx.fillText(bounds.id === 'yes' ? 'YES' : 'NO', bounds.x + bounds.w / 2, bounds.y + 22);
      });
    } else {
      this.confirmBounds = [];
    }
    ctx.restore();
  }
}
