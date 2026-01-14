export default class Title {
  constructor() {
    this.timer = 0;
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

  draw(ctx, width, height) {
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
    ctx.fillText('Press SPACE to begin', width / 2, height - 140 + Math.sin(this.timer * 4) * 6);
    ctx.fillText('Press T for TEST MODE', width / 2, height - 110);
    ctx.restore();
  }
}
