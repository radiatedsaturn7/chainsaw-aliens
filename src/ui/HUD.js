export default class HUD {
  draw(ctx, player, objective, regionName, options) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';

    const barWidth = 140;
    const barHeight = 10;
    const healthRatio = Math.max(0, player.health) / player.maxHealth;
    ctx.fillText('Health', 20, 24);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(90, 14, barWidth, barHeight);
    ctx.fillRect(90, 14, barWidth * healthRatio, barHeight);

    const fuelRatio = Math.max(0, player.fuel) / 3;
    ctx.fillText('Fuel', 20, 44);
    ctx.strokeRect(90, 34, barWidth, barHeight);
    ctx.fillRect(90, 34, barWidth * fuelRatio, barHeight);

    ctx.fillText(`Heat: ${Math.round(player.heat * 100)}%`, 20, 68);
    ctx.fillText(`Credits: ${player.credits}`, 20, 88);
    ctx.fillText(`Blueprint Shards: ${player.blueprints}`, 20, 108);
    ctx.fillText(`Region: ${regionName}`, 20, 130);
    ctx.fillText(`Objective: ${objective}`, 20, 154);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(14, 112, 420, 56);

    if (options.shake === false) {
      ctx.fillText('Screen Shake: OFF', 20, 172);
    }
    ctx.restore();
  }
}
