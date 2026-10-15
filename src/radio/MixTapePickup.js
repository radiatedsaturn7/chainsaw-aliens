export const isMixTape = item => item?.itemType === 'mix-tape';
export const mixTapeRotation = seconds => (Number(seconds) || 0) * Math.PI * 0.75;

// Keep authored placements intact. Pickup state belongs to the current play session.
export function collectMixTape({radio, item, id, state, notify = () => {}, now = Date.now()}) {
  if (!radio || !isMixTape(item) || !id) return Promise.resolve(false);
  state.mixTapeCollected ||= new Set();
  state.mixTapePending ||= new Map();
  state.mixTapeRetryAt ||= new Map();
  if (state.mixTapeCollected.has(id)) return Promise.resolve(false);
  if (state.mixTapePending.has(id)) return state.mixTapePending.get(id);
  if ((state.mixTapeRetryAt.get(id) || 0) > now) return Promise.resolve(false);
  const pending = Promise.resolve().then(async () => {
    await radio.load();
    const track = radio.library.tracks.find(track => track.id === item.unlockTrackId);
    if (!track) throw Error('This mix tape needs an existing radio track.');
    const unlocked = await radio.unlock(track.id);
    state.mixTapeCollected.add(id);
    notify(unlocked ? `Unlocked: ${track.title}` : `Already unlocked: ${track.title}`);
    return true;
  }).catch(error => {
    state.mixTapeRetryAt.set(id, now + 5000);
    notify(`Mix tape not saved: ${error.message}`);
    return false;
  }).finally(() => state.mixTapePending.delete(id));
  state.mixTapePending.set(id, pending);
  return pending;
}

export function updateLevelMixTapes(game) {
  if (!game.player || game.player.dead) return;
  const player = game.player;
  game.mixTapePickupState ||= {};
  for (const item of game.world?.decals || []) {
    if (!isMixTape(item)) continue;
    if (player.x + player.width/2 < item.x || player.x-player.width/2 > item.x+item.w
      || player.y+player.height/2 < item.y || player.y-player.height/2 > item.y+item.h) continue;
    void collectMixTape({radio:game.radio,item,id:item.id,state:game.mixTapePickupState,notify:message=>game.showSystemToast?.(message)});
  }
}
