// Baseline painter for exact output comparison (ddb4ad8).
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function drawRaceTireFxParticles(ctx, bounds, { camera = {}, cameraYaw = 0, layer = 'all' } = {}) {
    const particles = this.playtestSession?.tireFxParticles;
    if (!Array.isArray(particles) || !particles.length) return false;
    const projected = particles
      .filter((particle) => {
        if (layer === 'all') return true;
        const groundEffect = particle.slotId === 'asphaltSkid';
        return layer === 'ground' ? groundEffect : !groundEffect;
      })
      .map((particle) => {
        const point = this.projectRaceWorldVisualPoint(particle, {
          camera,
          cameraYaw,
          bounds
        });
        return { particle, point };
      })
      .filter(({ point }) => point?.visible && point.screenY >= bounds.y - 40 && point.screenY <= bounds.y + bounds.h + 60)
      .sort((a, b) => Number(b.point.cameraZ || 0) - Number(a.point.cameraZ || 0));
    if (!projected.length) return false;
    const focal = camera.firstPersonFrame?Number(bounds.h||1)/(2*Math.tan(58*Math.PI/360)):Math.max(140, Number(bounds.w || 1) * (Number(camera.focalScale) || 1.04));
    const roadWidthScale = Number(camera.roadWidthScale) || 1;
    ctx.save();
    projected.forEach(({ particle, point }) => {
      const life = clamp(Number(particle.ageMs || 0) / Math.max(1, Number(particle.lifetimeMs || 1)), 0, 1);
      const alpha = Number(particle.alpha || 0.5) * (1 - life);
      if (alpha <= 0.01) return;
      const size = clamp(
        Number(particle.sizeM || 0.5) * roadWidthScale * (focal / Math.max(1.2, Number(point.renderZ || point.cameraZ || 1))) * (1 + life * 1.2),
        2,
        bounds.w * 0.22
      );
      const sourceArtCanvas = particle.artRef ? this.getRaceArtSpriteCanvas(particle.artRef) : null;
      const artCanvas = sourceArtCanvas
        ? this.getRaceTintedTireFxArtCanvas(sourceArtCanvas, particle.artRef, particle.tintColor || particle.color)
        : null;
      ctx.globalAlpha = alpha;
      if (artCanvas && typeof ctx.drawImage === 'function') {
        const previousSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(artCanvas, point.screenX - size * 0.5, point.screenY - size * 0.55, size, size);
        ctx.imageSmoothingEnabled = previousSmoothing;
      } else {
        ctx.fillStyle = particle.color || 'rgba(228,232,222,0.72)';
        ctx.beginPath();
        ctx.ellipse?.(point.screenX, point.screenY - size * 0.18, size * 0.55, size * 0.26, 0, 0, Math.PI * 2);
        if (!ctx.ellipse) ctx.arc(point.screenX, point.screenY, size * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
    return true;
  }
