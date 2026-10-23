import {createLoadingMenuScreen} from './MenuLoadingScreen.js';
import {normalizeWorldMapStyle,normalizeWorldMapConnections} from './MenuWorldMap.js';
import {DEFAULT_MUSIC_VOLUME} from '../audio/musicVolume.js';
import {menuEmbeddedAsset} from './MenuAppearance.js';
import {createGarageMenuScreen,createCarShowroomScreen,createTuningMenuScreen,createUpgradeMenuScreen,createWorldMapMenuScreen} from '../garage/GarageMenu.js';
export const MENU_ELEMENT_TYPES = ['progress-bar','random-fact','garage-dialogue','garage-tuner','race-description','code-entry','world-map','car-showroom','garage-browser','shape','container','text','image','button','choice','slider','toggle','keybind','car-preview','car-description','car-stats','power-curve','video','property-display','asset-preview'];
export const MENU_ACTION_TYPES = ['cheat-code','screen','new-game','back','set-param','race','level','movie','quit','garage-fit','garage-buy','garage-install','garage-remove','garage-tune','garage-reset'];
export const MENU_ANIMATIONS = ['none','pulse','fade','bob','spin','typewriter'];
export const MENU_SETTINGS = {
  fxVolume:{label:'FX volume',min:0,max:1,step:0.05,default:0.8},
  musicVolume:{label:'Music volume',min:0,max:1,step:0.05,default:DEFAULT_MUSIC_VOLUME},
  brightness:{label:'Brightness',min:0.3,max:1.8,step:0.05,default:1},
  sensitivity:{label:'Control sensitivity',min:0.2,max:3,step:0.1,default:1}
};
const number=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const text=(value,fallback='')=>typeof value==='string'?value.slice(0,2048):fallback;
export function validMenuParameter(key){return typeof key==='string'&&/^[a-zA-Z][\w.-]{0,79}$/.test(key)&&!key.split('.').some(k=>['__proto__','prototype','constructor'].includes(k));}
export function normalizeMenuAction(action,depth=0){
  if(!action)return null;if(depth>8)throw Error('Limit action chains to nine actions');
  if(!MENU_ACTION_TYPES.includes(action.type))throw Error(`Unknown menu action: ${action.type}`);
  const result={type:action.type,target:text(action.target),parameter:text(action.parameter),value:structuredClone(action.value??null)};
  if(result.parameter&&!validMenuParameter(result.parameter))throw Error('Invalid parameter name');
  if(action.then&&!['race','level'].includes(action.type))result.then=normalizeMenuAction(action.then,depth+1);
  return result;
}
export function normalizeMenuElement(source={},index=0){
  const type=MENU_ELEMENT_TYPES.includes(source.type)?source.type:'text';
  const legacyIndicator=(source.selectionBorder===undefined?type==='car-showroom':source.selectionBorder===false)?'disabled':'border';
  const selectionIndicator=['cursor','border','disabled'].includes(source.selectionIndicator)?source.selectionIndicator:legacyIndicator;
  const binding=text(source.binding);if(source.angleBinding&&!validMenuParameter(source.angleBinding))throw Error('Invalid rotation binding');if(binding&&!validMenuParameter(binding))throw Error('Invalid parameter binding');
  return {id:text(source.id,`element-${index+1}`),type,parentId:text(source.parentId),shape:['rectangle','ellipse','triangle'].includes(source.shape)?source.shape:'rectangle',fill:text(source.fill,'#49758c'),stroke:text(source.stroke,'#ffffff'),strokeWidth:number(source.strokeWidth,0,0,30),label:text(source.label,'New item'),
    x:number(source.x,0.1,-2,2),y:number(source.y,0.1,-2,2),w:number(source.w,0.8,0.01,3),h:number(source.h,0.08,0.01,3),
    tabOrder:Math.round(number(source.tabOrder,0,0,9999)),color:text(source.color,'#ffffff'),background:text(source.background,'#253c49'),transparentBackground:source.transparentBackground===true,showSelectedLabel:source.showSelectedLabel!==false,codeLength:Math.round(number(source.codeLength,6,1,16)),fontSize:number(source.fontSize,26,8,160),useDefaultFont:source.useDefaultFont??(!source.fontData&&(!source.fontFamily||source.fontFamily==='system-ui')),fontFamily:text(source.fontFamily,'system-ui'),fontData:menuEmbeddedAsset(source.fontData),fontFileName:text(source.fontFileName),cursorText:text(source.cursorText,'>'),cursorArtRef:text(source.cursorArtRef),cursorData:menuEmbeddedAsset(source.cursorData),cursorFileName:text(source.cursorFileName),cursorSize:number(source.cursorSize,24,8,160),selectionIndicator,selectionBorder:selectionIndicator==='border',
    dataSource:['cars','actors','parameters','doodads','garage'].includes(source.dataSource)?source.dataSource:'cars',assetRef:text(source.assetRef),property:text(source.property,'name'),suffix:text(source.suffix),decimals:number(source.decimals,0,0,6),
    angleBinding:text(source.angleBinding),angle:number(source.angle,180,-3600,3600),imageFit:['contain','cover','stretch'].includes(source.imageFit)?source.imageFit:'contain',
    textOutlineWidth:number(source.textOutlineWidth,0,0,8),
    textOutlineColor:/^#[0-9a-f]{6}$/i.test(source.textOutlineColor||'')?source.textOutlineColor:'#000000',
    textFill:['gradient','gradient3'].includes(source.textFill)?source.textFill:'solid',
    textGradientDirection:source.textGradientDirection==='horizontal'?'horizontal':'vertical',
    textGradientStart:/^#[0-9a-f]{6}$/i.test(source.textGradientStart||'')?source.textGradientStart:'#70baff',
    textGradientMiddle:/^#[0-9a-f]{6}$/i.test(source.textGradientMiddle||'')?source.textGradientMiddle:'#ffffff',
    textGradientEnd:/^#[0-9a-f]{6}$/i.test(source.textGradientEnd||'')?source.textGradientEnd:'#70baff',
    artRef:text(source.artRef),videoUrl:text(source.videoUrl),binding,source:text(source.source),
    facts:(Array.isArray(source.facts)?source.facts:[]).slice(0,1000).map(f=>String(f).trim()).filter(Boolean),
    options:(Array.isArray(source.options)?source.options:[]).slice(0,200).map(option=>({label:text(option.label,String(option.value??'')),value:structuredClone(option.value??'')})),
    min:number(source.min,0,-1e6,1e6),max:number(source.max,1,-1e6,1e6),step:number(source.step,0.05,0.0001,1e6),
    typewriterSpeed:number(source.typewriterSpeed,40,1,200),typewriterPause:number(source.typewriterPause,.35,0,3),
    animation:MENU_ANIMATIONS.includes(source.animation)?source.animation:'none',duration:number(source.duration,2,0.1,600),
    nodes:(Array.isArray(source.nodes)?source.nodes:[]).slice(0,100).map((n,i)=>({id:text(n.id,`node-${i+1}`),label:text(n.label,'Race'),raceRef:text(n.raceRef),kind:n.kind==='junction'?'junction':'race',disabled:n.disabled===true,artRef:text(n.artRef),selectedArtRef:text(n.selectedArtRef),disabledArtRef:text(n.disabledArtRef),x:number(n.x,.5,0,1),y:number(n.y,.5,0,1),unlockParameter:validMenuParameter(n.unlockParameter)?n.unlockParameter:'',unlockValue:structuredClone(n.unlockValue??true),completedParameter:validMenuParameter(n.completedParameter)?n.completedParameter:''})),
    mapManual:source.mapManual===true||Boolean(source.nodes?.length),
    connections:normalizeWorldMapConnections(source.connections),mapStyle:normalizeWorldMapStyle(source.mapStyle),
    maxVisible:Math.round(number(source.maxVisible,4,1,4)),selectedZoomDuration:number(source.selectedZoomDuration,.18,.05,3),selectedScale:number(source.selectedScale,1.25,1,1.4),inactiveOpacity:number(source.inactiveOpacity,.4,.1,1),
    onSelect:normalizeMenuAction(source.onSelect),action:normalizeMenuAction(source.action),visible:source.visible!==false,disabled:source.disabled===true,loop:source.loop!==false,
    keyframes:(Array.isArray(source.keyframes)?source.keyframes:[]).slice(0,100).map(k=>({time:number(k.time,0,0,600),x:number(k.x,source.x??0.1,-2,2),y:number(k.y,source.y??0.1,-2,2),opacity:number(k.opacity,1,0,1),scale:number(k.scale,1,0.05,10),rotation:number(k.rotation,0,-3600,3600)})).sort((a,b)=>a.time-b.time)};
}
export function normalizeMenuDocument(source={}){
  // Older menus stored a separate schedule. Resolve its entry race only;
  // subsequent destinations belong to that race's own finish behavior.
  if(Array.isArray(source.grandPrix)){
    source=structuredClone(source);
    const first=id=>{const r=source.grandPrix.find(g=>g.id===id)?.races?.[0];return typeof r==='string'?r:r?.raceRef||''};
    const migrate=a=>{if(!a)return;if(a.type==='grand-prix'){a.type='race';if(!a.target?.startsWith('$'))a.target=first(a.target);else{const key=a.target.slice(1);if(source.parameters?.[key])source.parameters[key]=first(source.parameters[key])||source.parameters[key];}}migrate(a.then)};
    for(const screen of source.screens||[]){migrate(screen.startAction);for(const e of screen.elements||[]){if(e.label==='Start Grand Prix')e.label='Start Race';if(e.source==='grandPrix'){e.source=source.grandPrix.length?'':'races';e.options=source.grandPrix.map(g=>({label:g.name,value:first(g.id)}));if(source.parameters?.[e.binding])source.parameters[e.binding]=first(source.parameters[e.binding])||source.parameters[e.binding];}migrate(e.action);}}
  }
  const screens=(Array.isArray(source.screens)?source.screens:[]).slice(0,100).map((s,i)=>({id:text(s.id,`screen-${i+1}`),name:text(s.name,`Screen ${i+1}`),
    useDefaultBackground:s.useDefaultBackground===true||(s.useDefaultBackground!==false&&s.background===undefined&&s.backgroundArt===undefined&&s.effect===undefined),background:text(s.background,'#101c28'),backgroundArt:text(s.backgroundArt),musicRef:text(s.musicRef),musicLoop:s.musicLoop!==false,musicVolume:number(s.musicVolume,1,0,1),musicFadeIn:number(s.musicFadeIn,.4,0,30),musicFadeOut:number(s.musicFadeOut,.4,0,30),musicStart:number(s.musicStart,0,0,86400),effect:['none','stars','rain','snow'].includes(s.effect)?s.effect:'none',effectIntensity:number(s.effectIntensity,1,0,4),effectWind:number(s.effectWind,0,-3,3),
    transitionGroup:text(s.transitionGroup),
    backgroundRules:(Array.isArray(s.backgroundRules)?s.backgroundRules:[]).slice(0,100).map(r=>({when:r.when==='chapter'?'chapter':'lastCompletedRace',value:text(r.value),artRef:text(r.artRef)})).filter(r=>r.value&&r.artRef),
    startAction:normalizeMenuAction(s.startAction),elements:(Array.isArray(s.elements)?s.elements:[]).slice(0,200).map(normalizeMenuElement)}));
  if(!screens.length)throw Error('A menu needs at least one screen');
  if(new Set(screens.map(s=>s.id)).size!==screens.length)throw Error('Screen IDs must be unique');
  for(const s of screens)if(new Set(s.elements.map(e=>e.id)).size!==s.elements.length)throw Error('Element IDs must be unique within a screen');
  for(const screen of screens)for(const e of screen.elements){
    if(e.type==='container'&&!e.id)throw Error('Container ID is required');
    let p=e;const seen=new Set([e.id]);
    while(p.parentId){const parent=screen.elements.find(item=>item.id===p.parentId);if(!parent||parent.type!=='container')throw Error('Container not found');if(seen.has(parent.id))throw Error('Containers cannot contain themselves');seen.add(parent.id);p=parent;}
  }
  const parameters={};for(const [key,value] of Object.entries(source.parameters||{})){if(!validMenuParameter(key))throw Error('Invalid parameter name');parameters[key]=structuredClone(value);}
  const document={schemaVersion:1,kind:'menu',name:text(source.name,'New Menu'),startScreen:text(source.startScreen,screens[0].id),loadingScreen:text(source.loadingScreen),parameters,defaultFont:{fontFamily:text(source.defaultFont?.fontFamily,'system-ui'),fontData:menuEmbeddedAsset(source.defaultFont?.fontData),fontFileName:text(source.defaultFont?.fontFileName)},defaultBackground:{background:text(source.defaultBackground?.background,'#101c28'),backgroundArt:text(source.defaultBackground?.backgroundArt),effect:['none','stars','rain','snow'].includes(source.defaultBackground?.effect)?source.defaultBackground.effect:'none',effectIntensity:number(source.defaultBackground?.effectIntensity,1,0,4),effectWind:number(source.defaultBackground?.effectWind,0,-3,3)},screens};
  if(!screens.some(s=>s.id===document.startScreen))throw Error('Starting screen does not exist');
  const validate=action=>{if(!action)return;if(['screen','new-game'].includes(action.type)&&!action.target.startsWith('$')&&!screens.some(s=>s.id===action.target))throw Error(`Screen not found: ${action.target}`);validate(action.then)};
  screens.forEach(s=>{validate(s.startAction);s.elements.forEach(e=>{validate(e.action);validate(e.onSelect)})});return document;
}
const element=(id,type,label,x,y,w,h,extra={})=>({id,type,label,x,y,w,h,...extra});
export function createMenuDocument(){return normalizeMenuDocument({name:'Game Menu',startScreen:'splash',loadingScreen:'loading',parameters:{difficulty:'medium',carRef:'',raceRef:''},screens:[
 {id:'splash',name:'Splash',background:'#000000',effect:'none',startAction:{type:'new-game',target:'cars'},elements:[element('title','text','YOUR GAME',0.08,0.25,0.84,0.15,{fontSize:52}),element('start','button','Game Start',0.1,0.52,0.8,0.12,{transparentBackground:true,animation:'pulse',action:{type:'new-game',target:'cars'}}),element('settings','button','Option Mode',0.1,0.67,0.8,0.09,{transparentBackground:true,action:{type:'screen',target:'settings'}})]},
 createCarShowroomScreen(),
 {id:'events',name:'Choose Race',elements:[element('heading','text','Choose Race',0.06,0.06,0.88,0.12),element('event','choice','Race',0.06,0.3,0.88,0.12,{source:'races',binding:'raceRef'}),element('race','button','Start Race',0.1,0.55,0.8,0.12,{action:{type:'race',target:'$raceRef'}}),element('back','button','Back',0.1,0.78,0.8,0.1,{action:{type:'back'}})]},
 {id:'settings',name:'Settings',elements:[element('heading','text','Settings',0.06,0.02,0.88,0.08),element('difficulty','choice','Difficulty',0.06,0.14,0.88,0.08,{binding:'difficulty',options:['easy','medium','hard'].map(value=>({label:value,value}))}),...Object.entries(MENU_SETTINGS).map(([key,v],i)=>element(key,'slider',v.label,0.06,0.25+i*0.1,0.88,0.08,{binding:`settings.${key}`,min:v.min,max:v.max,step:v.step})),element('mapping','button','Input mapping',0.06,0.67,0.88,0.09,{action:{type:'screen',target:'mapping'}}),element('cheats','button','Cheat Codes',0.06,0.77,0.88,0.08,{action:{type:'screen',target:'cheats'}}),element('back','button','Back',0.06,0.89,0.88,0.09,{action:{type:'back'}})]},
 {id:'cheats',name:'Cheat Codes',background:'#000000',effect:'none',elements:[element('heading','text','CHEAT CODES',.1,.06,.8,.12),element('code','code-entry','Code',.15,.26,.7,.4,{binding:'cheatCode',codeLength:6,background:'#000000',selectionIndicator:'disabled',action:{type:'cheat-code',target:'$cheatCode'}}),element('hint','text','↑ / ↓ LETTER   ← / → POSITION   CONFIRM TO ENTER',.04,.7,.92,.09,{fontSize:20}),element('back','button','Back',.1,.85,.8,.1,{action:{type:'back'},selectionIndicator:'cursor',background:'#000000'})]},
 {id:'mapping',name:'Input Mapping',elements:[element('heading','text','Choose an action, then press a key',0.06,0.02,0.88,0.1),...['left','right','up','down','attack','interact'].map((key,i)=>element(key,'keybind',key,0.06,0.15+i*0.1,0.88,0.08,{binding:`input.${key}`})),element('back','button','Back',0.06,0.84,0.88,0.09,{action:{type:'back'}})]}
,createLoadingMenuScreen(),createGarageMenuScreen(),createTuningMenuScreen(),createUpgradeMenuScreen(),createWorldMapMenuScreen()].map(screen=>['splash','settings','mapping'].includes(screen.id)?{...screen,background:'#000000',effect:'none',elements:screen.elements.map(e=>({...e,background:'#000000',selectionIndicator:'cursor',cursorText:'>'}))}:screen)});}
export function resolveMenuValue(value,parameters){return typeof value==='string'&&value.startsWith('$')?parameters[value.slice(1)]:value;}
export function menuElementPose(element,time=0){
  let pose={x:element.x,y:element.y,opacity:1,scale:1,rotation:0};const phase=element.loop?time/element.duration:Math.min(1,time/element.duration);
  if(element.animation==='pulse')pose.opacity=0.6+0.4*(1+Math.sin(phase*Math.PI*2))/2;
  if(element.animation==='fade')pose.opacity=element.loop?phase%1:Math.min(1,phase);
  if(element.animation==='bob')pose.y+=Math.sin(phase*Math.PI*2)*0.02;
  if(element.animation==='spin'&&element.type!=='car-preview')pose.rotation=phase*360;
  const frames=element.keyframes||[];if(!frames.length)return pose;
  const duration=frames.at(-1).time,t=element.loop&&duration?time%duration:Math.min(time,duration);
  const a=[...frames].reverse().find(f=>f.time<=t)||frames[0],b=frames.find(f=>f.time>t)||a,u=b.time>a.time?(t-a.time)/(b.time-a.time):0;
  for(const key of ['x','y','opacity','scale','rotation'])pose[key]=a[key]+(b[key]-a[key])*u;return pose;
}

export function resolveMenuBackground(document,screen,parameters={}){
  const background=screen.useDefaultBackground?{...screen,...document.defaultBackground}:screen;
  const rule=(screen.backgroundRules||[]).find(r=>r.artRef&&r.value&&String(parameters[r.when]??'')===r.value);
  return rule?{...background,backgroundArt:rule.artRef}:background;
}
