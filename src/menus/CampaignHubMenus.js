import {normalizeMenuDocument} from './MenuDocument.js';

// Generated from the same event catalog as the importer. Only installed races
// get launch actions; failed imports remain explicitly unavailable.
export function createCampaignHubMenus(catalog, research, installed = []) {
 const ready = new Map(installed.filter(e => e.status === 'installed').map(e => [e.id,e]));
 const screens=[], hubs={};
 const select=ref=>({type:'set-param',parameter:'raceRef',value:ref,then:{type:'screen',target:'garage'}});
 const back={label:'Back',action:{type:'back'}};
 const screen=(id,name,rows)=>({
  id,name,background:'#000000',useDefaultBackground:false,effect:'none',musicMode:'continue',
  elements:[{id:'heading',type:'text',label:name,x:.06,y:.03,w:.88,h:.1,fontSize:28,useDefaultFont:true},
   ...rows.map((r,i)=>({id:`row-${i}`,type:'button',x:.06,y:.17+i*.09,w:.88,h:.08,fontSize:24,
    color:'#ffffff',background:'#000000',selectionIndicator:'cursor',cursorText:'>',useDefaultFont:true,...r}))]
 });
 for(const chapter of research.hubs){
  const boss=catalog.find(e=>e.stage===chapter.sequence);
  if(!boss)throw Error(`Missing campaign stage ${chapter.sequence}`);
  const id=`campaign-hub-${boss.stage}`;
  hubs[boss.name]=id;
  screens.push(screen(id,boss.label||boss.name,[
   {label:'Main mission',action:select(boss.name)},
   {label:'Side races',action:{type:'screen',target:`${id}-core`}},
   {label:'Detours',action:{type:'screen',target:`${id}-detours`}},back
  ]));
  for(const [suffix,priority] of [['core','core'],['detours','wildcard']]){
   const candidates=chapter.races.filter(r=>priority==='core'?r.priority==='core':r.priority!=='core');
   if(candidates.length>7)throw Error('Split side-event lists before exceeding eight buttons');
   screens.push(screen(`${id}-${suffix}`,`${boss.label||boss.name} · ${suffix==='core'?'Side races':'Detours'}`,[
    ...candidates.map(r=>({label:(ready.get(r.id)?.displayName||ready.get(r.id)?.raceRef||r.name)+(ready.has(r.id)?'':' (Unavailable)'),
      fontSize:20,disabled:!ready.has(r.id),action:ready.has(r.id)?select(ready.get(r.id).raceRef):null})),back
   ]));
  }
 }
 return {screens:normalizeMenuDocument({screens:[...screens,{id:'garage',elements:[]}]}).screens.filter(s=>s.id!=='garage'),hubs};
}
