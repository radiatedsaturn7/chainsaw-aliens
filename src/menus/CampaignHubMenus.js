import {authorCampaignPath,campaignPathScreen} from './CampaignPaths.js';
import {normalizeMenuDocument} from './MenuDocument.js';

// Surface comes from the installed course, not the old core/wildcard priority.
export function campaignEventCategory(event) {
 if(['roads','cities','detours','raceways'].includes(event.campaignCategory))return event.campaignCategory;
 if(event.city || event.kind==='city')return 'cities';
 if(event.venueKey || /circuit|drag|raceway|oval|kart/i.test(`${event.import_kind||''} ${event.event_type||event.eventType||''}`))return 'raceways';
 const surfaces=event.installedSurfaces||event.surface||[];
 if(surfaces.some(s=>!['asphalt','wet-asphalt','concrete','paved'].includes(s)))return 'detours';
 if(!surfaces.length && /gravel|dirt|snow|rally|forest|unpaved/i.test(`${event.import_kind||''} ${event.event_type||''}`))return 'detours';
 return 'roads';
}

export function createCampaignHubMenus(catalog, research, installed = []) {
 const ready = new Map(installed.filter(e => e.status === 'installed').map(e => [e.id,e]));
 const screens=[], hubs={},sideGates={},progression={version:2,regions:[]};
 const select=ref=>({type:'set-param',parameter:'raceRef',value:ref,then:{type:'screen',target:'garage'}});
 const back={label:'Back',action:{type:'back'}};
 const link=(label,target)=>({label,action:{type:'screen',target}});
 const screen=(id,name,rows)=>({
  id,name,background:'#000000',useDefaultBackground:false,effect:'none',musicMode:'continue',
  elements:[{id:'heading',type:'text',label:name,x:.06,y:.03,w:.88,h:.1,fontSize:28,useDefaultFont:true},
   ...rows.map((r,i)=>({id:`row-${i}`,type:'button',x:.04,y:.17+i*.09,w:.45,h:.08,fontSize:24,
    color:'#ffffff',background:'#000000',selectionIndicator:'cursor',cursorText:'>',useDefaultFont:true,...r})),
   {id:'route-preview',type:'race-description',property:'route-preview',x:.52,y:.17,w:.44,h:.74,useDefaultFont:true,color:'#ffffff'}]
 });
 // Five choices plus Previous/Next/Back always fits the eight-button limit.
 const pages=(id,name,rows,gate)=>{
  const size=rows.length<=7?7:5,count=Math.max(1,Math.ceil(rows.length/size));
  for(let i=0;i<count;i++){
   const pageId=i?`${id}-page-${i+1}`:id;
   const buttons=rows.slice(i*size,(i+1)*size);
   if(i)buttons.push({label:'Previous',action:{type:'screen',target:i===1?id:`${id}-page-${i}`,replace:true}});
   if(i<count-1)buttons.push({label:'Next',action:{type:'screen',target:`${id}-page-${i+2}`,replace:true}});
   screens.push(screen(pageId,count>1?`${name} · ${i+1}/${count}`:name,[...buttons,back]));
   if(gate)sideGates[pageId]=gate;
  }
 };
 for(const chapter of research.hubs){
  const boss=catalog.find(e=>e.stage===chapter.sequence);
  if(!boss)throw Error(`Missing campaign stage ${chapter.sequence}`);
  const id=`campaign-hub-${boss.stage}`,gate=null;
  hubs[boss.name]=id;
  const candidates=chapter.races.map(r=>({...r,...ready.get(r.id)}));
  const known=new Set(candidates.map(r=>r.id));
  candidates.push(...installed.filter(e=>e.hubStage===boss.stage&&!known.has(e.id)));
  // A promoted city race is the boss, not also a repeatable side-event entry.
  for(let i=candidates.length-1;i>=0;i--)if(candidates[i].raceRef===boss.name)candidates.splice(i,1);
  const pool=candidates.filter(r=>ready.has(r.id)),ordered=[];
  // Gentle local opening, then rotate disciplines to leave meaningful choice.
  if(boss.stage===1)for(const ref of ['Tower Hill Road','RI 116 — North Smithfield Scituate','Blue Hills — Reservation Parkways','RI 44 — Putnam Pike Glocester']){
   const e=pool.find(e=>e.raceRef===ref);if(e){ordered.push(e.raceRef);pool.splice(pool.indexOf(e),1);}
  }
  while(pool.length)for(const category of ['roads','detours','cities','raceways']){
   const i=pool.findIndex(e=>campaignEventCategory(e)===category);if(i>=0)ordered.push(pool.splice(i,1)[0].raceRef);
  }
  const region=authorCampaignPath({bossRef:boss.name,stage:boss.stage,events:[...new Set(ordered)],batchSize:4,clearsPerBatch:3,bossClears:Math.min(9,ordered.length)});
  progression.regions.push(region);
  if(region.mainPath)screens.push(campaignPathScreen(region,boss.label||boss.name));
  screens.push(screen(region.mainPath?`${id}-events`:id,boss.label||boss.name,[
   {label:'Main Mission',action:select(boss.name)},
   link('Road Runs',`${id}-roads`),link('City Runs',`${id}-cities`),link('Detours',`${id}-detours`),link('Raceways',`${id}-raceways`),back
  ]));
  const choice=r=>({label:(r.layoutLabel||r.displayName||r.raceRef||r.name)+(ready.has(r.id)?'':' (Unavailable)'),
   fontSize:20,disabled:!ready.has(r.id),action:ready.has(r.id)?select(r.raceRef):null});
  for(const [category,label] of [['roads','Road Runs'],['cities','City Runs'],['detours','Detours'],['raceways','Raceways']]){
   const events=candidates.filter(r=>campaignEventCategory(r)===category),rows=[],venues=new Set();
   for(const r of events){
    if(!r.venueKey){rows.push(choice(r));continue;}
    if(venues.has(r.venueKey))continue;
    venues.add(r.venueKey);
    const target=`${id}-venue-${r.venueKey}`;
    rows.push(link(r.venueName||r.name,target));
    pages(target,r.venueName||r.name,events.filter(e=>e.venueKey===r.venueKey).map(choice),gate);
   }
   pages(`${id}-${category}`,`${boss.label||boss.name} · ${label}`,rows,gate);
  }
 }
 return {screens:normalizeMenuDocument({screens:[...screens,{id:'garage',elements:[]}]}).screens.filter(s=>s.id!=='garage'),hubs,sideGates,progression};
}
