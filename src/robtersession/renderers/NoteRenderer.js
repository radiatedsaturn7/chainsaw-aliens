const DEFAULT_FONT = 'Courier New';

export default class NoteRenderer {
  drawNote(ctx, note) {
    const {
      x,
      y,
      width,
      height,
      color,
      primaryLabel,
      secondaryLabel,
      labelMode,
      kind,
      modifierState,
      hitGlow,
      alpha
    } = note;

    ctx.save();
    ctx.globalAlpha = alpha ?? 1;

    if (kind === 'chord') {
      const barGap = width * 0.08;
      const barW = (width - barGap * 2) / 3;
      for (let i = 0; i < 3; i += 1) {
        const barX = x + i * (barW + barGap);
        ctx.fillStyle = color;
        ctx.fillRect(barX, y, barW, height);
        ctx.strokeStyle = 'rgba(20,30,40,0.8)';
        ctx.strokeRect(barX, y, barW, height);
      }
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);
      ctx.strokeStyle = 'rgba(20,30,40,0.8)';
      ctx.strokeRect(x, y, width, height);
    }

    if (hitGlow) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
    }

    const showPrimary = labelMode !== 'pitch';
    const showSecondary = labelMode !== 'buttons';
    const modifierLaneHeight = modifierState ? Math.max(10, height * 0.2) : 0;
    const labelCenterX = x + width / 2;
    const labelCenterY = y + height / 2 - modifierLaneHeight * 0.25;

    if ((showPrimary && primaryLabel) || (showSecondary && secondaryLabel)) {
      const labelBoxW = width * 0.9;
      const labelBoxH = Math.min(height - 4 - modifierLaneHeight, height * 0.7);
      ctx.fillStyle = 'rgba(10,16,24,0.65)';
      ctx.fillRect(labelCenterX - labelBoxW / 2, labelCenterY - labelBoxH / 2, labelBoxW, labelBoxH);
    }

    ctx.fillStyle = '#f5fbff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (showPrimary && primaryLabel) {
      ctx.font = `bold ${Math.max(12, height * 0.55)}px ${DEFAULT_FONT}`;
      ctx.fillText(primaryLabel, labelCenterX, labelCenterY - (showSecondary && secondaryLabel ? height * 0.18 : 0));
    }

    if (showSecondary && secondaryLabel) {
      ctx.font = `bold ${Math.max(10, height * 0.25)}px ${DEFAULT_FONT}`;
      ctx.fillStyle = '#bfe9ff';
      ctx.fillText(secondaryLabel, labelCenterX, labelCenterY + height * 0.22);
    }

    if (modifierState) {
      const lanes = [
        { label: 'LB', active: modifierState.lb },
        { label: 'DL', active: modifierState.dleft },
        { label: 'RB', active: modifierState.rb }
      ];
      const laneW = width / lanes.length;
      const laneY = y + height - modifierLaneHeight;
      lanes.forEach((lane, index) => {
        const laneX = x + index * laneW;
        ctx.fillStyle = lane.active ? 'rgba(255,215,120,0.9)' : 'rgba(8,14,22,0.7)';
        ctx.fillRect(laneX, laneY, laneW, modifierLaneHeight);
        ctx.strokeStyle = 'rgba(120,190,255,0.45)';
        ctx.strokeRect(laneX, laneY, laneW, modifierLaneHeight);
        ctx.fillStyle = lane.active ? '#20120a' : '#d7f2ff';
        ctx.font = `bold ${Math.max(8, modifierLaneHeight * 0.55)}px ${DEFAULT_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lane.label, laneX + laneW / 2, laneY + modifierLaneHeight / 2);
      });
    }

    ctx.restore();
  }
}
