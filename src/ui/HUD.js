export default class HUD {
  draw(ctx, player, objective, options) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';

    const panelColor = 'rgba(0, 0, 0, 0.7)';
    const hasBootsHeat = player.magBootsHeat > 0 || player.magBootsOverheat > 0;
    const barWidth = 140;
    const barHeight = 10;
    const barsTop = 8;
    const barsBottom = hasBootsHeat ? 48 : 32;
    ctx.fillStyle = panelColor;
    ctx.fillRect(12, barsTop, 220, barsBottom - barsTop);
    ctx.fillStyle = '#fff';

    const showSawIcon = options.sawHeld || options.sawUsing || options.sawEmbedded;
    if (showSawIcon) {
      const buzz = options.sawBuzzing;
      const iconX = 200;
      const iconY = 24;
      const jitterX = buzz ? Math.sin(player.animTime * 60) * 1.5 : 0;
      const jitterY = buzz ? Math.cos(player.animTime * 55) * 1.5 : 0;
      ctx.save();
      ctx.translate(iconX + jitterX, iconY + jitterY);
      ctx.strokeStyle = options.sawEmbedded ? '#88e6ff' : options.sawUsing ? '#f25c2a' : '#cfd5dc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-8, -6, 10, 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(2, -2);
      ctx.lineTo(12, -2);
      ctx.lineTo(12, 2);
      ctx.lineTo(2, 2);
      ctx.stroke();
      if (options.sawUsing || options.sawHeld) {
        ctx.beginPath();
        ctx.moveTo(12, -4);
        ctx.lineTo(16, -6);
        ctx.moveTo(12, 4);
        ctx.lineTo(16, 6);
        ctx.stroke();
      }
      ctx.restore();
    }

    let infoStartY = 44;
    if (hasBootsHeat) {
      const bootsRatio = Math.min(1, Math.max(0, player.magBootsHeat));
      ctx.fillText('Mag Boots Heat', 20, 24);
      ctx.strokeRect(20, 28, barWidth, barHeight);
      ctx.fillRect(20, 28, barWidth * bootsRatio, barHeight);
      if (player.magBootsOverheat > 0) {
        ctx.fillText('OVERHEAT', 170, 24);
      }
      infoStartY = 68;
    }

    ctx.fillStyle = panelColor;
    ctx.fillRect(14, infoStartY + 8, 420, 32);
    ctx.fillStyle = '#fff';
    ctx.fillText(`Objective: ${objective}`, 20, infoStartY + 28);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(14, infoStartY + 8, 420, 32);

    const statusLines = [];
    if (options.flameMode) {
      statusLines.push('Flame Mode: ON');
    }
    if (options.sawUsing) {
      statusLines.push('SAW ACTIVE');
    } else if (options.sawEmbedded) {
      statusLines.push('SAW EMBEDDED');
    }
    if (options.shake === false) {
      statusLines.push('Screen Shake: OFF');
    }
    if (statusLines.length) {
      const statusY = infoStartY + 52;
      const statusHeight = statusLines.length * 20 + 8;
      ctx.fillStyle = panelColor;
      ctx.fillRect(14, statusY - 12, 260, statusHeight);
      ctx.fillStyle = '#fff';
      statusLines.forEach((line, index) => {
        ctx.fillText(line, 20, statusY + index * 20);
      });
    }
    ctx.restore();
  }
}
