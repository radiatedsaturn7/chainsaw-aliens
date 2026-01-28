const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class HighwayRenderer {
  constructor(noteRenderer) {
    this.noteRenderer = noteRenderer;
  }

  getLayout({ width, height, laneCount, zoom, octaveOffset, scrollSpeed }) {
    const laneGap = Math.max(10, width * 0.02) * zoom;
    const laneWidth = Math.min(120 * zoom, (width * 0.72 - laneGap * (laneCount - 1)) / laneCount);
    const totalWidth = laneCount * laneWidth + (laneCount - 1) * laneGap;
    const startX = width / 2 - totalWidth / 2;
    const hitLineY = height - Math.max(140, height * 0.18);
    const laneTop = Math.max(80, height * 0.12);
    const laneBottom = hitLineY;
    const horizonY = Math.max(60, height * 0.08);
    const octaveLineY = hitLineY - (octaveOffset || 0) * 18;
    return {
      widthCenter: width / 2,
      laneGap,
      laneWidth,
      totalWidth,
      startX,
      hitLineY,
      laneTop,
      laneBottom,
      horizonY,
      octaveLineY,
      scrollSpeed: scrollSpeed || 240
    };
  }

  drawBackground(ctx, width, height, layout, laneColors) {
    const { startX, totalWidth, laneTop, laneBottom, hitLineY, horizonY } = layout;
    ctx.save();
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#081427');
    sky.addColorStop(0.5, '#040a14');
    sky.addColorStop(1, '#020307');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width / 2, horizonY, 10, width / 2, horizonY, 300);
    glow.addColorStop(0, 'rgba(90,180,255,0.45)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(6,10,18,0.78)';
    ctx.fillRect(startX - 70, laneTop - 40, totalWidth + 140, laneBottom - laneTop + 100);
    ctx.strokeStyle = 'rgba(110,180,255,0.22)';
    ctx.strokeRect(startX - 70, laneTop - 40, totalWidth + 140, laneBottom - laneTop + 100);

    const edgeGlow = ctx.createLinearGradient(0, laneBottom, 0, height);
    edgeGlow.addColorStop(0, 'rgba(80,170,255,0.5)');
    edgeGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.strokeStyle = edgeGlow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(startX - 80, laneBottom);
    ctx.lineTo(startX - 140, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(startX + totalWidth + 80, laneBottom);
    ctx.lineTo(startX + totalWidth + 140, height);
    ctx.stroke();

    laneColors.forEach((color, index) => {
      const baseX = startX + index * (layout.laneWidth + layout.laneGap) + layout.laneWidth / 2;
      const topX = width / 2 + (baseX - width / 2) * 0.5;
      ctx.strokeStyle = `${color}55`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(topX, laneTop);
      ctx.lineTo(baseX, laneBottom);
      ctx.stroke();
    });

    const hitGlow = ctx.createLinearGradient(0, hitLineY - 40, 0, hitLineY + 40);
    hitGlow.addColorStop(0, 'rgba(70,160,255,0)');
    hitGlow.addColorStop(0.5, 'rgba(120,220,255,0.4)');
    hitGlow.addColorStop(1, 'rgba(70,160,255,0)');
    ctx.fillStyle = hitGlow;
    ctx.fillRect(startX - 80, hitLineY - 40, totalWidth + 160, 80);
    ctx.restore();
  }

  drawLanes(ctx, width, height, layout, laneColors, labels, pulseByIndex = []) {
    const { startX, laneWidth, laneGap, laneTop, laneBottom, horizonY } = layout;
    ctx.save();
    const topScale = 0.45;
    for (let i = 0; i < labels.length; i += 1) {
      const baseX = startX + i * (laneWidth + laneGap);
      const bottomLeft = baseX;
      const bottomRight = baseX + laneWidth;
      const centerBottom = baseX + laneWidth / 2;
      const centerTop = width / 2 + (centerBottom - width / 2) * topScale;
      const topWidth = laneWidth * 0.45;
      const topLeft = centerTop - topWidth / 2;
      const topRight = centerTop + topWidth / 2;

      const pulse = clamp(pulseByIndex[i] || 0, 0, 1);
      ctx.fillStyle = pulse > 0 ? `rgba(255,255,255,${0.08 + pulse * 0.2})` : 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.moveTo(topLeft, laneTop);
      ctx.lineTo(topRight, laneTop);
      ctx.lineTo(bottomRight, laneBottom);
      ctx.lineTo(bottomLeft, laneBottom);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(120,190,255,0.25)';
      ctx.stroke();

      ctx.fillStyle = laneColors[i] || '#7ad0ff';
      ctx.font = `bold ${Math.max(14, laneWidth * 0.32)}px Courier New`;
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], centerBottom, laneBottom + 34);
    }
    ctx.restore();
  }

  drawBeatLines(ctx, layout, songTime, beatDuration) {
    const { startX, totalWidth, hitLineY } = layout;
    const visibleWindow = 4.4;
    const startBeat = Math.floor(songTime / beatDuration) - 1;
    const endBeat = Math.ceil((songTime + visibleWindow) / beatDuration);
    ctx.save();
    for (let beat = startBeat; beat <= endBeat; beat += 1) {
      const beatTime = beat * beatDuration;
      const timeToHit = beatTime - songTime;
      if (timeToHit < -0.3 || timeToHit > visibleWindow) continue;
      const y = hitLineY - timeToHit * layout.scrollSpeed;
      const isBar = beat % 4 === 0;
      ctx.strokeStyle = isBar ? 'rgba(130,210,255,0.5)' : 'rgba(120,180,220,0.2)';
      ctx.lineWidth = isBar ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(startX - 40, y);
      ctx.lineTo(startX + totalWidth + 40, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawHitLine(ctx, layout, highlight, octaveLineY, mode) {
    const { startX, totalWidth, hitLineY } = layout;
    ctx.save();
    const glassGradient = ctx.createLinearGradient(startX, hitLineY - 8, startX, hitLineY + 8);
    glassGradient.addColorStop(0, 'rgba(160,220,255,0.25)');
    glassGradient.addColorStop(0.5, 'rgba(220,245,255,0.85)');
    glassGradient.addColorStop(1, 'rgba(120,200,255,0.2)');
    ctx.fillStyle = glassGradient;
    ctx.fillRect(startX - 40, hitLineY - 6, totalWidth + 80, 12);
    ctx.strokeStyle = 'rgba(200,245,255,0.9)';
    if (mode === 'chord') {
      const offsets = [-6, 0, 6];
      ctx.lineWidth = 2;
      offsets.forEach((offset) => {
        ctx.beginPath();
        ctx.moveTo(startX - 40, hitLineY + offset);
        ctx.lineTo(startX + totalWidth + 40, hitLineY + offset);
        ctx.stroke();
      });
    } else {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX - 40, hitLineY);
      ctx.lineTo(startX + totalWidth + 40, hitLineY);
      ctx.stroke();
    }

    if (highlight) {
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i += 1) {
        const crackX = lerp(startX, startX + totalWidth, i / 5);
        const crackLen = 18 + i * 3;
        ctx.beginPath();
        ctx.moveTo(crackX, hitLineY - crackLen);
        ctx.lineTo(crackX + (i % 2 === 0 ? -12 : 12), hitLineY - 6);
        ctx.stroke();
      }
    }

    if (Number.isFinite(octaveLineY)) {
      ctx.strokeStyle = 'rgba(255,215,120,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(startX - 30, octaveLineY);
      ctx.lineTo(startX + totalWidth + 30, octaveLineY);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawNotes(ctx, events, layout, songTime, settings, laneColors, mode) {
    const { startX, laneWidth, laneGap, hitLineY } = layout;
    const visibleWindow = 4.4;
    const showPitchLabel = settings.labelMode !== 'buttons';
    const showStickLabel = settings.labelMode !== 'pitch';
    events.forEach((event) => {
      const timeToHit = event.timeSec - songTime;
      if (timeToHit < -0.4 || timeToHit > visibleWindow) return;
      if (mode !== 'listen' && event.judged) return;
      const laneIndex = event.lane ?? 0;
      const depth = clamp(1 - timeToHit / visibleWindow, 0, 1);
      const perspective = lerp(0.45, 1, depth);
      const laneCenter = startX + laneIndex * (laneWidth + laneGap) + laneWidth / 2;
      const highwayCenter = layout.widthCenter ?? (startX + layout.totalWidth / 2);
      const perspectiveCenter = highwayCenter + (laneCenter - highwayCenter) * perspective;
      const noteWidth = laneWidth * perspective * settings.noteSize;
      const noteHeight = Math.max(24, laneWidth * 0.32) * settings.noteSize * perspective;
      const y = hitLineY - timeToHit * layout.scrollSpeed * lerp(0.85, 1.15, depth);
      const noteX = perspectiveCenter - noteWidth / 2;
      const noteY = y - noteHeight / 2;
      const color = laneColors[laneIndex] || '#7ad0ff';
      const sustainLength = event.sustain ? event.sustain * settings.secondsPerBeat * layout.scrollSpeed * 0.7 : 0;
      this.noteRenderer.drawNote(ctx, {
        x: noteX,
        y: noteY,
        width: noteWidth,
        height: noteHeight,
        color,
        primaryLabel: event.primaryLabel,
        secondaryLabel: event.secondaryLabel,
        modifierState: event.modifierState,
        labelMode: settings.labelMode,
        kind: event.noteKind,
        sustainLength,
        hitGlow: event.autoHit
      });

      if (showStickLabel && event.stickLabel) {
        const stickSize = Math.max(18, noteHeight * 0.5);
        const stickX = Math.max(12, noteX - stickSize - 8);
        const stickY = noteY + noteHeight / 2 - stickSize / 2;
        ctx.save();
        ctx.fillStyle = 'rgba(8,12,20,0.7)';
        ctx.fillRect(stickX, stickY, stickSize, stickSize);
        ctx.strokeStyle = 'rgba(140,200,255,0.45)';
        ctx.strokeRect(stickX, stickY, stickSize, stickSize);
        ctx.fillStyle = '#ffe16a';
        ctx.font = `bold ${Math.max(10, stickSize * 0.5)}px Courier New`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(event.stickLabel, stickX + stickSize / 2, stickY + stickSize / 2);
        ctx.restore();
      }

      if (showPitchLabel && event.sideLabel) {
        const labelText = event.sideLabel;
        const labelX = startX + layout.totalWidth + 18;
        const labelY = noteY + noteHeight / 2;
        ctx.save();
        ctx.font = `bold ${Math.max(12, noteHeight * 0.45)}px Courier New`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const metrics = ctx.measureText(labelText);
        const paddingX = 8;
        const paddingY = 4;
        const boxW = metrics.width + paddingX * 2;
        const boxH = Math.max(18, noteHeight * 0.55);
        ctx.fillStyle = 'rgba(8,12,20,0.7)';
        ctx.fillRect(labelX, labelY - boxH / 2, boxW, boxH);
        ctx.strokeStyle = 'rgba(140,200,255,0.45)';
        ctx.strokeRect(labelX, labelY - boxH / 2, boxW, boxH);
        ctx.fillStyle = '#d7f2ff';
        ctx.fillText(labelText, labelX + paddingX, labelY + paddingY / 2);
        ctx.restore();
      }
    });
  }
}
