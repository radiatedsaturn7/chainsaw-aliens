const STATUS_COLORS = {
  pass: '#fff',
  fail: 'rgba(255,255,255,0.6)',
  pending: 'rgba(255,255,255,0.8)',
  idle: 'rgba(255,255,255,0.8)',
  running: '#fff'
};

const TEST_ENTRIES = [
  { id: 'validity', label: 'World Validity' },
  { id: 'coverage', label: 'Room Coverage' },
  { id: 'encounter', label: 'Encounter Audit' },
  { id: 'golden', label: 'Golden Path' }
];

export default class TestDashboard {
  constructor() {
    this.results = {
      validity: 'idle',
      coverage: 'idle',
      encounter: 'idle',
      golden: 'idle'
    };
    this.details = {
      validity: [],
      coverage: [],
      encounter: [],
      golden: []
    };
    this.visible = false;
    this.applyFixes = false;
    this.selectedIndex = 0;
    this.notice = '';
    this.hitAreas = new Map();
  }

  open() {
    this.visible = true;
  }

  close() {
    this.visible = false;
  }

  toggle() {
    this.visible = !this.visible;
  }

  setResults(results) {
    this.results = { ...this.results, ...results };
    this.publishReport();
  }

  setDetails(testId, lines) {
    if (!this.details[testId]) return;
    this.details[testId] = lines || [];
    this.publishReport();
  }

  setNotice(message) {
    this.notice = message || '';
    this.publishReport();
  }

  clearNotice() {
    this.notice = '';
  }

  setApplyFixes(value) {
    this.applyFixes = Boolean(value);
    this.publishReport();
  }

  publishReport() {
    if (typeof window === 'undefined') return;
    window.__testReport = {
      results: this.results,
      details: this.details,
      applyFixes: this.applyFixes,
      timestamp: Date.now()
    };
  }

  selectedTestId() {
    return TEST_ENTRIES[this.selectedIndex]?.id || 'validity';
  }

  handleInput(input) {
    if (!this.visible) return null;
    if (input.wasPressed('up')) {
      this.selectedIndex = (this.selectedIndex - 1 + TEST_ENTRIES.length) % TEST_ENTRIES.length;
      return null;
    }
    if (input.wasPressed('down')) {
      this.selectedIndex = (this.selectedIndex + 1) % TEST_ENTRIES.length;
      return null;
    }
    if (input.wasPressed('interact') || input.wasPressedCode('Enter')) {
      return { type: 'run', test: this.selectedTestId() };
    }
    if (input.wasPressedCode('Digit1')) return { type: 'run', test: 'validity' };
    if (input.wasPressedCode('Digit2')) return { type: 'run', test: 'coverage' };
    if (input.wasPressedCode('Digit3')) return { type: 'run', test: 'encounter' };
    if (input.wasPressedCode('Digit4')) return { type: 'run', test: 'golden' };
    if (input.wasPressedCode('KeyR')) return { type: 'runAll' };
    if (input.wasPressedCode('KeyF')) return { type: 'toggleFixes' };
    if (input.wasPressedCode('Escape') || input.wasPressed('pause') || input.wasPressed('test')) {
      return { type: 'close' };
    }
    return null;
  }

  handleClick(x, y) {
    if (!this.visible) return null;
    for (const [id, rect] of this.hitAreas.entries()) {
      if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
        if (id.startsWith('test-')) {
          const test = id.replace('test-', '');
          const index = TEST_ENTRIES.findIndex((entry) => entry.id === test);
          this.selectedIndex = index >= 0 ? index : 0;
          return { type: 'run', test };
        }
        if (id === 'run-all') return { type: 'runAll' };
        if (id === 'toggle-fixes') return { type: 'toggleFixes' };
        if (id === 'close') return { type: 'close' };
      }
    }
    return null;
  }

  draw(ctx, width, height) {
    if (!this.visible) return;
    const boxWidth = 620;
    const boxHeight = 420;
    const x = width / 2 - boxWidth / 2;
    const y = height / 2 - boxHeight / 2;
    this.hitAreas.clear();

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, boxWidth, boxHeight);

    ctx.fillStyle = '#fff';
    ctx.font = '16px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('TEST DASHBOARD', x + 20, y + 30);

    ctx.font = '12px Courier New';
    ctx.fillText('1-4: Run test  •  R: Run all  •  F: Toggle Apply Fixes  •  Esc: Close', x + 20, y + 52);

    const modeLabel = this.applyFixes ? 'Apply Fixes: ON (writes repairs.json)' : 'Dry Run: report only';
    ctx.fillText(modeLabel, x + 20, y + 72);

    const listX = x + 20;
    const listY = y + 100;
    const rowHeight = 22;
    TEST_ENTRIES.forEach((entry, index) => {
      const status = this.results[entry.id] || 'idle';
      const rowY = listY + index * rowHeight;
      if (index === this.selectedIndex) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(listX - 6, rowY - 14, 250, 18);
      }
      ctx.fillStyle = STATUS_COLORS[status] || '#fff';
      ctx.fillText(`${entry.label}: ${status.toUpperCase()}`, listX, rowY);
      this.hitAreas.set(`test-${entry.id}`, { x: listX - 6, y: rowY - 16, w: 260, h: 20 });
    });

    const detailX = x + 300;
    const detailY = y + 100;
    ctx.fillStyle = '#fff';
    ctx.fillText('Diagnostics', detailX, detailY - 16);
    const activeId = this.selectedTestId();
    const lines = this.details[activeId] || [];
    if (lines.length === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText('No diagnostics yet.', detailX, detailY + 6);
    } else {
      ctx.fillStyle = '#fff';
      lines.slice(0, 10).forEach((line, idx) => {
        ctx.fillText(line, detailX, detailY + idx * 16);
      });
    }

    if (this.notice) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(this.notice, x + 20, y + boxHeight - 32);
    }

    const buttonY = y + boxHeight - 60;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x + 20, buttonY, 140, 28);
    ctx.fillRect(x + 180, buttonY, 180, 28);
    ctx.fillRect(x + 380, buttonY, 120, 28);

    ctx.fillStyle = '#fff';
    ctx.fillText('RUN ALL', x + 56, buttonY + 18);
    ctx.fillText('TOGGLE FIXES', x + 196, buttonY + 18);
    ctx.fillText('CLOSE', x + 410, buttonY + 18);

    this.hitAreas.set('run-all', { x: x + 20, y: buttonY, w: 140, h: 28 });
    this.hitAreas.set('toggle-fixes', { x: x + 180, y: buttonY, w: 180, h: 28 });
    this.hitAreas.set('close', { x: x + 380, y: buttonY, w: 120, h: 28 });

    ctx.restore();
  }
}
