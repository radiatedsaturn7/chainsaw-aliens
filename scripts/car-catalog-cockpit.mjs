/** Authored dashboard-pixel instrument regions, measured from original PNGs.
 * Applies only shared wheel and interior gauges. No physics/art/angle/map edits. */
import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeCarGauges} from '../src/racing/CarGauges.js';
export const cockpitAnchors={
 'kestrel-660-2018':{size:[2153,730],cluster:[485,554,590,82],wheel:[775,825,475]},
 'flint-coupe-2005':{size:[1670,941],cluster:[535,610,600,63],wheel:[795,947,420]},
 'volt-hound-gt-2023':{size:[2172,724],cluster:[425,535,855,80],wheel:[845,842,490],electric:true},
 'caravan-9-2024':{size:[1983,793],cluster:[345,563,430,80],wheel:[558,890,435]},
 'dustjack-v8':{size:[1983,793],cluster:[320,565,450,87],wheel:[550,899,450]},
 'trailglass-2024':{size:[1983,793],cluster:[350,575,445,92],wheel:[573,906,440]},
 'sentinel-sedan-2024':{size:[1984,793],cluster:[365,563,460,84],wheel:[595,894,430]},
 'ember-pod':{size:[1983,793],cluster:[325,548,405,94],wheel:[530,892,425]},
 'nightcoil-gt-1995':{size:[1983,793],cluster:[225,560,495,105],wheel:[475,916,455]}
};
export function applyCockpitAnchors(car,a){
 const [w,h]=a.size,[x,y,cw,ch]=a.cluster,[wx,wy,ww]=a.wheel;
 car.art||={};car.art.interior||={};
 car.art.interior.steeringWheel={...car.art.interior.steeringWheel,artRef:'steeringwheel',frameIndex:0,coordinateSpace:'dashboard',anchorX:wx/w,anchorY:wy/h,width:ww/w,scaleX:1,scaleY:1,offsetX:0,offsetY:0};
 const fields=a.electric?[['speed','MPH'],['tractionBattery.powerKw','kW'],['gear',''],['tractionBattery.percent','%']]:[['speed','MPH'],['rpm','RPM'],['gear',''],['fuel','%']];
 const parts=[.30,.32,.14,.24];let left=x;
 const widgets=fields.map(([source,units],i)=>{
  const width=cw*parts[i],characterBudget=[7,9,2,5][i],fontSize=Math.min(20,(width-10)*300/(h*characterBudget*.64),ch*300/(h*1.5)),g={id:'cockpit-'+source,name:source,source,format:'number',enabled:true,x:(left+3)/w,y:y/h,width:(width-6)/w,height:ch/h,units,fontSize,textTemplate:source==='speed'?'${value} MPH':'',fontWeight:700,color:'#ffcc79',textColor:'#ffcc79',background:'rgba(0,0,0,0)',outline:0,textAlign:'center',showValue:true};left+=width;return g;
 });
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
