export default class ConsoleOverlay {
  constructor() {
    this.lines = [];
    this.status = 'idle';
    this.timer = 0;
    this.title = 'VALIDATOR';
  }

  setReport(status, lines, title = 'VALIDATOR') {
    this.status = status;
    this.lines = lines;
    this.timer = 6;
    this.title = title;
  }

  update(dt) {
    this.timer = Math.max(0, this.timer - dt);
  }

  draw(ctx, width, height) {
    if (this.lines.length === 0) return;
    const padding = 12;
    const boxWidth = 360;
    const boxHeight = Math.min(220, this.lines.length * 18 + 28);
    ctx.save();
    ctx.globalAlpha = this.timer > 0 ? 0.9 : 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(width - boxWidth - padding, height - boxHeight - padding, boxWidth, boxHeight);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(width - boxWidth - padding, height - boxHeight - padding, boxWidth, boxHeight);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'left';
    const title = `${this.title}: ${this.status === 'pass' ? 'PASS' : this.status === 'fail' ? 'FAIL' : 'WARN'}`;
    ctx.fillText(title, width - boxWidth - padding + 12, height - boxHeight - padding + 18);
    this.lines.forEach((line, i) => {
      ctx.fillText(line, width - boxWidth - padding + 12, height - boxHeight - padding + 36 + i * 16);
    });
    ctx.restore();
  }
}
