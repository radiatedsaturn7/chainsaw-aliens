import {openEditorForm} from './shared/editorForm.js';
import {openProjectBrowser} from './ProjectBrowserModal.js';
import {hydrateRaceArtSpriteShared,getRaceArtSpriteCanvasShared} from './shared/raceArtSpriteCanvas.js';
import {INDICATOR_SIGNALS,normalizeIndicators,fitIndicatorCrop} from '../racing/IndicatorArt.js';

export function indicatorSheetBounds(canvas,image){const scale=Math.min(canvas.width/image.width,canvas.height/image.height);return {scale,x:(canvas.width-image.width*scale)/2,y:(canvas.height-image.height*scale)/2};}
export function indicatorDragCrop(start,end,width,height){const x=Math.max(0,Math.min(width-1,Math.floor(Math.min(start.x,end.x)))),y=Math.max(0,Math.min(height-1,Math.floor(Math.min(start.y,end.y))));return fitIndicatorCrop({x,y,width:Math.max(1,Math.ceil(Math.max(start.x,end.x))-x),height:Math.max(1,Math.ceil(Math.max(start.y,end.y))-y)},width,height);}
export async function editCarIndicator(e,existing=null,showForm=openEditorForm,picker=openProjectBrowser,loadSheet=async(ref,frameIndex)=>{await hydrateRaceArtSpriteShared(ref);return getRaceArtSpriteCanvasShared(ref,{frameIndex,allowStorageLoad:true,cache:e.raceArtSpriteCache});}){
 const car=e.selectedCar;if(!car)return;
 let artRef=existing?.artRef||'',image=null,anchor=null;
 const load=async ref=>{const next=await loadSheet(ref,existing?.frameIndex||0);if(!next)throw Error('Could not read the indicator sheet');image=next;artRef=ref;};
 if(artRef)await load(artRef);
 const fields=[
 {id:'sheet',label:'Choose indicator artwork sheet',type:'button',onClick:async()=>{const picked=await picker({mode:'open',fixedFolder:'art',initialFolder:'art',title:'Indicator sheet'});if(picked?.action!=='open')return {};await load(picked.name);return {x:0,y:0,width:image.width,height:image.height};}},
 {id:'preview',label:'Drag a rectangle around one indicator',type:'preview',sticky:true,render:(canvas,state)=>{const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#333';ctx.fillRect(0,0,canvas.width,canvas.height);if(!image){ctx.fillStyle='#fff';ctx.fillText('Choose an artwork sheet above',12,90);return;}const b=indicatorSheetBounds(canvas,image);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,b.x,b.y,image.width*b.scale,image.height*b.scale);const c=fitIndicatorCrop(state,image.width,image.height);ctx.strokeStyle='#58d6ff';ctx.lineWidth=2;ctx.strokeRect(b.x+c.x*b.scale,b.y+c.y*b.scale,c.width*b.scale,c.height*b.scale);},onPointer:(point,state,canvas)=>{if(!image)return {};const b=indicatorSheetBounds(canvas,image),p={x:(point.x-b.x)/b.scale,y:(point.y-b.y)/b.scale};if(point.phase==='pointerdown'||!anchor)anchor=p;return indicatorDragCrop(anchor,p,image.width,image.height);}},
 {id:'name',label:'Indicator name',type:'text',value:existing?.name||'Check engine'},
 {id:'source',label:'Signal',value:existing?.source||'enginelight',options:Object.entries(INDICATOR_SIGNALS).map(([value,label])=>({value,label}))},
 ...['x','y','width','height'].map(key=>({id:key,label:key+' (sheet pixels)',value:existing?.crop?.[key]??(key==='width'?image?.width||1:key==='height'?image?.height||1:0),min:key==='width'||key==='height'?1:0,step:1})),
 {id:'cut-preview',label:'Cut indicator preview',type:'preview',render:(canvas,state)=>{const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);if(!image)return;const c=fitIndicatorCrop(state,image.width,image.height),scale=Math.min(canvas.width/c.width,canvas.height/c.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,c.x,c.y,c.width,c.height,(canvas.width-c.width*scale)/2,(canvas.height-c.height*scale)/2,c.width*scale,c.height*scale);}}
 ];
 const result=await showForm('Cut indicator',fields,{description:'Choose a sheet, then drag around one icon. Coordinates snap to whole pixels. The original artwork is unchanged. Save the car to keep its indicator library.'});
 if(!result||e.selectedCar!==car)return;
 if(!image){e.status='Choose an artwork sheet before saving an indicator';return;}
 e.captureRaceHistory('Save indicator');car.art||={};const list=normalizeIndicators(car.art.indicators),id=existing?.id||'indicator-'+Date.now();const entry={id,name:result.name,source:result.source,artRef,frameIndex:existing?.frameIndex||0,crop:fitIndicatorCrop(result,image.width,image.height)};
 const index=list.findIndex(v=>v.id===id);if(index<0)list.push(entry);else list[index]=entry;car.art.indicators=normalizeIndicators(list);e.invalidateCarEditorPreviewFrame();e.status='Indicator saved — add it from Exterior or Interior Gauges';
}
export async function openCarIndicators(e,showForm=openEditorForm){
 const car=e.selectedCar;if(!car)return;car.art||={};
 const options=()=>normalizeIndicators(car.art?.indicators).map(v=>({value:v.id,label:v.name}));
 await showForm('Indicators',[
 {id:'id',label:'Saved indicator',value:options()[0]?.value||'',options:()=>options().length?options():[{value:'',label:'No indicators yet'}]},
 {id:'add',label:'Add / cut indicator',type:'button',onClick:async()=>{if(e.selectedCar===car)await editCarIndicator(e);return {id:normalizeIndicators(car.art?.indicators).at(-1)?.id||''};}},
 {id:'edit',label:'Edit selected indicator',type:'button',onClick:async state=>{const entry=normalizeIndicators(car.art?.indicators).find(v=>v.id===state.id);if(entry&&e.selectedCar===car)await editCarIndicator(e,entry);return {};}},
 {id:'remove',label:'Remove selected indicator',type:'button',onClick:state=>{if(e.selectedCar!==car)return {};e.captureRaceHistory('Remove indicator');car.art.indicators=normalizeIndicators(car.art?.indicators).filter(v=>v.id!==state.id);return {id:options()[0]?.value||''};}}
 ],{description:'Create reusable indicator cutouts for this car. Adding one to a gauge layout copies its cutout and signal; removing or editing the library entry does not change already placed gauges.'});
}
