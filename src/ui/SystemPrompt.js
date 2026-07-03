const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

function getPromptLines(message) {
  return String(message || '')
    .split('\n')
    .map((line) => line.trimEnd());
}

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
    const lines = getPromptLines(this.message);
    const title = lines[0] || '';
    const bodyLines = this.mode === 'modal' ? lines.slice(1).filter((line) => line.length || lines.length <= 2) : [];
    const baseW = Math.min(this.mode === 'modal' ? 620 : 360, width * 0.86);
    const lineHeight = 17;
    const modalBodyH = Math.min(Math.max(78, bodyLines.length * lineHeight + 18), Math.max(120, height * 0.52));
    const baseH = this.mode === 'modal' ? Math.min(height * 0.72, 82 + modalBodyH) : 78;
    const x = (width - baseW) / 2;
    const y = this.mode === 'modal' ? Math.max(18, (height - baseH) * 0.34) : height * 0.18;
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
    ctx.textAlign = this.mode === 'modal' ? 'left' : 'center';
    ctx.textBaseline = 'middle';
    if (this.mode === 'modal') {
      const pad = 18;
      ctx.fillText(title, x + pad, y + 28, baseW - pad * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.font = '13px Courier New';
      ctx.textBaseline = 'top';
      const bodyTop = y + 48;
      const bodyBottom = y + baseH - 48;
      bodyLines.forEach((line, index) => {
        const lineY = bodyTop + index * lineHeight;
        if (lineY + lineHeight > bodyBottom) return;
        ctx.fillText(line, x + pad, lineY, baseW - pad * 2);
      });
    } else {
      ctx.fillText(title, x + baseW / 2, y + baseH / 2);
    }

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
