import {
  DISPLAY_MODE_OPTIONS,
  getDisplayModeForAction,
  getDisplayModeLabelForAction
} from './shared/displayModes.js';

export default class Title {
  constructor() {
    this.timer = 0;
    this.screen = 'main';
    this.transition = null;
    this.menuOrder = ['recent-level', 'graphics', 'audio', 'game', 'options'];
    this.folderOrders = {
      graphics: [
        'pixel-editor',
        'cutscene-editor',
        'back'
      ],
      audio: [
        'midi-editor',
        'sfx-editor',
        'back'
      ],
      game: [
        'level-editor',
        'tile-editor',
        'race-editor',
        'car-editor',
        'actor-editor',
        'back'
      ]
    };
    this.optionsOrder = [
      'latest-changes',
      'robtersession',
      'controls',
      'display',
      'back'
    ];
    this.controlsOrder = [
      'mobile',
      'gamepad',
      'keyboard',
      'back'
    ];
    this.displayOrder = [
      ...DISPLAY_MODE_OPTIONS.map((option) => option.action),
      'back'
    ];
    this.menuSelection = 0;
    this.folderSelections = { graphics: 0, audio: 0, game: 0 };
    this.optionsSelection = 0;
    this.controlsSelection = 0;
    this.displaySelection = 0;
    this.menuBounds = new Map();
    this.folderBounds = {
      graphics: new Map(),
      audio: new Map(),
      game: new Map()
    };
    this.optionsBounds = new Map();
    this.controlsBounds = new Map();
    this.displayBounds = new Map();
    this.debugRestartBounds = null;
    this.mainMenuReady = false;
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  isPortraitPhone(width, height) {
    return height > width && Math.min(width, height) <= 900;
  }

  getScreenLayout(width, height, {
    screen = 'main',
    count = 1,
    preferredWidth = 360,
    defaultStartY = 245,
    defaultGap = 42
  } = {}) {
    const portrait = this.isPortraitPhone(width, height);
    const horizontalPad = portrait ? 24 : 40;
    const buttonWidth = Math.min(preferredWidth, Math.max(260, width - horizontalPad * 2));
    if (portrait) {
      const dense = count > 5;
      const shortViewport = height < 700;
      let buttonHeight = shortViewport ? 44 : dense ? 44 : 54;
      let gap = shortViewport ? 7 : dense ? 7 : 12;
      const topReserve = shortViewport ? (screen === 'main' ? 128 : 104) : (screen === 'main' ? 220 : 158);
      const bottomPad = shortViewport ? 20 : screen === 'main' ? 72 : 34;
      const available = Math.max(1, height - topReserve - bottomPad);
      const idealListHeight = count * buttonHeight + Math.max(0, count - 1) * gap;
      if (idealListHeight > available) {
        gap = count > 1 ? this.clamp(Math.floor((available - count * buttonHeight) / (count - 1)), 2, gap) : 0;
        const listWithCompactGap = count * buttonHeight + Math.max(0, count - 1) * gap;
        if (listWithCompactGap > available) {
          buttonHeight = this.clamp(Math.floor((available - Math.max(0, count - 1) * gap) / Math.max(1, count)), 32, buttonHeight);
        }
      }
      const listHeight = count * buttonHeight + Math.max(0, count - 1) * gap;
      const minStart = shortViewport ? (screen === 'main' ? 160 : 132) : (screen === 'main' ? 260 : 188);
      const fittedTop = Math.max(12, height - listHeight - bottomPad);
      const startY = Math.min(Math.max(minStart, fittedTop), fittedTop);
      const titleY = Math.max(shortViewport ? 42 : 86, Math.min(startY - 20, startY - (screen === 'main' ? (shortViewport ? 42 : 64) : 58)));
      return {
        portrait,
        buttonWidth,
        buttonHeight,
        buttonX: width / 2 - buttonWidth / 2,
        startY,
        gap,
        titleY,
        subtitleY: titleY + 26,
        titleFont: shortViewport ? '600 18px Arial' : '600 22px Arial',
        subtitleFont: shortViewport ? '12px Arial' : '14px Arial',
        labelFont: shortViewport ? '15px Arial' : dense ? '16px Arial' : '18px Arial'
      };
    }

    const compactLandscape = height <= 430 && width > height;
    const dense = count > 5;
    let buttonHeight = compactLandscape && dense ? 24 : height < 520 ? 32 : 34;
    const minButtonHeight = compactLandscape ? 24 : 30;
    const minGap = compactLandscape ? 3 : 8;
    const maxGap = compactLandscape && dense ? Math.min(defaultGap, 8) : defaultGap;
    const topLimit = compactLandscape ? (dense ? 108 : 136) : screen === 'main' ? 220 : 228;
    const minTopLimit = compactLandscape ? (screen === 'main' ? 62 : 50) : 120;
    const bottomPad = compactLandscape ? 10 : 42;
    const available = Math.max(1, height - minTopLimit - bottomPad);
    let fittedGap = count > 1
      ? Math.floor((available - count * buttonHeight) / (count - 1))
      : defaultGap;
    let gap = this.clamp(Math.min(maxGap, fittedGap), minGap, maxGap);
    let listHeight = count * buttonHeight + Math.max(0, count - 1) * gap;
    if (listHeight > available) {
      buttonHeight = this.clamp(
        Math.floor((available - Math.max(0, count - 1) * minGap) / Math.max(1, count)),
        minButtonHeight,
        buttonHeight
      );
      fittedGap = count > 1
        ? Math.floor((available - count * buttonHeight) / (count - 1))
        : defaultGap;
      gap = this.clamp(Math.min(maxGap, fittedGap), minGap, maxGap);
      listHeight = count * buttonHeight + Math.max(0, count - 1) * gap;
    }
    const minStartY = compactLandscape ? topLimit : 180;
    const fittedTop = Math.max(8, height - listHeight - bottomPad);
    const startY = Math.min(defaultStartY, Math.min(Math.max(minStartY, fittedTop), fittedTop));
    return {
      portrait,
      buttonWidth,
      buttonHeight,
      buttonX: width / 2 - buttonWidth / 2,
      startY,
      gap,
      titleY: compactLandscape ? Math.max(24, Math.min(dense ? 82 : 98, startY - 16)) : 180,
      subtitleY: compactLandscape ? Math.max(40, Math.min(dense ? 100 : 118, startY - 2)) : 206,
      titleFont: compactLandscape ? '600 18px Arial' : '600 22px Arial',
      subtitleFont: compactLandscape ? '12px Arial' : '14px Arial',
      labelFont: compactLandscape && dense ? '14px Arial' : '18px Arial'
    };
  }

  drawTitleText(ctx, width, text, layout, subtitle = '') {
    ctx.save();
    ctx.fillStyle = 'rgba(12,18,28,0.62)';
    const titleW = Math.min(width - 32, layout.portrait ? 300 : 360);
    const titleH = subtitle ? 58 : 42;
    const titleX = width / 2 - titleW / 2;
    const titleY = layout.titleY - 28;
    ctx.fillRect(titleX, titleY, titleW, titleH);
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.strokeRect(titleX, titleY, titleW, titleH);
    ctx.fillStyle = '#f8fbff';
    ctx.font = layout.titleFont;
    ctx.textAlign = 'center';
    ctx.fillText(text, width / 2, layout.titleY);
    if (subtitle) {
      ctx.font = layout.subtitleFont;
      ctx.fillStyle = 'rgba(198,220,245,0.86)';
      ctx.fillText(subtitle, width / 2, layout.subtitleY);
    }
    ctx.restore();
  }

  drawBackdrop(ctx, width, height) {
    const gradient = typeof ctx.createLinearGradient === 'function'
      ? ctx.createLinearGradient(0, 0, 0, height)
      : null;
    if (gradient) {
      gradient.addColorStop(0, '#10141c');
      gradient.addColorStop(0.5, '#07090e');
      gradient.addColorStop(1, '#050403');
      ctx.fillStyle = gradient;
    } else {
      ctx.fillStyle = '#07090e';
    }
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = 'rgba(120,150,178,0.22)';
    ctx.lineWidth = 1;
    const grid = Math.max(36, Math.floor(Math.min(width, height) / 12));
    for (let x = (this.timer * 6) % grid; x < width; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(255,225,106,0.09)';
    ctx.fillRect(0, 0, width, 3);
    ctx.fillStyle = 'rgba(95,184,168,0.09)';
    ctx.fillRect(0, height - 4, width, 4);

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = 'rgba(255,225,106,0.26)';
    ctx.beginPath();
    ctx.moveTo(width * 0.12, height * 0.22);
    ctx.lineTo(width * 0.88, height * 0.22);
    ctx.moveTo(width * 0.18, height * 0.78);
    ctx.lineTo(width * 0.82, height * 0.78);
    ctx.stroke();
    ctx.restore();
  }

  drawBrand(ctx, width, height) {
    const portrait = this.isPortraitPhone(width, height);
    const compactLandscape = !portrait && height <= 430;
    const y = portrait ? 82 : compactLandscape ? 48 : 118;
    const title = 'RTG Studio';
    const markY = y - (portrait ? 52 : compactLandscape ? 42 : 66);
    const markSize = portrait ? 40 : compactLandscape ? 34 : 52;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(95,184,168,0.18)';
    ctx.fillRect(width / 2 - markSize / 2 - 10, markY - markSize / 2, markSize, markSize);
    ctx.fillStyle = 'rgba(255,225,106,0.82)';
    ctx.fillRect(width / 2 - markSize / 2, markY - markSize / 2 + 10, markSize, markSize);
    ctx.fillStyle = '#0b0e14';
    ctx.font = portrait || compactLandscape ? 'bold 14px Arial' : 'bold 18px Arial';
    ctx.fillText('RTG', width / 2, markY + 7);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.font = portrait
      ? 'bold 34px Arial'
      : compactLandscape
        ? 'bold 32px Arial'
        : 'bold 54px Arial';
    ctx.fillText(title, width / 2 + 2, y + 3);
    ctx.fillStyle = '#f8fbff';
    ctx.fillText(title, width / 2, y);
    ctx.font = portrait || compactLandscape ? '12px Arial' : '14px Arial';
    ctx.fillStyle = 'rgba(198,220,245,0.82)';
    ctx.fillText('Interactive tools, games, and audio labs', width / 2, y + (portrait ? 24 : compactLandscape ? 22 : 30));
    ctx.fillStyle = '#ffe16a';
    ctx.fillRect(width / 2 - 42, y + (portrait ? 34 : compactLandscape ? 30 : 42), 84, 2);
    ctx.restore();
  }

  drawLoadingSplash(ctx, width, height) {
    const portrait = this.isPortraitPhone(width, height);
    const compactLandscape = !portrait && height <= 430;
    const tileW = Math.min(width - 40, portrait ? 280 : 340);
    const tileH = compactLandscape ? 76 : 92;
    const tileX = width / 2 - tileW / 2;
    const tileY = Math.max(24, height / 2 - tileH / 2 - 18);
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,20,0.88)';
    ctx.fillRect(tileX, tileY, tileW, tileH);
    ctx.strokeStyle = 'rgba(255,225,106,0.5)';
    ctx.strokeRect(tileX, tileY, tileW, tileH);
    ctx.fillStyle = 'rgba(255,225,106,0.92)';
    ctx.fillRect(tileX, tileY, 4, tileH);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fbff';
    ctx.font = portrait || compactLandscape ? 'bold 30px Arial' : 'bold 38px Arial';
    ctx.fillText('RTG Studio', width / 2, tileY + tileH / 2);
    ctx.fillStyle = 'rgba(198,220,245,0.86)';
    ctx.font = portrait || compactLandscape ? '14px Arial' : '16px Arial';
    ctx.fillText('Loading...', width / 2, tileY + tileH + 28);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  setMainMenuReady(ready) {
    this.mainMenuReady = Boolean(ready);
    if (!this.mainMenuReady) {
      this.menuBounds.clear();
      this.debugRestartBounds = null;
    }
  }

  drawMenuPanel(ctx, layout, count, title = '') {
    const pad = layout.portrait ? 12 : 14;
    const listHeight = count * layout.buttonHeight + Math.max(0, count - 1) * layout.gap;
    const panelX = layout.buttonX - pad;
    const panelY = layout.startY - pad - (title ? 22 : 0);
    const panelW = layout.buttonWidth + pad * 2;
    const panelH = listHeight + pad * 2 + (title ? 22 : 0);
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,20,0.74)';
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.strokeRect(panelX, panelY, panelW, panelH);
    ctx.fillStyle = 'rgba(255,225,106,0.62)';
    ctx.fillRect(panelX, panelY, 3, panelH);
    if (title) {
      ctx.fillStyle = 'rgba(198,220,245,0.78)';
      ctx.font = layout.portrait ? '11px Arial' : '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(title, panelX + pad, panelY + 15);
    }
    ctx.restore();
  }

  drawMenuButton(ctx, bounds, label, { selected = false, active = false, danger = false } = {}) {
    ctx.save();
    ctx.fillStyle = selected
      ? (danger ? 'rgba(176,72,72,0.46)' : 'rgba(46,86,132,0.72)')
      : (danger ? 'rgba(118,42,42,0.35)' : 'rgba(18,28,42,0.82)');
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = selected
      ? (danger ? 'rgba(255,160,150,0.25)' : 'rgba(255,225,106,0.22)')
      : 'rgba(255,255,255,0.045)';
    ctx.fillRect(bounds.x, bounds.y, bounds.w, Math.max(1, Math.floor(bounds.h / 2)));
    ctx.fillStyle = active
      ? '#ffe16a'
      : danger
        ? 'rgba(255,140,140,0.82)'
        : selected
          ? '#ffe16a'
          : 'rgba(111,171,231,0.72)';
    ctx.fillRect(bounds.x, bounds.y, 4, bounds.h);
    ctx.strokeStyle = active ? '#ffe16a' : danger ? 'rgba(255,140,140,0.9)' : 'rgba(190,215,245,0.36)';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = selected ? '#ffffff' : 'rgba(238,245,255,0.9)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bounds.x + 18, bounds.y + bounds.h / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = active ? '#ffe16a' : 'rgba(198,220,245,0.58)';
    ctx.fillText(selected ? '>' : '', bounds.x + bounds.w - 16, bounds.y + bounds.h / 2);
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  update(dt) {
    this.timer += dt;
    if (this.transition) {
      this.transition.progress += dt / this.transition.duration;
      if (this.transition.progress >= 1) {
        this.transition = null;
      }
    }
  }

  draw(ctx, width, height, inputMode, inputHints = {}) {
    ctx.save();
    if (Object.prototype.hasOwnProperty.call(inputHints || {}, 'mainMenuReady')) {
      this.setMainMenuReady(inputHints.mainMenuReady);
    }
    this.drawBackdrop(ctx, width, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 2;

    this.drawBrand(ctx, width, height);

    if (this.transition) {
      const t = Math.min(1, this.transition.progress);
      this.drawScreen(ctx, width, height, this.transition.from, inputMode, inputHints, 1 - t, (t - 1) * 24);
      this.drawScreen(ctx, width, height, this.transition.to, inputMode, inputHints, t, (1 - t) * 24);
    } else {
      this.drawScreen(ctx, width, height, this.screen, inputMode, inputHints, 1, 0);
    }

    ctx.restore();
  }

  drawScreen(ctx, width, height, screen, inputMode, inputHints, alpha, offsetY) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(0, offsetY);
    if (screen === 'intro') {
      this.drawMainMenu(ctx, width, height, { showDebugRestart: Boolean(inputHints?.debugRestartEnabled) });
    } else if (this.folderOrders[screen]) {
      this.drawFolder(ctx, width, height, screen);
    } else if (screen === 'options') {
      this.drawOptions(ctx, width, height);
    } else if (screen === 'controls') {
      this.drawControls(ctx, width, height, inputMode, inputHints);
    } else if (screen === 'display') {
      this.drawDisplay(ctx, width, height, inputHints);
    } else {
      this.drawMainMenu(ctx, width, height, { showDebugRestart: Boolean(inputHints?.debugRestartEnabled) });
    }
    ctx.restore();
  }

  drawMainMenu(ctx, width, height, options = {}) {
    const layout = this.getScreenLayout(width, height, {
      screen: 'main',
      count: this.menuOrder.length,
      preferredWidth: 360,
      defaultStartY: 240,
      defaultGap: 48
    });
    if (!this.mainMenuReady) {
      this.menuBounds.clear();
      this.debugRestartBounds = null;
      this.drawLoadingSplash(ctx, width, height);
      return;
    }

    this.drawMenuPanel(ctx, layout, this.menuOrder.length, 'Launcher');

    this.menuBounds.clear();
    this.menuOrder.forEach((action, index) => {
      const y = layout.startY + index * (layout.buttonHeight + layout.gap);
      const selected = this.menuOrder[this.menuSelection] === action;
      const label = action === 'recent-level'
        ? 'Play'
        : action === 'graphics'
          ? 'Graphics'
          : action === 'audio'
            ? 'Audio'
            : action === 'game'
              ? 'Game'
              : 'Options';
      const bounds = { x: layout.buttonX, y, w: layout.buttonWidth, h: layout.buttonHeight };
      ctx.font = layout.labelFont;
      this.drawMenuButton(ctx, bounds, label, { selected });
      this.menuBounds.set(action, bounds);
    });

    this.debugRestartBounds = null;
    if (options.showDebugRestart) {
      const restartBounds = { x: 18, y: height - 44, w: 140, h: 26 };
      this.debugRestartBounds = restartBounds;
      ctx.fillStyle = 'rgba(255,170,90,0.18)';
      ctx.fillRect(restartBounds.x, restartBounds.y, restartBounds.w, restartBounds.h);
      ctx.strokeStyle = 'rgba(255,170,90,0.95)';
      ctx.strokeRect(restartBounds.x, restartBounds.y, restartBounds.w, restartBounds.h);
      ctx.fillStyle = '#ffd5ad';
      ctx.font = '14px Courier New';
      ctx.fillText('Restart/Pull', restartBounds.x + restartBounds.w / 2, restartBounds.y + 17);
    }

  }


  drawFolder(ctx, width, height, folder) {
    const order = this.folderOrders[folder] || ['back'];
    const titles = {
      graphics: ['Graphics', 'Pixel art & scenes'],
      audio: ['Audio', 'Music & sound design'],
      game: ['Game', 'Levels & actors']
    };
    const layout = this.getScreenLayout(width, height, {
      screen: folder,
      count: order.length,
      preferredWidth: 360,
      defaultStartY: 245,
      defaultGap: 42
    });
    this.drawTitleText(ctx, width, titles[folder]?.[0] || 'Tools', layout, titles[folder]?.[1] || '');
    this.drawMenuPanel(ctx, layout, order.length, 'Folder');

    const boundsMap = this.folderBounds[folder] || new Map();
    boundsMap.clear();
    order.forEach((action, index) => {
      const y = layout.startY + index * (layout.buttonHeight + layout.gap);
      const selected = order[this.folderSelections[folder] || 0] === action;
      const label = action === 'level-editor'
        ? 'Level Editor'
        : action === 'tile-editor'
          ? 'Tile Editor'
          : action === 'race-editor'
            ? 'Race Editor'
            : action === 'car-editor'
              ? 'Car Editor'
              : action === 'pixel-editor'
                ? 'Pixel Editor'
                : action === 'actor-editor'
                  ? 'Actor Editor'
                  : action === 'midi-editor'
                    ? 'MIDI Editor'
                    : action === 'sfx-editor'
                      ? 'SFX Editor'
                      : action === 'cutscene-editor'
                        ? 'Cutscene Editor'
                        : 'Back';
      const bounds = { x: layout.buttonX, y, w: layout.buttonWidth, h: layout.buttonHeight };
      ctx.font = layout.labelFont;
      this.drawMenuButton(ctx, bounds, label, { selected });
      boundsMap.set(action, bounds);
    });
    this.folderBounds[folder] = boundsMap;
  }

  drawOptions(ctx, width, height) {
    const layout = this.getScreenLayout(width, height, {
      screen: 'options',
      count: this.optionsOrder.length,
      preferredWidth: 360,
      defaultStartY: 250,
      defaultGap: 46
    });
    this.drawTitleText(ctx, width, 'Options', layout, 'Studio settings');
    this.drawMenuPanel(ctx, layout, this.optionsOrder.length, 'Options');

    this.optionsBounds.clear();
    this.optionsOrder.forEach((action, index) => {
      const y = layout.startY + index * (layout.buttonHeight + layout.gap);
      const selected = this.optionsOrder[this.optionsSelection] === action;
      const label = action === 'latest-changes'
        ? 'Latest Changes'
        : action === 'robtersession'
          ? 'Songs'
          : action === 'controls'
            ? 'Controls'
            : action === 'display'
              ? 'Display'
              : 'Back';
      const bounds = { x: layout.buttonX, y, w: layout.buttonWidth, h: layout.buttonHeight };
      ctx.font = layout.labelFont;
      this.drawMenuButton(ctx, bounds, label, { selected });
      this.optionsBounds.set(action, bounds);
    });
  }

  drawControls(ctx, width, height, inputMode, inputHints = {}) {
    const layout = this.getScreenLayout(width, height, {
      screen: 'controls',
      count: this.controlsOrder.length,
      preferredWidth: 360,
      defaultStartY: 250,
      defaultGap: 46
    });
    this.drawTitleText(ctx, width, 'Controls', layout, 'Input mode');
    this.drawMenuPanel(ctx, layout, this.controlsOrder.length, 'Controls');

    this.controlsBounds.clear();
    this.controlsOrder.forEach((action, index) => {
      const y = layout.startY + index * (layout.buttonHeight + layout.gap);
      const selected = this.controlsOrder[this.controlsSelection] === action;
      const active = inputMode === action;
      const label = action === 'mobile'
        ? 'Mobile Touch'
        : action === 'gamepad'
          ? 'Controller / Gamepad'
          : action === 'keyboard'
            ? 'Keyboard'
            : 'Back';
      const bounds = { x: layout.buttonX, y, w: layout.buttonWidth, h: layout.buttonHeight };
      ctx.font = layout.labelFont;
      this.drawMenuButton(ctx, bounds, label, { selected, active });
      this.controlsBounds.set(action, bounds);
    });
  }

  drawDisplay(ctx, width, height, inputHints = {}) {
    const layout = this.getScreenLayout(width, height, {
      screen: 'display',
      count: this.displayOrder.length,
      preferredWidth: 360,
      defaultStartY: 250,
      defaultGap: 46
    });
    this.drawTitleText(ctx, width, 'Display', layout, 'Visual mode');
    this.drawMenuPanel(ctx, layout, this.displayOrder.length, 'Display');

    this.displayBounds.clear();
    this.displayOrder.forEach((action, index) => {
      const y = layout.startY + index * (layout.buttonHeight + layout.gap);
      const selected = this.displayOrder[this.displaySelection] === action;
      const displayMode = inputHints?.displayMode || 'sepia';
      const displayModeForAction = getDisplayModeForAction(action);
      const active = displayModeForAction ? displayMode === displayModeForAction : false;
      const label = displayModeForAction
        ? getDisplayModeLabelForAction(action)
        : 'Back';
      const bounds = { x: layout.buttonX, y, w: layout.buttonWidth, h: layout.buttonHeight };
      ctx.font = layout.labelFont;
      this.drawMenuButton(ctx, bounds, label, { selected, active });
      this.displayBounds.set(action, bounds);
    });
  }

  moveSelection(direction) {
    if (this.screen === 'intro') {
      return;
    }
    if (this.screen === 'main' && !this.mainMenuReady) {
      return;
    }
    if (this.folderOrders[this.screen]) {
      const count = this.folderOrders[this.screen].length;
      if (!count) return;
      this.folderSelections[this.screen] = ((this.folderSelections[this.screen] || 0) + direction + count) % count;
      return;
    }
    if (this.screen === 'options') {
      const count = this.optionsOrder.length;
      if (!count) return;
      this.optionsSelection = (this.optionsSelection + direction + count) % count;
      return;
    }
    if (this.screen === 'controls') {
      const count = this.controlsOrder.length;
      if (!count) return;
      this.controlsSelection = (this.controlsSelection + direction + count) % count;
      return;
    }
    if (this.screen === 'display') {
      const count = this.displayOrder.length;
      if (!count) return;
      this.displaySelection = (this.displaySelection + direction + count) % count;
      return;
    }
    const count = this.menuOrder.length;
    if (!count) return;
    this.menuSelection = (this.menuSelection + direction + count) % count;
  }

  getSelectedAction() {
    if (this.screen === 'main' && !this.mainMenuReady) {
      return null;
    }
    if (this.folderOrders[this.screen]) {
      return this.folderOrders[this.screen][this.folderSelections[this.screen] || 0] || 'back';
    }
    if (this.screen === 'options') {
      return this.optionsOrder[this.optionsSelection] || 'back';
    }
    if (this.screen === 'controls') {
      return this.controlsOrder[this.controlsSelection] || 'back';
    }
    if (this.screen === 'display') {
      return this.displayOrder[this.displaySelection] || 'back';
    }
    return this.menuOrder[this.menuSelection] || 'recent-level';
  }

  getActionAt(x, y) {
    if (this.screen === 'intro') {
      return null;
    }
    if (this.screen === 'main' && !this.mainMenuReady) {
      return null;
    }
    if (this.folderOrders[this.screen]) {
      for (const [action, bounds] of (this.folderBounds[this.screen] || new Map()).entries()) {
        if (x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h) {
          return action;
        }
      }
      return null;
    }
    if (this.screen === 'options') {
      for (const [action, bounds] of this.optionsBounds.entries()) {
        if (x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h) {
          return action;
        }
      }
      return null;
    }
    if (this.screen === 'controls') {
      for (const [action, bounds] of this.controlsBounds.entries()) {
        if (x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h) {
          return action;
        }
      }
      return null;
    }
    if (this.screen === 'display') {
      for (const [action, bounds] of this.displayBounds.entries()) {
        if (x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h) {
          return action;
        }
      }
      return null;
    }
    for (const [action, bounds] of this.menuBounds.entries()) {
      if (x >= bounds.x && x <= bounds.x + bounds.w && y >= bounds.y && y <= bounds.y + bounds.h) {
        return action;
      }
    }
    if (this.debugRestartBounds
      && x >= this.debugRestartBounds.x
      && x <= this.debugRestartBounds.x + this.debugRestartBounds.w
      && y >= this.debugRestartBounds.y
      && y <= this.debugRestartBounds.y + this.debugRestartBounds.h) {
      return 'debug-restart';
    }
    return null;
  }

  setScreen(target) {
    if (this.screen === target) return;
    this.transition = {
      from: this.screen,
      to: target,
      progress: 0,
      duration: 0.35
    };
    this.screen = target;
    if (target === 'options') this.optionsSelection = 0;
    if (target === 'controls') this.setControlsSelectionByMode();
    if (target === 'display') this.setDisplaySelectionByMode();
    if (this.folderOrders[target]) this.folderSelections[target] = 0;
  }

  setControlsSelectionByMode(mode) {
    const index = this.controlsOrder.indexOf(mode);
    if (index >= 0) {
      this.controlsSelection = index;
    }
  }

  setDisplaySelectionByMode(mode) {
    const action = mode ? `display-${mode}` : null;
    const index = action ? this.displayOrder.indexOf(action) : -1;
    const fallback = this.displayOrder.findIndex((candidate) => getDisplayModeForAction(candidate));
    this.displaySelection = index >= 0 ? index : Math.max(0, fallback);
  }
}
