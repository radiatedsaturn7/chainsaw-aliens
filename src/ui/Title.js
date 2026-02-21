export default class Title {
  constructor() {
    this.timer = 0;
    this.screen = 'intro';
    this.transition = null;
    this.menuOrder = ['campaign', 'robtersession', 'tools', 'options'];
    this.toolsOrder = [
      'project-browser',
      'level-editor',
      'pixel-editor',
      'midi-editor',
      'reset-all',
      'back'
    ];
    this.controlsOrder = ['mobile', 'gamepad', 'keyboard', 'back'];
    this.menuSelection = 0;
    this.toolsSelection = 0;
    this.controlsSelection = 0;
    this.menuBounds = new Map();
    this.toolsBounds = new Map();
    this.controlsBounds = new Map();
    this.debugRestartBounds = null;
    this.explosions = [];
    this.nextExplosion = 1.4;
    this.aliens = Array.from({ length: 12 }, (_, i) => ({
      x: 120 + i * 80,
      y: -Math.random() * 400,
      speed: 20 + Math.random() * 40
    }));
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

    // Earth
    const earthX = width / 2;
    const earthY = height / 2 + 120;
    const earthRadius = 120;
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

    ctx.font = 'bold 48px Courier New';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText('Chainsaw Aliens', width / 2, 120);

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
      this.drawControls(ctx, width, height, inputMode);
    } else {
      this.drawMainMenu(ctx, width, height, { showDebugRestart: Boolean(inputHints?.debugRestartEnabled) });
    }
    ctx.restore();
  }

  drawIntro(ctx, width, height, { isMobile = false, gamepadConnected = false } = {}) {
    ctx.fillStyle = '#fff';
    ctx.font = '20px Courier New';
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
    ctx.fillStyle = '#fff';
    ctx.font = '22px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Main Menu', width / 2, 180);

    const buttonWidth = 320;
    const buttonHeight = 34;
    const buttonX = width / 2 - buttonWidth / 2;
    const startY = 240;
    const gap = 48;

    this.menuBounds.clear();
    this.menuOrder.forEach((action, index) => {
      const y = startY + index * gap;
      const selected = this.menuOrder[this.menuSelection] === action;
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(buttonX, y, buttonWidth, buttonHeight);
      ctx.strokeStyle = '#fff';
      ctx.strokeRect(buttonX, y, buttonWidth, buttonHeight);
      ctx.fillStyle = '#fff';
      ctx.font = '18px Courier New';
      const label = action === 'campaign'
        ? 'Campaign'
        : action === 'robtersession'
          ? 'Songs'
        : action === 'tools'
            ? 'Tools'
            : 'Options';
      ctx.fillText(label, width / 2, y + 22);
      if (selected) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(buttonX - 14, y + buttonHeight / 2);
        ctx.lineTo(buttonX - 6, y + buttonHeight / 2 - 6);
        ctx.lineTo(buttonX - 6, y + buttonHeight / 2 + 6);
        ctx.closePath();
        ctx.fill();
      }
      this.menuBounds.set(action, { x: buttonX, y, w: buttonWidth, h: buttonHeight });
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

  drawTools(ctx, width, height) {
    ctx.fillStyle = '#fff';
    ctx.font = '22px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Tools', width / 2, 180);
    ctx.font = '14px Courier New';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Editors & Reset', width / 2, 206);

    const buttonWidth = 360;
    const buttonHeight = 34;
    const buttonX = width / 2 - buttonWidth / 2;
    const startY = 245;
    const gap = 42;

    this.toolsBounds.clear();
    this.toolsOrder.forEach((action, index) => {
      const y = startY + index * gap;
      const selected = this.toolsOrder[this.toolsSelection] === action;
      const isReset = action === 'reset-all';
      ctx.fillStyle = selected
        ? (isReset ? 'rgba(255,120,120,0.25)' : 'rgba(255,255,255,0.3)')
        : (isReset ? 'rgba(255,120,120,0.12)' : 'rgba(255,255,255,0.12)');
      ctx.fillRect(buttonX, y, buttonWidth, buttonHeight);
      ctx.strokeStyle = isReset ? 'rgba(255,140,140,0.9)' : '#fff';
      ctx.strokeRect(buttonX, y, buttonWidth, buttonHeight);
      ctx.fillStyle = '#fff';
      ctx.font = '18px Courier New';
      const label = action === 'level-editor'
        ? 'Level Editor'
        : action === 'project-browser'
          ? 'Project Browser'
          : action === 'pixel-editor'
            ? 'Pixel Editor'
            : action === 'midi-editor'
              ? 'MIDI Editor'
              : action === 'reset-all'
                ? 'Reset All'
                : 'Back';
      ctx.fillText(label, width / 2, y + 22);
      if (selected) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(buttonX - 14, y + buttonHeight / 2);
        ctx.lineTo(buttonX - 6, y + buttonHeight / 2 - 6);
        ctx.lineTo(buttonX - 6, y + buttonHeight / 2 + 6);
        ctx.closePath();
        ctx.fill();
      }
      this.toolsBounds.set(action, { x: buttonX, y, w: buttonWidth, h: buttonHeight });
    });
  }

  drawControls(ctx, width, height, inputMode) {
    ctx.fillStyle = '#fff';
    ctx.font = '22px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Controls', width / 2, 180);
    ctx.font = '14px Courier New';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Select an input mode', width / 2, 206);

    const buttonWidth = 360;
    const buttonHeight = 34;
    const buttonX = width / 2 - buttonWidth / 2;
    const startY = 250;
    const gap = 46;

    this.controlsBounds.clear();
    this.controlsOrder.forEach((action, index) => {
      const y = startY + index * gap;
      const selected = this.controlsOrder[this.controlsSelection] === action;
      const active = inputMode === action;
      ctx.fillStyle = selected ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(buttonX, y, buttonWidth, buttonHeight);
      ctx.strokeStyle = active ? '#ffe16a' : '#fff';
      ctx.strokeRect(buttonX, y, buttonWidth, buttonHeight);
      ctx.fillStyle = '#fff';
      ctx.font = '18px Courier New';
      const label = action === 'mobile'
        ? 'Mobile Touch'
        : action === 'gamepad'
          ? 'Controller / Gamepad'
          : action === 'keyboard'
            ? 'Keyboard'
            : 'Back';
      ctx.fillText(label, width / 2, y + 22);
      if (active && action !== 'back') {
        ctx.font = '12px Courier New';
        ctx.fillStyle = '#ffe16a';
        ctx.fillText('Active', width / 2, y + 40);
      }
      if (selected) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(buttonX - 14, y + buttonHeight / 2);
        ctx.lineTo(buttonX - 6, y + buttonHeight / 2 - 6);
        ctx.lineTo(buttonX - 6, y + buttonHeight / 2 + 6);
        ctx.closePath();
        ctx.fill();
      }
      this.controlsBounds.set(action, { x: buttonX, y, w: buttonWidth, h: buttonHeight });
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
    if (this.screen === 'controls') {
      const count = this.controlsOrder.length;
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
    return this.menuOrder[this.menuSelection] || 'campaign';
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
  }

  setControlsSelectionByMode(mode) {
    const index = this.controlsOrder.indexOf(mode);
    if (index >= 0) {
      this.controlsSelection = index;
    }
  }
}
