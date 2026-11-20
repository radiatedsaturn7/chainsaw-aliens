import {normalizeMenuDocument} from './MenuDocument.js';
import {raceLocationGroup} from '../racing/RaceLocation.js';
export function isInternationalRace(entry){return !entry.location?.body&&!!entry.location?.country&&entry.location.country!=='US';}
export function raceIndexEntries(entries=[],category='all'){
 return [...new Map(entries.filter(e=>e.ref&&(category!=='international'||isInternationalRace(e))&&(category!=='rallies'||e.rally?.id)&&(category!=='space'||['Moon','Mars'].includes(e.location?.body))).map(e=>[e.ref,{...e,group:category==='rallies'?{key:e.rally.id,label:`${e.location?.country||''} · ${e.rally.name}`,sort:`${e.location?.country||''} ${e.rally.name}`} : category==='international'?{key:e.venue||e.name,label:e.venue||e.name,sort:e.venue||e.name}:raceLocationGroup(e.location)}])).values()]
  .sort((a,b)=>a.group.sort.localeCompare(b.group.sort)||(category==='rallies'?(a.layout||a.name).localeCompare(b.layout||b.name):a.name.localeCompare(b.name)));
}
// A moving window, never pages. State headings are repeated at the top of a
// clipped group so the location is always visible after scrolling.
export function raceIndexScreen(entries,index=0,top=0,access=()=>({allowed:true}),category='all'){
 index=Math.max(0,Math.min(entries.length-1,index));top=Math.max(0,Math.min(top,index));
 if(index>=top+5)top=index-4;
 const rows=[];let group='';
 for(let i=top;i<entries.length&&rows.length<7;i++){
  const entry=entries[i];if(group!==entry.group.key){rows.push({heading:true,label:entry.group.label});group=entry.group.key;}
  if(rows.length<7)rows.push({entry,index:i});
 }
 // A boundary heading can consume a row. Advance only enough to reveal selection.
 if(entries.length&&!rows.some(r=>r.index===index))return raceIndexScreen(entries,index,top+1,access,category);
 const elements=[{id:'heading',type:'text',label:category==='space'?'Space':category==='international'?'International':category==='rallies'?'Rallies':'Race Index',x:.04,y:.02,w:.92,h:.09,fontSize:28,useDefaultFont:true}];
 const button={type:'button',x:.04,w:.46,h:.07,fontSize:20,useDefaultFont:true,color:'#ffffff',background:'#000000',selectionIndicator:'cursor',cursorText:'>'};
 elements.push({...button,id:'index-up',label:'Up',y:.12,action:{type:'back'}});
 for(const [row,r] of rows.entries())elements.push(r.heading?
  {id:`state-${row}`,type:'text',label:r.label,x:.04,y:.22+row*.085,w:.46,h:.075,fontSize:22,useDefaultFont:true,color:'#ffffff'}:
  {...button,id:`index-race-${r.index}`,label:((category==='international'||category==='rallies')?(r.entry.layout||r.entry.name):r.entry.name)+(access(r.entry.ref).allowed?'':' (Locked)'),y:.22+row*.085,
   action:{type:'set-param',parameter:'raceRef',value:r.entry.ref,then:{type:'screen',target:'garage'}}});
 elements.push({...button,id:'index-down',label:'Down',y:.85,action:{type:'back'}},
  {id:'route-preview',type:'race-description',property:'route-preview',x:.53,y:.15,w:.43,h:.76,useDefaultFont:true,color:'#ffffff'});
 const screen=normalizeMenuDocument({screens:[{id:'race-index',name:'Race Index',background:'#000000',useDefaultBackground:false,effect:'none',musicMode:'continue',elements},{id:'garage',elements:[]}]}).screens[0];
 return {screen,index,top,category};
}
