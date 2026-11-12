import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {cockpitAnchors} from '../../scripts/car-catalog-cockpit.mjs';
import {cockpitDashboardRect,cockpitWheelLayout,cockpitGaugeBounds} from '../../src/racing/CarCockpitLayout.js';
import {normalizeCarGauges,drawCarGauges} from '../../src/racing/CarGauges.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
for(const [id,a] of Object.entries(cockpitAnchors))for(const [w,h] of [[1280,720],[390,844]])test(`${id} cockpit uses authored dashboard pixels at ${w}x${h}`,()=>{
 const car=JSON.parse(fs.readFileSync(new URL(`../../assets/car-catalog/${id}/import.json`,import.meta.url))).car;
 const editor=new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'}),clean=editor.normalizeLoadedCarDocument(structuredClone(car));
 assert.deepEqual(clean.art.gauges.interior,car.art.gauges.interior);assert.equal(clean.art.interior.steeringWheel.coordinateSpace,'dashboard');
 const bounds={x:11,y:17,w,h},image={width:a.size[0],height:a.size[1]},dash=cockpitDashboardRect(bounds,car.art.interior.dashboard,image),wheel=cockpitWheelLayout(bounds,car.art.interior.steeringWheel,dash);
 close(wheel.x,dash.x+dash.w*a.wheel[0]/a.size[0]);close(wheel.y,dash.y+dash.h*a.wheel[1]/a.size[1]);close(wheel.width,dash.w*a.wheel[2]/a.size[0]);
 const calls=[];const ctx=new Proxy({globalAlpha:1,drawImage:(...args)=>calls.push(args),measureText:()=>({width:12})},{get:(o,k)=>k in o?o[k]:()=>{}});
 editor.getRaceArtSpriteCanvas=ref=>ref==='steeringwheel'?{width:512,height:468}:image;
 car.art.interior.dashboard.artRef='dashboard-test';editor.drawCarInteriorLayers(ctx,bounds,car);
 assert.equal(calls.length,2);close(calls[0][1],dash.x);close(calls[0][2],dash.y);close(calls[1][3],wheel.width);
 const gaugeBounds=cockpitGaugeBounds(bounds,car,image);const regions=drawCarGauges(ctx,gaugeBounds,car.art.gauges.interior,{session:{speedMps:20,engineRpm:3000},car});
 assert.equal(regions.length,4);for(const region of regions){assert.ok(region.x>=dash.x+dash.w*a.cluster[0]/a.size[0]);assert.ok(region.x+region.w<=dash.x+dash.w*(a.cluster[0]+a.cluster[2])/a.size[0]+1e-7);close(region.y,dash.y+dash.h*a.cluster[1]/a.size[1]);}
});
test('legacy viewport layouts and exterior gauges remain unchanged',()=>{
 const b={x:10,y:20,w:960,h:540},d={x:0,y:400,w:960,h:140},w=cockpitWheelLayout(b,{},d);close(w.x,490);close(w.y,462.8);close(w.width,140.4);
 const c={art:{gauges:{interior:{coordinateSpace:'dashboard'}}}};assert.equal(cockpitGaugeBounds(b,c,null,'exterior'),b);
 assert.equal(normalizeCarGauges({}).interior.coordinateSpace,undefined);assert.equal(normalizeCarGauges({exterior:{coordinateSpace:'dashboard'}}).exterior.coordinateSpace,undefined);
});

test('dashboard gauge editor hit testing and dragging use dashboard coordinates',async()=>{
 const {gaugePointer}=await import('../../src/ui/CarGaugeEditor.js');
 for(const [w,h] of [[1280,720],[390,844]]){
  const car=JSON.parse(fs.readFileSync(new URL('../../assets/car-catalog/sentinel-sedan-2024/import.json',import.meta.url))).car;
  car.art.interior.dashboard.artRef='dashboard';const a=cockpitAnchors[car.id],image={width:a.size[0],height:a.size[1]},bounds={x:0,y:0,w,h};
  const e={mode:'car',activeRootId:'art',activeAction:'car-gauges-interior',selectedCar:car,carGaugeViewport:bounds,isLivePlaytestSession:()=>false,getRaceArtSpriteCanvas:()=>image,captureRaceHistory:()=>{},invalidateCarEditorPreviewFrame:()=>{},syncCarAnglePreviewArt:()=>{}};
  const g=car.art.gauges.interior.widgets[0],x=g.x,y=g.y,b=cockpitGaugeBounds(bounds,car,image),point={id:1,x:b.x+(g.x+g.width/2)*b.w,y:b.y+(g.y+g.height/2)*b.h};
  assert.equal(gaugePointer(e,point,'down'),true);assert.equal(e.carGaugeId,g.id);
  assert.equal(gaugePointer(e,{...point,x:point.x+8,y:point.y+6},'up'),true);close(g.x,x+8/b.w);close(g.y,y+6/b.h);assert.equal(e.carGaugeDrag,null);
 }
});

test('authored gauge font budgets fit long readings without compressed glyphs',()=>{
 for(const [id,a] of Object.entries(cockpitAnchors)){
  const car=JSON.parse(fs.readFileSync(new URL(`../../assets/car-catalog/${id}/import.json`,import.meta.url))).car;
  for(const [w,h] of [[1280,720],[390,844]]){
   const b=cockpitGaugeBounds({x:0,y:0,w,h},car,{width:a.size[0],height:a.size[1]});
   for(const [i,g] of car.art.gauges.interior.widgets.entries()){
    const fontPx=g.fontSize*b.h/300,charBudget=[7,9,2,5][i];assert.ok(fontPx*.64*charBudget<=g.width*b.w);assert.ok(fontPx*1.5<=g.height*b.h+1e-7);
   }
  }
 }
});
