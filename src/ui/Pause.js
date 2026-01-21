export default class Pause {
  constructor() {
    this.volume = 0.4;
    this.shake = true;
    this.selection = 0;
    this.exitBounds = null;
  }

  move(dir) {
    this.selection = (this.selection + dir + 2) % 2;
  }

  adjust(dir) {
    if (this.selection === 0) {
      this.volume = Math.min(1, Math.max(0, this.volume + dir * 0.05));
    }
    if (this.selection === 1) {
      this.shake = !this.shake;
    }
  }

  draw(ctx, width, height, objective) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = '22px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Paused', width / 2, 120);
    ctx.font = '16px Courier New';
    ctx.textAlign = 'left';
    const items = [
      `Volume: ${(this.volume * 100).toFixed(0)}%`,
      `Screen Shake: ${this.shake ? 'ON' : 'OFF'}`
    ];
    items.forEach((text, index) => {
      const prefix = index === this.selection ? '> ' : '  ';
      ctx.fillText(prefix + text, width / 2 - 120, 200 + index * 30);
    });
    if (objective) {
      ctx.textAlign = 'center';
      ctx.fillText(`Objective: ${objective}`, width / 2, 200 + items.length * 30 + 20);
      ctx.textAlign = 'left';
    }
    const exitW = 180;
    const exitH = 32;
    const exitX = width / 2 - exitW / 2;
    const exitY = height - 140;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(exitX, exitY, exitW, exitH);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.strokeRect(exitX, exitY, exitW, exitH);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('Exit to Title', exitX + exitW / 2, exitY + 22);
    ctx.textAlign = 'left';
    this.exitBounds = { x: exitX, y: exitY, w: exitW, h: exitH };
    ctx.textAlign = 'center';
    ctx.fillText('Arrow keys to change, Esc to resume', width / 2, height - 80);
    ctx.restore();
  }
}
