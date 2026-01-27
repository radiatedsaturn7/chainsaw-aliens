const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const COMPASS_LABELS = [
  { id: 1, label: 'N' },
  { id: 2, label: 'NE' },
  { id: 3, label: 'E' },
  { id: 4, label: 'SE' },
  { id: 5, label: 'S' },
  { id: 6, label: 'SW' },
  { id: 7, label: 'W' },
  { id: 8, label: 'NW' }
];

export default class ControllerStateHUD {
  drawModePill(ctx, width, mode) {
    const pillW = 220;
    const pillH = 36;
    const pillX = width / 2 - pillW / 2;
    const pillY = 24;
    ctx.save();
    ctx.fillStyle = 'rgba(8,14,24,0.8)';
    ctx.fillRect(pillX, pillY, pillW, pillH);
    ctx.strokeStyle = 'rgba(140,210,255,0.6)';
    ctx.strokeRect(pillX, pillY, pillW, pillH);

    const halfW = pillW / 2;
    ctx.fillStyle = mode === 'note' ? 'rgba(90,200,255,0.85)' : 'rgba(90,200,255,0.2)';
    ctx.fillRect(pillX, pillY, halfW, pillH);
    ctx.fillStyle = mode === 'chord' ? 'rgba(255,200,90,0.85)' : 'rgba(255,200,90,0.2)';
    ctx.fillRect(pillX + halfW, pillY, halfW, pillH);

    ctx.fillStyle = '#041019';
    ctx.font = 'bold 16px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NOTE', pillX + halfW / 2, pillY + pillH / 2);
    ctx.fillText('CHORD', pillX + halfW + halfW / 2, pillY + pillH / 2);
    ctx.restore();
  }

  drawCompass(ctx, x, y, radius, activeDirection) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,12,20,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,200,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '11px Courier New';
    COMPASS_LABELS.forEach((entry) => {
      const angle = ((entry.id - 1) * 45 - 90) * (Math.PI / 180);
      const dx = Math.cos(angle) * (radius + 12);
      const dy = Math.sin(angle) * (radius + 12);
      ctx.fillStyle = entry.id === activeDirection ? '#ffe16a' : '#d7f2ff';
      ctx.fillText(entry.label, x + dx, y + dy);
    });

    ctx.restore();
  }

  drawModifiers(ctx, x, y, modifiers) {
    const entries = [
      { id: 'LB', active: modifiers.lb },
      { id: 'D-Left', active: modifiers.dleft },
      { id: 'RB', active: modifiers.rb }
    ];
    const boxW = 70;
    const boxH = 26;
    ctx.save();
    entries.forEach((entry, index) => {
      const boxX = x + index * (boxW + 8);
      ctx.fillStyle = entry.active ? 'rgba(255,220,120,0.85)' : 'rgba(20,30,40,0.6)';
      ctx.fillRect(boxX, y, boxW, boxH);
      ctx.strokeStyle = 'rgba(140,200,255,0.6)';
      ctx.strokeRect(boxX, y, boxW, boxH);
      ctx.fillStyle = entry.active ? '#20120a' : '#d7f2ff';
      ctx.font = 'bold 12px Courier New';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(entry.id, boxX + boxW / 2, y + boxH / 2);
    });
    ctx.restore();
  }

  drawOctaveMeter(ctx, x, y, height, octaveOffset, min = -2, max = 2) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,20,0.7)';
    ctx.fillRect(x, y, 22, height);
    ctx.strokeStyle = 'rgba(140,200,255,0.6)';
    ctx.strokeRect(x, y, 22, height);
    const range = max - min;
    const normalized = clamp((octaveOffset - min) / range, 0, 1);
    const markerY = y + height - normalized * height;
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(x + 2, markerY - 4, 18, 8);
    ctx.fillStyle = '#d7f2ff';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Oct ${octaveOffset >= 0 ? '+' : ''}${octaveOffset}`, x + 28, y + 10);
    ctx.restore();
  }

  drawMappings(ctx, x, y, mappings) {
    ctx.save();
    ctx.font = '12px Courier New';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#d7f2ff';
    mappings.forEach((entry, index) => {
      const rowY = y + index * 18;
      ctx.fillText(`${entry.button} → ${entry.label}`, x, rowY);
    });
    ctx.restore();
  }

  draw(ctx, width, height, state) {
    const {
      mode,
      degree,
      stickDir,
      modifiers,
      octaveOffset,
      mappings,
      compact
    } = state;

    if (mode && mode !== 'drum') {
      this.drawModePill(ctx, width, mode);
    }

    const baseX = 40;
    const baseY = height - 140;
    const radius = 36;

    this.drawCompass(ctx, baseX + radius, baseY, radius, stickDir || degree);
    ctx.save();
    ctx.fillStyle = '#d7f2ff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Degree ${degree}`, baseX + radius * 2 + 12, baseY - 8);
    ctx.restore();

    if (!compact) {
      this.drawModifiers(ctx, baseX + radius * 2 + 12, baseY + 12, modifiers);
      this.drawOctaveMeter(ctx, baseX + radius * 2 + 12, baseY + 50, 64, octaveOffset);
      this.drawMappings(ctx, baseX + radius * 2 + 72, baseY + 44, mappings);
    }
  }
}
