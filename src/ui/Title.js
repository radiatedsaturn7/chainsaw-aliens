export default class Title {
  constructor() {
    this.timer = 0;
    this.editorBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.aliens = Array.from({ length: 12 }, (_, i) => ({
      x: 120 + i * 80,
      y: -Math.random() * 400,
      speed: 20 + Math.random() * 40
    }));
  }

  update(dt) {
    this.timer += dt;
    this.aliens.forEach((alien) => {
      alien.y += alien.speed * dt;
      if (alien.y > 500) {
        alien.y = -200;
      }
    });
  }

  draw(ctx, width, height, isMobile) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    // Earth
    ctx.beginPath();
    ctx.arc(width / 2, height / 2 + 120, 120, 0, Math.PI * 2);
    ctx.stroke();

    this.aliens.forEach((alien) => {
      ctx.save();
      ctx.translate(alien.x, alien.y + 80 + Math.sin(this.timer + alien.x) * 4);
      ctx.beginPath();
      ctx.moveTo(-12, 12);
      ctx.lineTo(0, -16);
      ctx.lineTo(12, 12);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    });

    ctx.font = 'bold 48px Courier New';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('Chainsaw Aliens', width / 2, 120);
    ctx.font = '18px Courier New';
    if (isMobile) {
      ctx.fillText('Tap to continue', width / 2, height - 140 + Math.sin(this.timer * 4) * 6);
    } else {
      ctx.fillText('Press SPACE to begin', width / 2, height - 140 + Math.sin(this.timer * 4) * 6);
    }

    const buttonWidth = 180;
    const buttonHeight = 32;
    const buttonX = width / 2 - buttonWidth / 2;
    const editorY = height - 70;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(buttonX, editorY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(buttonX, editorY, buttonWidth, buttonHeight);
    ctx.fillStyle = '#fff';
    ctx.fillText('LEVEL EDITOR', width / 2, editorY + 22);
    this.editorBounds = { x: buttonX, y: editorY, w: buttonWidth, h: buttonHeight };
    ctx.restore();
  }

  isEditorHit(x, y) {
    const bounds = this.editorBounds;
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }
}
