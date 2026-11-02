import {normalizeTachometer,carRpmLimits,tachometerScale} from '../racing/TachometerFace.js';
import {drawCarGauges,normalizeGauge} from '../racing/CarGauges.js';
export function tachometerFromFields(g,state,choices){
 const t={...g.tachometer,font:{...g.tachometer.font}};
 for(const [id,value] of Object.entries(state)){
  if(id.startsWith('tach_font_'))t.font[id.slice(10)]=value;
  else if(id.startsWith('tach_')&&id!=='tach_fontChoice')t[id.slice(5)]=value;
 }
 const font=choices.find(c=>c.value===state.tach_fontChoice)?.font;if(font)Object.assign(t.font,font);
 return normalizeTachometer(t,g);
}
export function tachometerFields(g,car,choices,picker,getArt){
 const limits=carRpmLimits(car);
 const t=g.tachometer,visibleWhen=state=>state.source==='rpm'&&state.format==='dial';
 const scale={label:'Tachometer — scale',open:true,description:'Follow the car uses its tachometer maximum for the end of the scale and its redline start for the danger zone. The rev limiter is a separate engine cutoff. Turn either off for a custom value.'};
 const arcs={label:'Tachometer — safe / danger arcs'},ticks={label:'Tachometer — ticks'},labels={label:'Tachometer — number labels'};
 const field=(key,label,section,type='range',min=0,max=1,step=.01)=>({id:'tach_'+key,label,section,type,value:t[key],min,max,step});
 const rpmValues={label:'RPM — car values',open:true,description:'These are read from this car’s engine tuning. Use ${rpm.max}, ${rpm.limit}, or ${rpm.redline} in a text template. Dial mode exposes the arc, tick and number styling below.'};
 const fields=[
 {id:'rpmMaxReadout',label:'rpm.max — tachometer maximum',type:'text',readOnly:true,value:limits.max+' RPM',section:rpmValues,visibleWhen:s=>String(s.source).startsWith('rpm')},
 {id:'rpmLimitReadout',label:'rpm.limit — rev limiter kicks in',type:'text',readOnly:true,value:limits.limit+' RPM',section:rpmValues,visibleWhen:s=>String(s.source).startsWith('rpm')},
 {id:'rpmRedlineReadout',label:'rpm.redline — redline starts',type:'text',readOnly:true,value:limits.redline+' RPM',section:rpmValues,visibleWhen:s=>String(s.source).startsWith('rpm')},
 {id:'rpm-use-dial',label:'Customize RPM as a dial',type:'button',section:rpmValues,visibleWhen:s=>s.source==='rpm'&&s.format!=='dial',onClick:()=>({format:'dial',showValue:true,tach_showFace:true})},
 {id:'tach-preview',label:'Tachometer preview',type:'preview',sticky:true,render:(canvas,state)=>{
  const gauge=normalizeGauge({...g,...state,tachometer:tachometerFromFields(g,state,choices),x:.1,y:.02,width:.8,height:.96});
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);const {min,max}=tachometerScale(gauge,car);
  drawCarGauges(ctx,{x:0,y:0,w:320,h:180},{widgets:[gauge]},{car,session:{engineRpm:min+(max-min)*Number(state.rpmPreviewPercent??60)/100}},{getArt});
 }},
 {id:'rpmPreviewPercent',label:'Preview RPM (% of maximum)',type:'range',value:60,min:0,max:100,step:1},
 {...field('displayMode','RPM meter style',scale,'select'),options:[{value:'needle',label:'Needle dial'},{value:'fill',label:'Filled arc'},{value:'both',label:'Filled arc + needle'}]},
 field('autoScale','Use car tachometer maximum',scale,'checkbox'),field('autoRedline','Use car redline start for danger RPM',scale,'checkbox'),
 {...field('redline','Custom danger starts at RPM',scale,'number',0,100000,100),visibleWhen:s=>visibleWhen(s)&&!s.tach_autoRedline},
 field('showFace','Draw arcs, ticks and labels over background artwork',arcs,'checkbox'),field('radius','Arc radius (fraction of gauge radius)',arcs,'range',.1,1),field('arcWidth','Arc thickness (at 300px viewport height)',arcs,'range',0,50,.5),
 field('safeColor','Safe RPM color',arcs,'color'),field('dangerColor','Danger RPM color',arcs,'color'),
 {...field('darkColor','Unfilled arc — dark color',arcs,'color'),visibleWhen:s=>visibleWhen(s)&&s.tach_displayMode!=='needle'},
 {...field('darkOpacity','Unfilled arc opacity',arcs,'range',0,1,.01),visibleWhen:s=>visibleWhen(s)&&s.tach_displayMode!=='needle'},
 ...[['safeArcArtRef','Safe arc'],['dangerArcArtRef','Danger arc']].flatMap(([id,label])=>[
 {id,label:label+' artwork',section:arcs,type:'text',readOnly:true,required:false,value:g[id]},
 {id:'choose-'+id,label:'Choose '+label.toLowerCase()+' artwork',section:arcs,type:'button',onClick:async()=>{const result=await picker({mode:'open',fixedFolder:'art',initialFolder:'art',title:label+' artwork'});return result?.action==='open'?{[id]:result.name}:{};}},
 {id:'clear-'+id,label:'Clear '+label.toLowerCase()+' artwork',section:arcs,type:'button',onClick:()=>({[id]:''})}
 ]),
 field('majorInterval','Major ticks every (RPM)',ticks,'number',1,100000,1),field('minorInterval','Minor ticks every (RPM, 0 = off)',ticks,'number',0,100000,1),
 field('majorLength','Major tick length (fraction of radius)',ticks,'range',0,.8),field('minorLength','Minor tick length (fraction of radius)',ticks,'range',0,.8),
 field('majorWidth','Major tick thickness',ticks,'range',.1,12,.1),field('minorWidth','Minor tick thickness',ticks,'range',.1,12,.1),
 field('majorCutout','Transparent major ticks — cut through arc',ticks,'checkbox'),field('minorCutout','Transparent minor ticks — cut through arc',ticks,'checkbox'),
 {...field('majorColor','Major tick color',ticks,'color'),visibleWhen:s=>visibleWhen(s)&&!s.tach_majorCutout},{...field('minorColor','Minor tick color',ticks,'color'),visibleWhen:s=>visibleWhen(s)&&!s.tach_minorCutout},
 field('showLabels','Show major interval numbers',labels,'checkbox'),field('labelRadius','Number position (fraction of radius)',labels,'range',.1,1),
 {...field('labelDivisor','Number format',labels,'select'),options:[{value:1000,label:'Thousands (1, 2, 3...)'},{value:1,label:'Full RPM (1000, 2000, 3000...)'}]},
 {id:'tach_fontChoice',label:'Interval number font',section:labels,value:choices.find(c=>t.font.fontData?c.font.fontData===t.font.fontData:!c.font.fontData&&c.font.fontFamily===t.font.fontFamily)?.value||'system:monospace',options:choices.map(({value,label})=>({value,label}))},
 ...[['fontSize','Number font size','range',4,120,.5],['fontWeight','Number font weight','range',100,900,100],['fontItalic','Italic numbers','checkbox'],['fontUnderline','Underline numbers','checkbox'],['textColor','Number font color','color'],['outline','Number black outline width','range',0,12,.5]].map(([key,label,type,min,max,step])=>({id:'tach_font_'+key,label,type,min,max,step,value:t.font[key],section:labels}))
 ];
 return fields.map(f=>({...f,visibleWhen:f.visibleWhen||visibleWhen}));
}
