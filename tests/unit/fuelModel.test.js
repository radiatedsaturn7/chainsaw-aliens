import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFuelConfig,fuelBurnGallons,startingFuelFraction,LITERS_PER_US_GALLON} from '../../src/racing/simulation/FuelModel.js';
import {createMechanicalState,stepMechanicalState,applyMechanicalMission} from '../../src/racing/simulation/MechanicalModel.js';
import {normalizeGauge,gaugeValue,gaugeText,drawCarGauges} from '../../src/racing/CarGauges.js';
import {editRaceStartingFuel,editCarMechanics} from '../../src/ui/MechanicalForms.js';
const run=(s,seconds,t,dt=.1)=>{for(let i=0;i<Math.round(seconds/dt);i++)stepMechanicalState(s,dt,t);return s;};
const cruise={rpm:3000,maxRpm:7000,throttle:.35,speedMps:60*1609.344/3600};
test('US gallon conversion preserves legacy capacity; MPG gives calibrated cruise consumption',()=>{
 assert.equal(normalizeFuelConfig({fuelLiters:55}).fuelLiters,55);
 const cfg=normalizeFuelConfig({fuelMpg:30,fuelTankGallons:15});
 assert.equal(cfg.fuelLiters,15*LITERS_PER_US_GALLON);
 assert.ok(Math.abs(fuelBurnGallons(cfg,3600,cruise)-2)<1e-10);
 assert.ok(fuelBurnGallons(cfg,3600,{...cruise,throttle:1,rpm:6500})>3.5);
 assert.equal(fuelBurnGallons(cfg,3600,{...cruise,engineRunning:false}),0);
 assert.equal(fuelBurnGallons(cfg,3600,{...cruise,throttle:0}),0);
 assert.equal(fuelBurnGallons(cfg,3600,{speedMps:0,rpm:900,throttle:0}),.25);
});
test('fuel uses elapsed time independently of wear clock and persists deterministically',()=>{
 const a=createMechanicalState({}, {},{fuelMpg:30,fuelTankGallons:15,timeScale:1}),b=createMechanicalState({}, {},{fuelMpg:30,fuelTankGallons:15,timeScale:60});
 run(a,60,cruise);run(b,60,cruise,1/120);assert.ok(Math.abs(a.fuel-b.fuel)<1e-10);
 const saved=createMechanicalState(JSON.parse(JSON.stringify(a)));run(a,60,cruise);run(saved,60,cruise);assert.equal(a.fuel,saved.fuel);
 assert.ok(Math.abs((1-a.fuel)*15-2/30)<1e-8);
});
test('starting gallons and percent clamp to each car capacity and preserve legacy/saved fuel',()=>{
 assert.equal(startingFuelFraction({mode:'gallons',value:5},10),.5);assert.equal(startingFuelFraction({mode:'gallons',value:25},10),1);
 assert.equal(startingFuelFraction({mode:'percent',value:25},10),.25);assert.equal(startingFuelFraction(null,10,.3),.3);
 const s=createMechanicalState({fuel:.2},{},{fuelTankGallons:10});applyMechanicalMission(s,{startingFuel:{mode:'gallons',value:3}});assert.equal(s.fuel,.3);assert.ok(Math.abs(s.fuelLitersRemaining-3*LITERS_PER_US_GALLON)<1e-10);
 applyMechanicalMission(s,{});assert.equal(s.fuel,.3);applyMechanicalMission(s,{fuel:.7});assert.equal(s.fuel,.7);
});
test('empty tank stalls without fuel burn after shutdown; leaking tank still loses fuel',()=>{
 const s=createMechanicalState({fuel:0});run(s,.2,cruise);assert.equal(s.engineRunning,false);assert.equal(s.effects.drive,0);
 const leaking=applyMechanicalMission(createMechanicalState(),{components:{fuelTank:{failed:true}}});run(leaking,10,cruise);assert.ok(leaking.fuel<.95);
});
test('car and race authoring save gallon/MPG settings independently of other mission fluids',async()=>{
 const e={selectedCar:{},selectedRace:{mechanicalMission:{oil:.5}},captureRaceHistory(){}};
 await editCarMechanics(e,async(_title,fields)=>({...Object.fromEntries(fields.filter(f=>f.value!==undefined).map(f=>[f.id,f.value])),fuelMpg:32,fuelTankGallons:12,fuelDoorSide:'left'}));assert.equal(e.selectedCar.mechanics.fuelMpg,32);assert.equal(e.selectedCar.mechanics.fuelTankGallons,12);
 await editRaceStartingFuel(e,async()=>({mode:'gallons',value:5}));assert.deepEqual(e.selectedRace.mechanicalMission.startingFuel,{mode:'gallons',value:5});assert.equal(e.selectedRace.mechanicalMission.oil,.5);
 await editRaceStartingFuel(e,async()=>({mode:'saved'}));assert.equal(e.selectedRace.mechanicalMission.startingFuel,undefined);
});
test('fuel dial renders E/F, ticks, pump and door arrow; live readings use configured tank',()=>{
 const g=normalizeGauge({source:'fuel',format:'dial',startAngle:180,sweepAngle:180,showValue:false}),car={mechanics:{fuelTankGallons:16,fuelMpg:22,fuelDoorSide:'right'}},state={car,session:{mechanical:{fuel:.25}}};
 assert.equal(gaugeValue(g,state),25);assert.equal(gaugeText(g,25),'25%');assert.equal(gaugeValue({...g,source:'fuel.gallons'},state),4);
 const labels=[],lines=[];const ctx=new Proxy({globalAlpha:1,fillText:t=>labels.push(t),moveTo:(...p)=>lines.push(p),measureText:()=>({width:8})},{get:(o,k)=>k in o?o[k]:()=>{}});
 drawCarGauges(ctx,{x:0,y:0,w:400,h:300},{widgets:[g]},state);assert.ok(labels.includes('E'));assert.ok(labels.includes('F'));assert.ok(labels.includes('½'));assert.ok(lines.length>5);
});

import RaceEditor from '../../src/ui/RaceEditor.js';
import {editGauge,enterCarGauges} from '../../src/ui/CarGaugeEditor.js';
test('fuel dial fields have unique IDs and save independently of RPM controls',async()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'exterior');const g=normalizeGauge({id:'fuel-test',source:'fuel',format:'dial'});e.selectedCar.art.gauges.exterior.widgets=[g];e.carGaugeId=g.id;
 await editGauge(e,async(_title,fields)=>{
  assert.equal(new Set(fields.map(f=>f.id)).size,fields.length);
  return {...Object.fromEntries(fields.filter(f=>f.value!==undefined).map(f=>[f.id,f.value])),fuel_tach_redline:20,fuel_tach_majorInterval:25,fuel_tach_arcWidth:4,fuel_tach_displayMode:'both'};
 },async()=>null,async()=>[]);
 const saved=e.selectedCar.art.gauges.exterior.widgets[0];assert.equal(saved.tachometer.redline,20);assert.equal(saved.tachometer.arcWidth,4);assert.equal(saved.tachometer.displayMode,'both');
 const roundtrip=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())));assert.equal(roundtrip.art.gauges.exterior.widgets[0].tachometer.redline,20);
});

test('garage power upgrades increase real fuel burn, preserve stock and undo cleanly',async()=>{
 const {buildGarageCar,normalizeCarPart}=await import('../../src/garage/CarPart.js');
 const stock={mechanics:{fuelMpg:22,fuelTankGallons:16.6,fuelDoorSide:'right'},tuning:{idleRpm:1000,revLimitRpm:6000,engineCurve:{torquePoints:[{rpm:1000,torqueLbFt:100},{rpm:6000,torqueLbFt:200}]}}};
 const before=structuredClone(stock),part=(slot,modifiers)=>({carPart:normalizeCarPart({slot,modifiers})});
 const upgrade=part('engine',[{field:'torqueScale',operation:'multiply',value:1.5}]);
 const built=buildGarageCar(stock,{parts:[upgrade]}),base=normalizeFuelConfig(stock.mechanics),fuel=normalizeFuelConfig(built.mechanics);
 assert.ok(Math.abs(fuel.fuelMpg-22/1.125)<1e-9);
 const race={...cruise,throttle:1,rpm:5500};
 assert.ok(Math.abs(fuelBurnGallons(fuel,60,race)/fuelBurnGallons(base,60,race)-1.5)<1e-9);
 assert.ok(Math.abs(fuelBurnGallons(fuel,60,cruise)/fuelBurnGallons(base,60,cruise)-1.125)<1e-9);
 assert.equal(fuelBurnGallons(fuel,60,{speedMps:0,throttle:0}),fuelBurnGallons(base,60,{speedMps:0,throttle:0}));
 assert.deepEqual(stock,before);assert.deepEqual(buildGarageCar(stock),before);assert.deepEqual(buildGarageCar(stock,{parts:[upgrade]}),built);
 const economy=buildGarageCar(stock,{parts:[part('ecu',[{field:'fuelMpg',operation:'multiply',value:1.1},{field:'fuelConsumptionScale',operation:'multiply',value:.9}])]});
 assert.equal(economy.mechanics.fuelMpg,24.200000000000003);
 assert.ok(fuelBurnGallons(normalizeFuelConfig(economy.mechanics),60,race)<fuelBurnGallons(base,60,race));
 assert.equal(buildGarageCar(stock,{parts:[part('brakes',[{field:'brakePressure',operation:'set',value:1.2}])]}).mechanics.fuelMpg,22);
 const state=createMechanicalState(null,null,built.mechanics);run(state,60,race);
 const plain=createMechanicalState(null,null,stock.mechanics);run(plain,60,race);
 assert.ok(state.fuel<plain.fuel);
});


test('authored turbo curves and fixed fuel parts reach runtime without exposing economy sliders',async()=>{
 const {buildGarageCar,normalizeCarPart}=await import('../../src/garage/CarPart.js');
 const stock={mechanics:{fuelMpg:30},tuning:{idleRpm:1000,revLimitRpm:6000,engineCurve:{torquePoints:[{rpm:1000,torqueLbFt:100},{rpm:6000,torqueLbFt:200}]}}};
 const turbo={carPart:normalizeCarPart({slot:'turbo',torqueCurve:[{rpm:1000,multiplier:1},{rpm:6000,multiplier:1.6}],modifiers:[{field:'fuelConsumptionScale',operation:'set',value:1.1}],tuning:[{field:'fuelConsumptionScale',min:.8,max:1.2,step:.01}]})};
 const car=buildGarageCar(stock,{parts:[turbo],tune:{fuelConsumptionScale:1.1}});
 const state=createMechanicalState(null,null,car.mechanics);
 assert.ok(state.config.fuelMpg<30);assert.ok(state.config.fuelPowerLoadScale>1);assert.equal(state.config.fuelConsumptionScale,1.1);
 assert.equal(buildGarageCar(stock,{parts:[turbo],tune:{fuelConsumptionScale:10}}).mechanics.fuelConsumptionScale,1.1,'legacy tune cannot override a fixed part property');
});

test('saved donor car capacities and filler directions retain verified US units',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const [name,mpg,capacity,side] of [['RTG-001',22,16.6,'right'],['PZ-24',19,15.6,'right'],['CT-86',31.8,48/LITERS_PER_US_GALLON,'left'],['BUSE-019',39.9,45/LITERS_PER_US_GALLON,'right']]){
  const doc=JSON.parse(await readFile(new URL(`../../data/server-storage/files/cars/${name}/document.json`,import.meta.url),'utf8'));
  const fuel=normalizeFuelConfig(doc.car.mechanics);assert.equal(fuel.fuelMpg,mpg);assert.equal(fuel.fuelTankGallons,capacity);assert.equal(fuel.fuelDoorSide,side);
 }
});

test('fuel-door symbol moves/scales independently of the low-fuel warning',async()=>{
 const {drawFuelFace}=await import('../../src/racing/FuelGauge.js');
 const draws=[],icon={};const ctx=new Proxy({drawImage:(...args)=>draws.push(args)},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
 const g=normalizeGauge({source:'fuel',format:'dial',fuelIconOffsetX:.27,fuelIconOffsetY:-.85,fuelIconScale:.8,tachometer:{showFace:false}});
 drawFuelFace(ctx,{x:0,y:0,w:100,h:100},g,{},{getArt:()=>icon});
 assert.deepEqual(draws[0],[icon,71,-15.000000000000002,12,12]);
 assert.equal(normalizeGauge({source:'fuel'}).fuelIconScale,1);
});

test('fuel-side symbol stays at 180 degrees across viewport proportions',async()=>{
 const {drawFuelFace}=await import('../../src/racing/FuelGauge.js');
 const g=normalizeGauge({source:'fuel',format:'dial',fuelIconAngle:180,fuelIconScale:.8,tachometer:{showFace:false,radius:.9}});
 for(const [w,h] of [[160,90],[90,160]]){
  const draws=[];const ctx=new Proxy({drawImage:(...args)=>draws.push(args)},{get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
  drawFuelFace(ctx,{x:0,y:0,w,h},g,{},{getArt:()=>({})});
  const [,x,y,sw,sh]=draws[0];assert.ok(Math.abs(x+sw/2-(w/2-Math.min(w,h)*.45))<1e-9);assert.ok(Math.abs(y+sh/2-h/2)<1e-9);
 }
 assert.equal(normalizeGauge({fuelIconAngle:''}).fuelIconAngle,null);
});
