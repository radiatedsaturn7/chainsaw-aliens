import {drawCarGauges,normalizeGauge} from '../racing/CarGauges.js';
import {tachometerFromFields} from './TachometerEditor.js';
export function fuelGaugeFields(g,car,picker,getArt){
 const t=g.tachometer,visibleWhen=s=>s.source==='fuel'&&s.format==='dial',section={label:'Fuel dial',open:true};
 const field=(key,label,type='range',min=0,max=100,step=1)=>({id:'fuel_tach_'+key,label,type,value:t[key],min,max,step});
 const fields=[
 {id:'fuel-preview',label:'Fuel dial preview',type:'preview',render:(canvas,state)=>{const gauge=normalizeGauge({...g,...state,source:'fuel',tachometer:fuelTachometerFromFields(g,state),x:.1,y:.02,width:.8,height:.96});const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);drawCarGauges(ctx,{x:0,y:0,w:320,h:180},{widgets:[gauge]},{car,session:{mechanical:{fuel:Number(state.fuelPreviewPercent??60)/100}}},{getArt});}},
 {id:'fuelPreviewPercent',label:'Preview fuel (%)',type:'range',value:60,min:0,max:100,step:1},
 {...field('displayMode','Fuel meter style','select'),options:[{value:'needle',label:'Needle dial'},{value:'fill',label:'Filled arc'},{value:'both',label:'Filled arc + needle'}]},
 field('showFace','Draw face over artwork','checkbox'),field('redline','Low fuel zone (%)'),field('radius','Radius','range',.1,1,.01),field('arcWidth','Arc thickness','range',0,50,.5),
 field('safeColor','Normal fuel color','color'),field('dangerColor','Low fuel color','color'),field('darkColor','Unfilled arc color','color'),
 field('majorInterval','Major ticks every (%)','range',1,100,1),field('minorInterval','Minor ticks every (%; 0 = off)','range',0,100,1),field('showLabels','Show E / ½ / F labels','checkbox'),field('labelRadius','Label radius','range',.1,1,.01),
 {id:'fuelShowIcon',label:'Show pump and fuel-door arrow',type:'checkbox',value:g.fuelShowIcon},
 ...[['fuelIconOffsetX','Pump / arrow offset X',0,-2,2],['fuelIconOffsetY','Pump / arrow offset Y',0,-2,2],['fuelIconScale','Pump / arrow scale',1,.1,4]].map(([id,label,fallback,min,max])=>({id,label,type:'range',value:g[id]??fallback,min,max,step:.01})),
 {id:'fuelIconAngle',label:'Pump position angle (blank = X/Y offsets)',type:'number',required:false,value:g.fuelIconAngle??'',min:-360,max:360,step:1},
 {id:'fuelIconArtRef',label:'Pump artwork (blank = built-in icon)',type:'text',readOnly:true,required:false,value:g.fuelIconArtRef},
 {id:'fuel-icon',label:'Choose pump artwork',type:'button',onClick:async()=>{const p=await picker({mode:'open',fixedFolder:'art',initialFolder:'art',title:'Fuel pump icon'});return p?.action==='open'?{fuelIconArtRef:p.name}:{};}},
 {id:'fuel-icon-clear',label:'Use built-in pump icon',type:'button',onClick:()=>({fuelIconArtRef:''})}
 ];
 return [{id:'fuel-defaults',label:'Set up fuel dial (E to F)',type:'button',section,visibleWhen:s=>s.source==='fuel',onClick:()=>({format:'dial',min:0,max:100,startAngle:180,sweepAngle:180,showValue:false,fuel_tach_showFace:true,fuel_tach_redline:15,fuel_tach_majorInterval:25,fuel_tach_minorInterval:5,fuel_tach_radius:.9,fuel_tach_arcWidth:3})},...fields.map(f=>({...f,visibleWhen,section}))];
}

export function fuelTachometerFromFields(g,state){return tachometerFromFields(g,Object.fromEntries(Object.entries(state).filter(([key])=>key.startsWith('fuel_tach_')).map(([key,value])=>[key.slice(5),value])),[]);}
