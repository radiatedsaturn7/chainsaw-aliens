export default class HUD {
  constructor() {
    this.weaponButtons = [];
  }

  getWeaponButtonAt(x, y) {
    const hit = this.weaponButtons.find((button) => (
      x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h
    ));
    return hit ? hit.index : null;
  }

  draw(ctx, player, objective, options) {
    if (!player) return;
    const safeOptions = options ?? {};
    const safeObjective = objective ?? 'Unknown';
    const bootsHeat = Number.isFinite(player.magBootsHeat) ? player.magBootsHeat : 0;
    const bootsOverheat = Number.isFinite(player.magBootsOverheat) ? player.magBootsOverheat : 0;
    const weapons = safeOptions.weapons ?? [];
    this.weaponButtons = [];
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';

    const panelColor = 'rgba(0, 0, 0, 0.7)';
    const hasBootsHeat = bootsHeat > 0 || bootsOverheat > 0;
    const barWidth = 140;
    const barHeight = 10;
    const barsTop = 8;
    const barsBottom = hasBootsHeat ? 72 : 52;
    ctx.fillStyle = panelColor;
    ctx.fillRect(12, barsTop, 220, barsBottom - barsTop);
    ctx.fillStyle = '#fff';

    const healthRatio = player.maxHealth ? Math.max(0, player.health) / player.maxHealth : 0;
    const lowHealth = player.health <= 3;
    const blink = lowHealth && Math.floor(player.animTime * 4) % 2 === 0;
    ctx.fillStyle = blink ? '#ff4b4b' : '#fff';
    ctx.fillText(`Health ${player.health}/${player.maxHealth}`, 20, barsTop + 18);
    ctx.strokeRect(20, barsTop + 22, barWidth, barHeight);
    ctx.fillStyle = blink || healthRatio <= 0.3 ? '#ff4b4b' : '#9ad9ff';
    ctx.fillRect(20, barsTop + 22, barWidth * healthRatio, barHeight);
    ctx.fillStyle = '#fff';

    const showSawIcon = safeOptions.sawHeld || safeOptions.sawUsing || safeOptions.sawEmbedded;
    if (showSawIcon) {
      const buzz = safeOptions.sawBuzzing;
      const iconX = 200;
      const iconY = barsTop + 38;
      const jitterX = buzz ? Math.sin(player.animTime * 60) * 1.5 : 0;
      const jitterY = buzz ? Math.cos(player.animTime * 55) * 1.5 : 0;
      ctx.save();
      ctx.translate(iconX + jitterX, iconY + jitterY);
      ctx.strokeStyle = safeOptions.sawEmbedded ? '#88e6ff' : safeOptions.sawUsing ? '#f25c2a' : '#cfd5dc';
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
      if (safeOptions.sawUsing || safeOptions.sawHeld) {
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
      const bootsRatio = Math.min(1, Math.max(0, bootsHeat));
      ctx.fillText('Mag Boots Heat', 20, barsTop + 44);
      ctx.strokeRect(20, barsTop + 48, barWidth, barHeight);
      ctx.fillRect(20, barsTop + 48, barWidth * bootsRatio, barHeight);
      if (bootsOverheat > 0) {
        ctx.fillText('OVERHEAT', 170, barsTop + 44);
      }
      infoStartY = 92;
    } else {
      infoStartY = 72;
    }

    ctx.fillStyle = panelColor;
    ctx.fillRect(14, infoStartY + 8, 420, 32);
    ctx.fillStyle = '#fff';
    ctx.fillText(`Objective: ${safeObjective}`, 20, infoStartY + 28);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(14, infoStartY + 8, 420, 32);

    const statusLines = [];
    if (safeOptions.flameMode) {
      statusLines.push('Flame Mode: ON');
    }
    if (safeOptions.sawUsing) {
      statusLines.push('SAW ACTIVE');
    } else if (safeOptions.sawEmbedded) {
      statusLines.push('SAW EMBEDDED');
    }
    if (safeOptions.shake === false) {
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

    if (weapons.length > 0) {
      const buttonWidth = 130;
      const buttonHeight = 34;
      const gap = 8;
      const totalWidth = weapons.length * buttonWidth + (weapons.length - 1) * gap;
      const startX = Math.max(12, ctx.canvas.width / 2 - totalWidth / 2);
      const startY = 8;
      weapons.forEach((slot, index) => {
        const x = startX + index * (buttonWidth + gap);
        const y = startY;
        const isActive = index === safeOptions.activeWeaponIndex;
        const isAvailable = Boolean(slot.available);
        const isIgnitir = slot.id === 'ignitir';
        ctx.save();
        ctx.globalAlpha = isAvailable ? 0.95 : 0.5;
        ctx.fillStyle = isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.6)';
        ctx.fillRect(x, y, buttonWidth, buttonHeight);
        ctx.strokeStyle = isActive ? '#fff' : 'rgba(255,255,255,0.4)';
        ctx.strokeRect(x, y, buttonWidth, buttonHeight);
        if (isIgnitir && safeOptions.ignitirReady) {
          ctx.shadowColor = 'rgba(120,200,255,0.9)';
          ctx.shadowBlur = 12;
          ctx.strokeStyle = '#8fe6ff';
          ctx.strokeRect(x + 1, y + 1, buttonWidth - 2, buttonHeight - 2);
        }
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '13px Courier New';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = slot.label || 'EMPTY';
        ctx.fillText(`${slot.key}. ${label}`, x + buttonWidth / 2, y + buttonHeight / 2);
        if (isIgnitir) {
          const charge = Math.max(0, Math.min(1, safeOptions.ignitirCharge || 0));
          ctx.fillStyle = 'rgba(120,200,255,0.8)';
          ctx.fillRect(x + 2, y + buttonHeight - 4, (buttonWidth - 4) * charge, 2);
        }
        ctx.restore();
        if (isAvailable) {
          this.weaponButtons.push({ x, y, w: buttonWidth, h: buttonHeight, index });
        }
      });
    }
    ctx.restore();
  }
}
