import { UI_SUITE, SHARED_EDITOR_LEFT_MENU } from '../../uiSuite.js';


export function drawRecordModeSidebar(composer, ctx, x, y, w, h, tabOptions) {
  const isMobile = typeof composer.isMobileLayout === 'function' && composer.isMobileLayout();
  const rowH = isMobile ? SHARED_EDITOR_LEFT_MENU.buttonHeightMobile : SHARED_EDITOR_LEFT_MENU.buttonHeightDesktop;
  const rowGap = SHARED_EDITOR_LEFT_MENU.buttonGap;
  const panelPadding = SHARED_EDITOR_LEFT_MENU.panelPadding;
  const menuRows = tabOptions.length + 2;
  const menuH = Math.min(h, menuRows * rowH + (menuRows - 1) * rowGap + panelPadding * 2);
  const menuX = x;
  const menuY = y;

  ctx.fillStyle = UI_SUITE.colors.panel;
  ctx.fillRect(menuX, menuY, w, h);
  ctx.strokeStyle = UI_SUITE.colors.border;
  ctx.strokeRect(menuX, menuY, w, h);

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

  composer.bounds.undoButton = null;
  composer.bounds.redoButton = null;
  composer.bounds.settings = { x: innerX, y: cursorY, w: innerW, h: rowH };
  composer.bounds.leftSettings = { ...composer.bounds.settings };
  composer.drawButton(ctx, composer.bounds.settings, 'Settings', composer.activeTab === 'settings', false);
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
