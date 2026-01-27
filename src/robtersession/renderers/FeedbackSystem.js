const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class FeedbackSystem {
  constructor() {
    this.cards = [];
    this.hitFlashes = [];
  }

  addHit({ judgement, laneIndex }) {
    this.cards.push({
      type: 'hit',
      judgement,
      laneIndex,
      life: 1.2
    });
  }

  addMiss({ expected, played, inputs, laneIndex }) {
    this.cards.push({
      type: 'miss',
      expected,
      played,
      inputs,
      laneIndex,
      life: 1.6
    });
  }

  update(dt) {
    this.cards = this.cards.filter((card) => card.life > 0);
    this.cards.forEach((card) => {
      card.life = Math.max(0, card.life - dt);
    });
  }

  draw(ctx, layout) {
    const { hitLineY, startX, totalWidth } = layout;
    const baseX = startX + totalWidth / 2;
    const baseY = hitLineY - 110;
    const cardW = Math.min(420, totalWidth + 60);
    const cardH = 72;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.cards.forEach((card, index) => {
      const alpha = clamp(card.life / 1.6, 0, 1);
      const y = baseY - index * (cardH + 12);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = card.type === 'hit' ? 'rgba(90,200,255,0.85)' : 'rgba(255,120,120,0.85)';
      ctx.fillRect(baseX - cardW / 2, y, cardW, cardH);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.strokeRect(baseX - cardW / 2, y, cardW, cardH);
      ctx.fillStyle = '#0b121b';
      ctx.font = 'bold 16px Courier New';
      if (card.type === 'hit') {
        ctx.fillText(card.judgement || 'Perfect', baseX, y + cardH / 2);
      } else {
        ctx.fillText('Miss', baseX, y + 10);
        ctx.font = '12px Courier New';
        ctx.fillText(`Expected: ${card.expected}`, baseX, y + 28);
        ctx.font = '12px Courier New';
        ctx.fillText(`You played: ${card.played || '—'}`, baseX, y + 44);
        ctx.fillStyle = '#0b121b';
        ctx.fillText(card.inputs || '', baseX, y + 60);
      }
    });
    ctx.restore();
  }
}
