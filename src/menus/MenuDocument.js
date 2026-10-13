export const MENU_ELEMENT_TYPES = ['text','image','button','choice','slider','toggle','keybind','car-preview','car-stats','power-curve','video','property-display','asset-preview'];
export const MENU_ACTION_TYPES = ['screen','back','set-param','race','grand-prix','level','movie','quit'];
export const MENU_ANIMATIONS = ['none','pulse','fade','bob','spin'];
export const MENU_SETTINGS = {
  fxVolume:{label:'FX volume',min:0,max:1,step:0.05,default:0.8},
  musicVolume:{label:'Music volume',min:0,max:1,step:0.05,default:0.8},
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
  if(action.then)result.then=normalizeMenuAction(action.then,depth+1);
  return result;
}
export function normalizeMenuElement(source={},index=0){
  const type=MENU_ELEMENT_TYPES.includes(source.type)?source.type:'text';
  const binding=text(source.binding);if(source.angleBinding&&!validMenuParameter(source.angleBinding))throw Error('Invalid rotation binding');if(binding&&!validMenuParameter(binding))throw Error('Invalid parameter binding');
  return {id:text(source.id,`element-${index+1}`),type,label:text(source.label,'New item'),
    x:number(source.x,0.1,-2,2),y:number(source.y,0.1,-2,2),w:number(source.w,0.8,0.01,3),h:number(source.h,0.08,0.01,3),
    color:text(source.color,'#ffffff'),background:text(source.background,'#253c49'),fontSize:number(source.fontSize,26,8,160),
    dataSource:['cars','actors','parameters','doodads'].includes(source.dataSource)?source.dataSource:'cars',assetRef:text(source.assetRef),property:text(source.property,'name'),suffix:text(source.suffix),decimals:number(source.decimals,0,0,6),
    angleBinding:text(source.angleBinding),angle:number(source.angle,180,-3600,3600),imageFit:['contain','cover','stretch'].includes(source.imageFit)?source.imageFit:'contain',
    artRef:text(source.artRef),videoUrl:text(source.videoUrl),binding,source:text(source.source),
    options:(Array.isArray(source.options)?source.options:[]).slice(0,200).map(option=>({label:text(option.label,String(option.value??'')),value:structuredClone(option.value??'')})),
    min:number(source.min,0,-1e6,1e6),max:number(source.max,1,-1e6,1e6),step:number(source.step,0.05,0.0001,1e6),
    animation:MENU_ANIMATIONS.includes(source.animation)?source.animation:'none',duration:number(source.duration,2,0.1,600),
    action:normalizeMenuAction(source.action),visible:source.visible!==false,loop:source.loop!==false,
    keyframes:(Array.isArray(source.keyframes)?source.keyframes:[]).slice(0,100).map(k=>({time:number(k.time,0,0,600),x:number(k.x,source.x??0.1,-2,2),y:number(k.y,source.y??0.1,-2,2),opacity:number(k.opacity,1,0,1),scale:number(k.scale,1,0.05,10),rotation:number(k.rotation,0,-3600,3600)})).sort((a,b)=>a.time-b.time)};
}
export function normalizeMenuDocument(source={}){
  const screens=(Array.isArray(source.screens)?source.screens:[]).slice(0,100).map((s,i)=>({id:text(s.id,`screen-${i+1}`),name:text(s.name,`Screen ${i+1}`),
    background:text(s.background,'#101c28'),backgroundArt:text(s.backgroundArt),musicRef:text(s.musicRef),effect:['none','stars','rain','snow'].includes(s.effect)?s.effect:'none',
    startAction:normalizeMenuAction(s.startAction),elements:(Array.isArray(s.elements)?s.elements:[]).slice(0,200).map(normalizeMenuElement)}));
  if(!screens.length)throw Error('A menu needs at least one screen');
  if(new Set(screens.map(s=>s.id)).size!==screens.length)throw Error('Screen IDs must be unique');
  for(const s of screens)if(new Set(s.elements.map(e=>e.id)).size!==s.elements.length)throw Error('Element IDs must be unique within a screen');
  const parameters={};for(const [key,value] of Object.entries(source.parameters||{})){if(!validMenuParameter(key))throw Error('Invalid parameter name');parameters[key]=structuredClone(value);}
  const document={schemaVersion:1,kind:'menu',name:text(source.name,'New Menu'),startScreen:text(source.startScreen,screens[0].id),parameters,screens,
    grandPrix:(Array.isArray(source.grandPrix)?source.grandPrix:[]).slice(0,100).map((gp,i)=>({id:text(gp.id,`gp-${i+1}`),name:text(gp.name,`Grand Prix ${i+1}`),races:(Array.isArray(gp.races)?gp.races:[]).slice(0,100).map(r=>({raceRef:text(typeof r==='string'?r:r.raceRef),movieRef:text(r.movieRef)}))}))};
  if(new Set(document.grandPrix.map(g=>g.id)).size!==document.grandPrix.length)throw Error('Grand Prix IDs must be unique');
  if(!screens.some(s=>s.id===document.startScreen))throw Error('Starting screen does not exist');
  const validate=action=>{if(!action)return;if(action.type==='screen'&&!action.target.startsWith('$')&&!screens.some(s=>s.id===action.target))throw Error(`Screen not found: ${action.target}`);validate(action.then)};
  screens.forEach(s=>{validate(s.startAction);s.elements.forEach(e=>validate(e.action))});return document;
}
const element=(id,type,label,x,y,w,h,extra={})=>({id,type,label,x,y,w,h,...extra});
export function createMenuDocument(){return normalizeMenuDocument({name:'Game Menu',startScreen:'splash',parameters:{difficulty:'medium',carRef:'',grandPrix:''},grandPrix:[],screens:[
 {id:'splash',name:'Splash',background:'#0b1523',effect:'stars',startAction:{type:'screen',target:'cars'},elements:[element('title','text','YOUR GAME',0.08,0.25,0.84,0.15,{fontSize:52}),element('start','button','Tap / Press Space or Start',0.1,0.65,0.8,0.12,{animation:'pulse',action:{type:'screen',target:'cars'}})]},
 {id:'cars',name:'Choose Car',elements:[element('heading','text','Choose your car',0.06,0.03,0.88,0.08),element('car','choice','Car',0.06,0.13,0.88,0.09,{source:'cars',binding:'carRef'}),element('preview','car-preview','Car preview',0.06,0.24,0.44,0.24,{binding:'carRef',animation:'spin'}),element('stats','car-stats','Specifications',0.52,0.24,0.42,0.24,{binding:'carRef'}),element('power','power-curve','HP / Torque',0.06,0.49,0.88,0.2,{binding:'carRef'}),element('difficulty','choice','Difficulty',0.06,0.72,0.88,0.08,{binding:'difficulty',options:['easy','medium','hard'].map(value=>({label:value,value}))}),element('next','button','Choose Grand Prix',0.06,0.83,0.58,0.09,{action:{type:'screen',target:'events'}}),element('settings','button','Settings',0.67,0.83,0.27,0.09,{action:{type:'screen',target:'settings'}})]},
 {id:'events',name:'Grand Prix',elements:[element('heading','text','Choose Grand Prix',0.06,0.06,0.88,0.12),element('event','choice','Grand Prix',0.06,0.3,0.88,0.12,{source:'grandPrix',binding:'grandPrix'}),element('race','button','Start Grand Prix',0.1,0.55,0.8,0.12,{action:{type:'grand-prix',target:'$grandPrix'}}),element('back','button','Back',0.1,0.78,0.8,0.1,{action:{type:'back'}})]},
 {id:'settings',name:'Settings',elements:[element('heading','text','Settings',0.06,0.02,0.88,0.08),...Object.entries(MENU_SETTINGS).map(([key,v],i)=>element(key,'slider',v.label,0.06,0.14+i*0.12,0.88,0.09,{binding:`settings.${key}`,min:v.min,max:v.max,step:v.step})),element('mapping','button','Input mapping',0.06,0.67,0.88,0.09,{action:{type:'screen',target:'mapping'}}),element('back','button','Back',0.06,0.83,0.88,0.09,{action:{type:'back'}})]},
 {id:'mapping',name:'Input Mapping',elements:[element('heading','text','Choose an action, then press a key',0.06,0.02,0.88,0.1),...['left','right','up','down','attack','interact'].map((key,i)=>element(key,'keybind',key,0.06,0.15+i*0.1,0.88,0.08,{binding:`input.${key}`})),element('back','button','Back',0.06,0.84,0.88,0.09,{action:{type:'back'}})]}
]});}
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
