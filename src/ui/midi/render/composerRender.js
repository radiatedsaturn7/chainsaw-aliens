import { UI_SUITE, SHARED_EDITOR_LEFT_MENU, buildSharedLeftMenuLayout, buildSharedLeftMenuButtons } from '../../uiSuite.js';


export function drawRecordModeSidebar(composer, ctx, x, y, w, h, tabOptions) {
  const isMobile = typeof composer.isMobileLayout === 'function' && composer.isMobileLayout();
  const rowH = isMobile ? SHARED_EDITOR_LEFT_MENU.buttonHeightMobile : SHARED_EDITOR_LEFT_MENU.buttonHeightDesktop;

  ctx.fillStyle = UI_SUITE.colors.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = UI_SUITE.colors.border;
  ctx.strokeRect(x, y, w, h);

  const { tabColumn } = buildSharedLeftMenuLayout({ x, y, width: w, height: h, isMobile });
  const topButtons = buildSharedLeftMenuButtons({
    x: tabColumn.x,
    y: tabColumn.y,
    height: tabColumn.h,
    additionalButtons: tabOptions.map((tab) => ({ id: tab.id, label: tab.label })),
    isMobile,
    width: tabColumn.w
  });

  composer.bounds.tabs = [];
  composer.bounds.fileButton = topButtons[0]?.bounds || null;
  if (composer.bounds.fileButton) {
    composer.drawButton(ctx, composer.bounds.fileButton, SHARED_EDITOR_LEFT_MENU.fileLabel, composer.activeTab === 'file', false);
  }

  topButtons.slice(1).forEach((entry) => {
    const bounds = { ...entry.bounds, id: entry.id };
    composer.bounds.tabs.push(bounds);
    composer.drawButton(ctx, bounds, entry.label, composer.isLeftRailTabActive(entry.id), false);
  });

  const tabTail = topButtons[topButtons.length - 1]?.bounds || { x: tabColumn.x, y: tabColumn.y, h: rowH };
  composer.bounds.undoButton = {
    x: tabColumn.x,
    y: tabTail.y + tabTail.h + SHARED_EDITOR_LEFT_MENU.buttonGap,
    w: tabColumn.w,
    h: rowH
  };
  composer.drawButton(ctx, composer.bounds.undoButton, 'Undo / Redo', false, false);
  composer.bounds.redoButton = null;
  composer.bounds.settings = {
    x: tabColumn.x,
    y: composer.bounds.undoButton.y + composer.bounds.undoButton.h + SHARED_EDITOR_LEFT_MENU.buttonGap,
    w: tabColumn.w,
    h: rowH
  };
  composer.bounds.leftSettings = { ...composer.bounds.settings };
  composer.drawButton(ctx, composer.bounds.settings, 'Settings', composer.activeTab === 'settings', false);

  return Math.min(h, composer.bounds.settings.y + composer.bounds.settings.h - y + SHARED_EDITOR_LEFT_MENU.panelPadding);
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
