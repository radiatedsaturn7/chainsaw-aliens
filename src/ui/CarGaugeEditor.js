import {loadFontLibrary} from './FontLibrary.js';
import {openFontEditor} from './FontEditor.js';
import {prepareGaugeFont} from '../racing/CarGauges.js';
import {normalizeCarGauges,normalizeGauge,defaultGauges,GAUGE_SOURCES,GAUGE_FORMATS} from '../racing/CarGauges.js';
import {openEditorForm} from './shared/editorForm.js';
import {openProjectBrowser} from './ProjectBrowserModal.js';
export const gaugeSide=e=>e.activeAction==='car-gauges-interior'?'interior':'exterior';
export function gaugeLayout(e){e.selectedCar.art||={};e.selectedCar.art.gauges||=normalizeCarGauges();return e.selectedCar.art.gauges[gaugeSide(e)];}
const selected=e=>{const l=gaugeLayout(e);return l.widgets.find(g=>g.id===e.carGaugeId)||l.widgets[0];};
function change(e,label,fn){e.captureRaceHistory(label);fn();e.selectedCar.art.gauges=normalizeCarGauges(e.selectedCar.art.gauges);e.invalidateCarEditorPreviewFrame();e.syncCarAnglePreviewArt();e.status=label;}
export function enterCarGauges(e,side){e.activeRootId='art';e.activeAction='car-gauges-'+side;e.closeEditorMenus();e.status='Editing '+side+' gauges — drag to position, Properties to resize';e.carGaugeId=null;gaugeLayout(e);e.invalidateCarEditorPreviewFrame();e.syncCarAnglePreviewArt();}
function mapArtworkFields(g,picker){
 return [['artRef','Map background'],['markerArtRef','Your car icon'],['carMarkerArtRef','Other cars icon'],['startMarkerArtRef','Start icon'],['finishMarkerArtRef','Finish icon']].flatMap(([id,label])=>[
  {id,label:label+' artwork',type:'text',readOnly:true,required:false,value:g[id]||''},
  {id:'choose-'+id,label:'Choose '+label.toLowerCase()+' artwork',type:'button',onClick:async()=>{
   const picked=await picker({mode:'open',fixedFolder:'art',initialFolder:'art',title:'Choose '+label.toLowerCase()+' artwork'});
   return picked?.action==='open'?{[id]:picked.name}:{};
  }},
  {id:'clear-'+id,label:'Clear '+label.toLowerCase()+' artwork',type:'button',onClick:()=>({[id]:''})}
 ]);
}
export function gaugeMapFields(g,picker=openProjectBrowser){
 const visibleWhen=state=>state.format==='map';
 const fields=[{id:'mapMode',label:'Map view',value:g.mapMode,options:[{value:'whole',label:'Whole map'},{value:'local',label:'Local area — follows your car'}]},
 {id:'mapRangeM',label:'Viewable distance (meters across)',value:g.mapRangeM,min:20,max:10000},
 {id:'mapOrientation',label:'Map orientation',value:g.mapOrientation,options:[{value:'north',label:'North up (fixed)'},{value:'heading',label:'Heading up (car faces up)'}]},
 {id:'mapProjection',label:'Local projection',value:g.mapProjection,options:[{value:'flat',label:'Flat overhead'},{value:'perspective',label:'GPS perspective'}]},
 {id:'mapPitch',label:'GPS downward viewing angle (degrees)',value:g.mapPitch,min:20,max:80},
 {id:'mapPlayerY',label:'GPS car position (% down screen)',value:g.mapPlayerY*100,min:20,max:90},
 ...[['mapScreenX','Screen left'],['mapScreenY','Screen top'],['mapScreenWidth','Screen width'],['mapScreenHeight','Screen height']].map(([id,label])=>({id,label:label+' (% of background)',value:g[id]*100,min:id.includes('Width')||id.includes('Height')?1:0,max:100})),
 {id:'mapOpacity',label:'Roads and icons opacity (%)',value:g.mapOpacity*100,min:0,max:100},
 ...mapArtworkFields(g,picker),
 ...[['mapLineColor','Route color'],['mapLineBorderColor','Route outline color'],['mapBorderColor','Map frame color']].map(([id,label])=>({id,label,type:'color',value:g[id]})),
 ...[['mapLineWidth','Route width',.5,20],['mapLineBorderWidth','Route outline width (0 = none)',0,12],['mapBorderWidth','Map frame width (0 = none)',0,12]].map(([id,label,min,max])=>({id,label,value:g[id],min,max})),
 ...[['player','Your car'],['car','Other cars'],['start','Start'],['finish','Finish']].flatMap(([kind,label])=>[
  {id:kind+'MarkerShape',label:label+' icon shape',value:g[kind+'MarkerShape'],options:['circle','triangle','square','flag']},
  {id:kind+'MarkerColor',label:label+' icon color',type:'color',value:g[kind+'MarkerColor']},
  {id:kind+'MarkerSize',label:label+' icon size (% of map)',value:g[kind+'MarkerSize'],min:1,max:40}
 ])];return fields.map(f=>({...f,visibleWhen:['mapRangeM','mapProjection','mapPitch','mapPlayerY'].includes(f.id)?state=>visibleWhen(state)&&state.mapMode==='local'&&(!['mapPitch','mapPlayerY'].includes(f.id)||state.mapProjection==='perspective'):visibleWhen}));
}
export function enlargeMapBackground(state,factor=1.1){
 const x=Number(state.x),y=Number(state.y),w=Number(state.width),h=Number(state.height);
 const width=Math.min(100,w*factor),height=Math.min(100,h*factor);
 const left=Math.max(0,Math.min(100-width,x+(w-width)/2)),top=Math.max(0,Math.min(100-height,y+(h-height)/2));
 return {x:left,y:top,width,height,
  mapScreenX:((x+w*Number(state.mapScreenX)/100)-left)/width*100,
  mapScreenY:((y+h*Number(state.mapScreenY)/100)-top)/height*100,
  mapScreenWidth:w*Number(state.mapScreenWidth)/width,
  mapScreenHeight:h*Number(state.mapScreenHeight)/height};
}
export function groupMapPropertyFields(fields,getArt=()=>null,viewportAspect=1){
 const groups=[
  {label:'Background / bezel',description:'The artwork panel, including its decorative border and transparent padding. These size controls change the entire panel.'},
  {label:'Map screen — drawing area',open:true,description:'Only roads and icons inside this rectangle are drawn. Move and shrink it to fit the screen opening inside your artwork’s border. Percentages are measured within the whole background image.'},
  {label:'Map view / GPS',description:'Choose whole map or local area, viewing distance and GPS orientation.'},
  {label:'Road appearance'},
  {label:'Your car icon'},{label:'Other cars icons'},{label:'Start icon'},{label:'Finish icon'},
  {label:'Advanced / text'}
 ];
 const sectionFor=id=>{
  const art=id.replace(/^(choose-|clear-)/,'');
  if(['artRef','x','y','width','height','background','enlarge-background'].includes(art))return 0;
  if(id.startsWith('mapScreen')||id==='mapOpacity'||id.startsWith('mapBorder')||id==='inset-screen'||id==='screen-preview')return 1;
  if(['mapMode','mapRangeM','mapOrientation','mapProjection','mapPitch','mapPlayerY'].includes(id))return 2;
  if(id.startsWith('mapLine'))return 3;
  if(art==='markerArtRef'||id.startsWith('playerMarker'))return 4;
  if(art==='carMarkerArtRef'||id.startsWith('carMarker'))return 5;
  if(art==='startMarkerArtRef'||id.startsWith('startMarker'))return 6;
  if(art==='finishMarkerArtRef'||id.startsWith('finishMarker'))return 7;
  return 8;
 };
 const labels={x:'Background left (% of viewport)',y:'Background top (% of viewport)',width:'Background width (% of viewport)',height:'Background height (% of viewport)',background:'Screen fill color (when no artwork)',mapScreenX:'Drawing area left (% of background)',mapScreenY:'Drawing area top (% of background)',mapScreenWidth:'Drawing area width (% of background)',mapScreenHeight:'Drawing area height (% of background)',mapBorderWidth:'Extra screen outline width (0 = none)',mapBorderColor:'Extra screen outline color'};
 const extras=[{id:'screen-preview',label:'Background and map drawing area preview',type:'preview',render:(canvas,state)=>{
   const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
   const ratio=Math.max(.05,Number(state.width)/Math.max(.01,Number(state.height))*viewportAspect),w=Math.min(280,140*ratio),h=w/ratio,x=(320-w)/2,y=(180-h)/2;
   const art=state.artRef?getArt(state.artRef):null;ctx.fillStyle='#39433f';ctx.fillRect(x,y,w,h);if(art)ctx.drawImage(art,x,y,w,h);
   const sx=x+w*Number(state.mapScreenX)/100,sy=y+h*Number(state.mapScreenY)/100,sw=w*Number(state.mapScreenWidth)/100,sh=h*Number(state.mapScreenHeight)/100;
   ctx.fillStyle='rgba(88,214,255,.2)';ctx.fillRect(sx,sy,sw,sh);ctx.strokeStyle='#58d6ff';ctx.lineWidth=2;ctx.strokeRect(sx,sy,sw,sh);
   ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.fillText('Blue box = map drawing area',160,172);
 }},{id:'enlarge-background',label:'Make background 10% bigger — keep map in place',type:'button',onClick:state=>enlargeMapBackground(state)},
 {id:'inset-screen',label:'Start with a 10% border on every side',type:'button',onClick:()=>({mapScreenX:10,mapScreenY:10,mapScreenWidth:80,mapScreenHeight:80})}];
 const all=[...fields,...extras];
 for(const field of all){if(labels[field.id])field.label=labels[field.id];if(['min','max','startAngle','sweepAngle','needlePivotX','needlePivotY','units','vertical'].includes(field.id))field.visibleWhen=state=>state.format!=='map';}
 return [...all.filter(f=>['name','enabled'].includes(f.id)),...groups.flatMap((section,index)=>all.filter(f=>!['name','enabled'].includes(f.id)&&sectionFor(f.id)===index).map(f=>({...f,section})))];
}
export async function editGauge(e,showForm=openEditorForm,picker=openProjectBrowser,loadFonts=()=>typeof document==='undefined'?[]:loadFontLibrary({recoverEmbedded:false})){
 const car=e.selectedCar,g=selected(e),l=gaugeLayout(e),side=gaugeSide(e);if(!g)return;
 const savedFonts=await loadFonts();if(e.selectedCar!==car)return;
 const fonts=[...savedFonts];
 if(g.fontData&&!fonts.some(f=>f.fontData===g.fontData))fonts.push({name:g.fontFileName||'Current uploaded font',...g});
 const choices=[...['monospace','sans-serif','serif'].map(family=>({value:'system:'+family,label:{monospace:'System — Monospace','sans-serif':'System — Sans serif',serif:'System — Serif'}[family],font:{fontFamily:family,fontData:'',fontFileName:''}})),
 ...fonts.map((font,i)=>({value:'saved:'+i,label:font.name||font.fontFileName,font:{fontData:font.fontData,fontFileName:font.fontFileName,fontFamily:font.fontFamily||'sans-serif'}}))];
 if(!g.fontData&&!choices.some(c=>c.font.fontFamily===g.fontFamily))choices.push({value:'current',label:'Current system font — '+g.fontFamily,font:{fontFamily:g.fontFamily,fontData:'',fontFileName:''}});
 const selectedFont=choices.find(c=>g.fontData?c.font.fontData===g.fontData:!c.font.fontData&&c.font.fontFamily===g.fontFamily)?.value||'system:monospace';
 let fields=[{id:'name',label:'Name',type:'text',value:g.name},{id:'enabled',label:'Visible',type:'checkbox',value:g.enabled},{id:'source',label:'Instrument',value:g.source,options:GAUGE_SOURCES},{id:'format',label:'Display format',value:g.format,options:GAUGE_FORMATS},
 ...['x','y','width','height'].map(k=>({id:k,label:k+' (% of viewport)',value:g[k]*100,min:k==='width'||k==='height'?.5:0,max:100})),
 ...['min','max','startAngle','sweepAngle','needlePivotX','needlePivotY','frameIndex','fontSize','outline'].map(k=>({id:k,label:{min:'Minimum value',max:'Maximum value',startAngle:'Dial start (degrees, 0 = right)',sweepAngle:'Dial sweep (degrees)',needlePivotX:'Needle pivot X (0–1)',needlePivotY:'Needle pivot Y (0–1)',frameIndex:'Artwork frame (0 = first)',fontSize:'Font size (at 300px viewport height)',outline:'Black text outline width'}[k],value:g[k]})),
 {id:'fontChoice',label:'Font',value:selectedFont,options:choices.map(({value,label})=>({value,label}))},
 {id:'fontWeight',label:'Font weight',value:String(g.fontWeight||400),options:[100,200,300,400,500,600,700,800,900].map(value=>({value:String(value),label:value+(value===400?' — Normal':value===700?' — Bold':'')}))},
 {id:'font-bold',label:'Toggle bold',type:'button',onClick:state=>({fontWeight:Number(state.fontWeight)>=600?'400':'700'})},
 {id:'fontItalic',label:'Italic',type:'checkbox',value:g.fontItalic},
 {id:'fontUnderline',label:'Underline',type:'checkbox',value:g.fontUnderline},
 {id:'textColor',label:'Font color',type:'color',value:g.textColor||g.color},
 {id:'units',label:'Units (MPH or km/h for speed)',type:'text',required:false,value:g.units},{id:'color',label:'Needle / fill color',type:'color',value:g.color},{id:'background',label:'Bar background',type:'color',value:g.background},{id:'showValue',label:'Show numeric value',type:'checkbox',value:g.showValue},{id:'vertical',label:'Vertical bar',type:'checkbox',value:g.vertical}];
 fields.splice(4,0,...gaugeMapFields(g,picker));
 if(g.format==='map')fields=groupMapPropertyFields(fields,ref=>e.getRaceArtSpriteCanvas(ref,{frameIndex:g.frameIndex}),e.carGaugeViewport?e.carGaugeViewport.w/e.carGaugeViewport.h:1);
 const result=await showForm(g.format==='map'?'Map properties':'Gauge properties',fields,{description:g.format==='map'?'Open a section to edit it. Background / bezel is the picture. Map screen is the smaller opening where roads and icons can draw. Apply saves your changes; Cancel discards them.':'Coordinates are relative to the race viewport. Artwork fills the gauge rectangle. Set the needle pivot at its center of rotation. Damage values range from 0 to 100.'});
 if(!result||e.selectedCar!==car)return;
 const {fontChoice,...properties}=result,font=choices.find(c=>c.value===fontChoice)?.font;
 if(font)await prepareGaugeFont(font);
 if(e.selectedCar!==car)return;
 const layout=car.art.gauges[side],target=layout.widgets.find(w=>w.id===g.id);if(!target)return;
 change(e,'Update gauge',()=>{Object.assign(target,properties,font||{},Object.fromEntries(['x','y','width','height','mapScreenX','mapScreenY','mapScreenWidth','mapScreenHeight','mapOpacity','mapPlayerY'].map(k=>[k,result[k]/100])));layout.enabled=true;});
}
async function artwork(e){const car=e.selectedCar,g=selected(e),l=gaugeLayout(e);if(!g)return;const slot=await openEditorForm('Gauge artwork',[{id:'slot',label:'Artwork layer',value:'artRef',options:[{value:'artRef',label:'Background / icon'},{value:'needleArtRef',label:'Dial needle'},{value:'overlayArtRef',label:'Foreground overlay'},{value:'markerArtRef',label:'Map — your car'},{value:'carMarkerArtRef',label:'Map — other cars'},{value:'startMarkerArtRef',label:'Map — start'},{value:'finishMarkerArtRef',label:'Map — finish'}]},{id:'remove',label:'Remove artwork',type:'checkbox',value:false}]);if(!slot)return;const picked=slot.remove?null:await openProjectBrowser({mode:'open',fixedFolder:'art',initialFolder:'art',title:'Gauge artwork'});if(e.selectedCar!==car||!l.widgets.includes(g)||(!slot.remove&&picked?.action!=='open'))return;change(e,'Gauge artwork',()=>{g[slot.slot]=slot.remove?'':picked.name;l.enabled=true;});}
export async function chooseGaugeFont(e,picker=openFontEditor){
 const car=e.selectedCar,g=selected(e),side=gaugeSide(e);if(!g)return;
 const result=await picker({select:true,current:g});if(!result||e.selectedCar!==car)return;
 await prepareGaugeFont(result);
 const layout=car.art.gauges[side],target=layout.widgets.find(v=>v.id===g.id);if(!target)return;
 change(e,'Font: '+(result.fontFileName||'System font')+' — save car to keep it',()=>{Object.assign(target,result);layout.enabled=true;});
}
export function drawCarGaugePanel(e,ctx,bounds){const l=gaugeLayout(e),g=selected(e);if(g)e.carGaugeId=g.id;const gap=6,w=bounds.w-24,row=26;
 const button=(id,label,col,y,fn,enabled=true)=>e.registerDrawnButton(ctx,{x:bounds.x+12+col*(w+gap)/2,y:bounds.y+8+y*row,w:(w-gap)/2,h:22},{id:'gauge-'+id,label,formatLabel:false,disabled:!enabled,onClick:()=>{Promise.resolve(fn()).catch(error=>{e.status=error.message;});}});
 button('select',g?.name||'No gauges',0,0,async()=>{const result=await openEditorForm('Select gauge',[{id:'id',label:'Gauge',value:g?.id,options:l.widgets.map(g=>({value:g.id,label:g.name}))}]);if(result)e.carGaugeId=result.id;},!!g);
 button('enabled',l.enabled?'Layout: On':'Layout: Default',1,0,()=>change(e,'Toggle gauge layout',()=>{l.enabled=!l.enabled;}));
 button('add','+ Gauge',0,1,()=>change(e,'Add gauge',()=>{const v=normalizeGauge({id:'gauge-'+Date.now()});l.widgets.push(v);l.enabled=true;e.carGaugeId=v.id;}));
 button('remove','Remove',1,1,()=>change(e,'Remove gauge',()=>{l.widgets=l.widgets.filter(v=>v!==g);l.enabled=true;}),!!g);
 button('properties',g?.format==='map'?'Map Properties':'Properties',0,2,()=>editGauge(e),!!g);button('art','Artwork',1,2,()=>artwork(e),!!g);
 button('font','Font: '+(g?.fontFileName||'System'),0,3,()=>chooseGaugeFont(e),!!g);button('reset','Reset layout',1,3,async()=>{const r=await openEditorForm('Reset this gauge layout',[{id:'reset',label:'Restore default instruments',type:'checkbox',value:false}]);if(r?.reset)change(e,'Reset gauges',()=>{l.widgets=defaultGauges();l.enabled=true;});});
 [['left','←',-.01,0],['right','→',.01,0],['up','↑',0,-.01],['down','↓',0,.01]].forEach(([id,label,dx,dy],i)=>button(id,label,i%2,4+Math.floor(i/2),()=>change(e,'Move gauge',()=>{g.x=Math.max(0,Math.min(1-g.width,g.x+dx));g.y=Math.max(0,Math.min(1-g.height,g.y+dy));l.enabled=true;}),!!g));
}
export function gaugePointer(e,p,phase){
 if(e.mode!=='car'||e.activeRootId!=='art'||!e.activeAction?.startsWith('car-gauges-')||e.isLivePlaytestSession())return false;
 const b=e.carGaugeViewport;if(!b)return false;
 const l=gaugeLayout(e),id=p.id??'pointer';
 if(phase==='down'){
  if(p.x<b.x||p.y<b.y||p.x>b.x+b.w||p.y>b.y+b.h)return false;
  const g=[...l.widgets].reverse().find(g=>g.enabled&&p.x>=b.x+g.x*b.w&&p.y>=b.y+g.y*b.h&&p.x<=b.x+(g.x+g.width)*b.w&&p.y<=b.y+(g.y+g.height)*b.h);
  if(!g)return false;e.carGaugeId=g.id;e.carGaugeDrag={id,gaugeId:g.id,x:p.x,y:p.y,startX:g.x,startY:g.y,changed:false};e.invalidateCarEditorPreviewFrame();return true;
 }
 const d=e.carGaugeDrag;if(!d||d.id!==id)return false;
 const g=l.widgets.find(g=>g.id===d.gaugeId);
 if(g&&Math.hypot(p.x-d.x,p.y-d.y)>2){if(!d.changed)e.captureRaceHistory('Move gauge');d.changed=true;g.x=Math.max(0,Math.min(1-g.width,d.startX+(p.x-d.x)/b.w));g.y=Math.max(0,Math.min(1-g.height,d.startY+(p.y-d.y)/b.h));l.enabled=true;e.invalidateCarEditorPreviewFrame();e.syncCarAnglePreviewArt(undefined,{prepareFrames:false});}
 if(phase==='up'){e.carGaugeDrag=null;e.invalidateCarEditorPreviewFrame();}
 return true;
}
