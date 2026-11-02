import test from 'node:test';
import assert from 'node:assert/strict';
import {createGlassWeather,updateGlassWeather,syncWeatherWipers,sweptByWiper,GLASS_DROP_LIMIT} from '../../src/racing/GlassWeather.js';
import {normalizeCarWipers,toggleWipers} from '../../src/racing/CarWipers.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const wet={id:'rain',precipitationIntensity:1},dry={id:'clear',precipitationIntensity:0};
const wipers=normalizeCarWipers({artRef:'wipers'});
const run=(s,seconds,options,step=1/60)=>{for(let t=0;t<seconds-1e-8;t+=step)updateGlassWeather(s,step,{wipers,...options});};
const drop=()=>({x:.5,y:.4,radius:.008,age:1,life:25,snow:0,drift:0});
test('rain and snow auto-enable wipers on onset but respect a manual override',()=>{
 for(const id of ['rain','storm','snow']){
  const s={};syncWeatherWipers(s,{...wet,id});assert.equal(s.wipers.enabled,true);toggleWipers(s);syncWeatherWipers(s,{...wet,id});assert.equal(s.wipers.enabled,false);
  syncWeatherWipers(s,dry);syncWeatherWipers(s,{...wet,id});assert.equal(s.wipers.enabled,true);
 }
 const s={};syncWeatherWipers(s,dry);assert.equal(s.wipers,undefined);
});
test('droplet generation is bounded and fixed-step deterministic',()=>{
 const a={},b={};run(a,4,{weather:wet},1/30);run(b,4,{weather:wet});assert.deepEqual(a.glassWeather.lens,b.glassWeather.lens);assert.deepEqual(a.glassWeather.windshield,b.glassWeather.windshield);
 run(a,30,{weather:wet});assert.ok(a.glassWeather.lens.length<=GLASS_DROP_LIMIT);assert.ok(a.glassWeather.windshield.length<=GLASS_DROP_LIMIT);
 const before=JSON.stringify(a);updateGlassWeather(a,0,{weather:wet,wipers});assert.equal(JSON.stringify(a),before);
});
test('snow softens to water and fast airflow carries water upward',()=>{
 const s={glassWeather:createGlassWeather()};s.glassWeather.windshield.push({...drop(),snow:1});run(s,6,{weather:dry,temperatureC:-4,speedMps:0});assert.equal(s.glassWeather.windshield[0].snow,0);
 const slow={glassWeather:createGlassWeather()},fast={glassWeather:createGlassWeather()};slow.glassWeather.windshield.push(drop());fast.glassWeather.windshield.push(drop());run(slow,2,{weather:dry,speedMps:0});run(fast,2,{weather:dry,speedMps:45});assert.ok(slow.glassWeather.windshield[0].y>.4);assert.ok(fast.glassWeather.windshield[0].y<.4);
});
test('wipers clear only swept windshield positions; exterior droplets fade much faster',()=>{
 const c=normalizeCarWipers({artRef:'wipers',mounts:[{x:.5,y:.75}],width:.3});
 assert.equal(sweptByWiper({x:.6,y:.55},c,16/9,[-1.2,-.2]),true);assert.equal(sweptByWiper({x:.1,y:.1},c,16/9,[-1.2,-.2]),false);
 const s={glassWeather:createGlassWeather(),wiperWeatherWet:true,wipers:{enabled:true,moving:true,phase:0}};
 s.glassWeather.windshield.push({...drop(),x:.6,y:.55},{...drop(),x:.1,y:.1});run(s,1.6,{weather:dry,wipers:c});assert.equal(s.glassWeather.windshield.length,1);assert.equal(s.glassWeather.windshield[0].x,.1);
 const on={glassWeather:createGlassWeather(),wipers:{enabled:true,moving:true,phase:0}},off={glassWeather:createGlassWeather()};on.glassWeather.lens.push(drop());off.glassWeather.lens.push(drop());run(on,2,{weather:dry});run(off,2,{weather:dry});assert.equal(on.glassWeather.lens.length,0);assert.equal(off.glassWeather.lens.length,1);
});
test('shelter prevents new glass droplets',()=>{
 const s={};run(s,2,{weather:wet,sheltered:true});assert.equal(s.glassWeather.windshield.length,0);assert.equal(s.glassWeather.lens.length,0);
});
test('debug weather and brightness overrides are session-local and resettable',()=>{
 const e=new RaceEditor({},{mode:'car'});const authored=JSON.stringify(e.selectedRace);e.playtestSession={elapsedMs:0};e.raceInput.pauseMenuMode='debug-weather';
 e.adjustRaceDebugEnvironment('weather');assert.equal(e.getRaceWeatherState().id,'clear');e.adjustRaceDebugEnvironment('weather');assert.equal(e.getRaceWeatherState().id,'rain');assert.ok(e.getRaceWeatherState().effectiveIntensity>0);
 e.adjustRaceDebugEnvironment('sunIntensity',-1);assert.equal(e.getRaceRenderVisualFx().sunEnabled,true);assert.ok(e.getRaceRenderVisualFx().sunIntensity>=0);
 e.adjustRaceDebugEnvironment('brightness',-1);assert.ok(e.getRaceRenderBrightness()>=0);
 e.getRacePauseMenuRows().find(r=>r.id==='race-debug-environment-reset').onClick();assert.equal(e.playtestSession.debugEnvironment,undefined);assert.equal(JSON.stringify(e.selectedRace),authored);
});

test('long debug menu stays inside the viewport without overlapping touch regions',async()=>{
 const {drawInGameTextMenu}=await import('../../src/ui/shared/inGameTextMenu.js');
 const c=new Proxy({}, {get:()=>()=>{},set:()=>true});
 for(const bounds of [{x:0,y:0,w:960,h:540},{x:0,y:0,w:390,h:220}]){
  const menu=drawInGameTextMenu(c,{bounds,rows:Array.from({length:11},(_,i)=>({id:String(i),label:'Debug option'}))});
  for(let i=0;i<menu.rowBounds.length;i++){const r=menu.rowBounds[i];assert.ok(r.y>=bounds.y);assert.ok(r.y+r.h<=bounds.y+bounds.h);if(i)assert.ok(r.y>=menu.rowBounds[i-1].y+menu.rowBounds[i-1].h);}
 }
});
test('droplets render cached translucent sprites and snow, clipped above the dashboard',async()=>{
 const {drawGlassWeather}=await import('../../src/racing/GlassWeather.js');
 const previous=globalThis.OffscreenCanvas;let allocations=0;const stops=[];
 const fake=()=>new Proxy({createLinearGradient:()=>({addColorStop:(...a)=>stops.push(a)}),createRadialGradient:()=>({addColorStop:(...a)=>stops.push(a)})},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 globalThis.OffscreenCanvas=class {constructor(){allocations++;}getContext(){return fake();}};
 try{
  const s={speedMps:30,glassWeather:createGlassWeather()};s.glassWeather.windshield.push(drop(),{...drop(),snow:1});
  const c=fake(),draws=[],rects=[];c.lineTo=()=>assert.fail('glass droplets must not draw tails');c.drawImage=(...a)=>draws.push(a);c.rect=(...a)=>rects.push(a);
  drawGlassWeather(c,{x:0,y:0,w:512,h:288},s,'first-person');assert.equal(draws.length,2);assert.equal(allocations,2);assert.equal(rects[0][3],288*.755);assert.ok(stops.some(([,v])=>v.includes('255,255,255')));
  drawGlassWeather(c,{x:0,y:0,w:512,h:288},s,'first-person');assert.equal(allocations,2);
 }finally{globalThis.OffscreenCanvas=previous;}
});
