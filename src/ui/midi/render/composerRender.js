import { UI_SUITE } from '../../uiSuite.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function drawRecordModeSidebar(composer, ctx, x, y, w, h, tabOptions) {
  const rowH = clamp(Math.round(h * 0.055), 40, 48);
  const rowGap = clamp(Math.round(rowH * 0.2), 6, 10);
  const panelPadding = clamp(Math.round(rowH * 0.25), 8, 12);
  const menuRows = tabOptions.length + 2;
  const menuH = Math.min(h, menuRows * rowH + (menuRows - 1) * rowGap + panelPadding * 2);
  const menuX = x;
  const menuY = y;

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(menuX, menuY, w, menuH);
  ctx.strokeStyle = UI_SUITE.colors.border;
  ctx.strokeRect(menuX, menuY, w, menuH);

  const innerX = menuX + panelPadding;
  const innerW = w - panelPadding * 2;
  let cursorY = menuY + panelPadding;
  composer.bounds.tabs = [];
  composer.bounds.fileButton = { x: innerX, y: cursorY, w: innerW, h: rowH };
  composer.drawButton(ctx, composer.bounds.fileButton, 'File', composer.activeTab === 'file', false);
  cursorY += rowH + rowGap;

  tabOptions.forEach((tab) => {
    const bounds = { x: innerX, y: cursorY, w: innerW, h: rowH, id: tab.id };
    composer.bounds.tabs.push(bounds);
    composer.drawButton(ctx, bounds, tab.label, composer.isLeftRailTabActive(tab.id), false);
    cursorY += rowH + rowGap;
  });
  const undoCols = innerW < 190 ? 1 : 2;
  const undoW = undoCols === 1 ? innerW : (innerW - rowGap) / 2;
  composer.bounds.undoButton = { x: innerX, y: cursorY, w: undoW, h: rowH };
  composer.drawSmallButton(ctx, composer.bounds.undoButton, 'Undo', false);
  if (undoCols === 1) {
    cursorY += rowH + rowGap;
    composer.bounds.redoButton = { x: innerX, y: cursorY, w: undoW, h: rowH };
  } else {
    composer.bounds.redoButton = { x: innerX + undoW + rowGap, y: cursorY, w: undoW, h: rowH };
  }
  composer.drawSmallButton(ctx, composer.bounds.redoButton, 'Redo', false);
  return menuH;
}

export function drawGhostNotes(composer, ctx) {
  if (!composer.gridBounds) return;
  const activeNotes = composer.recorder.getActiveNotes();
  if (!activeNotes.length) return;
  const elapsed = Math.max(0, composer.getRecordingTime() - composer.recorder.startTime);
  const currentTick = (elapsed * composer.song.tempo / 60) * composer.ticksPerBeat;
  ctx.save();
  ctx.fillStyle = 'rgba(255,225,106,0.4)';
  activeNotes.forEach((note) => {
    const startSeconds = Math.max(0, note.startTime - composer.recorder.startTime);
    const startTick = (startSeconds * composer.song.tempo / 60) * composer.ticksPerBeat;
    const tempNote = {
      pitch: note.pitch,
      startTick,
      durationTicks: Math.max(1, currentTick - startTick)
    };
    const rect = composer.getNoteRect(tempNote);
    if (!rect) return;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  });
  ctx.restore();
}
