export default class Dialog {
  constructor(lines) {
    this.lines = lines;
    this.index = 0;
  }

  next() {
    if (this.index < this.lines.length - 1) {
      this.index += 1;
      return false;
    }
    return true;
  }

  draw(ctx, width, height, isMobile) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = '22px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText(this.lines[this.index], width / 2, height / 2);
    ctx.font = '14px Courier New';
    ctx.fillText(isMobile ? 'Tap to continue' : 'Press SPACE', width / 2, height / 2 + 60);
    ctx.restore();
  }
}
