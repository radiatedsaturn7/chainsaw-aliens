// Save data stores completion, not a mutable unlock counter. Replays cannot
// farm batches, and each slot derives its own regional progress.
const completionKey=ref=>'raceCompleted.'+String(ref).replace(/[^a-zA-Z0-9_-]/g,'_');
export const PROVIDENCE_BOSS='Providence, RI — Landmark Run';
export function migrateCampaignProgress(progress={}) {
 if(progress.campaignProgressionVersion>=1)return {...progress};
 const next={...progress,campaignProgressionVersion:1};
 // Tower Hill was the first boss in old saves. Preserve that earned region
 // unlock without paying Providence's rewards or modifying other completions.
 if(progress[completionKey('Tower Hill Road')])next[completionKey(PROVIDENCE_BOSS)]=true;
 return next;
}
export function campaignRegionState(config,bossRef,parameters={},garage={}) {
 const regions=config?.regions||[],index=regions.findIndex(r=>r.bossRef===bossRef);
 if(index<0)return null;
 const region=regions[index],cleared=ref=>parameters[completionKey(ref)]===true||Number(garage.rewards?.[ref]?.clears)>0;
 const won=cleared(bossRef),open=index===0||cleared(regions[index-1].bossRef)||regions.slice(index).some(r=>cleared(r.bossRef));
 const events=[...new Set(region.events||[])],wins=events.filter(cleared).length;
 const required=Math.min(region.bossClears??9,events.length),batch=Math.max(1,region.batchSize||4),step=Math.max(1,region.clearsPerBatch||3);
 const count=won?events.length:Math.min(events.length,batch*(1+Math.floor(Math.min(wins,Math.max(0,required-step))/step)));
 return {region,open,won,wins,required,available:events.slice(0,count),cleared,bossReady:open&&(won||wins>=required)};
}
export function campaignRaceAccess(config,ref,parameters={},garage={},unlocks={}) {
 if(!config?.regions||unlocks['cheat.travel'])return {allowed:true};
 const region=config.regions.find(r=>r.bossRef===ref||(r.events||[]).includes(ref));
 if(!region)return {allowed:true}; // Custom races/editor content remain independent.
 const state=campaignRegionState(config,region.bossRef,parameters,garage);
 if(!state.open)return {allowed:false,reason:'Win the previous region’s main mission first.',state};
 if(ref===region.bossRef)return {allowed:state.bossReady,reason:`Complete ${state.required} different events in this region (${state.wins}/${state.required}).`,state};
 const allowed=state.won||state.cleared(ref)||state.available.includes(ref);
 const index=region.events.indexOf(ref),needed=Math.floor(index/(region.batchSize||4))*(region.clearsPerBatch||3);
 return {allowed,reason:needed>=state.required?'Win this region’s main mission to open the remaining events.':`Complete ${needed} different regional events to open this batch (${state.wins}/${needed}).`,state};
}
export function refreshCampaignScreen(screen,config,parameters,garage,unlocks) {
 if(!config?.regions)return;
 for(const e of screen.elements||[]){
  const ref=e.action?.type==='set-param'&&e.action.parameter==='raceRef'?e.action.value:null;
  if(!ref)continue;
  const access=campaignRaceAccess(config,ref,parameters,garage,unlocks);if(!access.state)continue;
  e.campaignBaseLabel??=e.label;e.campaignBaseColor??=e.color;
  const boss=ref===access.state.region.bossRef;
  e.label=e.campaignBaseLabel+(access.state.cleared(ref)?'':boss&&!access.allowed?` (${access.state.wins}/${access.state.required})`:access.allowed?'':' (Locked)');
  e.color=access.allowed?e.campaignBaseColor:'#e36a6a';
 }
}
