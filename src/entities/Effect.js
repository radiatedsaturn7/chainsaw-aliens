export default class Effect {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.age = 0;
    this.life = 0.4;
    if (this.type === 'oil') {
      this.life = 0.6;
      this.drips = Array.from({ length: 5 }, () => ({
        x: (Math.random() - 0.5) * 12,
        y: 0,
        vy: 80 + Math.random() * 140,
        length: 6 + Math.random() * 8
      }));
    }
    if (this.type === 'explosion') {
      this.life = 0.9;
      this.sparks = Array.from({ length: 14 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 14 + Math.random() * 0.2;
        return {
          angle,
          length: 18 + Math.random() * 16
        };
      });
    }
    if (this.type === 'splat') {
      this.life = 0.9;
      this.blobs = Array.from({ length: 5 }, () => ({
        angle: Math.random() * Math.PI * 2,
        radius: 10 + Math.random() * 12,
        size: 10 + Math.random() * 14
      }));
    }
    if (this.type === 'ignitir-blast') {
      this.life = 1.1;
      this.flares = Array.from({ length: 6 }, () => ({
        angle: Math.random() * Math.PI * 2,
        radius: 40 + Math.random() * 40
      }));
    }
    if (this.type === 'ignitir-flame') {
      this.life = 6.5;
      this.flicker = Math.random() * Math.PI * 2;
      this.height = 16 + Math.random() * 18;
    }
    if (this.type === 'ignitir-fog') {
      this.life = 1.8;
    }
  }

  update(dt) {
    this.age += dt;
    if (this.type === 'oil') {
      this.drips.forEach((drip) => {
        drip.vy += 240 * dt;
        drip.y += drip.vy * dt;
      });
    }
  }

  get alive() {
    return this.age < this.life;
  }

  draw(ctx) {
    const t = this.age / this.life;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    if (this.type === 'dash') {
      ctx.beginPath();
      ctx.moveTo(-16, -4);
      ctx.lineTo(16, 0);
      ctx.lineTo(-16, 4);
      ctx.stroke();
    } else if (this.type === 'hit') {
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(8, 8);
      ctx.moveTo(8, -8);
      ctx.lineTo(-8, 8);
      ctx.stroke();
    } else if (this.type === 'stagger') {
      ctx.beginPath();
      ctx.arc(0, 0, 10 + t * 6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'execute') {
      ctx.beginPath();
      ctx.arc(0, 0, 14 + t * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(12, 0);
      ctx.stroke();
    } else if (this.type === 'pickup') {
      ctx.beginPath();
      ctx.arc(0, 0, 8 + t * 10, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'interact') {
      ctx.beginPath();
      ctx.rect(-6 - t * 6, -6 - t * 6, 12 + t * 12, 12 + t * 12);
      ctx.stroke();
    } else if (this.type === 'jump') {
      ctx.beginPath();
      ctx.arc(0, 0, 6 + t * 6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'land') {
      ctx.beginPath();
      ctx.moveTo(-10 - t * 6, 0);
      ctx.lineTo(10 + t * 6, 0);
      ctx.stroke();
    } else if (this.type === 'move') {
      ctx.beginPath();
      ctx.moveTo(-6, 4);
      ctx.lineTo(6, 4);
      ctx.stroke();
    } else if (this.type === 'damage') {
      ctx.beginPath();
      ctx.arc(0, 0, 10 + t * 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      ctx.lineTo(10, 10);
      ctx.stroke();
    } else if (this.type === 'bite') {
      ctx.beginPath();
      ctx.arc(0, 0, 12, -0.7, 0.7);
      ctx.stroke();
    } else if (this.type === 'oil') {
      ctx.strokeStyle = 'rgba(76, 255, 120, 0.9)';
      ctx.lineWidth = 2;
      this.drips.forEach((drip) => {
        ctx.beginPath();
        ctx.moveTo(drip.x, drip.y);
        ctx.lineTo(drip.x, drip.y + drip.length);
        ctx.stroke();
      });
    } else if (this.type === 'explosion') {
      const blast = 16 + t * 50;
      ctx.fillStyle = `rgba(255, 180, 80, ${0.6 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(0, 0, blast * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, blast, 0, Math.PI * 2);
      ctx.stroke();
      this.sparks.forEach((spark) => {
        const length = spark.length + t * 20;
        ctx.beginPath();
        ctx.moveTo(Math.cos(spark.angle) * (blast * 0.3), Math.sin(spark.angle) * (blast * 0.3));
        ctx.lineTo(Math.cos(spark.angle) * length, Math.sin(spark.angle) * length);
        ctx.stroke();
      });
    } else if (this.type === 'splat') {
      const spread = 18 + t * 30;
      ctx.fillStyle = `rgba(76, 255, 120, ${0.85 - t * 0.6})`;
      ctx.beginPath();
      ctx.arc(0, 0, 16 + t * 10, 0, Math.PI * 2);
      ctx.fill();
      this.blobs.forEach((blob) => {
        const bx = Math.cos(blob.angle) * (spread + blob.radius);
        const by = Math.sin(blob.angle) * (spread + blob.radius);
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(4, blob.size * (1 - t * 0.6)), 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (this.type === 'ignitir-blast') {
      const blast = 40 + t * 160;
      ctx.globalAlpha = 0.9 - t * 0.6;
      ctx.fillStyle = `rgba(90, 200, 255, ${0.5 - t * 0.3})`;
      ctx.beginPath();
      ctx.arc(0, 0, blast * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.9 - t * 0.7})`;
      ctx.beginPath();
      ctx.arc(0, 0, blast * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(150, 220, 255, ${0.9 - t * 0.7})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, blast, 0, Math.PI * 2);
      ctx.stroke();
      this.flares.forEach((flare) => {
        const length = flare.radius + t * 80;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(flare.angle) * (blast * 0.2), Math.sin(flare.angle) * (blast * 0.2));
        ctx.lineTo(Math.cos(flare.angle) * length, Math.sin(flare.angle) * length);
        ctx.stroke();
      });
    } else if (this.type === 'ignitir-flame') {
      const flicker = 0.7 + Math.sin(this.flicker + t * 12) * 0.2;
      const height = this.height * flicker * (1 - t * 0.6);
      ctx.globalAlpha = 0.8 - t * 0.5;
      ctx.fillStyle = 'rgba(120, 210, 255, 0.8)';
      ctx.beginPath();
      ctx.moveTo(0, -height);
      ctx.quadraticCurveTo(-6, -height * 0.4, -4, 0);
      ctx.quadraticCurveTo(0, 4, 4, 0);
      ctx.quadraticCurveTo(6, -height * 0.4, 0, -height);
      ctx.fill();
      ctx.fillStyle = 'rgba(40, 120, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'ignitir-fog') {
      const fog = 60 + t * 200;
      ctx.globalAlpha = 0.25 - t * 0.2;
      ctx.fillStyle = 'rgba(120, 200, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, fog, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
