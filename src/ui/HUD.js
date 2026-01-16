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

    ctx.fillText(`Blueprint Shards: ${player.blueprints}`, 20, 88);
    ctx.fillText(`Region: ${regionName}`, 20, 108);
    ctx.fillText(`Objective: ${objective}`, 20, 132);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(14, 96, 420, 48);

    if (options.shake === false) {
      ctx.fillText('Screen Shake: OFF', 20, 156);
    }
    ctx.restore();
  }
}
