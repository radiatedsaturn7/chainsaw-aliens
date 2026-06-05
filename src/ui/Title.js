import {
  DISPLAY_MODE_OPTIONS,
  getDisplayModeForAction,
  getDisplayModeLabelForAction
} from './shared/displayModes.js';

export default class Title {
  constructor() {
    this.timer = 0;
    this.screen = 'intro';
    this.transition = null;
    this.menuOrder = ['recent-level', 'robtersession', 'storage', 'tools', 'options'];
    this.toolsOrder = [
      'project-browser',
      'level-editor',
      'pixel-editor',
      'actor-editor',
      'midi-editor',
      'sfx-editor',
      'cutscene-editor',
      'reset-all',
      'back'
    ];
    this.controlsOrder = [
      'mobile',
      'gamepad',
      'keyboard',
      ...DISPLAY_MODE_OPTIONS.map((option) => option.action),
      'back'
    ];
    this.storageOrder = ['toggle-server-storage', 'sync-server', 'sync-github', 'back'];
    this.menuSelection = 0;
    this.toolsSelection = 0;
    this.controlsSelection = 0;
    this.menuBounds = new Map();
    this.toolsBounds = new Map();
    this.controlsBounds = new Map();
    this.storageBounds = new Map();
    this.debugRestartBounds = null;
    this.explosions = [];
    this.nextExplosion = 1.4;
    this.aliens = Array.from({ length: 12 }, (_, i) => ({
      x: 120 + i * 80,
      y: -Math.random() * 400,
      speed: 20 + Math.random() * 40
    }));
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
        titleFont: shortViewport ? '19px Courier New' : '22px Courier New',
        subtitleFont: shortViewport ? '12px Courier New' : '14px Courier New',
        labelFont: shortViewport ? '15px Courier New' : dense ? '16px Courier New' : '18px Courier New'
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
      titleFont: compactLandscape ? '18px Courier New' : '22px Courier New',
      subtitleFont: compactLandscape ? '12px Courier New' : '14px Courier New',
      labelFont: compactLandscape && dense ? '14px Courier New' : '18px Courier New'
    };
  }

  drawTitleText(ctx, width, text, layout, subtitle = '') {
    ctx.fillStyle = '#fff';
    ctx.font = layout.titleFont;
    ctx.textAlign = 'center';
    ctx.fillText(text, width / 2, layout.titleY);
    if (subtitle) {
      ctx.font = layout.subtitleFont;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(subtitle, width / 2, layout.subtitleY);
    }
  }

  drawMenuButton(ctx, bounds, label, { selected = false, active = false, danger = false } = {}) {
    ctx.fillStyle = selected
      ? (danger ? 'rgba(255,120,120,0.25)' : 'rgba(255,255,255,0.3)')
      : (danger ? 'rgba(255,120,120,0.12)' : 'rgba(255,255,255,0.12)');
    ctx.fillRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.strokeStyle = active ? '#ffe16a' : danger ? 'rgba(255,140,140,0.9)' : '#fff';
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, bounds.x + bounds.w / 2, bounds.y + bounds.h / 2);
    ctx.textBaseline = 'alphabetic';
    if (selected) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(bounds.x - 14, bounds.y + bounds.h / 2);
      ctx.lineTo(bounds.x - 6, bounds.y + bounds.h / 2 - 6);
      ctx.lineTo(bounds.x - 6, bounds.y + bounds.h / 2 + 6);
      ctx.closePath();
      ctx.fill();
    }
  }

  update(dt) {
    this.timer += dt;
    if (this.transition) {
      this.transition.progress += dt / this.transition.duration;
      if (this.transition.progress >= 1) {
        this.transition = null;
      }
    }
    this.aliens.forEach((alien) => {
      alien.y += alien.speed * dt;
      if (alien.y > 500) {
        alien.y = -200;
      }
    });

    if (this.screen !== 'intro' || (this.transition && this.transition.to !== 'intro')) {
      this.nextExplosion -= dt;
      if (this.nextExplosion <= 0) {
        this.spawnExplosion();
        this.nextExplosion = 1.2 + Math.random() * 2.4;
      }
      this.explosions.forEach((explosion) => {
        explosion.age += dt;
      });
      this.explosions = this.explosions.filter((explosion) => explosion.age < explosion.duration);
    }
  }

  draw(ctx, width, height, inputMode, inputHints = {}) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    const portrait = this.isPortraitPhone(width, height);
    // Earth
    const earthX = width / 2;
    const earthY = portrait ? height * 0.34 : height / 2 + 120;
    const earthRadius = portrait ? Math.max(72, Math.min(108, width * 0.23)) : 120;
    const oceanGradient = ctx.createRadialGradient(
      earthX - 40,
      earthY - 60,
      30,
      earthX,
      earthY,
      earthRadius + 10
    );
    oceanGradient.addColorStop(0, '#2d8de6');
    oceanGradient.addColorStop(0.6, '#0b4fa3');
    oceanGradient.addColorStop(1, '#032a5c');
    ctx.fillStyle = oceanGradient;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2fb26a';
    ctx.beginPath();
    ctx.moveTo(earthX - 60, earthY - 30);
    ctx.bezierCurveTo(earthX - 90, earthY - 80, earthX - 30, earthY - 90, earthX - 10, earthY - 60);
    ctx.bezierCurveTo(earthX + 10, earthY - 40, earthX - 20, earthY - 10, earthX - 55, earthY);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(earthX + 20, earthY - 10);
    ctx.bezierCurveTo(earthX + 60, earthY - 40, earthX + 90, earthY - 10, earthX + 70, earthY + 20);
    ctx.bezierCurveTo(earthX + 50, earthY + 40, earthX + 10, earthY + 30, earthX + 5, earthY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(earthX - 30, earthY - 70, 42, 12, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(earthX + 50, earthY + 10, 48, 14, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(155,205,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthRadius + 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;

    this.aliens.forEach((alien) => {
      ctx.save();
      ctx.translate(alien.x, alien.y + 80 + Math.sin(this.timer + alien.x) * 4);
      ctx.strokeStyle = '#ff6b6b';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.ellipse(0, 6, 18, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 5, 0, Math.PI, 0, true);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(-10, 8);
      ctx.lineTo(10, 8);
      ctx.stroke();
      ctx.restore();
    });

    if (this.screen !== 'intro' || (this.transition && this.transition.to !== 'intro')) {
      this.drawExplosions(ctx, earthX, earthY, earthRadius);
    }

    const compactLandscape = !portrait && height <= 430;
    ctx.font = portrait
      ? 'bold 34px Courier New'
      : compactLandscape
        ? 'bold 30px Courier New'
        : 'bold 48px Courier New';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('Chainsaw Aliens', width / 2, portrait ? 82 : compactLandscape ? 46 : 120);

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
      this.drawIntro(ctx, width, height, inputHints);
    } else if (screen === 'tools') {
      this.drawTools(ctx, width, height);
    } else if (screen === 'controls') {
      this.drawControls(ctx, width, height, inputMode, inputHints);
    } else if (screen === 'storage') {
      this.drawStorage(ctx, width, height, inputHints);
    } else {
      this.drawMainMenu(ctx, width, height, { showDebugRestart: Boolean(inputHints?.debugRestartEnabled) });
    }
    ctx.restore();
  }

  drawIntro(ctx, width, height, { isMobile = false, gamepadConnected = false } = {}) {
    ctx.fillStyle = '#fff';
    ctx.font = this.isPortraitPhone(width, height) ? '22px Courier New' : '20px Courier New';
    ctx.textAlign = 'center';
    const pulse = Math.sin(this.timer * 4) * 6;
    const message = gamepadConnected
      ? 'Press START to Begin'
      : isMobile
        ? 'Tap to Begin'
        : 'Press SPACE to Begin';
    ctx.fillText(message, width / 2, height - 140 + pulse);
  }

  drawMainMenu(ctx, width, height, options = {}) {
    const layout = this.getScreenLayout(width, height, {
      screen: 'main',
      count: this.menuOrder.length,
      preferredWidth: 360,
      defaultStartY: 240,
      defaultGap: 48
    });
    this.drawTitleText(ctx, width, 'Main Menu', layout);

    this.menuBounds.clear();
    this.menuOrder.forEach((action, index) => {
      const y = layout.startY + index * (layout.buttonHeight + layout.gap);
      const selected = this.menuOrder[this.menuSelection] === action;
      const label = action === 'recent-level'
        ? 'Recent Level'
        : action === 'robtersession'
          ? 'Songs'
          : action === 'storage'
            ? 'Server Storage'
            : action === 'tools'
              ? 'Tools'
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


  drawStorage(ctx, width, height, inputHints = {}) {
    const layout = this.getScreenLayout(width, height, {
      screen: 'storage',
      count: this.storageOrder.length,
      preferredWidth: 420,
      defaultStartY: 245,
      defaultGap: 42
    });
    this.drawTitleText(ctx, width, 'Server Storage', layout, 'Persist projects on server + GitHub sync');

    this.storageBounds.clear();
    this.storageOrder.forEach((action, index) => {
      const y = layout.startY + index * (layout.buttonHeight + layout.gap);
      const selected = this.storageOrder[this.controlsSelection] === action;
      const enabled = Boolean(inputHints?.serverStorageEnabled);
      const label = action === 'toggle-server-storage'
        ? `Server Storage: ${enabled ? 'ON' : 'OFF'}`
        : action === 'sync-server'
          ? 'Sync Snapshot to Server'
          : action === 'sync-github'
            ? 'Sync Snapshot to GitHub'
            : 'Back';
      const bounds = { x: layout.buttonX, y, w: layout.buttonWidth, h: layout.buttonHeight };
      ctx.font = layout.labelFont;
      this.drawMenuButton(ctx, bounds, label, { selected });
      this.storageBounds.set(action, bounds);
    });
  }

  drawTools(ctx, width, height) {
    const layout = this.getScreenLayout(width, height, {
      screen: 'tools',
      count: this.toolsOrder.length,
      preferredWidth: 360,
      defaultStartY: 245,
      defaultGap: 42
    });
    this.drawTitleText(ctx, width, 'Tools', layout, 'Editors & Reset');

    this.toolsBounds.clear();
    this.toolsOrder.forEach((action, index) => {
      const y = layout.startY + index * (layout.buttonHeight + layout.gap);
      const selected = this.toolsOrder[this.toolsSelection] === action;
      const isReset = action === 'reset-all';
      const label = action === 'level-editor'
        ? 'Level Editor'
        : action === 'project-browser'
          ? 'Project Browser'
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
              : action === 'reset-all'
                ? 'Reset All'
                : 'Back';
      const bounds = { x: layout.buttonX, y, w: layout.buttonWidth, h: layout.buttonHeight };
      ctx.font = layout.labelFont;
      this.drawMenuButton(ctx, bounds, label, { selected, danger: isReset });
      this.toolsBounds.set(action, bounds);
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
    this.drawTitleText(ctx, width, 'Options', layout, 'Controls & display');

    this.controlsBounds.clear();
    this.controlsOrder.forEach((action, index) => {
      const y = layout.startY + index * (layout.buttonHeight + layout.gap);
      const selected = this.controlsOrder[this.controlsSelection] === action;
      const displayMode = inputHints?.displayMode || 'sepia';
      const displayModeForAction = getDisplayModeForAction(action);
      const active = displayModeForAction ? displayMode === displayModeForAction : inputMode === action;
      const label = action === 'mobile'
        ? 'Mobile Touch'
        : action === 'gamepad'
          ? 'Controller / Gamepad'
          : action === 'keyboard'
            ? 'Keyboard'
            : displayModeForAction
              ? getDisplayModeLabelForAction(action)
              : 'Back';
      const bounds = { x: layout.buttonX, y, w: layout.buttonWidth, h: layout.buttonHeight };
      ctx.font = layout.labelFont;
      this.drawMenuButton(ctx, bounds, label, { selected, active });
      this.controlsBounds.set(action, bounds);
    });
  }

  spawnExplosion() {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.8 + 0.1;
    this.explosions.push({
      angle,
      radius,
      age: 0,
      duration: 0.8 + Math.random() * 0.6
    });
  }

  drawExplosions(ctx, earthX, earthY, earthRadius) {
    this.explosions.forEach((explosion) => {
      const progress = explosion.age / explosion.duration;
      const pulse = Math.sin(progress * Math.PI);
      const sparkRadius = earthRadius * explosion.radius;
      const x = earthX + Math.cos(explosion.angle) * sparkRadius;
      const y = earthY + Math.sin(explosion.angle) * sparkRadius;
      const size = 6 + pulse * 10;
      ctx.save();
      ctx.globalAlpha = 0.8 * (1 - progress);
      ctx.fillStyle = '#ffcc6a';
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.arc(x, y, size * 1.3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  moveSelection(direction) {
    if (this.screen === 'intro') {
      return;
    }
    if (this.screen === 'tools') {
      const count = this.toolsOrder.length;
      if (!count) return;
      this.toolsSelection = (this.toolsSelection + direction + count) % count;
      return;
    }
    if (this.screen === 'controls' || this.screen === 'storage') {
      const count = this.screen === 'controls' ? this.controlsOrder.length : this.storageOrder.length;
      if (!count) return;
      this.controlsSelection = (this.controlsSelection + direction + count) % count;
      return;
    }
    const count = this.menuOrder.length;
    if (!count) return;
    this.menuSelection = (this.menuSelection + direction + count) % count;
  }

  getSelectedAction() {
    if (this.screen === 'tools') {
      return this.toolsOrder[this.toolsSelection] || 'back';
    }
    if (this.screen === 'controls') {
      return this.controlsOrder[this.controlsSelection] || 'back';
    }
    if (this.screen === 'storage') {
      return this.storageOrder[this.controlsSelection] || 'back';
    }
    return this.menuOrder[this.menuSelection] || 'recent-level';
  }

  getActionAt(x, y) {
    if (this.screen === 'intro') {
      return null;
    }
    if (this.screen === 'tools') {
      for (const [action, bounds] of this.toolsBounds.entries()) {
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
    if (this.screen === 'storage') {
      for (const [action, bounds] of this.storageBounds.entries()) {
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
    if (target === 'controls') this.setControlsSelectionByMode();
    if (target === 'tools') this.toolsSelection = 0;
    if (target === 'storage') this.controlsSelection = 0;
  }

  setControlsSelectionByMode(mode) {
    const index = this.controlsOrder.indexOf(mode);
    if (index >= 0) {
      this.controlsSelection = index;
    }
  }
}
