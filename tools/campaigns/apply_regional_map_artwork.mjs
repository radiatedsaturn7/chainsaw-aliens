// Overlay the authored regional illustration and route geometry on the current
// Game Menu. Run from repository root; unrelated screens and saves are retained.
import fs from 'node:fs';
import {authorCampaignTopology} from './author_campaign_road_topology.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {campaignTravelOrder,CAMPAIGN_REGION_ART} from '../../src/menus/CampaignItinerary.js';
import {raceCompletionKey} from '../../src/menus/MenuWorldMap.js';
const root='data/server-storage/files';
const menuFile=path.join(root,'menus/Game Menu/document.json');
const metadataFile=path.join(root,'menus/Game Menu/metadata.json');
const local=name=>fileURLToPath(new URL(name,import.meta.url));
const gps=JSON.parse(fs.readFileSync(local('regional-map-gps.json'))).regions;
const menu=JSON.parse(fs.readFileSync(menuFile));
const itinerary=menu.parameters.campaignProgression.regions;
if(itinerary.length!==11)throw new Error('Expected 11 campaign regions');
itinerary.sort((a,b)=>campaignTravelOrder(a.stage)-campaignTravelOrder(b.stage));

const improvedOrder=new Set([1,2,3,4,7,11]);
for(const region of itinerary){
 const {stage,bossRef}=region,positions=gps[bossRef];
 const screen=menu.screens.find(s=>s.id===`campaign-hub-${stage}`);
 const widget=screen?.elements.find(e=>e.id==='regional-path'&&e.property==='campaign-path');
 if(!positions||!widget||widget.assetRef!==bossRef)throw new Error(`Missing matching screen/geography for ${bossRef}`);
 const artRef=`campaign-map-${CAMPAIGN_REGION_ART[stage-1]}`;
 if(!fs.existsSync(path.join(root,'art',artRef,'document.json')))throw new Error(`Missing native art ${artRef}`);
 Object.assign(widget,{artRef,imageFit:'stretch',x:.025,y:.112,w:.63,h:.858});
 widget.mapStyle={...widget.mapStyle,nodeScale:.80};
 Object.assign(screen.elements.find(e=>e.id==='route-name'),{x:.68,y:.145,w:.29,h:.14});
 Object.assign(screen.elements.find(e=>e.id==='route-preview'),{x:.68,y:.29,w:.29,h:.545});
 const authored=positions.route.authored;
 const main=improvedOrder.has(stage)?positions.route.geographicSuggestion:authored;
 if(main.length!==5||!main.every(ref=>region.events.includes(ref)))throw new Error(`Invalid itinerary for ${bossRef}`);
 region.mainPath=[...main];
 const refs=[...main,bossRef,...region.branches.map(b=>b.raceRef)];
 const byRef=new Map(widget.nodes.map(n=>[n.raceRef,n]));
 widget.nodes=refs.map((ref,i)=>{
  const n=byRef.get(ref),p=positions.nodesByRace[ref];
  if(!n||!p)throw new Error(`Missing matching race/node ${ref}`);
  return {...n,x:p.x,y:p.y,label:i===5?'Boss':i>5?'Detour':String(i+1)};
 });

}
authorCampaignTopology(menu);
const world=menu.screens.find(s=>s.id==='world-map')?.elements.find(e=>e.type==='world-map');
if(world?.nodes.length!==11)throw new Error('Unexpected world-map pin count');
const byRef=new Map(world.nodes.map(n=>[n.raceRef,n]));
const links=new Map(world.connections.map(e=>[e.to,e]));
world.nodes=itinerary.map(({bossRef},i)=>{
 const n=byRef.get(bossRef);
 if(!n)throw new Error(`Missing world-map pin for ${bossRef}`);
 if(i)return {...n,unlockParameter:raceCompletionKey(itinerary[i-1].bossRef),unlockValue:true};
 const {unlockParameter,unlockValue,...origin}=n;
 return origin;
});
world.connections=world.nodes.slice(1).map((n,i)=>({...links.get(n.id),from:world.nodes[i].id,to:n.id}));
const serialized=JSON.stringify(menu,null,2)+'\n';
const old=fs.readFileSync(menuFile,'utf8');
if(serialized!==old){
 const meta=JSON.parse(fs.readFileSync(metadataFile));
 const replace=(file,s)=>{const tmp=file+'.regional.tmp';fs.writeFileSync(tmp,s);fs.renameSync(tmp,file);};
 replace(menuFile,serialized);
 replace(metadataFile,JSON.stringify({...meta,savedAt:Date.now()},null,2)+'\n');
}
console.log('Bound 11 editable regional maps; world travel: '+itinerary.map(r=>r.stage).join(' → '));
