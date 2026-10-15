// Item files contain data only. Effects are interpreted by ItemEffects, never eval'd.
export const ITEM_VERSION = 2;
export const ITEM_EFFECT_TYPES = ['health', 'max-health', 'armor', 'currency', 'key', 'weapon', 'ability', 'inventory', 'device', 'unlock', 'modifier', 'radio-track', 'map', 'speed'];
export const ITEM_MODIFIERS = ['speed', 'jumpPower', 'revEfficiency', 'dashCooldownBase', 'upgradeSlots'];
const text = value => typeof value === 'string' ? value.trim() : '';
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const safeKey = value => {
  const key = text(value);
  if (!key || ['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('Enter a valid effect target.');
  return key;
};

export function normalizeItemEffect(source = {}) {
  const radio = source.type === 'radio-track';
  const type = radio ? 'inventory' : text(source.type);
  if (!ITEM_EFFECT_TYPES.includes(type)) throw Error(`Unknown item effect: ${type}`);
  const needsTarget = ['key', 'weapon', 'ability', 'inventory', 'device', 'unlock', 'modifier', 'radio-track'].includes(type);
  const target = needsTarget ? safeKey(source.target) : '';
  if (type === 'modifier' && !ITEM_MODIFIERS.includes(target)) throw Error(`Unsupported player modifier: ${target}`);
  const amount = finite(source.amount ?? 1, NaN);
  if (!Number.isFinite(amount)) throw Error('Effect amount must be a number.');
  if (type !== 'modifier' && amount <= 0) throw Error('Effect amount must be greater than zero.');
  return { type, target, amount, contentName:text(source.contentName), itemRef:text(source.itemRef),
    bag: radio ? 'radio' : ['items','radio'].includes(source.bag) ? source.bag : 'items',
    recipient: ['player','allies','opponents','everyone'].includes(source.recipient) ? source.recipient : 'player',
    when: ['collect','use','hit'].includes(source.when) ? source.when : 'collect',
    duration: Math.max(0.1, Math.min(300, finite(source.duration, 5))),
    operation: ['add', 'set', 'multiply', 'max', 'min'].includes(source.operation) ? source.operation : 'add' };
}

export function normalizeItemDocument(value = {}) {
  const source = value.kind === 'item' ? value.item || {} : value.doodad || value;
  const legacyTape = source.itemType === 'mix-tape';
  const effects = (Array.isArray(source.effects) ? source.effects : legacyTape && source.unlockTrackId ? [{type:'radio-track', target:source.unlockTrackId}] : []).map(normalizeItemEffect);
  return {
    id: safeKey(text(source.id) || 'new-item'), name: text(source.name) || 'New Item',
    description: text(source.description), artRef: text(source.artRef),
    widthM: Math.max(0.1, Math.min(500, finite(source.widthM, 1))),
    heightM: Math.max(0.1, Math.min(500, finite(source.heightM, 1))),
    widthPx: Math.max(1, Math.min(4096, finite(source.widthPx, 32))),
    heightPx: Math.max(1, Math.min(4096, finite(source.heightPx, 32))),
    groundOffsetM: finite(source.groundOffsetM, 0),
    rotate: source.rotate ?? legacyTape,
    persistent: source.persistent !== false,
    effects
  };
}

export function serializeItemDocument(item) {
  return {kind:'item', schemaVersion:ITEM_VERSION, item:normalizeItemDocument(item)};
}

export function itemAsDoodad(item) {
  const normalized = normalizeItemDocument(item);
  return {...normalized, itemType:'item', item:normalized, hitboxWidthM:normalized.widthM, hitboxHeightM:normalized.heightM};
}

export function applyItemModifier(value,effect) {
  const amount=effect.amount;
  return effect.operation==='set'?amount:effect.operation==='multiply'?value*amount:effect.operation==='max'?Math.max(value,amount):effect.operation==='min'?Math.min(value,amount):value+amount;
}
