export default class HUD {
  draw(ctx, player, objective, regionName, options) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '14px Courier New';
    ctx.textAlign = 'left';
    ctx.fillText(`Health: ${player.health}/${player.maxHealth}`, 20, 24);
    ctx.fillText(`Heat: ${Math.round(player.heat * 100)}%`, 20, 44);
    ctx.fillText(`Fuel: ${player.fuel}/3`, 20, 64);
    ctx.fillText(`Credits: ${player.credits}`, 20, 84);
    ctx.fillText(`Blueprint Shards: ${player.blueprints}`, 20, 104);
    ctx.fillText(`Region: ${regionName}`, 20, 126);
    ctx.fillText(`Objective: ${objective}`, 20, 150);

    if (options.shake === false) {
      ctx.fillText('Screen Shake: OFF', 20, 172);
    }
    ctx.restore();
  }
}
