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
  drawModePill(ctx, width, mode, options = {}) {
    const pillW = 220;
    const pillH = 36;
    const pillX = width / 2 - pillW / 2;
    const pillY = 24;
    const noteLabel = options.noteLabel ?? 'NOTE';
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
    ctx.fillText(noteLabel, pillX + halfW / 2, pillY + pillH / 2);
    ctx.fillText('CHORD', pillX + halfW + halfW / 2, pillY + pillH / 2);
    ctx.restore();
  }

  drawCompass(ctx, x, y, radius, activeDirection, targetDirection) {
    ctx.save();
    ctx.fillStyle = 'rgba(6,12,20,0.75)';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,200,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (Number.isFinite(targetDirection)) {
      const angles = {
        1: 270,
        2: 315,
        3: 0,
        4: 45,
        5: 90,
        6: 135,
        7: 180,
        8: 225
      };
      const angle = (angles[targetDirection] ?? 270) * (Math.PI / 180);
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius;
      ctx.strokeStyle = 'rgba(255,225,120,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
      ctx.fillStyle = '#ffe16a';
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, 4, 0, Math.PI * 2);
      ctx.fill();
    }

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

  drawOctaveMeter(ctx, x, y, height, octaveOffset, min = -2, max = 2, requiredOffset = null) {
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
    if (Number.isFinite(requiredOffset)) {
      const targetNorm = clamp((requiredOffset - min) / range, 0, 1);
      const targetY = y + height - targetNorm * height;
      ctx.strokeStyle = 'rgba(255,225,120,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 4, targetY);
      ctx.lineTo(x + 26, targetY);
      ctx.stroke();
    }
    ctx.fillStyle = '#d7f2ff';
    ctx.font = '10px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Oct ${octaveOffset >= 0 ? '+' : ''}${octaveOffset}`, x + 28, y + 10);
    if (Number.isFinite(requiredOffset)) {
      ctx.fillStyle = '#ffe16a';
      ctx.fillText(`Target ${requiredOffset >= 0 ? '+' : ''}${requiredOffset}`, x + 28, y + 24);
    }
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
      targetDirection,
      modifiers,
      octaveOffset,
      requiredOctaveOffset,
      mappings,
      compact,
      instrument
    } = state;

    if (mode && mode !== 'drum') {
      const noteLabel = instrument === 'piano' || instrument === 'guitar' ? 'ARP' : 'NOTE';
      this.drawModePill(ctx, width, mode, { noteLabel });
    }

    const baseX = width - 260;
    const baseY = 80;
    const rowH = 24;
    const rowW = 220;
    const labelX = baseX + 10;
    const valueX = baseX + rowW - 10;
    const directionLabels = {
      1: 'N',
      2: 'NE',
      3: 'E',
      4: 'SE',
      5: 'S',
      6: 'SW',
      7: 'W',
      8: 'NW'
    };
    const stickLabel = directionLabels[targetDirection] || `${targetDirection ?? ''}`;
    const showStick = Number.isFinite(targetDirection) && targetDirection !== stickDir;
    const showOctave = Number.isFinite(requiredOctaveOffset) && requiredOctaveOffset !== octaveOffset;
    const mappingByButton = (mappings || []).reduce((acc, entry) => {
      acc[entry.button] = entry.label;
      return acc;
    }, {});
    const rows = [];

    if (showOctave) {
      rows.push({
        label: 'D-Pad Octave',
        value: `Now ${octaveOffset >= 0 ? '+' : ''}${octaveOffset} → ${requiredOctaveOffset >= 0 ? '+' : ''}${requiredOctaveOffset}`,
        highlight: true
      });
    }

    rows.push({
      label: 'D-Pad Left',
      value: modifiers.dleft ? 'On' : 'Off',
      active: modifiers.dleft
    });
    rows.push({
      label: 'LB',
      value: modifiers.lb ? 'On' : 'Off',
      active: modifiers.lb
    });

    if (showStick) {
      rows.push({
        label: 'L-Stick Dir',
        value: stickLabel,
        highlight: true
      });
    }

    ['A', 'X', 'Y', 'B'].forEach((button) => {
      rows.push({
        label: button,
        value: mappingByButton[button] || '--'
      });
    });

    rows.push({
      label: 'RB',
      value: modifiers.rb ? 'On' : 'Off',
      active: modifiers.rb
    });

    if (compact) {
      rows.splice(5, 0, {
        label: 'Degree',
        value: `${degree}`
      });
    }

    rows.forEach((row, index) => {
      const rowY = baseY + index * (rowH + 6);
      ctx.save();
      const bg = row.highlight
        ? 'rgba(255,225,120,0.2)'
        : row.active
          ? 'rgba(255,220,120,0.18)'
          : 'rgba(20,30,40,0.6)';
      ctx.fillStyle = bg;
      ctx.fillRect(baseX, rowY, rowW, rowH);
      ctx.strokeStyle = 'rgba(140,200,255,0.45)';
      ctx.strokeRect(baseX, rowY, rowW, rowH);
      ctx.font = '12px Courier New';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#d7f2ff';
      ctx.fillText(row.label, labelX, rowY + rowH / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = row.highlight ? '#ffe16a' : row.active ? '#ffe9b0' : '#d7f2ff';
      ctx.fillText(row.value, valueX, rowY + rowH / 2);
      ctx.restore();
    });
  }
}
