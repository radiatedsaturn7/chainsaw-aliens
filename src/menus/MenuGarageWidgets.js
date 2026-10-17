import {partFits} from '../garage/CarPart.js';

export function showroomPage(choices, value, maximum = 4) {
  const index = Math.max(0, choices.findIndex(c => c.value === value));
  const size = Math.max(1, Math.min(4, Math.round(maximum)));
  const start = Math.floor(index / size) * size;
  return {index, start, entries: choices.slice(start, start + size)};
}
export function garageBrowserRows(resources, parameters, state = {}) {
  const stock=resources.stockCar?.(parameters.carRef);
  const installedSlots=resources.garage?.configuration(parameters.carRef).installed||{};
  // Keep an installed slot reachable for stock restoration if its permissions changed.
  const catalog = resources.garageCatalog().filter(({item}) => installedSlots[item.carPart.slot]===item.id || (partFits(item.carPart, parameters.carRef, stock)
    && (item.carPart.forSale || resources.garage?.items.progress.bags.items[item.id] > 0)));
  if (!state.section) return [...new Set(catalog.map(({item}) => item.carPart.section || 'Engine'))]
    .map(section => ({value: section, label: section}));
  const section = catalog.filter(({item}) => (item.carPart.section || 'Engine') === state.section);
  if (!state.slot) return [...new Set(section.map(({item}) => item.carPart.slot))]
    .map(slot => ({value: slot, label: slot.charAt(0).toUpperCase() + slot.slice(1)}));
  const installed = resources.garage?.configuration(parameters.carRef).installed[state.slot];
  const tiers = {street: 1, sport: 2, race: 3, custom: 4};
  return [{value: '', label: `None / Stock${!installed ? ' · Installed' : ''}`},
    ...section.filter(({item}) => item.carPart.slot === state.slot && partFits(item.carPart, parameters.carRef, stock))
      .sort((a,b) => (tiers[a.item.carPart.tier] || 4) - (tiers[b.item.carPart.tier] || 4) || a.item.carPart.price - b.item.carPart.price)
      .map(({ref,item}) => {
        const owned = resources.garage?.availableCount(item.id) > 0;
        const locked = item.carPart.unlockKey && !resources.garage?.items.progress.unlocks[item.carPart.unlockKey];
        return {value: ref, label: `${item.name} · ${installed === item.id ? 'Installed' : locked ? 'Locked' : owned ? 'Install' : `${item.carPart.price} credits`}`};
      })];
}
export function garageCardBounds(bounds, count, index) {
  const width = bounds.w / Math.max(1, count);
  return {x: bounds.x + index * width + 4, y: bounds.y + 24, w: width - 8, h: bounds.h - 48};
}
