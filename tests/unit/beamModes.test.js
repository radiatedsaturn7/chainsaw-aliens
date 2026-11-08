import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {raceStartsWithHeadlights,updateRaceLighting,LOW_BEAM_REACH_M,HIGH_BEAM_REACH_M,RALLY_LIGHT_REACH_M} from '../../src/racing/RaceLighting.js';
import {createMechanicalState,stepMechanicalState} from '../../src/racing/simulation/MechanicalModel.js';
import {controlLamp} from '../../src/racing/MechanicalInstruments.js';
import {normalizeGauge,gaugeArtRefs,drawCarGauges} from '../../src/racing/CarGauges.js';
test('storm starts on low beams; high beams and independent AUX follow pause controls',()=>{
 assert.equal(raceStartsWithHeadlights({weather:'storm',timeOfDay:'day'}),true);
 const e=new RaceEditor({});e.playtestSession={mechanical:createMechanicalState()};e.raceInput.pauseMenuMode='car-controls';const m=e.playtestSession.mechanical;
 assert.equal(m.highBeams,false);assert.equal(m.auxLights,false);
 const rows=e.getRacePauseMenuRows();rows.find(r=>r.id==='race-highBeams').onClick();assert.equal(m.highBeams,true);assert.equal(controlLamp('highbeamslight',e.playtestSession),1);
 rows.find(r=>r.id==='race-auxLights').onAdjust(1);assert.equal(controlLamp('auxlightslight',e.playtestSession),1);
 e.toggleRaceHeadlights();assert.equal(m.highBeams,false);assert.equal(controlLamp('headlightslight',e.playtestSession),0);assert.equal(controlLamp('auxlightslight',e.playtestSession),1);
});
test('beam modes update uniforms without changing poses and accumulate electrical loads',()=>{
 assert.deepEqual([LOW_BEAM_REACH_M,HIGH_BEAM_REACH_M,RALLY_LIGHT_REACH_M],[75,140,900]);
 const r={scene:{traverse(){}}};let u=updateRaceLighting(r,{pose:{},visibilityDistanceM:200});assert.equal(u.rtgAux.value,0);assert.equal(u.rtgHighBeam.value,0);
 u=updateRaceLighting(r,{pose:{},highBeams:true,auxIntensity:.6,headlightIntensity:0,visibilityDistanceM:200});assert.equal(u.rtgAux.value,.6);assert.equal(u.rtgHighBeam.value,1);assert.equal(u.rtgHeadlights.value,0);assert.equal(u.rtgVisibility.value,200);
 const current=options=>{const s=createMechanicalState({headlights:true,...options});s.components.alternator.failed=true;stepMechanicalState(s,1,{rpm:1500});return s.batteryCurrentA;};
 assert.ok(current({highBeams:true})<current({}));assert.ok(current({auxLights:true})<current({highBeams:true}));
});
test('all four cars preload the blue alternate icon, add AUX, and keep compact paired arrows near speed',()=>{
 for(const name of ['RTG-001','BUSE-019','PZ-24','CT-86']){
  const car=JSON.parse(readFileSync(new URL(`../../data/server-storage/files/cars/${name}/document.json`,import.meta.url))).car;
  assert.ok(gaugeArtRefs(car).includes('indicator-high-beams'));assert.ok(gaugeArtRefs(car).includes('indicator-aux-lights'));
  for(const layout of Object.values(car.art.gauges)){const head=layout.widgets.find(g=>g.source==='headlightslight');assert.equal(normalizeGauge(head).highBeamArtRef,'indicator-high-beams');assert.ok(layout.widgets.some(g=>g.source==='auxlightslight'));}
  const w=car.art.gauges.interior.widgets,speed=w.find(g=>g.source==='speed');for(const source of ['leftsignallight','rightsignallight'])assert.ok(w.find(g=>g.source===source).width<.014);
 }
});
test('visibility is in metres, override is session-only and lit road is not veiled again',()=>{
 const e=new RaceEditor({});e.selectedRace.weather='storm';e.selectedRace.weatherIntensity=1;e.playtestSession={};
 assert.equal(e.getRaceWeatherState().visibilityDistanceM,864.81);e.selectedRace.weatherVisibilityM=450;assert.equal(e.getRaceWeatherState().visibilityDistanceM,450);
 e.adjustRaceDebugEnvironment('visibilityDistanceM',1);assert.equal(e.getRaceWeatherState().visibilityDistanceM,864.81);assert.equal(e.selectedRace.weatherVisibilityM,450);
 e.raceHeadlightsRendered=true;assert.equal(e.drawRaceWeatherVisibilityVeil({},{}),false);
});

test('headlight gauge swaps green/blue artwork in exactly the same rectangle',()=>{
 const car=JSON.parse(readFileSync(new URL('../../data/server-storage/files/cars/RTG-001/document.json',import.meta.url))).car;
 const g=normalizeGauge(car.art.gauges.exterior.widgets.find(g=>g.source==='headlightslight'));
 const draws=[],ctx=new Proxy({globalAlpha:1,drawImage:(...a)=>draws.push(a)}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 for(const highBeams of [false,true])drawCarGauges(ctx,{x:0,y:0,w:512,h:288},{widgets:[g]},{session:{mechanical:{headlights:true,highBeams}}},{getArt:ref=>({ref,width:32,height:32})});
 assert.equal(draws[0][0].ref,'indicator-headlights');assert.equal(draws[1][0].ref,'indicator-high-beams');assert.deepEqual(draws[0].slice(1),draws[1].slice(1));
});

test('AUX and high beams survive worker transport, timeline sampling and mechanical steps',async()=>{
 const {createVehicleControlInputBuffer,readVehicleControlInput}=await import('../../src/racing/simulation/VehicleDynamicsWorkerProtocol.js');
 const {VehicleControlInputTimeline}=await import('../../src/racing/simulation/VehicleDynamicsRunner.js');
 const {carFxDrivingState,carFxActive,normalizeCarFx}=await import('../../src/racing/CarFx.js');
 const e=new RaceEditor({});e.playtestSession={mechanical:createMechanicalState({headlights:false})};e.toggleRaceExtraLights('auxLights');
 const wire=readVehicleControlInput(createVehicleControlInputBuffer({headlights:false,highBeams:false,auxLights:e.raceInput.auxLights}));
 const timeline=new VehicleControlInputTimeline([{timeSeconds:0,input:wire},{timeSeconds:1,input:{...wire,auxLights:false,highBeams:true,headlights:true}}]);
 const m=createMechanicalState({headlights:false,auxLights:false});
 stepMechanicalState(m,.2,{...timeline.sampleAt(.5,{}),rpm:1500});
 assert.equal(m.headlights,false);assert.equal(m.auxLights,true);assert.ok(m.effects.lights>0);
 const fx=normalizeCarFx([{triggers:['aux-lights']}])[0];assert.equal(carFxActive(fx,carFxDrivingState({mechanical:m})),true);
 stepMechanicalState(m,.2,{...timeline.sampleAt(1,{}),rpm:1500});assert.equal(m.auxLights,false);assert.equal(m.highBeams,true);
 assert.equal(carFxActive(fx,carFxDrivingState({mechanical:m})),false);
 for(const flag of [null,false,true]){const r=readVehicleControlInput(createVehicleControlInputBuffer({highBeams:flag,auxLights:flag}));assert.equal(r.highBeams,flag);assert.equal(r.auxLights,flag);}
});

test('all four car billboard renderers draw AUX artwork with headlights off',()=>{
 for(const [name,count] of [['RTG-001',2],['BUSE-019',4],['PZ-24',4],['CT-86',1]]){
  const car=JSON.parse(readFileSync(`data/server-storage/files/cars/${name}/document.json`)).car,e=new RaceEditor({});
  const drawn=[];const ctx=new Proxy({globalAlpha:1,drawImage:canvas=>drawn.push(canvas.ref)},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  e.getRaceArtSpriteCanvas=ref=>ref?{ref,width:550,height:315}:null;e.getRaceCarBillboardLayerCanvas=c=>c;
  const session={mechanical:createMechanicalState({headlights:false,auxLights:true})};stepMechanicalState(session.mechanical,.2,{rpm:1500});
  const ref=car.art.fx.find(f=>f.triggers.includes('aux-lights')).artRef;
  for(const viewSlot of ['front','frontLeft','frontRight','rear']){
   drawn.length=0;const body=car.art.angleLayers[viewSlot].body;
   e.drawRaceCarBillboardLayers(ctx,{car,session,artChoice:{...body,viewSlot},drawWheels:false,drawShadowLayer:false});
   assert.equal(drawn.filter(r=>r===ref).length,viewSlot==='rear'?0:count,`${name} ${viewSlot}`);
  }
 }
});

test('AUX placements match body source pixels after per-angle scale, offset and rotation',()=>{
 for(const name of ['RTG-001','BUSE-019','PZ-24','CT-86'])for(const slot of ['front','frontLeft','frontRight']){
  const car=JSON.parse(readFileSync(`data/server-storage/files/cars/${name}/document.json`)).car;
  const e=new RaceEditor({}),body=car.art.angleLayers[slot].body,fx=car.art.fx.find(f=>f.triggers.includes('aux-lights')),draws=[];
  let m=[1,0,0,1,0,0];const stack=[];const point=(x,y)=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
  const ctx=new Proxy({globalAlpha:1,save(){stack.push([...m]);},restore(){m=stack.pop();},translate(x,y){const p=point(x,y);m[4]=p.x;m[5]=p.y;},rotate(r){const [a,b,c,d]=m,co=Math.cos(r),si=Math.sin(r);m[0]=a*co+c*si;m[1]=b*co+d*si;m[2]=-a*si+c*co;m[3]=-b*si+d*co;},scale(x,y){m[0]*=x;m[1]*=x;m[2]*=y;m[3]*=y;},drawImage(canvas,x,y,w,h){draws.push({ref:canvas.ref,center:point(x+w/2,y+h/2),origin:point(x,y),axisX:{x:m[0]*w,y:m[1]*w},axisY:{x:m[2]*h,y:m[3]*h}});}},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  e.getRaceArtSpriteCanvas=ref=>ref?{ref,width:550,height:315}:null;e.getRaceCarBillboardLayerCanvas=c=>c;
  e.drawRaceCarBillboardLayers(ctx,{car,session:{mechanical:createMechanicalState({headlights:false,auxLights:true})},artChoice:{...body,viewSlot:slot},drawWheels:false,drawShadowLayer:false,bodyRotationRad:.2});
  const base=draws.find(d=>d.ref===body.artRef),lamps=draws.filter(d=>d.ref===fx.artRef);
  fx.views[slot].placements.forEach((p,i)=>{const x=base.origin.x+base.axisX.x*(p.x+.5)+base.axisY.x*(p.y+.5),y=base.origin.y+base.axisX.y*(p.x+.5)+base.axisY.y*(p.y+.5);assert.ok(Math.abs(lamps[i].center.x-x)<1e-8);assert.ok(Math.abs(lamps[i].center.y-y)<1e-8);});
 }
});

test('depth sprite recorder separates only emitting lamp pixels with the identical transform and opacity',async()=>{
 const {boundedContext}=await import('../../src/racing/RaceCarDepthSprites.js');
 const calls=[],matrix={a:2,b:0,c:0,d:3,e:11,f:17};
 const ctx={globalAlpha:.7,imageSmoothingEnabled:false,getTransform:()=>matrix,drawImage(){}};
 const emission={save(){},restore(){},setTransform:m=>calls.push(m),drawImage:(...a)=>calls.push(a)};
 const recorded=boundedContext(ctx,emission),art={width:32,height:32};
 recorded.context.drawImage(art,0,0,10,10);assert.equal(recorded.hasEmission(),false);
 recorded.context.__raceEmissive=true;recorded.context.drawImage(art,5,6,7,8);
 assert.equal(recorded.hasEmission(),true);assert.equal(emission.globalAlpha,.7);assert.deepEqual(calls,[matrix,[art,5,6,7,8]]);
});

test('normal, high-beam and rally FX have independent modes and preserve each lamp location',async()=>{
 const {carFxActive,normalizeCarFx}=await import('../../src/racing/CarFx.js');
 for(const [name,widthPx,sourceWidth] of [['RTG-001',28,550],['BUSE-019',28,583],['PZ-24',27,595],['CT-86',111,509]]){
  const fx=normalizeCarFx(JSON.parse(readFileSync(`data/server-storage/files/cars/${name}/document.json`)).car.art.fx);
  const normal=fx.find(e=>e.name==='Headlight'),high=fx.find(e=>e.name==='High beams'),rally=fx.find(e=>e.triggers.includes('aux-lights')),tail=fx.find(e=>e.name==='Tail lights');
  for(const slot of Object.keys(normal.views)){
   assert.equal(normal.views[slot].width,2);assert.equal(high.views[slot].width,normal.views[slot].width*1.5);assert.equal(high.views[slot].height,normal.views[slot].height*1.5);assert.deepEqual(high.views[slot].placements,normal.views[slot].placements);
  }
  assert.equal(rally.artRef,normal.artRef);
  for(const slot of Object.keys(normal.views)){assert.equal(rally.views[slot].artRef,normal.views[slot].artRef);assert.equal(rally.views[slot].width,2*normal.views[slot].width);assert.equal(rally.views[slot].height,2*normal.views[slot].height);assert.equal(rally.views[slot].sizeAnchor,'car');}
  const low={headlights:true,highBeams:false,auxLights:false},bright={...low,highBeams:true},aux={headlights:false,highBeams:false,auxLights:true};
  assert.equal(carFxActive(normal,low),true);assert.equal(carFxActive(high,low),false);
  assert.equal(carFxActive(normal,bright),false);assert.equal(carFxActive(high,bright),true);assert.equal(carFxActive(tail,bright),true);
  assert.equal(carFxActive(rally,aux),true);assert.equal(carFxActive(normal,aux),false);assert.equal(carFxActive(high,aux),false);
 }
});
