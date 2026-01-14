export default class Pause {
  constructor() {
    this.volume = 0.4;
    this.shake = true;
    this.selection = 0;
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

  draw(ctx, width, height) {
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
    ctx.textAlign = 'center';
    ctx.fillText('Arrow keys to change, Esc to resume', width / 2, height - 80);
    ctx.restore();
  }
}
