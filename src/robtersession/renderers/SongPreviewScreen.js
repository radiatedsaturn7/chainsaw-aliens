const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class SongPreviewScreen {
  constructor() {
    this.bounds = {
      modeButtons: [],
      toggles: [],
      sliders: [],
      speedButtons: []
    };
  }

  drawButton(ctx, bounds, label, active) {
    ctx.fillStyle = active ? 'rgba(120,200,255,0.85)' : 'rgba(20,30,40,0.7)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(140,200,255,0.6)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = active ? '#041019' : '#d7f2ff';
    ctx.font = 'bold 16px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
  }

  drawToggle(ctx, bounds, label, active) {
    ctx.fillStyle = active ? 'rgba(255,220,120,0.85)' : 'rgba(20,30,40,0.7)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(140,200,255,0.6)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = active ? '#22140a' : '#d7f2ff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
  }

  drawSlider(ctx, bounds, label, value, min, max) {
    ctx.fillStyle = 'rgba(8,14,22,0.75)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = 'rgba(140,200,255,0.6)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    const ratio = clamp((value - min) / (max - min), 0, 1);
    ctx.fillStyle = 'rgba(120,200,255,0.8)';
    ctx.fillRect(bounds.x + 2, bounds.y + 2, (bounds.w - 4) * ratio, bounds.h - 4);
    ctx.fillStyle = '#d7f2ff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${label}: ${value.toFixed(2)}`, bounds.x, bounds.y - 4);
  }

  draw(ctx, width, height, state) {
    const { selectedIndex, settings, practiceSpeed, ghostNotes } = state;
    this.bounds = { modeButtons: [], toggles: [], sliders: [], speedButtons: [] };
    ctx.save();
    ctx.fillStyle = '#0b0f18';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Choose Session Mode', width / 2, 60);

    const modes = ['Listen', 'Practice', 'Play'];
    const btnW = 180;
    const btnH = 44;
    const startY = 120;
    modes.forEach((label, index) => {
      const x = width / 2 - btnW / 2;
      const y = startY + index * (btnH + 12);
      const bounds = { x, y, w: btnW, h: btnH, mode: label.toLowerCase() };
      this.drawButton(ctx, bounds, label, selectedIndex === index);
      this.bounds.modeButtons.push(bounds);
    });

    ctx.fillStyle = '#d7f2ff';
    ctx.font = '14px Courier New';
    ctx.fillText('Practice Options', width / 2, startY + 3 * (btnH + 12) + 10);

    const toggleY = startY + 3 * (btnH + 12) + 24;
    const toggleW = 160;
    const toggleH = 28;
    const toggleX = width / 2 - toggleW - 12;
    const ghostBounds = { x: toggleX, y: toggleY, w: toggleW, h: toggleH, id: 'ghostNotes' };
    this.drawToggle(ctx, ghostBounds, `Ghost Notes: ${ghostNotes ? 'On' : 'Off'}`, ghostNotes);
    this.bounds.toggles.push(ghostBounds);

    const labelText = settings.labelMode === 'buttons'
      ? 'Buttons'
      : settings.labelMode === 'pitch'
        ? 'Pitch'
        : 'Both';
    const labelBounds = { x: toggleX + toggleW + 24, y: toggleY, w: toggleW, h: toggleH, id: 'labelMode' };
    this.drawToggle(ctx, labelBounds, `Labels: ${labelText}`, true);
    this.bounds.toggles.push(labelBounds);

    const speedOptions = [0.5, 0.75, 1];
    const speedY = toggleY + 40;
    const speedLabelX = width / 2 - 140;
    ctx.fillStyle = '#d7f2ff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('Practice Speed', speedLabelX, speedY - 6);
    speedOptions.forEach((speed, index) => {
      const bounds = {
        x: speedLabelX + index * 72,
        y: speedY,
        w: 64,
        h: 26,
        value: speed,
        id: 'practiceSpeed'
      };
      this.drawToggle(ctx, bounds, `${speed}x`, Math.abs(practiceSpeed - speed) < 0.01);
      this.bounds.speedButtons.push(bounds);
    });

    const hudBounds = { x: speedLabelX, y: speedY + 48, w: 260, h: 28, id: 'inputHud' };
    this.drawToggle(ctx, hudBounds, `HUD: ${settings.inputHud === 'compact' ? 'Compact' : 'Full'}`, settings.inputHud === 'full');
    this.bounds.toggles.push(hudBounds);

    ctx.fillStyle = 'rgba(215,242,255,0.6)';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Confirm: Start  |  Back: Setlist', width / 2, height - 40);

    ctx.restore();
  }

  handleClick(x, y) {
    const modeHit = this.bounds.modeButtons.find((btn) => (
      x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h
    ));
    if (modeHit) return { type: 'mode', value: modeHit.mode };

    const toggleHit = this.bounds.toggles.find((btn) => (
      x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h
    ));
    if (toggleHit) return { type: 'toggle', id: toggleHit.id };

    const speedHit = this.bounds.speedButtons.find((btn) => (
      x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h
    ));
    if (speedHit) return { type: 'speed', value: speedHit.value };

    return null;
  }
}
