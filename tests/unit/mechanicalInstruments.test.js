import test from 'node:test';
import assert from 'node:assert/strict';
import {createMechanicalState,repairMechanicalComponent} from '../../src/racing/simulation/MechanicalModel.js';
import {mechanicalLamp,mechanicalLampVisible,MECHANICAL_LAMPS} from '../../src/racing/MechanicalInstruments.js';
import {normalizeGauge,normalizeCarGauges,gaugeValue,gaugeText,drawCarGauges,GAUGE_SOURCES} from '../../src/racing/CarGauges.js';
test('engine light derives warning, active misfire and catastrophic states; targeted repair clears it',()=>{
 const s=createMechanicalState();assert.equal(mechanicalLamp('enginelight',s),0);
 s.components.panels.failed=true;assert.equal(mechanicalLamp('enginelight',s),0);
 s.components.ignition.damage=55;assert.equal(mechanicalLamp('enginelight',s),0);
 s.components.ignition.malfunctionUntil=10;assert.equal(mechanicalLamp('enginelight',s),1);
 s.misfireUntil=3;assert.equal(mechanicalLamp('enginelight',s),2);
 s.tick=3;assert.equal(mechanicalLamp('enginelight',s),1);
 s.components.ignition.failed=true;assert.equal(mechanicalLamp('enginelight',s),2);
 repairMechanicalComponent(s,'ignition');assert.equal(mechanicalLamp('enginelight',s),0);
 s.engineRunning=false;assert.equal(mechanicalLamp('enginelight',s),2);
 s.config.enabled=false;assert.equal(mechanicalLamp('enginelight',s),0);
 assert.equal(mechanicalLamp('enginelight',null),0);
});
test('measured pressure, heat, voltage and tire conditions drive appropriate warnings',()=>{
 const s=createMechanicalState();for(const key of Object.keys(MECHANICAL_LAMPS))assert.equal(mechanicalLamp(key,s),0,key);
 s.oilPressureBar=.2;assert.equal(mechanicalLamp('enginelight',s),2);assert.equal(mechanicalLamp('oillight',s),2);
 s.oilPressureBar=3;s.coolantTemperatureC=115;assert.equal(mechanicalLamp('coolantlight',s),1);
 s.coolantTemperatureC=125;assert.equal(mechanicalLamp('enginelight',s),2);
 s.voltage=9;assert.equal(mechanicalLamp('batterylight',s),2);
 s.tires.fl.brakeTemperatureC=550;assert.equal(mechanicalLamp('brakelight',s),1);
 s.tires.fl.pressureRatio=.2;assert.equal(mechanicalLamp('tirelight',s),2);
 s.lostGears=[3];assert.equal(mechanicalLamp('transmissionlight',s),2);
});
test('component metrics and lamp status survive both gauge layouts and templates',()=>{
 const s=createMechanicalState();s.components.alternator.failed=true;
 const lamp=normalizeGauge({source:'batterylight',textTemplate:'Charging: ${value}'});
 assert.equal(gaugeText(lamp,gaugeValue(lamp,{session:{mechanical:s}})), 'Charging: Critical');
 const source='mechanical.components.alternator.failed';assert.ok(GAUGE_SOURCES.includes(source));
 assert.equal(Number(gaugeValue(normalizeGauge({source}),{session:{mechanical:s}})),1);
 const layouts=normalizeCarGauges({exterior:{widgets:[lamp]},interior:{widgets:[lamp]}});
 assert.equal(layouts.interior.widgets[0].source,'batterylight');assert.equal(layouts.exterior.widgets[0].source,'batterylight');
});
test('critical flashing follows simulation ticks and affects artwork and overlay; selected off lamp remains placeable',()=>{
 const s=createMechanicalState(),g=normalizeGauge({source:'enginelight',format:'icon',artRef:'lamp',overlayArtRef:'glass'});
 const draws=[],stack=[];const c=new Proxy({globalAlpha:1,save(){stack.push(this.globalAlpha);},restore(){this.globalAlpha=stack.pop();},drawImage(ref){draws.push([ref,this.globalAlpha]);}},{get:(o,k)=>k in o?o[k]:()=>{}});
 const draw=selectedId=>{draws.length=0;return drawCarGauges(c,{x:0,y:0,w:400,h:300},{widgets:[g]},{session:{mechanical:s}},{getArt:r=>r,selectedId});};
 assert.equal(draw().length,1);assert.deepEqual(draws,[['lamp',0],['glass',0]]);
 draw(g.id);assert.deepEqual(draws,[['lamp',.25],['glass',.25]]);
 s.components.pistons.failed=true;draw();assert.deepEqual(draws,[['lamp',1],['glass',1]]);
 s.tick=3;draw();assert.deepEqual(draws,[['lamp',0],['glass',0]]);
 assert.equal(mechanicalLampVisible(2,s),false);assert.equal(mechanicalLampVisible(2,s),false);
 s.tick=6;assert.equal(mechanicalLampVisible(2,s),true);
});

test('assist-off indicators use actual settings, independently of mechanical simulation',()=>{
 for(const [source,key] of [['absofflight','absEnabled'],['tractioncontrolofflight','tractionControlEnabled']]){
  const g=normalizeGauge({source,format:'icon'});assert.equal(g.source,source);
  assert.equal(gaugeValue(g,{session:{[key]:true}}),0);
  assert.equal(gaugeValue(g,{session:{[key]:false,mechanical:{config:{enabled:false}}}}),1);
  assert.equal(gaugeValue(g,{session:{}}),0);
  assert.equal(gaugeText(g,1),'On');
 }
});
test('handbrake lamp follows authoritative held or timed input and switches off on release',()=>{
 const g=normalizeGauge({source:'handbrakelight',format:'icon'});
 assert.equal(gaugeValue(g,{session:{authoritativeHandbrakeActive:true}}),1);
 assert.equal(gaugeValue(g,{session:{handbrakeCommandState:{active:true}}}),1);
 assert.equal(gaugeValue(g,{session:{authoritativeHandbrakeActive:false,handbrakeCommandState:{active:true}}}),0);
 assert.equal(gaugeValue(g,{session:{}}),0);
 const layouts=normalizeCarGauges({interior:{widgets:[g]},exterior:{widgets:[g]}});
 assert.equal(layouts.interior.widgets[0].source,'handbrakelight');
 assert.equal(layouts.exterior.widgets[0].source,'handbrakelight');
});
