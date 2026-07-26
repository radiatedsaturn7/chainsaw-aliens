const REFERENCE_WIDTH = 960;
const REFERENCE_HEIGHT = 540;
const TITLE_Y = 120;
const ROW_START_Y = 205;
const ROW_GAP = 44;
const ROW_WIDTH = 320;
const ROW_HEIGHT = 34;
const ROW_TEXT_INSET = 22;
const FOOTER_BOTTOM = 42;

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export function drawInGameTextMenu(ctx, {
  bounds = {},
  title = 'Paused',
  rows = [],
  selectedIndex = 0,
  footer = '',
  objective = ''
} = {}) {
  const width = Math.max(1, finite(bounds.w, REFERENCE_WIDTH));
  const height = Math.max(1, finite(bounds.h, REFERENCE_HEIGHT));
  const scale = Math.max(0.001, Math.min(1, width / REFERENCE_WIDTH, height / REFERENCE_HEIGHT));
  const contentWidth = REFERENCE_WIDTH * scale;
  const contentHeight = REFERENCE_HEIGHT * scale;
  const originX = finite(bounds.x) + (width - contentWidth) * 0.5;
  const originY = finite(bounds.y) + (height - contentHeight) * 0.5;
  const contentBounds = { x: originX, y: originY, w: contentWidth, h: contentHeight };
  const safeRows = Array.isArray(rows) ? rows : [];
  const activeIndex = Math.max(0, Math.min(
    Math.max(0, safeRows.length - 1),
    Math.round(finite(selectedIndex))
  ));

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(finite(bounds.x), finite(bounds.y), width, height);
  ctx.fillStyle = '#fff';
  ctx.font = `${22 * scale}px Courier New`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(title || 'Paused'), originX + contentWidth / 2, originY + TITLE_Y * scale);

  const rowBounds = [];
  ctx.font = `${16 * scale}px Courier New`;
  ctx.textAlign = 'left';
  safeRows.forEach((row, index) => {
    const textY = originY + (ROW_START_Y + index * ROW_GAP) * scale;
    const itemBounds = {
      x: originX + (REFERENCE_WIDTH / 2 - ROW_WIDTH / 2) * scale,
      y: textY - 26 * scale,
      w: ROW_WIDTH * scale,
      h: ROW_HEIGHT * scale,
      id: row?.id
    };
    rowBounds.push(itemBounds);
    if (index === activeIndex) {
      ctx.fillStyle = 'rgba(214,193,96,0.24)';
      ctx.fillRect(itemBounds.x, itemBounds.y, itemBounds.w, itemBounds.h);
      ctx.strokeStyle = 'rgba(214,193,96,0.75)';
      ctx.strokeRect(itemBounds.x, itemBounds.y, itemBounds.w, itemBounds.h);
    }
    ctx.fillStyle = '#fff';
    ctx.font = `${16 * scale}px Courier New`;
    ctx.textAlign = 'left';
    const prefix = index === activeIndex ? '> ' : '  ';
    ctx.fillText(`${prefix}${String(row?.label || '')}`, itemBounds.x + ROW_TEXT_INSET * scale, textY);
    if (row?.value) {
      ctx.textAlign = 'right';
      ctx.fillText(`< ${String(row.value)} >`, itemBounds.x + itemBounds.w - 16 * scale, textY);
    }
  });

  if (objective) {
    ctx.fillStyle = '#fff';
    ctx.font = `${16 * scale}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText(
      `Objective: ${objective}`,
      originX + contentWidth / 2,
      originY + (ROW_START_Y + safeRows.length * 36 + 18) * scale
    );
  }
  if (footer) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `${16 * scale}px Courier New`;
    ctx.textAlign = 'center';
    ctx.fillText(
      String(footer),
      originX + contentWidth / 2,
      originY + contentHeight - FOOTER_BOTTOM * scale
    );
  }
  ctx.restore();

  return {
    rowBounds,
    scale,
    contentBounds,
    selectedIndex: activeIndex
  };
}
