export default class Effect {
  constructor(x, y, type, options = {}) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.options = options || {};
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
      this.life = this.options.life ?? 1.15;
      this.flares = Array.from({ length: 8 }, () => ({
        angle: Math.random() * Math.PI * 2,
        radius: 50 + Math.random() * 60
      }));
      this.blastRadius = this.options.radius ?? 240;
    }
    if (this.type === 'ignitir-flame') {
      this.life = 5.6;
      this.flicker = Math.random() * Math.PI * 2;
      this.height = 22 + Math.random() * 20;
      this.vx = (Math.random() - 0.5) * 40;
      this.vy = -120 - Math.random() * 80;
    }
    if (this.type === 'ignitir-fog') {
      this.life = this.options.life ?? 1.4;
      this.swirl = Math.random() * Math.PI * 2;
    }
    if (this.type === 'ignitir-beam') {
      this.life = this.options.life ?? 0.28;
      this.angle = this.options.angle ?? 0;
      this.length = Math.max(40, this.options.length ?? 160);
      this.flicker = Math.random() * Math.PI * 2;
      this.startWidth = this.options.startWidth ?? 12;
      this.endWidth = this.options.endWidth ?? 18;
      this.coreStart = this.options.coreStart ?? 4;
      this.coreEnd = this.options.coreEnd ?? 6;
    }
    if (this.type === 'ignitir-implosion') {
      this.life = this.options.life ?? 0.45;
      this.implosionRadius = this.options.radius ?? 80;
      this.implosion = Array.from({ length: 16 }, () => ({
        angle: Math.random() * Math.PI * 2,
        radius: (this.implosionRadius * 0.6) + Math.random() * (this.implosionRadius * 0.4),
        size: 2 + Math.random() * 3
      }));
    }
    if (this.type === 'ignitir-shockwave') {
      this.life = this.options.life ?? 0.9;
      this.startRadius = this.options.startRadius ?? 70;
      this.endRadius = this.options.endRadius ?? 290;
      this.waveLineWidth = this.options.lineWidth ?? 6;
      this.waveColor = this.options.color ?? 'rgba(150, 200, 220, 0.6)';
      this.waveFill = this.options.fillColor ?? 'rgba(110, 150, 180, 0.4)';
      this.waveJitter = Math.random() * Math.PI * 2;
    }
    if (this.type === 'ignitir-target') {
      this.life = this.options.life ?? 1;
      this.pulse = Math.random() * Math.PI * 2;
    }
    if (this.type === 'ignitir-lens') {
      this.life = this.options.life ?? 0.9;
      this.lensSpin = Math.random() * Math.PI * 2;
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
    if (this.type === 'ignitir-flame') {
      this.vy += 260 * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
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
      const blast = this.blastRadius * (0.25 + t * 0.75);
      const glow = 0.85 - t * 0.6;
      ctx.globalAlpha = glow;
      ctx.fillStyle = `rgba(80, 190, 255, ${0.55 - t * 0.25})`;
      ctx.beginPath();
      ctx.arc(0, 0, blast * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.95 - t * 0.7})`;
      ctx.beginPath();
      ctx.arc(0, 0, blast * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(140, 220, 255, ${0.9 - t * 0.7})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, blast, 0, Math.PI * 2);
      ctx.stroke();
      this.flares.forEach((flare) => {
        const length = flare.radius + t * (this.blastRadius * 0.5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(flare.angle) * (blast * 0.2), Math.sin(flare.angle) * (blast * 0.2));
        ctx.lineTo(Math.cos(flare.angle) * length, Math.sin(flare.angle) * length);
        ctx.stroke();
      });
    } else if (this.type === 'ignitir-flame') {
      const flicker = 0.75 + Math.sin(this.flicker + t * 10) * 0.25;
      const height = this.height * flicker * (1 - t * 0.5);
      ctx.globalAlpha = 0.85 - t * 0.6;
      ctx.fillStyle = 'rgba(90, 210, 255, 0.85)';
      ctx.beginPath();
      ctx.moveTo(0, -height);
      ctx.quadraticCurveTo(-7, -height * 0.3, -5, 2);
      ctx.quadraticCurveTo(0, 6, 5, 2);
      ctx.quadraticCurveTo(7, -height * 0.3, 0, -height);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(0, -height * 0.35, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(40, 120, 255, 0.65)';
      ctx.beginPath();
      ctx.arc(0, 2, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'ignitir-fog') {
      const fog = 40 + t * 120;
      ctx.globalAlpha = 0.3 - t * 0.25;
      ctx.fillStyle = 'rgba(120, 200, 255, 0.45)';
      ctx.beginPath();
      ctx.arc(0, 0, fog, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(160, 220, 255, ${0.35 - t * 0.25})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, fog * 0.7 + Math.sin(this.swirl + t * 6) * 6, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'ignitir-beam') {
      ctx.save();
      ctx.rotate(this.angle);
      const ease = (v) => v * v * (3 - 2 * v);
      const flicker = 0.7 + Math.sin(this.flicker + t * 16) * 0.3;
      const grow = ease(Math.min(1, t * 1.1));
      const beamWidth = this.startWidth + (this.endWidth - this.startWidth) * grow;
      const coreWidth = this.coreStart + (this.coreEnd - this.coreStart) * grow;
      const beamLength = this.length;
      ctx.globalAlpha = 0.9 - t * 0.6;
      ctx.strokeStyle = `rgba(90, 200, 255, ${0.7 - t * 0.5})`;
      ctx.lineWidth = beamWidth * flicker;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(beamLength, 0);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 - t * 0.6})`;
      ctx.lineWidth = coreWidth * flicker;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(beamLength, 0);
      ctx.stroke();
      ctx.restore();
    } else if (this.type === 'ignitir-implosion') {
      const pull = 1 - t;
      ctx.globalAlpha = 0.95 - t * 0.7;
      ctx.strokeStyle = `rgba(120, 210, 255, ${0.9 - t * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.implosionRadius * 0.4 * pull, 0, Math.PI * 2);
      ctx.stroke();
      this.implosion.forEach((particle) => {
        const radius = particle.radius * pull;
        const px = Math.cos(particle.angle) * radius;
        const py = Math.sin(particle.angle) * radius;
        ctx.fillStyle = `rgba(160, 230, 255, ${0.9 - t * 0.6})`;
        ctx.beginPath();
        ctx.arc(px, py, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (this.type === 'ignitir-shockwave') {
      const wave = this.startRadius + t * (this.endRadius - this.startRadius);
      ctx.globalAlpha = 0.55 - t * 0.45;
      ctx.strokeStyle = this.waveColor;
      ctx.lineWidth = this.waveLineWidth;
      ctx.beginPath();
      ctx.arc(0, 0, wave, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.35 - t * 0.3;
      ctx.fillStyle = this.waveFill;
      ctx.beginPath();
      ctx.arc(0, 0, wave * 0.75 + Math.sin(this.waveJitter + t * 8) * 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'ignitir-target') {
      const pulse = 0.7 + Math.sin(this.pulse + t * 12) * 0.3;
      const radius = 4 + t * 10;
      ctx.globalAlpha = 0.9 - t * 0.6;
      ctx.fillStyle = 'rgba(80, 190, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(200, 240, 255, ${0.9 - t * 0.7})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 1.6 * pulse, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this.type === 'ignitir-lens') {
      const flare = 120 + t * 240;
      ctx.globalAlpha = 0.9 - t * 0.8;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.85 - t * 0.6})`;
      ctx.beginPath();
      ctx.arc(0, 0, flare * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(200, 240, 255, ${0.9 - t * 0.7})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, flare * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.6 - t * 0.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, flare * 0.9, this.lensSpin, this.lensSpin + Math.PI * 1.5);
      ctx.stroke();
    }
    ctx.restore();
  }
}
