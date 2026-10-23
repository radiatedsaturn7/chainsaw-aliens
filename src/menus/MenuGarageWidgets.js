import {partFits,isStockPart,isGarageUpgrade} from '../garage/CarPart.js';

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
  const catalog = resources.garageCatalog().filter(({item})=>isGarageUpgrade(item)).filter(({item}) => installedSlots[item.carPart.slot]===item.id || (partFits(item.carPart, parameters.carRef, stock)
    && (item.carPart.forSale || resources.garage?.items.progress.bags.items[item.id] > 0)));
  if (!state.section) return [...new Set(catalog.map(({item}) => item.carPart.section || 'Engine'))]
    .map(section => ({value: section, label: section}));
  const section = catalog.filter(({item}) => (item.carPart.section || 'Engine') === state.section);
  if (!state.slot) return [...new Set(section.map(({item}) => item.carPart.slot))]
    .map(slot => ({value: slot, label: slot.charAt(0).toUpperCase() + slot.slice(1)}));
  const installed = resources.garage?.configuration(parameters.carRef).installed[state.slot];
  const tiers = {street: 1, sport: 2, race: 3, custom: 4};
  const stockInstalled=!installed||catalog.some(({item})=>item.id===installed&&isStockPart(item));
  return [{value: '', label: `Stock${stockInstalled ? ' · Installed' : ' · Install'}`},
    ...section.filter(({item}) => item.carPart.slot === state.slot && !isStockPart(item) && partFits(item.carPart, parameters.carRef, stock))
      .sort((a,b) => (tiers[a.item.carPart.tier] || 4) - (tiers[b.item.carPart.tier] || 4) || a.item.carPart.price - b.item.carPart.price)
      .map(({ref,item}) => {
        const owned = resources.garage?.availableCount(item.id) > 0;
        const locked = item.carPart.unlockKey && !resources.garage?.items.progress.unlocks[item.carPart.unlockKey];
        const credits=Number(resources.garage?.items.game?.player?.credits??resources.garage?.items.savedStats?.credits);
        // Unlock and scrap requirements apply to purchasing, not installing a spare already owned.
        const disabled=installed!==item.id&&!owned&&(!!locked||(Number.isFinite(credits)&&credits<item.carPart.price));
        return {disabled,reason:locked?'This part has not been unlocked':'Not enough scrap',value: ref, label: `${item.name} · ${installed === item.id ? 'Installed' : owned ? 'Install' : locked ? 'Locked' : `${item.carPart.price} scrap`}`};
      })];
}
export function garageCardBounds(bounds, count, index) {
  const width = bounds.w / Math.max(1, count);
  return {x: bounds.x + index * width + 4, y: bounds.y + 24, w: width - 8, h: bounds.h - 48};
}

// Fixed 4 × 2 upgrade pages share the same geometry for drawing and touch.
export function garageGridBounds(bounds,index){
 const width=bounds.w/4,height=Math.max(2,(bounds.h-32)/2);
 return {x:bounds.x+(index%4)*width+4,y:bounds.y+24+Math.floor(index/4)*height+2,w:Math.max(1,width-8),h:Math.max(1,height-4)};
}
export function garageGridVerticalIndex(index,count,direction){
 if(direction<0)return index%8<4?index:index-4;
 const pageStart=Math.floor(index/8)*8;
 if(index-pageStart>=4||count<=pageStart+4)return null;
 return Math.min(count-1,index+4);
}
