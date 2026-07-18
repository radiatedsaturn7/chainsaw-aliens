export function getBrowserViewportSize(windowLike, {
  defaultWidth = 960,
  defaultHeight = 540
} = {}) {
  const visualViewport = windowLike?.visualViewport;
  const visualWidth = Number(visualViewport?.width);
  const visualHeight = Number(visualViewport?.height);
  const innerWidth = Number(windowLike?.innerWidth);
  const innerHeight = Number(windowLike?.innerHeight);
  const widthSource = Number.isFinite(visualWidth) && visualWidth > 0 ? visualWidth : innerWidth;
  const heightSource = Number.isFinite(visualHeight) && visualHeight > 0 ? visualHeight : innerHeight;
  return {
    width: Math.max(1, Math.round(Number.isFinite(widthSource) && widthSource > 0 ? widthSource : defaultWidth)),
    height: Math.max(1, Math.round(Number.isFinite(heightSource) && heightSource > 0 ? heightSource : defaultHeight))
  };
}

export function getCanvasViewportLayout({
  isMobile = false,
  viewportWidth = 1,
  viewportHeight = 1,
  defaultCanvasWidth = 960,
  defaultCanvasHeight = 540,
  devicePixelRatio = 1,
  maxMobileDpr = 3
} = {}) {
  const width = Math.max(1, Math.round(Number(viewportWidth) || defaultCanvasWidth));
  const height = Math.max(1, Math.round(Number(viewportHeight) || defaultCanvasHeight));
  const mobile = Boolean(isMobile);
  const portrait = mobile && height > width;
  const landscape = mobile && width > height;
  const dpr = mobile
    ? Math.max(1, Math.min(maxMobileDpr, Number(devicePixelRatio) || 1))
    : 1;
  const logicalWidth = width;
  const logicalHeight = height;
  const targetCanvasWidth = mobile ? Math.round(logicalWidth * dpr) : logicalWidth;
  const targetCanvasHeight = mobile ? Math.round(logicalHeight * dpr) : logicalHeight;
  const styleWidth = width;
  const styleHeight = height;
  const scale = 1;

  return {
    viewportWidth: logicalWidth,
    viewportHeight: logicalHeight,
    physicalViewportWidth: width,
    physicalViewportHeight: height,
    logicalWidth,
    logicalHeight,
    isMobile: mobile,
    isPortrait: portrait,
    isLandscape: landscape,
    dpr,
    targetCanvasWidth,
    targetCanvasHeight,
    styleWidth,
    styleHeight,
    scale
  };
}

export function getPortraitHandheldLayout(width, height, {
  margin = 14,
  screenRatio = 0.5,
  renderWidth = 960,
  renderHeight = 540
} = {}) {
  const viewportW = Math.max(1, Math.round(Number(width) || 1));
  const viewportH = Math.max(1, Math.round(Number(height) || 1));
  const safeRenderW = Math.max(1, Math.round(Number(renderWidth) || 960));
  const safeRenderH = Math.max(1, Math.round(Number(renderHeight) || 540));
  const safeMargin = Math.max(8, Math.min(24, Math.round(Number(margin) || 14)));
  const splitY = Math.round(viewportH * Math.max(0.44, Math.min(0.56, Number(screenRatio) || 0.5)));
  const device = { x: 0, y: 0, w: viewportW, h: viewportH };
  const screenOuter = {
    x: safeMargin,
    y: safeMargin,
    w: Math.max(1, viewportW - safeMargin * 2),
    h: Math.max(1, splitY - safeMargin * 2)
  };
  const bezel = Math.max(8, Math.round(Math.min(screenOuter.w, screenOuter.h) * 0.045));
  const screenSlot = {
    x: screenOuter.x + bezel,
    y: screenOuter.y + bezel,
    w: Math.max(1, screenOuter.w - bezel * 2),
    h: Math.max(1, screenOuter.h - bezel * 2)
  };
  const screenScale = Math.min(screenSlot.w / safeRenderW, screenSlot.h / safeRenderH);
  const screen = {
    x: Math.round(screenSlot.x + (screenSlot.w - safeRenderW * screenScale) / 2),
    y: Math.round(screenSlot.y + (screenSlot.h - safeRenderH * screenScale) / 2),
    w: Math.max(1, Math.round(safeRenderW * screenScale)),
    h: Math.max(1, Math.round(safeRenderH * screenScale))
  };
  const controlsDeck = {
    x: safeMargin,
    y: splitY + safeMargin,
    w: Math.max(1, viewportW - safeMargin * 2),
    h: Math.max(1, viewportH - splitY - safeMargin * 2)
  };
  const controlsBase = Math.min(controlsDeck.w, controlsDeck.h);
  const dpadSize = Math.max(96, Math.min(132, Math.round(controlsBase * 0.36)));
  const controlMidY = Math.round(controlsDeck.y + controlsDeck.h * 0.3);
  const dpad = {
    x: Math.round(controlsDeck.x + Math.max(18, controlsDeck.w * 0.08)),
    y: Math.round(controlMidY - dpadSize / 2),
    w: dpadSize,
    h: dpadSize
  };
  const buttonRadius = Math.max(32, Math.min(42, Math.round(controlsBase * 0.105)));
  const buttonClusterX = Math.round(controlsDeck.x + controlsDeck.w - Math.max(76, controlsDeck.w * 0.19));
  const buttonClusterY = controlMidY;
  const buttons = {
    a: { x: buttonClusterX - buttonRadius * 0.15, y: buttonClusterY - buttonRadius * 1.05, r: buttonRadius },
    jump: { x: buttonClusterX + buttonRadius * 0.25, y: buttonClusterY + buttonRadius * 1.05, r: buttonRadius }
  };
  const pillW = Math.max(48, Math.min(64, Math.round(controlsDeck.w * 0.15)));
  const pillH = Math.max(18, Math.min(24, Math.round(controlsDeck.h * 0.055)));
  const pillY = Math.round(controlsDeck.y + controlsDeck.h - Math.max(34, controlsDeck.h * 0.11));
  const centerX = controlsDeck.x + controlsDeck.w / 2;
  const select = { x: Math.round(centerX - pillW - 8), y: pillY, w: pillW, h: pillH };
  const start = { x: Math.round(centerX + 8), y: pillY, w: pillW, h: pillH };
  const speakerSlots = Array.from({ length: 7 }, (_entry, index) => ({
    x: Math.round(controlsDeck.x + controlsDeck.w - 96 + index * 9),
    y: Math.round(controlsDeck.y + controlsDeck.h - 66 + index * 2),
    w: 5,
    h: 42
  }));
  return {
    device,
    screenOuter,
    screenSlot,
    screen,
    controlsDeck,
    splitY,
    margin: safeMargin,
    renderViewport: { w: safeRenderW, h: safeRenderH },
    screenScale,
    dpad,
    buttons,
    start,
    select,
    speakerSlots
  };
}

export function getLandscapeHandheldLayout(width, height, {
  margin = 10,
  renderWidth = 960,
  renderHeight = 540
} = {}) {
  const viewportW = Math.max(1, Math.round(Number(width) || 1));
  const viewportH = Math.max(1, Math.round(Number(height) || 1));
  const safeRenderW = Math.max(1, Math.round(Number(renderWidth) || 960));
  const safeRenderH = Math.max(1, Math.round(Number(renderHeight) || 540));
  const safeMargin = Math.max(6, Math.min(18, Math.round(Number(margin) || 10)));
  const device = { x: 0, y: 0, w: viewportW, h: viewportH };
  const leftRail = {
    x: safeMargin,
    y: safeMargin,
    w: Math.max(124, Math.round(viewportW * 0.19)),
    h: Math.max(1, viewportH - safeMargin * 2)
  };
  const rightRailWidth = Math.max(150, Math.round(viewportW * 0.21));
  const rightRail = {
    x: Math.max(1, viewportW - safeMargin - rightRailWidth),
    y: safeMargin,
    w: rightRailWidth,
    h: Math.max(1, viewportH - safeMargin * 2)
  };
  const screenSlot = {
    x: leftRail.x + leftRail.w + safeMargin,
    y: safeMargin * 2,
    w: Math.max(1, rightRail.x - (leftRail.x + leftRail.w) - safeMargin * 2),
    h: Math.max(1, viewportH - safeMargin * 4)
  };
  const screenScale = Math.min(screenSlot.w / safeRenderW, screenSlot.h / safeRenderH);
  const screen = {
    x: Math.round(screenSlot.x + (screenSlot.w - safeRenderW * screenScale) / 2),
    y: Math.round(screenSlot.y + (screenSlot.h - safeRenderH * screenScale) / 2),
    w: Math.max(1, Math.round(safeRenderW * screenScale)),
    h: Math.max(1, Math.round(safeRenderH * screenScale))
  };
  const controlsBase = Math.min(leftRail.w, leftRail.h);
  const dpadSize = Math.max(116, Math.min(156, Math.round(controlsBase * 0.96)));
  const dpad = {
    x: Math.round(leftRail.x + (leftRail.w - dpadSize) / 2),
    y: Math.round(leftRail.y + leftRail.h * 0.56 - dpadSize / 2),
    w: dpadSize,
    h: dpadSize
  };
  const buttonRadius = Math.max(36, Math.min(50, Math.round(Math.min(rightRail.w, rightRail.h) * 0.22)));
  const buttonX = Math.round(rightRail.x + rightRail.w * 0.5);
  const buttonY = Math.round(rightRail.y + rightRail.h * 0.5);
  const buttons = {
    a: { x: buttonX - buttonRadius * 0.58, y: buttonY - buttonRadius * 1.5, r: buttonRadius },
    jump: { x: buttonX + buttonRadius * 0.58, y: buttonY + buttonRadius * 1.5, r: buttonRadius }
  };
  const pillW = Math.max(54, Math.min(72, Math.round(rightRail.w * 0.48)));
  const pillH = Math.max(20, Math.min(26, Math.round(rightRail.h * 0.07)));
  const select = {
    x: Math.round(leftRail.x + (leftRail.w - pillW) / 2),
    y: Math.round(leftRail.y + 30),
    w: pillW,
    h: pillH
  };
  const start = {
    x: Math.round(rightRail.x + (rightRail.w - pillW) / 2),
    y: Math.round(rightRail.y + 30),
    w: pillW,
    h: pillH
  };
  const speakerSlots = Array.from({ length: 6 }, (_entry, index) => ({
    x: Math.round(rightRail.x + rightRail.w * 0.24 + index * Math.max(8, rightRail.w * 0.065)),
    y: Math.round(rightRail.y + rightRail.h - 58),
    w: 4,
    h: 34
  }));
  return {
    device,
    leftRail,
    rightRail,
    screenOuter: screenSlot,
    screenSlot,
    screen,
    controlsDeck: device,
    margin: safeMargin,
    renderViewport: { w: safeRenderW, h: safeRenderH },
    screenScale,
    dpad,
    buttons,
    start,
    select,
    speakerSlots
  };
}

export function mapPortraitHandheldPoint(layout, x, y) {
  if (!layout?.screen || !layout?.renderViewport) return null;
  const { screen, renderViewport } = layout;
  if (x < screen.x || x > screen.x + screen.w || y < screen.y || y > screen.y + screen.h) return null;
  return {
    x: ((x - screen.x) / Math.max(1, screen.w)) * renderViewport.w,
    y: ((y - screen.y) / Math.max(1, screen.h)) * renderViewport.h
  };
}

export function shouldShowMobileFullscreenButton({
  isMobile = false,
  isFullscreen = false,
  fullscreenPending = false,
  hiddenForTesting = false,
  gameState = '',
  titleScreen = ''
} = {}) {
  const normalizedTitleScreen = String(titleScreen || '');
  return Boolean(isMobile)
    && !isFullscreen
    && !fullscreenPending
    && !hiddenForTesting
    && gameState === 'title'
    && (normalizedTitleScreen === '' || normalizedTitleScreen === 'main');
}
