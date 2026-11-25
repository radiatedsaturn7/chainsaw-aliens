// Save data stores completion, not a mutable unlock counter. Replays cannot
// farm batches, and each slot derives its own regional progress.
const completionKey=ref=>'raceCompleted.'+String(ref).replace(/[^a-zA-Z0-9_-]/g,'_');
export const PROVIDENCE_BOSS='Providence, RI — Landmark Run';
export const CAMPAIGN_PROGRESS_VERSION=2;
export const campaignFinaleRef=region=>region?.finaleRef||region?.bossRef;
export function migrateCampaignProgress(progress={}) {
 if(progress.campaignProgressionVersion>=CAMPAIGN_PROGRESS_VERSION)return {...progress};
 const next={...progress,campaignProgressionVersion:CAMPAIGN_PROGRESS_VERSION};
 // Tower Hill was the first boss in old saves. Preserve that earned region
 // unlock without paying Providence's rewards or modifying other completions.
 if(!(progress.campaignProgressionVersion>=1)&&progress[completionKey('Tower Hill Road')])next[completionKey(PROVIDENCE_BOSS)]=true;
 // An older save may already have opened New Hampshire. Retain access, but
 // do not fabricate a Pachaug clear or prevent viewing the revised finale.
 if(next[completionKey(PROVIDENCE_BOSS)]===true)next.campaignRegion1LegacyOpen=true;
 return next;
}
// An authored regional hub reads the same normalized road graph as the map.
// Legacy/partial documents with no authored widget keep the old save gates.
function regionalGraph(document,region){
 const screen=document?.screens?.find(s=>s.id===`campaign-hub-${region.stage}`);
 return screen?.elements?.find(e=>e.type==='world-map'&&e.property==='campaign-path'
  &&(!e.assetRef||e.assetRef===region.bossRef));
}
function authoredAvailability(widget,region,cleared){
 const nodes=new Map((widget.nodes||[]).filter(n=>n.id&&!n.disabled&&(n.kind==='junction'||n.raceRef)).map(n=>[n.id,n]));
 const edges=new Map([...nodes.keys()].map(id=>[id,[]]));
 for(const {from,to} of widget.connections||[]){
  if(from===to||!nodes.has(from)||!nodes.has(to))continue;
  edges.get(from).push(to);edges.get(to).push(from);
 }
 const finale=campaignFinaleRef(region);
 const races=[...nodes.values()].filter(n=>n.kind!=='junction'&&n.raceRef!==finale);
 const start=[...nodes.values()].find(n=>n.kind==='junction'&&n.id==='start')
  ||races.find(n=>n.raceRef===region.mainPath?.[0])||races[0];
 const reached=new Set(),available=new Set(),frontier=[];
 let bossReachable=false;
 // Junctions only relay existing roads. An uncleared race can be selected,
 // but it doesn't reveal any more ordinary races.
 const pending=start?[start.id]:[];
 for(let i=0;i<pending.length;i++){
  const id=pending[i];if(reached.has(id))continue;reached.add(id);
  const node=nodes.get(id);
  if(node.kind!=='junction'){
   if(node.raceRef===finale){bossReachable=true;continue;}
   available.add(node.raceRef);
   if(!cleared(node.raceRef)){frontier.push(id);continue;}
  }
  pending.push(...edges.get(id));
 }
 return {available,bossReachable};
}
export function campaignRegionState(config,bossRef,parameters={},garage={},document=null) {
 const regions=config?.regions||[],index=regions.findIndex(r=>r.bossRef===bossRef);
 if(index<0)return null;
 const region=regions[index],cleared=ref=>parameters[completionKey(ref)]===true||Number(garage.rewards?.[ref]?.clears)>0;
 const finale=campaignFinaleRef(region);
 const winsRegion=r=>cleared(campaignFinaleRef(r));
 const won=winsRegion(region),previous=regions[index-1];
 const legacyBridge=previous?.stage===1&&campaignFinaleRef(previous)!==previous.bossRef&&parameters.campaignRegion1LegacyOpen===true;
 const open=index===0||winsRegion(previous)||legacyBridge||regions.slice(index).some(winsRegion);
 const graph=regionalGraph(document,region);
 const graphRefs=graph?(graph.nodes||[]).filter(n=>n.kind!=='junction'&&!n.disabled&&n.raceRef!==finale).map(n=>n.raceRef).filter(Boolean):[];
 const events=[...new Set([...(region.events||[]),...graphRefs])];
 if(graph){
  const {available,bossReachable}=authoredAvailability(graph,region,cleared);
  return {region,open,won,graphBased:true,available:won?events:events.filter(ref=>available.has(ref)),
   cleared,bossReady:open&&(won||(bossReachable&&(region.mainPath||[]).every(cleared)))};
 }
 const wins=events.filter(cleared).length;
 if(region.mainPath?.length){
  const path=region.mainPath,mainWins=path.filter(cleared).length;
  const available=won?events:events.filter(ref=>{
   if(cleared(ref))return true;
   const i=path.indexOf(ref);
   if(i>=0)return i===0||path.slice(0,i).every(cleared);
   const branch=region.branches?.find(b=>b.raceRef===ref);
   return branch?cleared(branch.after):mainWins>=2;
  });
  return {region,open,won,wins:mainWins,required:path.length,available,cleared,bossReady:open&&(won||mainWins===path.length)};
 }
 const required=Math.min(region.bossClears??9,events.length),batch=Math.max(1,region.batchSize||4),step=Math.max(1,region.clearsPerBatch||3);
 const count=won?events.length:Math.min(events.length,batch*(1+Math.floor(Math.min(wins,Math.max(0,required-step))/step)));
 return {region,open,won,wins,required,available:events.slice(0,count),cleared,bossReady:open&&(won||wins>=required)};
}
export function campaignRaceAccess(config,ref,parameters={},garage={},unlocks={},document=null) {
 if(!config?.regions||unlocks['cheat.travel'])return {allowed:true};
 const region=config.regions.find(r=>r.bossRef===ref||campaignFinaleRef(r)===ref)
  ||config.regions.find(r=>regionalGraph(document,r)?.nodes?.some(n=>n.kind!=='junction'&&n.raceRef===ref))
  ||config.regions.find(r=>(r.events||[]).includes(ref));
 if(!region)return {allowed:true}; // Custom races/editor content remain independent.
 const state=campaignRegionState(config,region.bossRef,parameters,garage,document);
 const finale=campaignFinaleRef(region);
 if(!state.open)return {allowed:false,reason:'Win the previous region’s main mission first.',state};
 if(state.graphBased){
  if(ref===finale)return {allowed:state.bossReady,reason:'Clear the main route to reach this region’s final mission.',state};
  const allowed=state.won||state.cleared(ref)||state.available.includes(ref);
  return {allowed,reason:'Clear a connected stop to reach this race.',state};
 }
 if(region.mainPath?.length){
  const allowed=ref===finale?state.bossReady:state.won||state.cleared(ref)||state.available.includes(ref);
  return {allowed,reason:ref===finale?`Complete the five main-path races (${state.wins}/${state.required}).`:'Follow the connected main path to open this race.',state};
 }
 if(ref===finale)return {allowed:state.bossReady,reason:`Complete ${state.required} different events in this region (${state.wins}/${state.required}).`,state};
 const allowed=state.won||state.cleared(ref)||state.available.includes(ref);
 const index=region.events.indexOf(ref),needed=Math.floor(index/(region.batchSize||4))*(region.clearsPerBatch||3);
 return {allowed,reason:needed>=state.required?'Win this region’s main mission to open the remaining events.':`Complete ${needed} different regional events to open this batch (${state.wins}/${needed}).`,state};
}
export function refreshCampaignScreen(screen,config,parameters,garage,unlocks,document=null) {
 if(!config?.regions)return;
 for(const e of screen.elements||[]){
  const ref=e.action?.type==='set-param'&&e.action.parameter==='raceRef'?e.action.value:null;
  if(!ref)continue;
  const access=campaignRaceAccess(config,ref,parameters,garage,unlocks,document);if(!access.state)continue;
  e.campaignBaseLabel??=e.label;e.campaignBaseColor??=e.color;
  const boss=ref===campaignFinaleRef(access.state.region);
  e.label=e.campaignBaseLabel+(access.state.cleared(ref)?'':boss&&!access.allowed&&!access.state.graphBased?` (${access.state.wins}/${access.state.required})`:access.allowed?'':' (Locked)');
  e.color=access.allowed?e.campaignBaseColor:'#e36a6a';
 }
}
