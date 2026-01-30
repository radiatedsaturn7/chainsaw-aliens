const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class InstrumentSelectView {
  constructor() {
    this.bounds = { items: [], actions: [] };
    this.actions = ['Play', 'Listen', 'Download Zip', 'Back'];
  }

  draw(ctx, width, height, {
    stems = [],
    selectedStemIndex = 0,
    selectedActionIndex = 0,
    songTitle = '',
    status = ''
  } = {}) {
    ctx.save();
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Select Instrument', width / 2, 70);
    ctx.font = '16px Courier New';
    ctx.fillStyle = 'rgba(215,242,255,0.9)';
    ctx.fillText(songTitle, width / 2, 100);

    this.bounds.items = [];
    const listWidth = 520;
    const cardHeight = 50;
    const startY = 140;
    const gap = 10;
    const x = width / 2 - listWidth / 2;

    stems.forEach((stem, index) => {
      const y = startY + index * (cardHeight + gap);
      const isSelected = index === selectedStemIndex;
      ctx.fillStyle = isSelected ? 'rgba(120,200,255,0.85)' : 'rgba(20,30,40,0.7)';
      ctx.fillRect(x, y, listWidth, cardHeight);
      ctx.strokeStyle = isSelected ? '#ffe16a' : 'rgba(140,200,255,0.4)';
      ctx.lineWidth = isSelected ? 2.5 : 2;
      ctx.strokeRect(x, y, listWidth, cardHeight);
      ctx.fillStyle = isSelected ? '#041019' : '#d7f2ff';
      ctx.font = 'bold 16px Courier New';
      ctx.textAlign = 'left';
      ctx.fillText(stem.label, x + 16, y + 30);
      ctx.textAlign = 'right';
      ctx.font = '12px Courier New';
      ctx.fillStyle = isSelected ? '#041019' : 'rgba(215,242,255,0.9)';
      ctx.fillText(stem.difficultyLabel || '...', x + listWidth - 16, y + 30);
      this.bounds.items.push({ x, y, w: listWidth, h: cardHeight, index });
    });

    const actionY = height - 120;
    const actionW = 160;
    const actionH = 36;
    const actionGap = 22;
    const totalWidth = this.actions.length * actionW + (this.actions.length - 1) * actionGap;
    let actionX = width / 2 - totalWidth / 2;
    this.bounds.actions = [];
    this.actions.forEach((label, index) => {
      const isSelected = index === selectedActionIndex;
      ctx.fillStyle = isSelected ? 'rgba(255,220,140,0.9)' : 'rgba(20,30,40,0.7)';
      ctx.fillRect(actionX, actionY, actionW, actionH);
      ctx.strokeStyle = isSelected ? '#ffe16a' : 'rgba(140,200,255,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(actionX, actionY, actionW, actionH);
      ctx.fillStyle = isSelected ? '#241608' : '#d7f2ff';
      ctx.font = 'bold 14px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(label, actionX + actionW / 2, actionY + 23);
      this.bounds.actions.push({ x: actionX, y: actionY, w: actionW, h: actionH, index });
      actionX += actionW + actionGap;
    });

    if (status) {
      ctx.fillStyle = 'rgba(255,220,140,0.9)';
      ctx.font = '14px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(status, width / 2, height - 80);
    }

    ctx.fillStyle = 'rgba(215,242,255,0.75)';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Confirm: Select  |  Back: Return to Song List', width / 2, height - 50);
    ctx.restore();
  }

  handleClick(x, y) {
    const stemHit = this.bounds.items.find((item) => (
      x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h
    ));
    if (stemHit) {
      return { type: 'stem', index: stemHit.index };
    }
    const actionHit = this.bounds.actions.find((item) => (
      x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h
    ));
    if (actionHit) {
      return { type: 'action', index: actionHit.index };
    }
    return null;
  }

  clampSelection(index, length) {
    return clamp(index, 0, Math.max(0, length - 1));
  }
}
