import {normalizeCarFx,normalizeCarFxView,newCarFxPlacementView,CAR_FX_TRIGGERS,CAR_FX_DAMAGE} from '../racing/CarFx.js';
import {CAR_VIEW_LABELS} from '../racing/CarDirectionalArt.js';
import {openEditorForm} from './shared/editorForm.js';
import {openProjectBrowser} from './ProjectBrowserModal.js';
export const currentCarFx=e=>(e.selectedCar.art.fx||[]).find(f=>f.id===e.carFxId)||(e.selectedCar.art.fx||[])[0];
function change(e,label,fn){e.captureRaceHistory(label);fn();e.selectedCar.art.fx=normalizeCarFx(e.selectedCar.art.fx);e.invalidateCarEditorPreviewFrame();e.syncCarAnglePreviewArt();e.status=label;}
export function addCarFx(e){
 const slot=e.selectedCarShellFrameSlot||'front';const id=`fx-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
 change(e,'Add car FX',()=>{e.selectedCar.art.fx||=[];e.selectedCar.art.fx.push({id,name:'New effect',enabled:true,triggers:['always'],views:{[slot]:normalizeCarFxView({placements:[]})}});});e.carFxId=id;e.carFxPlacementIndex=-1;
}
export function removeCarFx(e){const fx=currentCarFx(e);if(fx)change(e,'Remove car FX',()=>{e.selectedCar.art.fx=e.selectedCar.art.fx.filter(f=>f.id!==fx.id);e.carFxPlacementIndex=-1;e.carFxPlacementDrag=null;});}
export function removeCarFxPlacement(e){
 const fx=currentCarFx(e),slot=e.selectedCarShellFrameSlot||'front',index=e.carFxPlacementIndex;
 if(!fx||!Number.isInteger(index)||index<0||!fx.views?.[slot]?.placements?.[index])return;
 change(e,'Remove FX copy',()=>{fx.views[slot].placements.splice(index,1);e.carFxPlacementIndex=-1;e.carFxPlacementDrag=null;});
}
export async function pickCarFxArt(e,picker=openProjectBrowser){
 const car=e.selectedCar,fx=currentCarFx(e),slot=e.selectedCarShellFrameSlot||'front';if(!fx){e.status='Add an effect first';return;}
 const picked=await picker({mode:'open',fixedFolder:'art',initialFolder:'art',title:'Choose FX artwork for '+CAR_VIEW_LABELS[slot]});
 if(picked?.action!=='open'||!picked.name||e.selectedCar!==car||!car.art.fx.includes(fx))return;
 change(e,'Set car FX artwork',()=>{fx.artRef=picked.name;fx.views[slot]=normalizeCarFxView({...fx.views[slot],artRef:picked.name});});
}
export async function editCarFx(e,showForm=openEditorForm){
 const car=e.selectedCar,fx=currentCarFx(e),slot=e.selectedCarShellFrameSlot||'front';if(!fx)return;
 const v=fx.views[slot]||newCarFxPlacementView(fx);
 const pointIndex=Math.min(e.carFxPlacementIndex??0,(v.placements||[]).length-1);
 const point=v.placements?.[pointIndex]||v;
 const labels={always:'Always',precipitation:'Precipitation',braking:'Braking',reverse:'Reverse gear',cold:'Cold weather',night:'Night',accelerating:'Accelerating'};
 const fields=[{id:'name',label:'Effect name',type:'text',value:fx.name},{id:'enabled',label:'Effect enabled',type:'checkbox',value:fx.enabled},
  {id:'artRef',label:'Artwork',type:'text',readOnly:true,required:false,value:v.artRef||fx.artRef||''},
  {id:'chooseArt',label:'Choose artwork',type:'button',onClick:async()=>{const picked=await openProjectBrowser({mode:'open',fixedFolder:'art',initialFolder:'art',title:'Choose effect artwork'});return picked?.action==='open'?{artRef:picked.name}:{};}},
  {id:'removePlacement',label:'Remove selected placement',type:'checkbox',value:false,visibleWhen:()=>pointIndex>=0},
  ...CAR_FX_TRIGGERS.map(t=>({id:'trigger:'+t,label:labels[t]||t.replace('-',' '),type:'checkbox',value:fx.triggers.includes(t)})),
  ...CAR_FX_DAMAGE.flatMap(k=>['min','max'].map(limit=>({id:k+':'+limit,label:k+' damage '+limit+' (%)',value:fx.damageLevels?.[k]?.[limit]??(limit==='min'?25:100),min:0,max:100,visibleWhen:state=>state['trigger:'+k+'-damage']}))),
  {id:'coldBelowC',label:'Cold below (°C)',value:fx.coldBelowC,min:-80,max:60},
  {id:'clearArt',label:'Clear all placements at this angle',type:'checkbox',value:false},
  {id:'frameIndex',label:'Artwork frame (0 = first)',value:v.frameIndex,min:0,max:10000,step:1},
  ...['x','y','width','height','rotation','opacity'].map(k=>({id:k,label:{x:'Position X (% of car width)',y:'Position Y (% of car height)',width:'Width (% of car)',height:'Height (% of car)',rotation:'Rotation (degrees)',opacity:'Opacity (%)'}[k],value:(['x','y'].includes(k)?point[k]:v[k])*(k==='rotation'?1:100),min:['width','height'].includes(k)?.5:k==='opacity'?0:k==='rotation'?-180:-400,max:k==='rotation'?180:k==='opacity'?100:400,step:'any'})),
  {id:'mirror',label:'Mirrored pair across car center (this view)',type:'checkbox',value:v.mirror}];
 const result=await showForm('FX — '+CAR_VIEW_LABELS[slot],fields,{description:'Damage ranges are inclusive percentages (0 = intact, 100 = destroyed); tire, suspension and body use their most damaged part. Triggers use ANY matching condition. Always keeps the effect on. Assigned artwork appears at this angle whenever a trigger matches. Tap the car to add placements; drag a placement to move it. Clear placements to omit an angle. Reverse means reverse gear is selected. Size, rotation, opacity and mirroring apply to all placements at this angle. X/Y edits the selected placement. Positive X is right; positive Y is down. Rotate the car to configure other views. Turn on Test Effect to preview the selected effect regardless of its triggers.'});
 if(!result||e.selectedCar!==car||!car.art.fx.includes(fx))return;
 change(e,'Update car FX',()=>{fx.damageLevels=Object.fromEntries(CAR_FX_DAMAGE.map(k=>[k,{min:result[k+':min'],max:result[k+':max']}]));fx.name=result.name;fx.enabled=result.enabled;fx.coldBelowC=result.coldBelowC;fx.triggers=CAR_FX_TRIGGERS.filter(t=>result['trigger:'+t]);const placements=(v.placements||[]).map(p=>({...p}));if(pointIndex>=0){if(result.removePlacement)placements.splice(pointIndex,1);else placements[pointIndex]={x:result.x/100,y:result.y/100};}fx.artRef=result.artRef??fx.artRef;fx.views[slot]=normalizeCarFxView({...v,...result,artRef:result.artRef??v.artRef,placements:result.clearArt?[]:placements,...Object.fromEntries(['x','y','width','height','opacity'].map(k=>[k,result[k]/100]))});e.carFxPlacementIndex=result.removePlacement||result.clearArt?-1:pointIndex;});
}
export async function selectCarFx(e,showForm=openEditorForm){
 const car=e.selectedCar,fx=currentCarFx(e),draft=normalizeCarFx(car.art.fx||[]),slot=e.selectedCarShellFrameSlot||'front';
 const result=await showForm('Effects',[
  {id:'effect',label:'Effect to edit',value:fx?.id||'',required:false,options:()=>draft.length?draft.map(f=>({value:f.id,label:f.name})):[{value:'',label:'No effects — add one below'}]},
  {id:'add',label:'Add effect',type:'button',onClick:()=>{const id=`fx-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;draft.push(normalizeCarFx([{id,name:'New effect',enabled:true,triggers:['always'],views:{[slot]:normalizeCarFxView({placements:[]})}}])[0]);return {effect:id};}},
  {id:'remove',label:'Remove selected effect',type:'button',onClick:state=>{const index=draft.findIndex(f=>f.id===state.effect);if(index>=0)draft.splice(index,1);return {effect:draft[Math.max(0,index-1)]?.id||''};}}
 ],{applyLabel:'Apply',description:'Choose an effect to edit in the preview and Properties. Add or remove effects here, then Apply. Cancel discards these changes.'});
 if(!result||e.selectedCar!==car)return;
 if(JSON.stringify(draft)!==JSON.stringify(car.art.fx||[]))change(e,'Update car effects',()=>{car.art.fx=draft;});
 e.carFxId=draft.find(f=>f.id===result.effect)?.id||draft[0]?.id||null;e.carFxPlacementIndex=-1;e.carFxPlacementDrag=null;e.invalidateCarEditorPreviewFrame();
}
export function toggleCarFxTest(e){e.carFxTestEnabled=!e.carFxTestEnabled;e.invalidateCarEditorPreviewFrame();e.status=e.carFxTestEnabled?'Testing selected effect — triggers bypassed':'Effect test off — normal triggers apply';}

export function drawCarFxPanel(e,ctx,bounds){
 const x=bounds.x+12,w=bounds.w-24,gap=6,rowH=26;
 const button=(id,label,col,row,fn,enabled=true)=>e.registerDrawnButton(ctx,{x:x+col*(w+gap)/2,y:bounds.y+8+row*rowH,w:(w-gap)/2,h:22},{id:'car-fx-'+id,label,formatLabel:false,disabled:!enabled,onClick:enabled?()=>Promise.resolve(fn()).catch(err=>{e.status=err.message;}):null});
 const fx=currentCarFx(e);if(fx)e.carFxId=fx.id;
 button('select','Effects',0,0,()=>selectCarFx(e));button('properties','Properties',1,0,()=>editCarFx(e),!!fx);
 button('test',e.carFxTestEnabled?'Test Effect: On':'Test Effect: Off',0,1,()=>toggleCarFxTest(e),!!fx);
 button('remove-copy','Remove Copy',1,1,()=>removeCarFxPlacement(e),!!fx?.views?.[e.selectedCarShellFrameSlot||'front']?.placements?.[e.carFxPlacementIndex]);
 const y=bounds.y+64,arrowW=Math.min(66,w*.25),slot=e.selectedCarShellFrameSlot||'front';
 for(const [direction,label,bx] of [[-1,'← 45°',x],[1,'45° →',x+w-arrowW]])e.registerDrawnButton(ctx,{x:bx,y,w:arrowW,h:22},{id:direction<0?'car-angle-left':'car-angle-right',label,formatLabel:false,onClick:()=>{e.carFxPlacementIndex=-1;e.cycleCarShellFrameSlot(direction);}});
 ctx.fillStyle='#eef4ed';ctx.font='700 10px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText?.(CAR_VIEW_LABELS[slot],x+w/2,y+11,Math.max(1,w-arrowW*2-8));
 ctx.font='10px sans-serif';ctx.fillText?.(fx?'Tap car preview • Drag handles':'Add an effect to place artwork',x+w/2,y+40,w);ctx.textAlign='left';
 const tabY=bounds.y+bounds.h-28,tabW=(w-18)/4;
 [['body','Body'],['tires','Tires'],['brakes','FX'],['shadow','Shadow']].forEach(([id,label],i)=>e.drawCarArtComponentTab(ctx,{x:x+i*(tabW+6),y:tabY,w:tabW,h:22},id,label,id==='brakes'));
}
export const isCarFxPlacementEditor=e=>e.mode==='car'&&e.activeRootId==='art'&&e.carArtActiveComponent==='brakes'&&!['car-art-interior','car-camera-settings','car-gauges-exterior','car-gauges-interior'].includes(e.activeAction)&&!e.isLivePlaytestSession();
export function carFxPreviewTransform(e,b){
 const f=e.carFxPreviewFrame;
 if(!isCarFxPlacementEditor(e)||e.carFxZoom!==2||!f)return {scale:1,x:0,y:0};
 const x=b.x+(f.x-f.bounds.x)*b.w/f.bounds.w,y=b.y+(f.y-f.bounds.y)*b.h/f.bounds.h;
 return {scale:2,x:b.x+b.w/2-x*2,y:b.y+b.h/2-y*2};
}
export function drawCarFxPreviewCanvas(e,ctx,canvas,b){
 const t=carFxPreviewTransform(e,b);
 if(t.scale===1){ctx.drawImage(canvas,b.x,b.y,b.w,b.h);return;}
 ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();ctx.translate(t.x,t.y);ctx.scale(t.scale,t.scale);ctx.drawImage(canvas,b.x,b.y,b.w,b.h);ctx.restore();
}
export function nudgeCarFxPlacement(e,dx,dy){
 const frame=placementFrame(e),fx=currentCarFx(e),slot=e.selectedCarShellFrameSlot||'front',p=fx?.views?.[slot]?.placements?.[e.carFxPlacementIndex];
 if(!frame||!p)return;
 const side=e.carFxPlacementSide===-1?-1:1,q=projectPoint(p,side,frame);
 change(e,'Nudge FX copy',()=>Object.assign(p,unprojectPoint({x:q.x+dx,y:q.y+dy},side,frame)));
}
function drawCarFxPreviewTools(e,ctx,b){
 const size=28,gap=3,x=b.x+8,y=b.y+b.h-size*3-gap*2-8;
 const selected=!!currentCarFx(e)?.views?.[e.selectedCarShellFrameSlot||'front']?.placements?.[e.carFxPlacementIndex];
 const button=(id,label,bounds,onClick,disabled=false)=>e.registerDrawnButton(ctx,bounds,{id:'car-fx-'+id,label,formatLabel:false,disabled,onClick:disabled?null:onClick});
 for(const [id,label,col,row,dx,dy] of [['up','↑',1,0,0,-1],['left','←',0,1,-1,0],['right','→',2,1,1,0],['down','↓',1,2,0,1]])button('nudge-'+id,label,{x:x+col*(size+gap),y:y+row*(size+gap),w:size,h:size},()=>nudgeCarFxPlacement(e,dx,dy),!selected);
 const w=Math.min(106,b.w*.32),right=b.x+b.w-w-8;
 button('guides',e.carFxGuidesHidden?'Guides: Off':'Guides: On',{x:right,y:b.y+b.h-72,w,h:28},()=>{e.carFxGuidesHidden=!e.carFxGuidesHidden;});
 button('zoom',e.carFxZoom===2?'Zoom: 2×':'Zoom: 1×',{x:right,y:b.y+b.h-38,w,h:28},()=>{e.carFxZoom=e.carFxZoom===2?1:2;e.carFxPlacementDrag=null;});
}
function placementFrame(e){const f=e.carFxPreviewFrame,b=e.carGaugeViewport;return f&&b&&f.slot===(e.selectedCarShellFrameSlot||'front')&&f.carId===e.getRaceCarProjectIdentity(e.selectedCar)?{f,b,transform:carFxPreviewTransform(e,b)}:null;}
function projectPoint(p,side,{f,b,transform={scale:1,x:0,y:0}}){const c=Math.cos(f.rotation),s=Math.sin(f.rotation),x=p.x*f.width*side,y=p.y*f.height;return {x:(b.x+(f.x+c*x-s*y-f.bounds.x)*b.w/f.bounds.w)*transform.scale+transform.x,y:(b.y+(f.y+s*x+c*y-f.bounds.y)*b.h/f.bounds.h)*transform.scale+transform.y};}
function unprojectPoint(p,side,{f,b,transform={scale:1,x:0,y:0}}){p={x:(p.x-transform.x)/transform.scale,y:(p.y-transform.y)/transform.scale};const x=f.bounds.x+(p.x-b.x)*f.bounds.w/b.w-f.x,y=f.bounds.y+(p.y-b.y)*f.bounds.h/b.h-f.y,c=Math.cos(f.rotation),s=Math.sin(f.rotation);return {x:Math.max(-4,Math.min(4,(c*x+s*y)/f.width*side)),y:Math.max(-4,Math.min(4,(-s*x+c*y)/f.height))};}
export function drawCarFxPlacementHandles(e,ctx,bounds){
 if(!isCarFxPlacementEditor(e))return;
 const frame=placementFrame(e),fx=currentCarFx(e),v=fx?.views?.[frame?.f.slot];
 ctx.save();ctx.beginPath();ctx.rect(bounds.x,bounds.y,bounds.w,bounds.h);ctx.clip();
 const message=!fx?'Add an effect to start placing artwork':!frame?'Preparing FX placement preview…':!(v?.artRef||fx.artRef)?'Choose artwork in FX Properties':e.carFxTestEnabled&&!v?'Test sample only — tap car to place at this angle':`Tap car to place ${fx.name || 'effect'} • Drag handles to move`;
 if(!e.carFxGuidesHidden){ctx.fillStyle='rgba(0,0,0,0.8)';ctx.fillRect(bounds.x+8,bounds.y+8,Math.max(1,bounds.w-16),28);
 ctx.fillStyle='#eef4ed';ctx.font='700 12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(message,bounds.x+bounds.w/2,bounds.y+22,Math.max(1,bounds.w-28));}
 if(frame&&fx&&!e.carFxGuidesHidden){
  // Outline the actual body anchor area, including before the first placement.
  ctx.strokeStyle='rgba(88,214,255,0.8)';ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.beginPath();
  [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5],[-.5,-.5]].forEach(([x,y],i)=>{const q=projectPoint({x,y},1,frame);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.stroke();ctx.setLineDash([]);
  (v?.placements||(v?[{x:v.x,y:v.y}]:[])).forEach((p,i)=>{for(const side of v.mirror&&Math.abs(p.x)>.0001?[1,-1]:[1]){const q=projectPoint(p,side,frame);ctx.strokeStyle=i===e.carFxPlacementIndex?'#ffd45a':'#58d6ff';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,7,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(q.x-10,q.y);ctx.lineTo(q.x+10,q.y);ctx.moveTo(q.x,q.y-10);ctx.lineTo(q.x,q.y+10);ctx.stroke();}});
 }
 ctx.restore();
 drawCarFxPreviewTools(e,ctx,bounds);
}

export function carFxPointer(e,p,phase){
 if(!isCarFxPlacementEditor(e))return false;
 const frame=placementFrame(e),fx=currentCarFx(e),id=p.id??'pointer';if(!frame||!fx)return false;
 const slot=frame.f.slot,{b}=frame;
 if(phase==='down'){
  if(p.x<b.x||p.y<b.y||p.x>b.x+b.w||p.y>b.y+b.h)return false;
  let v=fx.views[slot];const ref=v?.artRef||fx.artRef;
  if(!ref){e.status='Choose artwork in FX Properties, then tap the car';return true;}
  if(!v)v=newCarFxPlacementView(fx);
  const placements=v.placements||[{x:v.x,y:v.y}];let index=-1,side=1,best=14;
  placements.forEach((point,i)=>{for(const sign of v.mirror&&Math.abs(point.x)>.0001?[1,-1]:[1]){const q=projectPoint(point,sign,frame),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<best){best=d;index=i;side=sign;}}});
  let captured=false;if(index<0){e.captureRaceHistory('Place car FX');captured=true;fx.views[slot]=v;v.placements=placements;index=placements.length;placements.push(unprojectPoint(p,1,frame));e.syncCarAnglePreviewArt();e.invalidateCarEditorPreviewFrame();}
  e.carFxPlacementIndex=index;e.carFxPlacementSide=side;e.carFxPlacementDrag={id,effectId:fx.id,slot,index,side,startX:p.x,startY:p.y,captured,frame};e.status='Drag to move; Remove Copy deletes this placement; Properties resizes it';return true;
 }
 const d=e.carFxPlacementDrag;if(!d||d.id!==id)return false;
 const active=(e.selectedCar.art.fx||[]).find(f=>f.id===d.effectId),point=active?.views?.[d.slot]?.placements?.[d.index];
 if(point&&Math.hypot(p.x-d.startX,p.y-d.startY)>2){if(!d.captured){e.captureRaceHistory('Move car FX');d.captured=true;}Object.assign(point,unprojectPoint(p,d.side,d.frame));e.syncCarAnglePreviewArt(undefined,{prepareFrames:false});e.invalidateCarEditorPreviewFrame();}
 if(phase==='up'){e.carFxPlacementDrag=null;e.invalidateCarEditorPreviewFrame();}
 return true;
}
