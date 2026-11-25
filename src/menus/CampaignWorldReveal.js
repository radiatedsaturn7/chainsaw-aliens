import {campaignFinaleRef} from './CampaignProgression.js';
import {worldMapNodes,worldMapConnections} from './MenuWorldMap.js';

export const WORLD_ROAD_REVEAL_SECONDS=1.1;
export const WORLD_PIN_POP_SECONDS=.35;
export const campaignWorldRevealKey=id=>`world-road-reveal:${id}`;
export const campaignWorldOverview=(screen,document)=>screen?.id==='world-map'&&document?.parameters?.campaignProgression?.regions?.length
 ? screen.elements.find(e=>e.type==='world-map'&&e.property!=='campaign-path') : null;

// Take this snapshot when launching the race, before rewards/progress may be
// saved by the results screen. A replay or a previously opened region never
// replays an old reveal, even if race rewards were recorded before the flags.
export function captureCampaignWorldReturn(document,ref,resources,parameters){
 const region=document?.parameters?.campaignProgression?.regions?.find(r=>campaignFinaleRef(r)===ref);
 if(!region)return null;
 const element=campaignWorldOverview(document.screens?.find(s=>s.id==='world-map'),document);
 if(!element)return null;
 const nodes=worldMapNodes(element,resources,document,parameters),i=nodes.findIndex(n=>n.raceRef===region.bossRef);
 if(i<0)return null;
 const from=nodes[i],to=nodes[i+1];
 const link=to&&worldMapConnections(element,nodes).find(c=>c.from===from.id&&c.to===to.id||c.to===from.id&&c.from===to.id);
 return {bossRef:region.bossRef,...(ref===region.bossRef?{}:{finaleRef:ref}),binding:element.binding,reveal:!from.completed&&to?.locked&&!to.disabled&&link ? {from:from.id,to:to.id,toRef:to.raceRef,elapsed:0} : null};
}

export function campaignWorldPresentation(nodes,links,reveal){
 const paving=Boolean(reveal&&reveal.elapsed<WORLD_ROAD_REVEAL_SECONDS);
 const visible=nodes.filter(n=>!n.locked&&(!paving||n.id!==reveal.to));
 const ids=new Set(visible.map(n=>n.id));
 return {visible,links:links.filter(c=>ids.has(c.from)&&ids.has(c.to)),paving};
}
