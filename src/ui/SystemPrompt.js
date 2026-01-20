const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export default class SystemPrompt {
  constructor(message, { mode = 'toast', duration = 1.8 } = {}) {
    this.message = message;
    this.mode = mode;
    this.duration = duration;
    this.timer = 0;
    this.transition = 0;
    this.direction = 1;
    this.done = false;
    this.okBounds = null;
  }

  update(dt) {
    if (this.done) return;
    const speed = 1 / 0.2;
    if (this.direction > 0) {
      this.transition = Math.min(1, this.transition + dt * speed);
      if (this.transition >= 1 && this.mode === 'toast') {
        this.timer += dt;
        if (this.timer >= this.duration) {
          this.direction = -1;
        }
      }
    } else {
      this.transition = Math.max(0, this.transition - dt * speed);
      if (this.transition <= 0) {
        this.done = true;
      }
    }
  }

  dismiss() {
    if (this.direction < 0) return;
    this.direction = -1;
  }

  draw(ctx, width, height) {
    if (this.done) return;
    const t = easeOutCubic(this.transition);
    const scale = 0.92 + 0.08 * t;
    const alpha = 0.2 + 0.8 * t;
    const baseW = Math.min(360, width * 0.8);
    const baseH = this.mode === 'modal' ? 120 : 78;
    const x = (width - baseW) / 2;
    const y = this.mode === 'modal' ? height * 0.35 : height * 0.18;
    const w = baseW * scale;
    const h = baseH * scale;
    const offsetX = (baseW - w) / 2;
    const offsetY = (baseH - h) / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#000';
    ctx.fillRect(x + offsetX, y + offsetY, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + offsetX, y + offsetY, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = '18px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.message, x + baseW / 2, y + baseH / 2 - (this.mode === 'modal' ? 12 : 0));

    this.okBounds = null;
    if (this.mode === 'modal') {
      const buttonW = 90 * scale;
      const buttonH = 26 * scale;
      const buttonX = x + baseW / 2 - buttonW / 2;
      const buttonY = y + baseH - 22 - buttonH / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(buttonX, buttonY, buttonW, buttonH);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(buttonX, buttonY, buttonW, buttonH);
      ctx.fillStyle = '#fff';
      ctx.font = '14px Courier New';
      ctx.fillText('OK', buttonX + buttonW / 2, buttonY + buttonH / 2);
      this.okBounds = { x: buttonX, y: buttonY, w: buttonW, h: buttonH };
    }
    ctx.restore();
  }
}
