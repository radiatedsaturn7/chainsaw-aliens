const STATUS_COLORS = {
  pass: '#fff',
  fail: 'rgba(255,255,255,0.6)',
  pending: 'rgba(255,255,255,0.8)',
  idle: 'rgba(255,255,255,0.8)',
  running: '#fff'
};

export default class TestDashboard {
  constructor() {
    this.results = {
      validity: 'pending',
      coverage: 'pending',
      encounter: 'pending',
      golden: 'idle'
    };
    this.lines = [];
    this.hardFail = false;
    this.visible = true;
  }

  setResults(results) {
    this.results = { ...this.results, ...results };
  }

  setLines(lines) {
    this.lines = lines || [];
  }

  setHardFail(value) {
    this.hardFail = value;
  }

  toggle() {
    this.visible = !this.visible;
  }

  draw(ctx, width, height) {
    if (!this.visible) return;
    const padding = 12;
    const boxWidth = 260;
    const boxHeight = 120;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(padding, padding, boxWidth, boxHeight);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(padding, padding, boxWidth, boxHeight);
    ctx.fillStyle = '#fff';
    ctx.font = '12px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText('TEST DASHBOARD', padding + 12, padding + 20);

    const entries = [
      ['World Validity', this.results.validity],
      ['Room Coverage', this.results.coverage],
      ['Encounter Audit', this.results.encounter],
      ['Golden Path', this.results.golden]
    ];
    entries.forEach((entry, index) => {
      const [label, status] = entry;
      ctx.fillStyle = STATUS_COLORS[status] || '#fff';
      ctx.fillText(`${label}: ${status.toUpperCase()}`, padding + 12, padding + 40 + index * 16);
    });

    if (this.hardFail) {
      ctx.fillStyle = '#fff';
      ctx.fillText('AUTO-REPAIR FAILED', padding + 12, padding + 108);
    }
    ctx.restore();
  }
}
