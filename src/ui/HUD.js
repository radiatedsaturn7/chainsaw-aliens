export default class HUD {
  draw(ctx, player, objective, regionName, options) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';

    const barWidth = 140;
    const barHeight = 10;
    const healthRatio = Math.max(0, player.health) / player.maxHealth;
    ctx.fillText('Health', 20, 24);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(90, 14, barWidth, barHeight);
    ctx.fillRect(90, 14, barWidth * healthRatio, barHeight);

    const fuelRatio = Math.max(0, player.fuel) / 3;
    ctx.fillText('Fuel (Execute)', 20, 44);
    ctx.strokeRect(90, 34, barWidth, barHeight);
    ctx.fillRect(90, 34, barWidth * fuelRatio, barHeight);

    const heatCap = player.heatCap || 1;
    const heatRatio = Math.min(1, Math.max(0, player.heat / heatCap));
    const heatColor = {
      r: Math.round(245 + (255 - 245) * heatRatio),
      g: Math.round(215 + (77 - 215) * heatRatio),
      b: Math.round(110 + (77 - 110) * heatRatio)
    };
    ctx.fillText('Heat', 20, 64);
    ctx.strokeRect(90, 54, barWidth, barHeight);
    ctx.fillStyle = `rgb(${heatColor.r}, ${heatColor.g}, ${heatColor.b})`;
    ctx.fillRect(90, 54, barWidth * heatRatio, barHeight);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.round(heatRatio * 100)}%`, 240, 64);
    if (player.overheat > 0) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = 'rgba(255,120,80,0.7)';
      for (let i = 0; i < 3; i += 1) {
        const drift = Math.sin(player.animTime * 2 + i) * 6;
        ctx.beginPath();
        ctx.arc(110 + i * 22 + drift, 46 - i * 4, 6 - i, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    let infoStartY = 88;
    if (player.magBootsHeat > 0 || player.magBootsOverheat > 0) {
      const bootsRatio = Math.min(1, Math.max(0, player.magBootsHeat));
      ctx.fillText('Mag Boots Heat', 20, 84);
      ctx.strokeRect(90, 74, barWidth, barHeight);
      ctx.fillRect(90, 74, barWidth * bootsRatio, barHeight);
      if (player.magBootsOverheat > 0) {
        ctx.fillText('OVERHEAT', 240, 84);
      }
      infoStartY = 108;
    }

    ctx.fillText(`Blueprint Shards: ${player.blueprints}`, 20, infoStartY);
    ctx.fillText(`Region: ${regionName}`, 20, infoStartY + 20);
    ctx.fillText(`Objective: ${objective}`, 20, infoStartY + 44);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(14, infoStartY + 8, 420, 48);

    let statusY = infoStartY + 68;
    if (options.flameMode) {
      ctx.fillText('Flame Mode: ON', 20, statusY);
      statusY += 20;
    }
    if (options.sawEmbedded) {
      ctx.fillText('SAW EMBEDDED', 20, statusY);
      statusY += 20;
    }
    if (options.shake === false) {
      ctx.fillText('Screen Shake: OFF', 20, statusY);
    }
    ctx.restore();
  }
}
