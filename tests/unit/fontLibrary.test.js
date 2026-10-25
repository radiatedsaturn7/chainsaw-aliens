import test from 'node:test';
import assert from 'node:assert/strict';
import {embeddedFonts,saveLibraryFont} from '../../src/ui/FontLibrary.js';
import {PROJECT_FOLDERS} from '../../src/ui/projectFiles.js';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {enterCarGauges,chooseGaugeFont} from '../../src/ui/CarGaugeEditor.js';
import {normalizeCarGauges} from '../../src/racing/CarGauges.js';

test('fonts are a project folder and older embedded menu/car fonts are deduplicated',()=>{
 assert.ok(PROJECT_FOLDERS.includes('fonts'));
 const a={fontData:'data:font/ttf;base64,AA',fontFileName:'Pixel.ttf'};
 const found=embeddedFonts({defaultFont:a,screens:[{elements:[a]}],car:{art:{gauges:{widgets:[a]}}}});
 assert.equal(found.size,1);assert.equal([...found.values()][0].fontFileName,'Pixel.ttf');
});
test('library uploads deduplicate content and preserve different files sharing the same name',async()=>{
 const docs=new Map(),deps={list:()=>[...docs.keys()].map(name=>({name})),load:async(_,name)=>({data:docs.get(name)}),save:async(_,name,data)=>{docs.set(name,data);}};
 const a={fontData:'data:font/ttf;base64,AA',fontFileName:'Pixel.ttf'};
 const first=await saveLibraryFont(a,deps),again=await saveLibraryFont({...a,fontFileName:'Renamed.ttf'},deps);
 assert.equal(first.name,again.name);assert.equal(docs.size,1);
 const different=await saveLibraryFont({...a,fontData:'data:font/ttf;base64,BB'},deps);
 assert.notEqual(first.name,different.name);assert.equal(docs.size,2);
 await assert.rejects(saveLibraryFont({...a,fontData:'data:new'},{...deps,save:async()=>{throw Error('Save failed');}}),/Save failed/);
});
test('lap font choice survives layout replacement, serialization and undo; cancel preserves it',async()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'exterior');
 e.carGaugeId=e.selectedCar.art.gauges.exterior.widgets.find(g=>g.source==='lap').id;
 const font={fontData:'data:font/ttf;base64,AA',fontFileName:'Lap.ttf',fontFamily:'monospace'};
 await chooseGaugeFont(e,async()=>{e.selectedCar.art.gauges=normalizeCarGauges(e.selectedCar.art.gauges);return font;});
 const saved=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument());
 assert.equal(saved.art.gauges.exterior.enabled,true);assert.equal(saved.art.gauges.exterior.widgets.find(g=>g.source==='lap').fontData,font.fontData);
 assert.equal(saved.art.gauges.interior.widgets.find(g=>g.source==='lap').fontData,'');
 await chooseGaugeFont(e,async()=>null);assert.equal(e.selectedCar.art.gauges.exterior.widgets.find(g=>g.source==='lap').fontFileName,'Lap.ttf');
 e.undoRaceHistory();assert.equal(e.selectedCar.art.gauges.exterior.widgets.find(g=>g.source==='lap').fontData,'');
});

test('Gauge Properties selects saved fonts directly, preserves Cancel and clears uploads for system fonts',async()=>{
 const {editGauge}=await import('../../src/ui/CarGaugeEditor.js');
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'exterior');
 const font={name:'Uploaded pixel font',fontData:'data:font/ttf;base64,AA',fontFileName:'Pixel.ttf',fontFamily:'monospace'};
 const load=async()=>[font];
 const form=choice=>async(_,fields)=>{
  assert.ok(!fields.some(f=>f.id==='fontFamily'));
  const selector=fields.find(f=>f.id==='fontChoice');assert.ok(selector.options.some(o=>o.label===font.name));
  return {...Object.fromEntries(fields.filter(f=>!['button','preview'].includes(f.type)).map(f=>[f.id,f.value])),fontChoice:choice};
 };
 await editGauge(e,form('saved:0'),undefined,load);
 let g=e.selectedCar.art.gauges.exterior.widgets[0];assert.equal(g.fontData,font.fontData);assert.equal(g.fontFileName,'Pixel.ttf');
 await editGauge(e,async(_,fields)=>{assert.equal(fields.find(f=>f.id==='fontChoice').value,'saved:0');return null;},undefined,load);
 assert.equal(e.selectedCar.art.gauges.exterior.widgets[0].fontData,font.fontData);
 await editGauge(e,form('system:serif'),undefined,load);
 g=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument()).art.gauges.exterior.widgets[0];assert.equal(g.fontData,'');assert.equal(g.fontFileName,'');assert.equal(g.fontFamily,'serif');
 e.undoRaceHistory();assert.equal(e.selectedCar.art.gauges.exterior.widgets[0].fontData,font.fontData);
});
