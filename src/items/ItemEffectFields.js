export const EFFECT_LABELS = {health:'Health','max-health':'Maximum health',armor:'Armor',currency:'Money',key:'Key',weapon:'Weapon',ability:'Ability',inventory:'Inventory',device:'Device',unlock:'Unlock',modifier:'Player stat',map:'Reveal map',speed:'Speed'};
export const RECIPIENTS = [{value:'player',label:'Player'},{value:'allies',label:'Allies'},{value:'opponents',label:'Opponents'},{value:'everyone',label:'Everyone'}];
const options=entries=>entries.map(([value,label])=>({value,label}));
const NAMED={weapon:options([['ignitir','Ignitir'],['flamethrower','Flamethrower']]),ability:options([['anchor','Anchor'],['flame','Flame saw'],['magboots','Magnetic boots'],['resonance','Resonance']]),modifier:options([['speed','Movement speed'],['jumpPower','Jump strength'],['revEfficiency','Rev efficiency'],['dashCooldownBase','Dash cooldown'],['upgradeSlots','Upgrade slots']])};
export function itemEffectFields(effect,item,{tracks=[],items=[]}={}) {
  const contents=state=>{
    const type=state.type||effect.type,bag=state.bag||effect.bag;
    if(type==='inventory'&&bag==='radio')return [{value:'',label:'Choose track'},...tracks.map(t=>({value:t.id,label:t.title}))];
    if(NAMED[type])return NAMED[type];
    const entries=[{value:item.id,label:item.name},...items.flatMap(entry=>[
      ...(type==='inventory'?[{value:entry.id,label:entry.name}]:[]),
      ...entry.effects.filter(e=>e.type===type).map(e=>({value:e.target,label:e.contentName||entry.name}))
    ])];
    if(effect.target&&!entries.some(e=>e.value===effect.target))entries.push({value:effect.target,label:effect.contentName||'Current selection'});
    return entries.filter((entry,index)=>entry.value&&entries.findIndex(e=>e.value===entry.value)===index);
  };
  return [
    {id:'type',label:'Effect',value:effect.type,options:Object.entries(EFFECT_LABELS).map(([value,label])=>({value,label}))},
    {id:'when',label:'When',value:effect.when||'collect',options:options([['collect','Collected'],['use','Used'],['hit','Projectile hits']])},
    {id:'recipient',label:'Recipient',value:effect.recipient||'player',options:s=>s.when==='hit'?[RECIPIENTS[2],RECIPIENTS[1],RECIPIENTS[3]]:RECIPIENTS},
    {id:'bag',label:'Bag',value:effect.bag||'items',options:options([['items','Items'],['radio','Radio']]),visibleWhen:s=>s.type==='inventory'},
    {id:'target',label:s=>s.type==='inventory'&&s.bag==='radio'?'Track':({key:'Key',weapon:'Weapon',ability:'Ability',inventory:'Item',device:'Device',unlock:'Unlock',modifier:'Stat'}[s.type]||'Item'),value:effect.target||item.id,options:contents,visibleWhen:s=>['key','weapon','ability','inventory','device','unlock','modifier'].includes(s.type)},
    {id:'amount',label:s=>s.type==='speed'?'Speed multiplier':'Amount',type:'number',value:effect.amount??1,required:true,visibleWhen:s=>!['weapon','ability','device','unlock'].includes(s.type)&&!(s.type==='inventory'&&s.bag==='radio')},
    {id:'duration',label:'Seconds',type:'number',min:0.1,max:300,value:effect.duration||5,visibleWhen:s=>s.type==='speed'},
    {id:'operation',label:'Change',value:effect.operation||'add',options:options([['add','Add'],['set','Set'],['multiply','Multiply'],['max','At least'],['min','At most']]),visibleWhen:s=>s.type==='modifier'}
  ];
}
