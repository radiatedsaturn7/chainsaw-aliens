/** Authored dashboard-pixel instrument regions, measured from original PNGs.
 * Applies only shared wheel and interior gauges. No physics/art/angle/map edits. */
import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeCarGauges} from '../src/racing/CarGauges.js';
export const cockpitAnchors={
 'cinder-si-1991':{size:[1983,793],cluster:[245,555,570,145],wheel:[530,793,255]},
 'lark-1600-1990':{size:[1983,793],cluster:[220,540,570,130],wheel:[505,793,250]},
 'sunstriker-gt-1994':{size:[1983,793],cluster:[180,555,580,115],wheel:[470,793,240]},
 'briar-xt-2004':{size:[1983,793],cluster:[335,565,475,115],wheel:[573,793,230]},
 'kestrel-660-2018':{size:[2153,730],cluster:[485,554,590,82],wheel:[775,730,168]},
 'flint-coupe-2005':{size:[1670,941],cluster:[535,610,600,63],wheel:[795,947,420]},
 'volt-hound-gt-2023':{size:[2172,724],cluster:[425,535,855,80],wheel:[845,724,198],electric:true},
 'caravan-9-2024':{size:[1983,793],cluster:[345,563,430,80],wheel:[558,793,280]},
 'dustjack-v8':{size:[1983,793],cluster:[320,565,450,87],wheel:[550,793,262]},
 'trailglass-2024':{size:[1983,793],cluster:[350,575,445,92],wheel:[573,793,232]},
 'sentinel-sedan-2024':{size:[1984,793],cluster:[365,563,460,84],wheel:[595,793,272]},
 'ember-pod':{size:[1983,793],cluster:[325,548,405,94],wheel:[530,793,282]},
 'nightcoil-gt-1995':{size:[1983,793],cluster:[225,560,495,105],wheel:[475,793,236]}
};
export function applyCockpitAnchors(car,a){
 const [w,h]=a.size,[x,y,cw,ch]=a.cluster,[wx,wy,ww]=a.wheel;
 car.art||={};car.art.interior||={};
 car.art.interior.steeringWheel={...car.art.interior.steeringWheel,artRef:'steeringwheel',frameIndex:0,coordinateSpace:'dashboard',anchorX:wx/w,anchorY:wy/h,width:ww/w,scaleX:1,scaleY:1,offsetX:0,offsetY:0};
 const fields=a.electric?[['speed','MPH'],['tractionBattery.powerKw',''],['gear','']]:[['speed','MPH'],['rpm',''],['gear','']];
 const parts=[.34,.49,.17];let left=x;
 const widgets=fields.map(([source,units],i)=>{
  const width=cw*parts[i],characterBudget=[3,5,1][i],fontSize=Math.min(20,(width-10)*300/(h*characterBudget*.64),ch*.84*300/(h*1.5)),g={id:'cockpit-'+source,name:source==='gear'?'Gear':source==='speed'?'Speed (MPH)':a.electric?'Motor power (kW)':'Engine RPM',source,format:'number',enabled:true,x:(left+3)/w,y:y/h,width:(width-6)/w,height:ch*.84/h,units,fontSize,textTemplate:'',fontWeight:700,color:'#ffcc79',textColor:'#ffcc79',background:'rgba(0,0,0,0)',outline:0,textAlign:'center',showValue:true};left+=width;return g;
 });
 widgets.push({id:'cockpit-reserve',name:a.electric?'Battery reserve (0–100%)':'Fuel reserve (0–100%)',source:a.electric?'tractionBattery.percent':'fuel',format:'bar',enabled:true,x:x/w,y:(y+ch*.9)/h,width:cw/w,height:ch*.1/h,min:0,max:100,color:'#ffcc79',background:'#35302a',showValue:false,outline:0});
 const layout=normalizeCarGauges({interior:{enabled:true,coordinateSpace:'dashboard',widgets}}).interior;
 car.art.gauges={...car.art.gauges,interior:layout};return car;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=path.resolve(process.argv[2]||'.');
 for(const [id,a] of Object.entries(cockpitAnchors)){
  const p=path.join(root,'assets/car-catalog',id,'import.json'),d=JSON.parse(fs.readFileSync(p));applyCockpitAnchors(d.car,a);
  d.cockpitCalibration={coordinateSpace:'dashboard',sourceImageSize:a.size,clusterPixels:a.cluster,wheelPivotAndWidthPixels:a.wheel,method:'Visual inspection of original dashboard PNG. Shared steering wheel pivot retained. Numeric instruments occupy the authored dark cluster; browser QA required.'};
  fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
  const doc=path.join(root,'data/server-storage/files/cars',d.car.name,'document.json');
  if(fs.existsSync(doc)){const stored=JSON.parse(fs.readFileSync(doc)),compressed=stored.__chainsawStorage;const current=compressed?JSON.parse(gunzipSync(Buffer.from(stored.data,'base64'))):stored;applyCockpitAnchors(current.car,a);fs.writeFileSync(doc,JSON.stringify(compressed?{...stored,data:gzipSync(JSON.stringify(current)).toString('base64')}:current,null,2)+'\n');}
 }
}
