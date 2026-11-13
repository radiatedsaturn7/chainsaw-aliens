/** Authored dashboard-pixel instrument regions, measured from original PNGs.
 * Applies only shared wheel and interior gauges. No physics/art/angle/map edits. */
import fs from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeCarGauges} from '../src/racing/CarGauges.js';
export const cockpitAnchors={
 'moonpetal-2000':{wheelOpening:true,size:[1983,793],cluster:[235,495,410,180],wheel:[440,700,250]},
 'foxmint-2000':{wheelOpening:true,size:[1983,793],cluster:[1240,440,420,175],wheel:[1450,655,250]},
 'hazel-2011':{wheelOpening:true,size:[1983,793],cluster:[245,500,430,185],wheel:[460,715,250]},
 'primrose-st-2005':{wheelOpening:true,size:[1983,793],cluster:[245,500,430,185],wheel:[460,715,250]},
 'bluebell-gt-2006':{wheelOpening:true,size:[1983,793],cluster:[265,510,420,175],wheel:[475,715,250]},
 'chicory-gt-2008':{wheelOpening:true,size:[1983,793],cluster:[275,510,420,175],wheel:[485,715,250]},
 'mallow-s-2006':{wheelOpening:true,size:[1983,793],cluster:[275,510,420,175],wheel:[485,715,250]},
 'firethorn-turbo-2005':{wheelOpening:true,size:[1983,793],cluster:[285,510,420,175],wheel:[495,720,250]},
 'copperhead-sc-2006':{wheelOpening:true,size:[1983,793],cluster:[265,500,465,185],wheel:[500,715,250]},
 'snowdrop-t5-2008':{wheelOpening:true,size:[1983,793],cluster:[200,490,535,205],wheel:[470,720,250]},
 'aster-170-2003':{wheelOpening:true,size:[1983,793],cluster:[225,490,535,195],wheel:[490,710,250]},
 'foxglove-z-2003':{wheelOpening:true,size:[1983,793],cluster:[220,470,570,215],wheel:[505,710,250]},
 'ironbloom-gt-2005':{wheelOpening:true,size:[1983,793],cluster:[215,490,550,200],wheel:[490,715,250]},
 'starwort-2005':{wheelOpening:true,size:[1983,793],cluster:[225,470,550,200],wheel:[500,700,250]},
 'bellflower-2006':{wheelOpening:true,size:[1983,793],cluster:[235,425,520,190],wheel:[495,650,250]},
 'redbud-v6-2007':{wheelOpening:true,size:[1983,793],cluster:[235,450,545,215],wheel:[505,695,250]},
 'boxelder-2005':{wheelOpening:true,size:[1983,793],cluster:[215,485,550,205],wheel:[490,710,250]},
 'stonepod-2006':{wheelOpening:true,size:[1983,793],cluster:[220,450,555,220],wheel:[500,700,250]},
 'clover-2007':{wheelOpening:true,size:[1983,793],cluster:[220,450,555,220],wheel:[500,700,250]},
 'sorrel-2008':{wheelOpening:true,size:[1983,793],cluster:[1160,420,560,210],wheel:[1450,655,250]},
 'buttoncap-2003':{wheelOpening:true,size:[1983,793],cluster:[1160,410,570,225],wheel:[1460,655,250]},
 'cubby-2014':{wheelOpening:true,size:[1983,793],cluster:[200,440,580,230],wheel:[500,690,250]},
 'sunmallow-2006':{wheelOpening:true,size:[1983,793],cluster:[200,420,595,240],wheel:[500,680,250]},
 'copperwing-2004':{wheelOpening:true,size:[1983,793],cluster:[280,340,560,180],wheel:[520,630,250]},
 'dewskipper-2004':{wheelOpening:true,size:[1983,793],cluster:[1110,460,590,170],wheel:[1410,660,250]},
 'podmoss-2005':{wheelOpening:true,size:[1983,793],cluster:[270,480,500,125],wheel:[520,660,250]},
 'glasswing-1990':{wheelOpening:true,size:[1983,793],cluster:[1250,560,460,130],wheel:[1480,660,250]},
 'quince-2014':{wheelOpening:true,size:[1983,793],cluster:[1250,560,460,130],wheel:[1480,793,250]},
 'mossling-2019':{wheelOpening:true,size:[1983,793],cluster:[1240,575,465,120],wheel:[1475,793,250]},
 'cicada-turbo-2015':{size:[1983,793],cluster:[250,550,510,130],wheel:[505,793,255]},
 'nettle-turbo-2017':{size:[1983,793],cluster:[255,570,475,125],wheel:[490,793,250]},
 'marigold-1991':{size:[1983,793],cluster:[1240,585,490,125],wheel:[1485,793,250]},
 'glimmer-1986':{size:[1983,793],cluster:[260,580,520,125],wheel:[520,793,250]},
 'rosefinch-1991':{size:[1983,793],cluster:[1335,545,475,130],wheel:[1573,793,250]},
 'larch-turbo-1995':{size:[1983,793],cluster:[230,560,420,125],wheel:[440,793,250]},
 'vesper-v6-2003':{size:[1983,793],cluster:[285,560,480,125],wheel:[525,793,255]},
 'bramble-2021':{wheelOpening:true,size:[1983,793],cluster:[1335,545,475,130],wheel:[1573,793,250]},
 'sundew-660-1991':{size:[1983,793],cluster:[1335,545,475,130],wheel:[1573,793,250]},
 'pipit-100-2007':{size:[1983,793],cluster:[1135,550,560,115],wheel:[1415,793,270]},
 'cairn-1974':{size:[1983,793],cluster:[330,585,510,130],wheel:[580,793,270]},
 'ashbaron-1987':{size:[1983,793],cluster:[160,555,490,130],wheel:[405,793,250]},
 'stormline-2002':{size:[1983,793],cluster:[1305,555,490,130],wheel:[1550,793,250]},
 'gossamer-2005':{size:[1983,793],cluster:[285,545,480,120],wheel:[525,793,250]},
 'rotorveil-1993':{size:[1983,793],cluster:[280,545,495,125],wheel:[530,793,255]},
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
 if(a.wheelOpening){
  // Match the playable WRX-derived Airslayer wheel diameter on every viewport,
  // but retain the authored right-hand-drive dashboard anchor.
  Object.assign(car.art.interior.steeringWheel,{sizeSpace:'viewport',scaleX:1.6875,scaleY:1.6875});
  layout.coordinateSpace='wheel-opening';
  for(const [i,g] of layout.widgets.entries()){
   const xs=[0,.28,.8,0],widths=[.26,.50,.20,1];
   Object.assign(g,{x:xs[i],y:i===3?.92:0,width:widths[i],height:i===3?.08:.88,fontSize:i===3?18:120});
  }
 }
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
