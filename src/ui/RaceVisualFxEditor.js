import {openProjectBrowser} from './ProjectBrowserModal.js';
import {openEditorForm} from './shared/editorForm.js';
import {normalizeRaceVisualFx,raceFxPreset,RACE_FX_PRESETS,skySunFacingYaw} from '../racing/RaceVisualFx.js';
import {raceBrightness} from '../racing/RaceLighting.js';
export function sunPreviewRect(art){const aspect=(art?.width||2)/(art?.height||1),w=Math.min(320,156*aspect),h=w/aspect;return {x:(320-w)/2,y:(156-h)/2,w,h};}
export function pickSkySun(point,art){const r=sunPreviewRect(art);if(point.x<r.x||point.x>r.x+r.w||point.y<r.y||point.y>r.y+r.h)return {};return {sunX:(point.x-r.x)/r.w,sunY:(point.y-r.y)/r.h};}
export function skyboxEnvironment(race){return {brightness:raceBrightness(race),timeOfDay:race.timeOfDay==='night'?'night':'day',visualFx:race.visualFx?{...race.visualFx}:null};}
export function applySkyboxEnvironment(race,environment){
 race.brightness=Math.max(0,Math.min(1,Number(environment.brightness)));race.timeOfDay=environment.timeOfDay==='night'?'night':'day';
 if(environment.visualFx)race.visualFx=normalizeRaceVisualFx(environment.visualFx);
}
export async function editRaceVisualFx(e,{skybox=null,deferApply=false,showForm=openEditorForm,pickArt=openProjectBrowser}={}){
 const race=e.selectedRace;if(!race)return;
 const environment=skybox?.environment||skyboxEnvironment(race),fx=normalizeRaceVisualFx(environment.visualFx||{}),settings=skybox||e.getRaceSkyboxSettings();
 let art=settings.artRef?e.getRaceSkyboxRenderCanvas(settings.artRef):null;
 if(!art&&settings.artRef&&typeof document!=='undefined'){await e.hydrateRaceArt(settings.artRef);e.raceSkyboxRenderCache=null;art=e.getRaceSkyboxRenderCanvas(settings.artRef);}
 if(e.selectedRace!==race)return;
 const sun={label:'Sun / sky',open:true},speed={label:'Speed effects',open:true,description:'Choose transparent full-screen streak art, or a single horizontal streak pointing right. Opacity multiplies streak strength. Darkened edges reach the selected strength at full-effect speed.'},grade={label:'Lighting / color'};
 const previewStarted=e.getNowMs(),previewBuffers={};
 const fields=[
 {id:'live-preview',label:'Live sun glare, lens flare and speed preview',type:'preview',animated:true,sticky:true,render:(canvas,state)=>{
  const ctx=canvas.getContext('2d'),bounds={x:0,y:0,w:canvas.width,h:canvas.height};
  const yaw=state.previewRotate?(e.getNowMs()-previewStarted)/20000*Math.PI*2:Number(state.previewHeading)*Math.PI/180;
  e.drawRaceSkyboxSettingsPreview(ctx,bounds,{...settings,environment:{brightness:Number(state.brightness),timeOfDay:state.timeOfDay,visualFx:normalizeRaceVisualFx(state)}},{yaw,speedMph:Number(state.previewSpeed),trees:state.previewTrees,fxState:previewBuffers});
 }},
 {id:'previewRotate',label:'Rotate preview 360°',type:'checkbox',value:true},
 {id:'previewHeading',label:'Preview direction',type:'range',value:0,min:0,max:360,step:1,format:v=>v+'°',onInput:()=>({previewRotate:false})},
 {id:'face-sun',label:'Face sun / pause rotation',type:'button',onClick:state=>({previewRotate:false,previewHeading:((skySunFacingYaw({x:0,y:0,w:320,h:180},settings,(art?.width||2)/(art?.height||1),normalizeRaceVisualFx(state))*180/Math.PI)%360+360)%360})},
 {id:'previewTrees',label:'Preview roadside trees',type:'checkbox',value:true},
 {id:'previewSpeed',label:'Preview speed (MPH)',type:'range',value:80,min:0,max:200,step:1},
 {id:'enabled',label:'Enable sky and speed effects',type:'checkbox',value:fx.enabled},
 {id:'preset',label:'Time-of-day preset',value:fx.preset,options:Object.keys(RACE_FX_PRESETS)},
 {id:'apply-preset',label:'Apply preset to these settings',type:'button',onClick:state=>{const p=raceFxPreset(state.preset);return {...p.visualFx,speedLineArtRef:state.speedLineArtRef??fx.speedLineArtRef,speedLineArtMode:state.speedLineArtMode??fx.speedLineArtMode,speedLineOpacity:state.speedLineOpacity??fx.speedLineOpacity,brightness:p.brightness,timeOfDay:p.timeOfDay};}},
 {id:'sky-preview',label:'Tap or drag on the skybox to position the sun',type:'preview',section:sun,onPointer:p=>pickSkySun(p,art),render:(canvas,state)=>{
  const ctx=canvas.getContext('2d'),r=sunPreviewRect(art);ctx.clearRect(0,0,320,180);ctx.fillStyle='#283c55';ctx.fillRect(r.x,r.y,r.w,r.h);if(art)ctx.drawImage(art,r.x,r.y,r.w,r.h);
  const x=r.x+state.sunX*r.w,y=r.y+state.sunY*r.h;ctx.strokeStyle=state.sunColor;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.moveTo(x-12,y);ctx.lineTo(x+12,y);ctx.moveTo(x,y-12);ctx.lineTo(x,y+12);ctx.stroke();ctx.fillStyle='#ffffff';ctx.font='12px sans-serif';ctx.fillText('Tap the sun in the image; drag to fine-tune.',6,174);
 }},
 ...[['sunEnabled','Sun glow enabled'],['sunDisc','Draw sun disc (off if already in artwork)']].map(([id,label])=>({id,label,type:'checkbox',value:fx[id],section:sun})),
 {id:'sunColor',label:'Sun color',type:'color',value:fx.sunColor,section:sun},
 ...[['sunX','Sun horizontal position',0,1],['sunY','Sun vertical position',0,1],['sunSize','Sun radius (fraction of image height)',.002,.06],['sunIntensity','Sun glow strength',0,1],['lensFlare','Lens flare strength',0,1],['sunGlare','Sun glare / screen washout',0,1]].map(([id,label,min,max])=>({id,label,type:'range',step:['sunX','sunY'].includes(id)?.0001:id==='sunSize'?.001:.01,value:fx[id],min,max,section:sun})),
 ...[['motionBlur','Peripheral motion blur',0,1],['speedLines','Speed streak strength',0,1],['speedLineOpacity','Streak opacity',0,1],['vignette','Darkened edges at full speed',0,.6],['speedStartMph','Effects start at (MPH)',0,200],['speedFullMph','Full effect at (MPH)',10,300]].map(([id,label,min,max])=>({id,label,type:'range',step:id.endsWith('Mph')?1:.01,value:fx[id],min,max,section:speed})),
 {id:'speedLineArtRef',label:'Streak artwork',type:'text',readOnly:true,required:false,value:fx.speedLineArtRef,section:speed},
 {id:'choose-streak-art',label:'Choose streak artwork',type:'button',section:speed,onClick:async state=>{
  const picked=await pickArt({mode:'open',fixedFolder:'art',initialFolder:'art',title:'Speed streak artwork'});
  if(picked?.action!=='open'||race!==e.selectedRace)return {};
  if(typeof document!=='undefined')await e.hydrateRaceArt(picked.name);
  return {speedLineArtRef:picked.name,speedLines:Number(state.speedLines)>0?Number(state.speedLines):1};
 }},
 {id:'clear-streak-art',label:'Use built-in streak lines',type:'button',section:speed,onClick:()=>({speedLineArtRef:''})},
 {id:'speedLineArtMode',label:'Streak artwork layout',value:fx.speedLineArtMode,options:[{value:'overlay',label:'Full-screen overlay'},{value:'streak',label:'Single horizontal streak'}],section:speed},
 {id:'timeOfDay',label:'Day / night triggers',value:environment.timeOfDay,options:['day','night'],section:grade},
 {id:'brightness',type:'range',step:.01,label:'World brightness (night default 0.05)',value:environment.brightness,min:0,max:1,section:grade},
 {id:'skyBrightness',type:'range',step:.01,label:'Sky brightness',value:fx.skyBrightness,min:0,max:1,section:grade},
 {id:'tintColor',label:'Scene tint',type:'color',value:fx.tintColor,section:grade},
 {id:'tintAmount',type:'range',step:.01,label:'Tint strength',value:fx.tintAmount,min:0,max:.3,section:grade}];
 const result=await showForm('Skybox lighting & FX',fields,{description:'Drag sliders to test changes live. Face sun pauses the view toward your sun; uncheck Rotate preview to scrub direction. Preview speed and roadside trees test blur/streaks without driving. Glare washes out the road; cockpit and gauges stay clear. Apply Skybox to keep changes, then save the race.'});
 if(!result||race!==e.selectedRace)return;
 if(Number(result.speedFullMph)<=Number(result.speedStartMph)){e.status='Full-effect speed must exceed the starting speed';throw Error(e.status);}
 const next={visualFx:normalizeRaceVisualFx(result),brightness:result.brightness,timeOfDay:result.timeOfDay};
 if(deferApply&&skybox){
  if(e.raceSettingsDialogDraft!==skybox)return;
  skybox.environment=next;e.status='Lighting / FX ready — Apply Skybox to keep changes';return;
 }
 e.captureRaceHistory('Skybox lighting / FX');applySkyboxEnvironment(race,next);
 e.raceVisualFxState={};e.status='Skybox lighting / FX updated — save race to keep changes';
}
