import {TUNING_SECTIONS} from './GarageTuning.js';
import {garageBrowserRows} from '../menus/MenuGarageWidgets.js';
export const GARAGE_DIALOGUE={
 garage:{
 drive:"Ready to head out?",
 tune:"Maybe we can make it run faster?",
 upgrade:"If we got enough scrap, I can fabricate something new."
 },
 tuning:{
 pressure:"Hmm... maybe a little less pressure? I mean, half these roads are barely roads anymore.",
 tires:"You think we'll need something for dirt or snow? I'd rather not waste a good set of tires on pavement.",
 engine:"We could get a little more power out of it. Or lose some weight. I'm not sure how much more this thing can take.",
 gearing:"We could make it accelerate faster, but we'd lose some top speed. I guess it depends on what we're expecting out there.",
 suspension:"I'm thinking softer suspension might help. I mean, have you seen the roads lately?",
 alignment:"We could probably get it to corner better. Might be worth trying, especially with some of those highways falling apart.",
 brakes:"Hmm... we can change the brake balance. I'd rather not find out we got it wrong halfway down a mountain.",
 differential:"We could change how the power gets to the wheels. More traction might help, but turning could get interesting."
 },
 upgrades:{
 Tires:"You know, we might want to spend some scrap on better tires. Then again, these have gotten us pretty far.",
 Engine:"I've been thinking about a bigger turbo. I don't know. That's a lot of scrap for something we might blow up.",
 Body:"We could reinforce the car a little. Although, I kind of wonder how much more weight we really want to carry.",
 Drivetrain:"I'm thinking we should put some scrap into the drivetrain. All that horsepower isn't helping if we can't use it.",
 Handling:"Maybe we should work on the suspension next. I'd rather not lose the car to a pothole after everything we've been through."
 },
 events:{
 insufficient:"Yeah, I think we could do that. We just don't have enough scrap yet. Maybe we should see what else we can find.",
 expensive:"That's most of what we've got. I mean, it might be worth it. What do you think?",
 confirming:"Alright, let's do it. I've actually been wanting to try this.",
 installed:"Hmm. Yeah, I think that's better. Guess we'll find out.",
 maximum:"I think we've done about everything we can with this. At least until we find something better.",
 returned:"Well, we're back. So... what do you think we should work on?",
 badRace:"Yeah, that could've gone better. I guess we've got a few things to figure out.",
 won:"Hey, that actually worked. I mean, I thought it would, but still.",
 broke:"We probably should've saved some of that. Oh well. Too late now.",
 city:"You know, I remember when you couldn't drive through here without hitting traffic. Kind of miss that, actually.",
 repaired:"I wonder how much of this thing is still original. I mean, we've replaced just about everything.",
 highway:"I used to drive this road all the time. It's weird seeing it like this.",
 engineMemory:"I used to know somebody who would've loved working on this. Anyway... you think we should try it?",
 damaged:"Hmm. We can fix it. I just hope we don't have to keep doing this forever.",
 journey:"Well, we're still moving. I guess that's what matters right now.",
 quiet:"Sometimes I forget how much things have changed. Then I look outside.",
 personal:"I'm glad we're doing this together, you know. I don't think I'd have gotten very far on my own."
 }
};
export function garageDialogueContext(screen,resources,parameters,states=new Map(),focusedId=null){
 const tuner=screen.elements.find(e=>e.type==='garage-tuner');
 if(tuner){const state=states.get(tuner.id)?.tuner;return {kind:'tuning',category:TUNING_SECTIONS[state?.index||0]?.id||'pressure',selection:state?.mode==='grid'?'':String(state?.rowIndex||0)};}
 const browser=screen.elements.find(e=>e.type==='garage-browser');
 if(browser){
  const state=states.get(browser.id)||{},rows=garageBrowserRows(resources,parameters,state),row=rows[Math.min(state.index||0,Math.max(0,rows.length-1))];
  const category=state.section||row?.value||'Engine',entry=state.slot?resources.garageCatalog().find(e=>e.ref===row?.value):null;
  const garage=resources.garage,credits=Number(garage?.items.game?.player?.credits??garage?.items.savedStats?.credits)||0;
  const installed=garage?.configuration(parameters.carRef).installed[state.slot],item=entry?.item,owned=item&&(garage?.availableCount(item.id)>0||installed===item.id);
  const candidates=resources.garageCatalog().filter(e=>e.item.carPart.slot===state.slot);
  const rank=t=>({street:1,sport:2,race:3,custom:4}[t]||0);
  const maximum=!!item&&installed===item.id&&!candidates.some(e=>rank(e.item.carPart.tier)>rank(item.carPart.tier)||(rank(e.item.carPart.tier)===rank(item.carPart.tier)&&e.item.carPart.price>item.carPart.price));
  return {kind:'upgrades',category,selection:state.slot?row?.value:state.section?row?.value:'',insufficient:!!item&&!owned&&credits<item.carPart.price,expensive:!!item&&!owned&&credits>0&&item.carPart.price>=credits*.6,maximum};
 }
 const category=screen.id==='garage'?({'garage-play':'drive','garage-tune':'tune','garage-upgrade':'upgrade'}[focusedId]||'drive'):'';
 return {kind:'garage',category};
}
export function garageDialogueText(context){
 if(context.insufficient)return GARAGE_DIALOGUE.events.insufficient;
 if(context.maximum)return GARAGE_DIALOGUE.events.maximum;
 if(context.expensive)return GARAGE_DIALOGUE.events.expensive;
 if(context.kind==='garage')return GARAGE_DIALOGUE.garage[context.category]||'';
 if(context.kind==='tuning')return GARAGE_DIALOGUE.tuning[context.category]||'';
 if(context.kind==='upgrades')return GARAGE_DIALOGUE.upgrades[context.category]||(context.category==='Brakes'?GARAGE_DIALOGUE.tuning.brakes:'');
 return '';
}
const key=c=>`${c.kind}:${c.category}:${c.selection||''}`;
export class GarageDialogueState{
 constructor(){this.visits=0;this.lastRace='';this.lastTrigger='';this.lastScreen='';this.event=null;this.lastContext='';this.engineVisits=0;}
 say(event,context,now=Date.now()){if(GARAGE_DIALOGUE.events[event])this.event={text:GARAGE_DIALOGUE.events[event],key:key(context),until:now+Math.max(6500,(GARAGE_DIALOGUE.events[event].length/40+(GARAGE_DIALOGUE.events[event].match(/[.!?]/g)||[]).length*.35+3)*1000)};}
 enter(screen,parameters,context,now=Date.now()){
  const from=this.lastScreen;this.lastScreen=screen.id;this.event=null;
  if(!['garage','tuning','upgrades'].includes(screen.id))return;
  const raceToken=`${parameters.lastCompletedRace||''}:${parameters.garageReturnCount||0}`;
  const trigger=String(parameters.garageDialogueEvent||''),token=`${trigger}:${raceToken}:${parameters.chapter||''}`;
  if(trigger&&token!==this.lastTrigger&&GARAGE_DIALOGUE.events[trigger]){this.lastTrigger=token;this.say(trigger,context,now);return;}
  if(screen.id!=='garage'||['tuning','upgrades'].includes(from))return;
  this.visits++;
  if(parameters.lastCompletedRace&&raceToken!==this.lastRace){this.lastRace=raceToken;this.say('returned',context,now);}
  else if(this.visits%5===0){const stories=['city','quiet','personal'];this.say(stories[(this.visits/5-1)%stories.length],context,now);}
 }
 text(context,now=Date.now()){
  const selection=key(context);
  if(selection!==this.lastContext){this.lastContext=selection;if(context.kind==='upgrades'&&context.category==='Engine'&&!context.insufficient&&!context.expensive&&++this.engineVisits%6===0)this.say('engineMemory',context,now);}
  if(this.event&&(this.event.until<=now||this.event.key!==key(context)))this.event=null;
  return this.event?.text||garageDialogueText(context);
 }
}
