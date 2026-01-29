const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default class SongSelectView {
  constructor() {
    this.bounds = { items: [] };
  }

  draw(ctx, width, height, { songs = [], selectedIndex = 0, status = '' } = {}) {
    ctx.save();
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Select Song', width / 2, 70);

    this.bounds.items = [];
    const listWidth = 520;
    const cardHeight = 46;
    const startY = 130;
    const gap = 12;
    const x = width / 2 - listWidth / 2;

    songs.forEach((song, index) => {
      const y = startY + index * (cardHeight + gap);
      const isSelected = index === selectedIndex;
      ctx.fillStyle = isSelected ? 'rgba(120,200,255,0.85)' : 'rgba(20,30,40,0.7)';
      ctx.fillRect(x, y, listWidth, cardHeight);
      ctx.strokeStyle = isSelected ? '#ffe16a' : 'rgba(140,200,255,0.4)';
      ctx.lineWidth = isSelected ? 2.5 : 2;
      ctx.strokeRect(x, y, listWidth, cardHeight);
      ctx.fillStyle = isSelected ? '#041019' : '#d7f2ff';
      ctx.font = 'bold 18px Courier New';
      ctx.fillText(song.title || song.filename, width / 2, y + cardHeight / 2 + 6);
      this.bounds.items.push({ x, y, w: listWidth, h: cardHeight, index });
    });

    if (!songs.length) {
      ctx.fillStyle = 'rgba(215,242,255,0.8)';
      ctx.font = '16px Courier New';
      ctx.fillText('No songs found in manifest.', width / 2, height / 2);
    }

    if (status) {
      ctx.fillStyle = 'rgba(255,220,140,0.9)';
      ctx.font = '14px Courier New';
      ctx.fillText(status, width / 2, height - 90);
    }

    ctx.fillStyle = 'rgba(215,242,255,0.75)';
    ctx.font = '14px Courier New';
    ctx.fillText('Confirm: Select  |  Back: Exit to Main Menu', width / 2, height - 60);
    ctx.restore();
  }

  handleClick(x, y) {
    const hit = this.bounds.items.find((item) => (
      x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h
    ));
    if (hit) {
      return hit.index;
    }
    return null;
  }

  clampSelection(index, length) {
    return clamp(index, 0, Math.max(0, length - 1));
  }
}
