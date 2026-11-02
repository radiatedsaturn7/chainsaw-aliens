import {raceFxPreset} from '../racing/RaceVisualFx.js';
import {chooseRoadRoute} from './RaceRouteImport.js';
import {openEditorForm} from './shared/editorForm.js';

export async function requestTrackImport(body,{signal,fetcher=fetch}={}){
  let response;
  try { response=await fetcher('/__race-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal}); }
  catch(error){if(error.name==='AbortError')throw error;throw Error('Cannot reach the Python track importer. Start tools/dev_server.py and try again.');}
  let result;try{result=await response.json();}catch{throw Error('Track import needs the Python server (tools/dev_server.py), not static hosting.');}
  if(!response.ok||!result.ok)throw Error(result.error||'Track import failed.');
  return result;
}

export function trackLayoutLength(layout){
  if(Number.isFinite(layout?.lengthM))return layout.lengthM;
  return (layout?.points||[]).slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-layout.points[i].x,p.y-layout.points[i].y),0);
}
export function trackLayoutLabel(layout){
  const length=trackLayoutLength(layout);
  return `${layout.name} — ${(length/1000).toFixed(2)} km / ${(length/1609.344).toFixed(2)} mi`;
}
export function drawTrackImportPreview(canvas,layout){
  const ctx=canvas.getContext('2d'),points=layout?.points||[];
  ctx.fillStyle='#101818';ctx.fillRect(0,0,canvas.width,canvas.height);if(!points.length)return;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),minY=Math.min(...ys);
  const w=Math.max(1,Math.max(...xs)-minX),h=Math.max(1,Math.max(...ys)-minY);
  const scale=Math.min((canvas.width-32)/w,(canvas.height-64)/h);
  const ox=(canvas.width-w*scale)/2,oy=30+(canvas.height-56-h*scale)/2;
  const x=p=>ox+(p.x-minX)*scale,y=p=>oy+(p.y-minY)*scale;
  ctx.strokeStyle='#68d8cf';ctx.lineWidth=3;ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(x(p),y(p)):ctx.moveTo(x(p),y(p)));ctx.stroke();
  ctx.fillStyle='#ffe26b';ctx.beginPath();ctx.arc(x(points[0]),y(points[0]),4,0,Math.PI*2);ctx.fill();
  const length=trackLayoutLength(layout);ctx.font='bold 15px system-ui';ctx.textAlign='left';ctx.fillStyle='#fff';
  ctx.fillText(`${(length/1000).toFixed(2)} km / ${(length/1609.344).toFixed(2)} miles`,10,20);
  ctx.font='12px system-ui';ctx.fillStyle='#c2d6ce';
  ctx.fillText(`Footprint: ${Math.round(w)} × ${Math.round(h)} m · Yellow: start`,10,canvas.height-8);
}

export async function importRealTrack(editor,{form=openEditorForm,request=requestTrackImport}={}){
  if(editor.mode!=='race'||editor.realTrackImportOpen)return false;
  editor.realTrackImportOpen=true;editor.closeEditorMenus?.();editor.game?.input?.reset?.();
  const original=editor.selectedRace;
  const attempt=async(label,body)=>{
    editor.status=label;
    const cancel=new AbortController(),dialog=new AbortController();let finished=false;
    const prompt=form(label,[],{pending:true,signal:dialog.signal,description:'Contacting map services. Elevation can take a minute or two. Cancel leaves your current track unchanged.'});
    void prompt.then(()=>{if(!finished)cancel.abort();});
    const timer=setTimeout(()=>cancel.abort(),150000);
    try{return await request(body,{signal:cancel.signal});}
    finally{finished=true;clearTimeout(timer);dialog.abort();await prompt;}
  };
  const busy=async(label,body)=>{
    for(;;){
      try{return await attempt(label,body);}
      catch(error){
        if(error.name==='AbortError'||!/service unavailable|cannot reach/i.test(error.message))throw error;
        editor.status=`Track import paused: ${error.message}`;
        const retry=await form('Track service unavailable',[],{applyLabel:'Retry',description:`${label}\n${error.message}\n\nYour track is unchanged. Retry this step without re-entering the name or layout.`});
        if(!retry)throw Object.assign(Error('Cancelled'),{name:'AbortError'});
      }
    }
  };
  try{
    const input=await form('Import Real Track',[
      {id:'mode',label:'Race import',type:'select',value:'circuit',options:[{value:'circuit',label:'Circuit layouts'},{value:'route',label:'Point-to-point roads'}]},
      {id:'radius',label:'Road map radius (metres)',type:'number',value:10000,min:500,max:20000,visibleWhen:v=>v.mode==='route'},
      {id:'name',label:'Track or area name',type:'text',value:'',required:true},
    ],{applyLabel:'Find track',description:'Try Seekonk Speedway, New Hampshire Motor Speedway, Lime Rock Park, or Laguna Seca. Choose a mapped circuit, then import editable road nodes and approximate terrain. Map data: © OpenStreetMap contributors (ODbL), openstreetmap.org/copyright. US elevations: USGS 3DEP.'});
    if(!input)return false;
    const found=await busy('Finding track…',{action:'search',name:input.name});
    const choice=await form('Choose venue',[{id:'place',label:'Location',type:'select',value:found.places[0].id,options:found.places.map(p=>({value:p.id,label:p.name}))}],{applyLabel:input.mode==='route'?'Load road map':'Find layouts',description:found.searchedName?`Search: ${found.searchedName}`:''});
    if(!choice)return false;
    const mapped=input.mode==='route'?await chooseRoadRoute({form,busy,placeId:choice.place,radius:input.radius}):await busy('Finding circuit layouts…',{action:'layouts',placeId:choice.place});
    if(!mapped)return false;
    const config=await form(input.mode==='route'?'Preview point-to-point route':'Choose circuit layout',[
      {id:'layout',label:input.mode==='route'?'Route':'Circuit',type:'select',value:mapped.layouts[0].id,options:mapped.layouts.map(l=>({value:l.id,label:trackLayoutLabel(l)}))},
      {type:'preview',label:input.mode==='route'?'Route outline — yellow dot is start':'Circuit outline — yellow dot is provisional start',render:(canvas,values)=>drawTrackImportPreview(canvas,mapped.layouts.find(l=>l.id===values.layout))},
      {id:'importAll',label:`Import all ${mapped.layouts.length} listed layouts as separate races`,type:'checkbox',value:false,visibleWhen:()=>mapped.layouts.length>1},
      {id:'width',label:'Default road width (metres)',type:'number',value:12,min:3,max:30,step:.5},
      {id:'elevation',label:'Import USGS elevation and terrain (USA)',type:'checkbox',value:true},
      {id:'reverse',label:'Reverse driving direction',type:'checkbox',value:false}
    ],{applyLabel:'Build track',description:input.mode==='route'?`${mapped.warning||'Route matched to source OSM geometry.'} Review the route and distance before importing. Start and finish remain separate, including their elevations.`:'Compare the outline and distance: main circuits are listed first, with smaller courses below. Import all includes alternate junction combinations and may take several minutes. Only mapped closed raceways are included; pit lanes are excluded. Banking starts flat. Width, start line, direction and elevation can be edited afterward.'});
    if(!config)return false;
    const choices=config.importAll?mapped.layouts:mapped.layouts.filter(l=>l.id===config.layout);
    const results=[];
    for(const [index,layout] of choices.entries()){
      results.push(await busy(choices.length>1?`Building ${index+1}/${choices.length}: ${layout.name}`:'Building editable track…',
        {action:'build',layoutId:layout.id,width:config.width,elevation:config.elevation,reverse:config.reverse}));
    }
    const warnings=[...new Set(results.flatMap(r=>r.warnings))];
    const accept=await form('Track ready',[],{applyLabel:'Open in editor',description:[results[0].attribution,...choices.map(trackLayoutLabel),...warnings,
      'Your existing race stays in the project. Each imported layout is a separate editable race. Use Save As to keep the races you want.'].join('\n\n')});
    if(!accept||editor.selectedRace!==original)return false;
    let first;
    for(const result of results){if(!result.race.visualFx)Object.assign(result.race,raceFxPreset('noon'));if(!editor.applyImageRace(result.race,'OpenStreetMap'))return false;first??=editor.selectedRace;}
    if(results.length>1){editor.applyLoadedRaceDocument?.(first,{normalized:true,name:first.name});editor.status=`Imported ${results.length} layouts — choose a race and Save As to keep it`;}
    return true;
  }catch(error){
    editor.status=error.name==='AbortError'?'Track import cancelled or timed out. Your track is unchanged.':`Track import failed: ${error.message}`;
    if(error.name!=='AbortError')await form('Track import failed',[],{description:editor.status,applyLabel:'OK'});
    return false;
  }finally{editor.realTrackImportOpen=false;editor.game?.input?.reset?.();}
}
