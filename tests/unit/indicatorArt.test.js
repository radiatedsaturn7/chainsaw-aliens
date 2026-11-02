import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeIndicators,fitIndicatorCrop} from '../../src/racing/IndicatorArt.js';
import {indicatorDragCrop,editCarIndicator} from '../../src/ui/CarIndicatorEditor.js';
import {addGaugeIndicator} from '../../src/ui/CarGaugeEditor.js';
import {drawCarGauges,gaugeArtRefs} from '../../src/racing/CarGauges.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
const editor=()=>({selectedCar:{art:{}},activeAction:'car-gauges-interior',captureRaceHistory(){},invalidateCarEditorPreviewFrame(){},syncCarAnglePreviewArt(){}});
test('drag crop is pixel aligned, direction independent and bounded',()=>{
 assert.deepEqual(indicatorDragCrop({x:15.8,y:20.2},{x:4.2,y:5.1},32,32),{x:4,y:5,width:12,height:16});
 assert.deepEqual(indicatorDragCrop({x:-20,y:-5},{x:60,y:40},32,32),{x:0,y:0,width:32,height:32});
 assert.deepEqual(fitIndicatorCrop({x:60,y:60,width:10,height:10},32,32),{x:31,y:31,width:1,height:1});
});
test('cut workflow saves only the chosen region and signal, cancels without mutation',async()=>{
 const e=editor(),image={width:128,height:64};
 await editCarIndicator(e,null,async(_,fields)=>{await fields.find(f=>f.id==='sheet').onClick();return {name:'Engine',source:'enginelight',x:10,y:8,width:20,height:16};},async()=>({action:'open',name:'Dashboard icons'}),async()=>image);
 const entry=e.selectedCar.art.indicators[0];assert.equal(entry.artRef,'Dashboard icons');assert.deepEqual(entry.crop,{x:10,y:8,width:20,height:16});
 const before=JSON.stringify(e.selectedCar);await editCarIndicator(e,entry,async()=>null,null,async()=>image);assert.equal(JSON.stringify(e.selectedCar),before);
 const loaded=RaceEditor.prototype.normalizeLoadedCarDocument.call(Object.create(RaceEditor.prototype),JSON.parse(before));assert.deepEqual(loaded.art.indicators,e.selectedCar.art.indicators);
});
test('add indicator copies crop and signal to either layout; rendering samples only the cutout',async()=>{
 for(const side of ['interior','exterior']){
 const e=editor();e.activeAction='car-gauges-'+side;e.selectedCar.art.indicators=normalizeIndicators([{id:'engine',name:'Engine',source:'enginelight',artRef:'sheet',crop:{x:12,y:4,width:16,height:8}}]);
 await addGaugeIndicator(e,async()=>({id:'engine'}));const layout=e.selectedCar.art.gauges[side],g=layout.widgets.at(-1);
 assert.equal(g.source,'enginelight');assert.equal(g.format,'icon');assert.equal(g.showValue,false);assert.deepEqual(g.artCrop,{x:12,y:4,width:16,height:8});
 e.selectedCar.art.indicators=[];assert.deepEqual(gaugeArtRefs(e.selectedCar),['sheet']);
 const calls=[],ctx=new Proxy({globalAlpha:1,drawImage:(...args)=>calls.push(args)},{get:(o,k)=>k in o?o[k]:()=>{}}),image={width:128,height:64};
 drawCarGauges(ctx,{x:0,y:0,w:320,h:180},{widgets:[g]},{session:{mechanical:{components:{ignition:{damage:60}},tick:0,config:{enabled:true}}}},{getArt:()=>image});
 assert.equal(calls.length,1);assert.deepEqual(calls[0].slice(1,5),[12,4,16,8]);
 }
});
test('missing library and cancelled add do not modify gauges',async()=>{
 const e=editor();await addGaugeIndicator(e);assert.match(e.status,/Art → Indicators/);assert.equal(e.selectedCar.art.gauges,undefined);
 e.selectedCar.art.indicators=normalizeIndicators([{id:'one'}]);await addGaugeIndicator(e,async()=>null);assert.equal(e.selectedCar.art.gauges,undefined);
});
