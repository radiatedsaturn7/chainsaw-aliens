import {normalizeMenuDocument} from './MenuDocument.js';
import {setMenuProgress} from './MenuProgress.js';
import {motorsportCatalog,createMotorsportEvent,readMotorsportEvent,completeMotorsportRound,seriesStandings,serviceMotorsportEvent,availableSeriesService,seriesServiceHealth,SERIES_SAVE_KEY} from './MotorsportEvents.js';

export function installMotorsportNavigation(document){
 const world=document.screens?.find(s=>s.id==='world-map');if(!world)return;
 const ids=['world-international','world-space','world-rallies','world-race-index','world-championships','world-rally'];
 world.elements=world.elements.filter(e=>!ids.includes(e.id));
 for(const [i,[id,label]] of [['world-race-index','Index'],['world-championships','Championships']].entries())world.elements.push({id,type:'button',label,x:.025+i*.485,y:.025,w:.475,h:.085,fontSize:22,useDefaultFont:true,color:'#ffffff',background:'#000000',selectionIndicator:'cursor',cursorText:'>',action:{type:'back'}});
}
const time=ms=>{const s=Math.round(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
export class MotorsportMenu {
 constructor(player){this.player=player;this.kind='championships';this.lists={};}
 get game(){return this.player.game;}
 get state(){return readMotorsportEvent(this.player.flow?.parameters?.[SERIES_SAVE_KEY]);}
 get catalog(){return motorsportCatalog(this.player.flow.document.parameters.raceIndex||[]);}
 async save(state){await setMenuProgress(this.game,{[SERIES_SAVE_KEY]:state?JSON.stringify(state):''});}
 screen(id,title,buttons,lines=[],{remember=true,refresh=false}={}){
  const elements=[{id:'heading',type:'text',label:title,x:.035,y:.025,w:.93,h:.095,fontSize:26,useDefaultFont:true,color:'#ffffff'},
   ...buttons.map(([label,key],i)=>({id:key,type:'button',label,x:.035,y:.15+i*.1,w:.46,h:.085,fontSize:21,useDefaultFont:true,color:'#ffffff',background:'#000000',selectionIndicator:'cursor',cursorText:'>',action:{type:'back'}})),
   ...lines.map((label,i)=>({id:`detail-${i}`,type:'text',label,x:.52,y:.16+i*.075,w:.45,h:.07,fontSize:19,useDefaultFont:true,color:'#ffffff'}))];
  const screen=normalizeMenuDocument({screens:[{id,name:title,background:'#000000',useDefaultBackground:false,effect:'none',musicMode:'continue',elements}]}).screens[0];
  const flow=this.player.flow,at=flow.document.screens.findIndex(s=>s.id===id);if(at<0)flow.document.screens.push(screen);else flow.document.screens[at]=screen;
  if(!refresh||flow.screenId!==id)flow.goTo(id,{remember:remember&&flow.screenId!==id});
 }
 home(){
  if(this.state)return this.showEvent({remember:false});
  this.screen('motorsport-home','Championships',[
   ['Circuit Cups','motorsport-circuits'],['Rally','motorsport-rallies'],
   ['Back','motorsport-back']]);
 }
 entries(kind=this.kind){return this.catalog[kind==='rallies'?'rallyGroups':kind]||[];}
 formats(group){
  if(this.state)return this.showEvent({remember:false});
  this.rallySelection=group;
  this.screen('motorsport-formats',group.name,[...group.formats.map(f=>[`${f.rounds.length} Stages`,`motorsport-format-${f.rounds.length}`]),['Back','motorsport-back']],
   group.formats.flatMap(f=>[`${f.rounds.length} stages · ~${Math.round(f.rounds.reduce((n,r)=>n+r.seconds,0)/60)} min`,`${new Set(f.rounds.map(r=>r.ref)).size} distinct sections · ${f.rounds.length===4?'one pass':'two passes'}`]).concat(group.formats.length?['Selected roads, not a full WRC itinerary.','Stage lengths vary throughout.',...(group.formats.length===1?['12 stages needs more mapped sections.']:[])]:['More mapped sections needed.','Original roads remain playable in Index.']));
 }
 open(kind='championships',index){
  if(this.state)return this.showEvent({remember:false});
  this.kind=kind;const entries=this.entries(kind),prior=this.lists[kind]||{index:0,top:0};
  index=Math.max(0,Math.min(entries.length-1,index??prior.index));
  let top=Math.min(prior.top,index);
  if(index>=top+5)top=index-4;
  top=Math.max(0,Math.min(top,Math.max(0,entries.length-5)));
  this.lists[kind]={index,top};
  const start=this.lists[kind].top;
  const buttons=[['Up','motorsport-up'],...entries.slice(start,start+5).map((e,i)=>[e.name,`motorsport-pick-${i+start}`]),['Down','motorsport-down'],['Back','motorsport-back']];
  const focus=`motorsport-pick-${index}`;
  this.player.screenFocus?.set('motorsport-list',focus);
  this.screen('motorsport-list',kind==='rallies'?'Rally':'Circuit Cups',buttons,entries.length?kind==='rallies'?['Short: 4 stages','Full: 12 stages','Total time decides the winner.','Damage carries between stages.','Limited / full service: 30 / 60 pts','Full: six sections, two passes.']:['Named three-race cups','Closed circuits only','Six drivers · 3 laps per round','Points: 25 / 18 / 15 / 12 / 10 / 8','Heat 1–3 sets opponent difficulty.']:['No eligible events installed.'],{refresh:this.player.flow.screenId==='motorsport-list'});
  const items=this.player.interactive?.()||this.player.flow.screen.elements.filter(e=>e.type==='button');
  this.player.focus=Math.max(0,items.findIndex(e=>e.id===focus));
 }
 scroll(direction){this.open(this.kind,(this.lists[this.kind]?.index||0)+direction);}
 guard(){
  if(!this.state||!['world-map','race-index','garage','motorsport-home','motorsport-list','motorsport-formats','motorsport-preview'].includes(this.player.flow.screenId))return false;
  this.player.flow.history=[];this.showEvent({remember:false});return true;
 }
 back(){
  const flow=this.player.flow;if(!flow.screenId.startsWith('motorsport-'))return false;
  if(flow.screenId==='motorsport-event'){
   if(this.state?.phase==='complete')void this.activate('motorsport-close').catch(e=>{flow.error=e.message;});
   else this.confirmQuit();
  }else if(['motorsport-service','motorsport-retire'].includes(flow.screenId)){
   flow.history=[];this.showEvent({remember:false});
  }else{const target=flow.history.pop();if(target)flow.goTo(target,{remember:false});else flow.goTo('world-map',{remember:false});}
  return true;
 }
 confirmQuit(){this.screen('motorsport-retire','Quit this event?',[['Quit Event','motorsport-retire-confirm'],['Cancel','motorsport-service-back']],['Event progress will be discarded.']);}
 preview(definition){
  if(this.state)return this.showEvent({remember:false});
  this.selection=definition;
  this.screen('motorsport-preview',definition.name,[['Enter','motorsport-enter'],['Back','motorsport-back']],
   [`Heat ${definition.heat} / 3`,definition.kind==='rally'?`${definition.rounds.length} stages · timed rivals`:'3 rounds · live AI opponents',...definition.rounds.slice(0,6).map((r,i)=>`${i+1}. ${r.ref}${r.pass?' · P'+r.pass+' · ~'+Math.round(r.seconds/60)+' min':''}`),...(definition.rounds.length>6?['…plus six further stages']:[]),definition.kind==='rally'?`Service every ${definition.serviceEvery} stages`:'Points decide the championship']);
 }
 showEvent({remember=true}={}){
  const state=this.state;if(!state)return this.open(this.kind);
  const definition=state.definition,complete=state.phase==='complete';
  const buttons=complete?[['Close Event','motorsport-close']]:[[state.phase==='racing'?'Restart Round':'Start Next','motorsport-drive']];
  if(state.phase==='between'&&definition.kind==='rally'&&state.round%definition.serviceEvery===0)buttons.push([`Service (${state.serviceBudget} pts)`,'motorsport-service']);
  if(!complete)buttons.push(['Quit Event','motorsport-retire']);
  const next=definition.rounds[state.round];
  const lines=[complete?'Final standings':`Next: ${state.round+1} / ${definition.rounds.length}`,next?`${next.ref}${next.pass?' · Pass '+next.pass:''}`:'Event complete',
   ...seriesStandings(state).map((r,i)=>`${i+1}. ${r.name}  ${definition.kind==='rally'?(r.retired?'DNF':time(r.timeMs)):`${r.points} pts`}`),
   definition.kind==='rally'?(state.serviceBudget?`Service available: ${state.serviceBudget} points`:'No service at this stop'):'Ties: wins, then finishing places'];
  this.screen('motorsport-event',definition.name,buttons,lines,{remember});
 }
 showService(){
  const state=this.state;
  this.screen('motorsport-service',`Service · ${state.serviceBudget} points`,[...availableSeriesService(state).map(g=>[`${g.name} ${seriesServiceHealth(state,g)}% · ${g.cost}`,`motorsport-repair-${g.id}`]),['Back','motorsport-service-back']],['Choose repairs within the budget.','Unused points expire at next start.','No repairs between service stops.','Engine / drivetrain: full service only.']);
 }
 async enter(){
  if(this.state)throw Error('Finish or retire your current event first.');
  const ref=this.player.flow.parameters.carRef||this.game.menuProgress?.selectedGameCar;
  const garage=this.player.resources.garage;
  await this.save(createMotorsportEvent(this.selection,ref,garage.configuration(ref)));this.player.flow.history=[];this.showEvent({remember:false});
 }
 async drive(){
  const state=this.state;if(!state||state.phase==='complete')throw Error('Choose an active event.');
  const setup=this.player.resources.garage.configuration(state.carRef);
  if(JSON.stringify({installed:setup.installed||{},tune:setup.tune||{}})!==state.setup)throw Error('Restore the entered car setup, or retire and enter again.');
  const next={...state,phase:'racing',serviceBudget:0};await this.save(next);
  const parameters={...this.player.flow.parameters,carRef:state.carRef,motorsportId:state.id,motorsportRound:state.round};
  this.player.raceIntroCutscene=true;this.player.cleanupScreen();
  try{
   const ok=await this.game.startRaceTravel({raceName:state.definition.rounds[state.round].ref,carSelection:'specific',carRef:state.carRef,menuConfiguration:parameters,menuFlow:this.player.flow,garage:this.player.resources.garage,motorsportEvent:next});
   if(!ok)throw Error(this.game.lastRaceTravelError||'Could not start event.');
  }finally{this.player.raceIntroCutscene=false;}
 }
 async record(session,{dnf=false}={}){
  const state=this.state,config=session.menuConfiguration;
  if(!state||config?.motorsportId!==state.id||config.motorsportRound!==state.round||state.phase!=='racing')return;
  await this.save(completeMotorsportRound(state,session,{dnf}));
 }
 async finish(session){
  await this.record(session);this.showEvent({remember:false});
  await this.game.openMenuDestination({menuScreen:'motorsport-event'});
  this.player.flow.history=[];
 }
 async activate(id){
  if(id==='motorsport-back'){this.back();return;}
  if(id==='motorsport-up'||id==='motorsport-down'){this.scroll(id.endsWith('down')?1:-1);return;}
  if(id==='motorsport-circuits'){this.open('championships');return;}
  if(id==='motorsport-rallies'){this.open('rallies');return;}
  if(id.startsWith('motorsport-format-')){this.preview(this.rallySelection.formats.find(f=>f.rounds.length===Number(id.slice(18))));return;}
  if(id.startsWith('motorsport-pick-')){const entry=this.entries()[Number(id.slice(16))];if(this.kind==='rallies')this.formats(entry);else this.preview(entry);return;}
  if(id==='motorsport-enter')return this.enter();
  if(id==='motorsport-service-back'){this.player.flow.history.pop();this.showEvent({remember:false});return;}
  if(id==='motorsport-drive')return this.drive();
  if(id==='motorsport-service'){this.showService();return;}
  if(id.startsWith('motorsport-repair-')){await this.save(serviceMotorsportEvent(this.state,id.slice(18)));this.showService();return;}
  if(id==='motorsport-retire'){this.confirmQuit();return;}
  if(id==='motorsport-retire-confirm'||id==='motorsport-close'){await this.save(null);this.player.flow.history=['world-map'];this.home();this.player.flow.history=['world-map'];return;}
 }
}
