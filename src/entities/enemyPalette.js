export const ENEMY_PALETTE = {
  body: '#d63a3a',
  flash: '#ff9a9a',
  accent: '#111111'
};

export const applyEnemyPalette = (ctx, flash, alpha = ctx.globalAlpha) => {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = flash ? ENEMY_PALETTE.flash : ENEMY_PALETTE.body;
  ctx.strokeStyle = ENEMY_PALETTE.accent;
};
