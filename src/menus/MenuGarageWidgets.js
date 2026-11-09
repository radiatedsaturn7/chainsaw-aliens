import {AUTO_UPGRADE_CLASSES} from '../garage/GarageAutoUpgrade.js';
import {GARAGE_UPGRADE_PRESETS} from '../garage/GarageSetupProfiles.js';
import {quoteGarageSetup} from '../garage/GarageSetups.js';
import {stockDrivetrain} from '../garage/GarageConversions.js';
import {garageTireChoices} from '../garage/GarageTireChoices.js';
import {cappedMenu,menuAtPath} from '../garage/GarageMenuTree.js';
import {upgradeLabel,isOriginalDrivetrain,upgradeSlotLabel} from '../garage/GarageLabels.js';
import {GARAGE_CATEGORIES,garagePartCategory} from '../garage/GarageCategories.js';
import {partFits,isStockPart,isGarageUpgrade,readCarSetting} from '../garage/CarPart.js';

export function showroomPage(choices, value, maximum = 4) {
  const index = Math.max(0, choices.findIndex(c => c.value === value));
  const size = Math.max(1, Math.min(4, Math.round(maximum)));
  const start = Math.floor(index / size) * size;
  return {index, start, entries: choices.slice(start, start + size)};
}
function garageRows(resources, parameters, state = {}) {
  const stock=resources.stockCar?.(parameters.carRef);
  if(state.section==='Presets'&&!state.slot)return [{value:'setup',label:'Setup'},{value:'auto',label:'Auto Upgrade'}];
  if(state.section==='Presets'&&state.slot==='auto'){
    const setup=resources.garage?.configuration?.(parameters.carRef);
    const stockRow={value:'package:stock',label:'Stock',package:true,cost:0,disabled:!stock,reason:'Loading car…',installed:!!setup&&!Object.keys(setup.installed).length&&!Object.keys(setup.tune).length,description:`0 scrap · ${GARAGE_UPGRADE_PRESETS[0].description}`};
    const quotes=AUTO_UPGRADE_CLASSES.map(target=>({...target,quote:resources.autoUpgradeQuote?.(parameters.carRef,target.label)}));
    // Keep positions stable while all quotes finish, rather than shifting a
    // different purchase button underneath the player's pointer.
    if(quotes.some(q=>!q.quote))return [stockRow,{value:'loading',label:'Calculating…',disabled:true,reason:'Calculating supported classes…'}];
    return [stockRow,...quotes.filter(({label,quote})=>!quote.error&&quote.rating.class===label).sort((a,b)=>b.quote.rating.points-a.quote.rating.points||b.limit-a.limit).slice(0,7).map(({label,limit,quote})=>{
      const credits=Number(resources.garage?.items.game?.player?.credits??resources.garage?.items.savedStats?.credits)||0;
      const reason=credits<quote.cost?'Not enough scrap':'';
      return {value:'auto:'+label,label:'Max '+label,package:true,installed:quote.changes===0&&!quote.resetsTune,cost:quote.cost,quote:quote.token,disabled:!!reason,reason,description:`${quote.cost.toLocaleString()} scrap · ${quote.initial.class} ${quote.initial.points} → ${quote.rating.class} ${quote.rating.points} PI (limit ${limit}). ${quote.changes??quote.refs.length} part changes; dry-tarmac parts with supplied settings.${quote.resetsTune?' Replaces previous part tuning overrides.':''} ${reason}`};
    })];
  }
  if(state.section==='Presets'&&state.slot==='setup')return GARAGE_UPGRADE_PRESETS.map(profile=>{
    try{
      if(profile.id==='stock'){
        const setup=resources.garage?.configuration(parameters.carRef);
        return {value:'package:stock',label:profile.label,package:true,cost:0,disabled:!stock,reason:'Loading car…',installed:!!setup&&!Object.keys(setup.installed).length&&!Object.keys(setup.tune).length,description:`0 scrap · ${profile.description}`};
      }
      if(!stock||!resources.setupCatalog)throw Error('Loading packages…');
      const quote=quoteGarageSetup(resources.garage,parameters.carRef,stock,profile.id,resources.setupCatalog);
      const credits=Number(resources.garage.items.game?.player?.credits??resources.garage.items.savedStats?.credits)||0;
      return {value:'package:'+profile.id,label:profile.label,package:true,cost:quote.cost,disabled:credits<quote.cost,reason:'Not enough scrap',description:`${quote.cost.toLocaleString()} scrap · ${profile.label} package. Fits matching parts and applies the setup; reuses parts you own.`};
    }catch(error){return {value:'package:'+profile.id,label:profile.label,package:true,disabled:true,reason:error.message,description:error.message};}
  });
  const installedSlots=resources.garage?.configuration(parameters.carRef).installed||{};
  // Keep an installed slot reachable for stock restoration if its permissions changed.
  const catalog = resources.garageCatalog().filter(({item})=>isGarageUpgrade(item)).filter(({item}) => installedSlots[item.carPart.slot]===item.id || (partFits(item.carPart, parameters.carRef, stock)
    && (item.carPart.forSale || resources.garage?.items.progress.bags.items[item.id] > 0)));
  if (!state.section) return [...new Set(['Presets',...catalog.map(({item}) => garagePartCategory(item.carPart))])]
    .sort((a,b)=>(GARAGE_CATEGORIES.includes(a)?GARAGE_CATEGORIES.indexOf(a):GARAGE_CATEGORIES.length)-(GARAGE_CATEGORIES.includes(b)?GARAGE_CATEGORIES.indexOf(b):GARAGE_CATEGORIES.length))
    .map(section => ({value: section, label: section}));
  const section = catalog.filter(({item}) => garagePartCategory(item.carPart) === state.section);
  if (!state.slot){
   const slots=[...new Set(section.map(({item})=>item.carPart.slot))].map(slot=>({value:slot,label:upgradeSlotLabel(slot)}));
   const wheelSlots=new Set(['wheels','wheel-diameter','tire-profile','wheel-offset']);
   const wheels=slots.filter(row=>wheelSlots.has(row.value));
   return wheels.length?[...slots.filter(row=>!wheelSlots.has(row.value)),{id:'group:Wheels',value:'group:Wheels',label:'Wheels',children:wheels}]:slots;
  }
  const installed = resources.garage?.configuration(parameters.carRef).installed[state.slot];
  const tiers = {street: 1, sport: 2, race: 3, custom: 4};
  const wheelDimension=stock&&({wheels:['tireWidthMm','mm'],'wheel-diameter':['wheelDiameterIn','in'],'tire-profile':['tireAspectRatio','%'],'wheel-offset':['wheelOutsetMm','mm']}[state.slot]);
  const factorySize=wheelDimension?readCarSetting(stock,wheelDimension[0]):null;
  const matchesFactory=item=>{
   if(!wheelDimension)return false;
   const changes=item.carPart.modifiers?.filter(m=>m.field===wheelDimension[0])||[];
   return changes.length>0&&Math.abs(changes.reduce((value,m)=>m.operation==='set'?m.value:m.operation==='multiply'?value*m.value:value+m.value,factorySize)-factorySize)<1e-8;
  };
  const stockInstalled=!installed||catalog.some(({item})=>item.id===installed&&(isStockPart(item)||isOriginalDrivetrain(item.carPart,stock)||matchesFactory(item)));
  const originalDrive=state.slot==='drive-swap'&&stock?stockDrivetrain(stock).toUpperCase():null;
  let choices=section.filter(({item}) => item.carPart.slot === state.slot && !isOriginalDrivetrain(item.carPart,stock) && !isStockPart(item) && partFits(item.carPart, parameters.carRef, stock));
  choices=choices.filter(({item})=>!matchesFactory(item));
  if(state.slot==='tires')choices=garageTireChoices(choices,resources.garage,installed);
  else choices.sort((a,b) => (tiers[a.item.carPart.tier] || 4) - (tiers[b.item.carPart.tier] || 4) || a.item.carPart.price - b.item.carPart.price);
  return [{value: '', ...(wheelDimension?{labelLines:['Stock',`(${factorySize} ${wheelDimension[1]})`]}:{}), label: wheelDimension?`Stock (${factorySize} ${wheelDimension[1]})`:originalDrive?`Stock ${originalDrive}`:'Stock',description:originalDrive?'Owned · Free to restore factory drivetrain.':'Free · Restore original equipment.', installed: stockInstalled},
    ...choices.map(({ref,item,tireLabel}) => {
        const owned = resources.garage?.availableCount(item.id) > 0;
        const width=item.carPart.slot==='wheels'&&item.carPart.modifiers?.find(m=>m.field==='tireWidthMm');
        const widthLabel=width&&stock?`${width.operation==='set'?width.value:(stock.setup?.tireSize?.widthMm||245)+width.value} mm`:width&&['add','set'].includes(width.operation)?`${width.operation==='add'&&width.value>0?'+':''}${width.value} mm`:null;
        const ballast=item.carPart.slot==='ballast'&&item.carPart.tuning?.find(r=>r.field==='ballastKg');
        const ballastLabel=ballast?`${ballast.min}–${ballast.max} kg`:null;
        const dimension=item.carPart.modifiers?.find(m=>['wheelDiameterIn','tireAspectRatio','wheelOutsetMm'].includes(m.field));
        const dimensionLabel=dimension?`${dimension.field==='wheelOutsetMm'?'+':''}${dimension.value} ${{wheelDiameterIn:'in',tireAspectRatio:'%',wheelOutsetMm:'mm'}[dimension.field]}`:null;
        const name=dimensionLabel||ballastLabel||widthLabel||tireLabel||upgradeLabel(item.name,state.slot);
        const locked = item.carPart.unlockKey && !resources.garage?.items.progress.unlocks[item.carPart.unlockKey];
        const credits=Number(resources.garage?.items.game?.player?.credits??resources.garage?.items.savedStats?.credits);
        // Unlock and scrap requirements apply to purchasing, not installing a spare already owned.
        const disabled=installed!==item.id&&!owned&&(!!locked||(Number.isFinite(credits)&&credits<item.carPart.price));
        const status=installed===item.id||owned?'Owned':locked?'Locked':`${item.carPart.price.toLocaleString()} scrap`;
        return {installed:installed===item.id,disabled,reason:locked?'This part has not been unlocked':'Not enough scrap',value:ref,label:name,tier:item.carPart.tier,description:`${status} · ${item.description||item.name}${disabled?' · '+(locked?'Unlock required':'Not enough scrap'):''}`};
      })];
}
export function garageBrowserRows(resources,parameters,state={}){
 const rows=garageRows(resources,parameters,state);
 const tree=cappedMenu(rows,state.slot==='auto'?row=>row.value==='package:stock'?'Stock':row.value.startsWith('auto:E')?'E1–E4':'F–S':state.slot?row=>!row.value?'Stock':({street:'Street',sport:'Sport',race:'Race',custom:'Specialist'}[row.tier]||'Specialist'):null);
 return menuAtPath(tree,state.path||[]);
}
// All garage grids use the same full panel as the main Tune categories.
export function upgradeGridArea(b){return b;}
export function garageCardBounds(bounds, count, index) {
  const width = bounds.w / Math.max(1, count);
  return {x: bounds.x + index * width + 4, y: bounds.y + 24, w: width - 8, h: bounds.h - 48};
}

// Fixed 4 × 2 upgrade pages share the same geometry for drawing and touch.
export function garageGridBounds(bounds,index){
 const width=bounds.w/4,height=Math.max(1,(bounds.h-24)/2);
 return {x:bounds.x+(index%4)*width,y:bounds.y+24+Math.floor(index/4)*height,w:width,h:height};
}
export function garageGridVerticalIndex(index,count,direction){
 if(direction<0)return index%8<4?index:index-4;
 const pageStart=Math.floor(index/8)*8;
 if(index-pageStart>=4||count<=pageStart+4)return null;
 return Math.min(count-1,index+4);
}
