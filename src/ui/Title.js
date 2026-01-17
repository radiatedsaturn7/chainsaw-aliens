export default class Title {
  constructor() {
    this.timer = 0;
    this.editorBounds = { x: 0, y: 0, w: 0, h: 0 };
    this.endlessBounds = { x: 0, y: 0, w: 0, h: 0 };
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
    const earthX = width / 2;
    const earthY = height / 2 + 120;
    const earthRadius = 120;
    const oceanGradient = ctx.createRadialGradient(
      earthX - 40,
      earthY - 60,
      30,
      earthX,
      earthY,
      earthRadius + 10
    );
    oceanGradient.addColorStop(0, '#2d8de6');
    oceanGradient.addColorStop(0.6, '#0b4fa3');
    oceanGradient.addColorStop(1, '#032a5c');
    ctx.fillStyle = oceanGradient;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2fb26a';
    ctx.beginPath();
    ctx.moveTo(earthX - 60, earthY - 30);
    ctx.bezierCurveTo(earthX - 90, earthY - 80, earthX - 30, earthY - 90, earthX - 10, earthY - 60);
    ctx.bezierCurveTo(earthX + 10, earthY - 40, earthX - 20, earthY - 10, earthX - 55, earthY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(earthX + 20, earthY - 10);
    ctx.bezierCurveTo(earthX + 60, earthY - 40, earthX + 90, earthY - 10, earthX + 70, earthY + 20);
    ctx.bezierCurveTo(earthX + 50, earthY + 40, earthX + 10, earthY + 30, earthX + 5, earthY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(earthX - 30, earthY - 70, 42, 12, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(earthX + 50, earthY + 10, 48, 14, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(155,205,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    this.aliens.forEach((alien) => {
      ctx.save();
      ctx.translate(alien.x, alien.y + 80 + Math.sin(this.timer + alien.x) * 4);
      ctx.strokeStyle = '#ff6b6b';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 6, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5, 0, Math.PI, 0, true);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(-10, 8);
      ctx.lineTo(10, 8);
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
    const endlessY = height - 112;
    const editorY = height - 70;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(buttonX, endlessY, buttonWidth, buttonHeight);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(buttonX, endlessY, buttonWidth, buttonHeight);
    ctx.fillStyle = '#fff';
    ctx.fillText('ENDLESS MODE', width / 2, endlessY + 22);
    this.endlessBounds = { x: buttonX, y: endlessY, w: buttonWidth, h: buttonHeight };

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

  isEndlessHit(x, y) {
    const bounds = this.endlessBounds;
    return x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h;
  }
}
