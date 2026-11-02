import {buildRaceMinimap,drawMinimapStartLine,gaugeMinimapTransform,drawGaugeMinimap,gaugeMapScreenBounds} from '../../src/racing/RaceMinimap.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {normalizeCarGauges,normalizeGauge,gaugeValue,gaugeText,drawCarGauges,gaugeArtRefs} from '../../src/racing/CarGauges.js';
import {reorderGauge,editGaugeGeometry,editGaugeOrder,enterCarGauges,gaugePointer,drawCarGaugePanel,editGauge,gaugeMapFields,enlargeMapBackground,groupMapPropertyFields} from '../../src/ui/CarGaugeEditor.js';
import {normalizeCarFx,carFxActive} from '../../src/racing/CarFx.js';
import {createRaceTrackStateWeatherForcing} from '../../src/racing/trackState/TrackStateIntegration.js';
const ctx=()=>new Proxy({globalAlpha:1,measureText:t=>({width:String(t).length*6})}, {get:(o,k)=>k in o?o[k]:()=>{},set:(o,k,v)=>(o[k]=v,true)});
test('independent interior and exterior layouts, all damage parts, embedded fonts and artwork round trip',()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'interior');
 const a=e.selectedCar.art.gauges;a.interior.enabled=true;Object.assign(a.interior.widgets[0],{x:.3,artRef:'dash-map',fontData:'data:font/ttf;base64,AA==',fontFileName:'dash.ttf'});
 a.exterior.widgets[0].x=.1;
 const car=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())));
 assert.equal(car.art.gauges.interior.widgets[0].x,.3);assert.equal(car.art.gauges.exterior.widgets[0].x,.1);assert.equal(car.art.gauges.interior.widgets[0].fontFileName,'dash.ttf');
 assert.equal(car.art.gauges.interior.widgets.filter(g=>g.source.startsWith('damage.')).length,14);
 assert.deepEqual(gaugeArtRefs(car),['dash-map']);assert.ok(e.collectRaceCarArtRefs(car).includes('dash-map'));
});
test('gauges report units, RPM, gear, lap timer and individual damage correctly',()=>{
 const state={session:{speedMps:10,rpm:.5,gear:-1,elapsedMs:90000,lapStartMs:60000,damage:{tires:{fl:45}}},car:{tuning:{revLimitRpm:7000}}};
 assert.equal(gaugeValue(normalizeGauge({source:'speed',units:'km/h'}),state),36);
 assert.equal(gaugeValue(normalizeGauge({source:'rpm'}),state),3500);
 assert.equal(gaugeText(normalizeGauge({source:'gear'}),-1),'R');
 assert.equal(gaugeText(normalizeGauge({source:'lapTime'}),gaugeValue(normalizeGauge({source:'lapTime'}),state)),'0:30.0');
 assert.equal(gaugeText(normalizeGauge({source:'raceTime'}),59999),'0:59.9');
 assert.equal(gaugeValue(normalizeGauge({source:'damage.tires.fl'}),state),45);
});
test('number/dial/bar/icon/map render at normalized bounds and layer artwork around the needle',()=>{
 const c=ctx(),draws=[],maps=[],text=[];c.drawImage=(art)=>draws.push(art);c.fillText=t=>text.push(t);
 const widgets=['number','dial','bar','icon','map'].map((format,i)=>normalizeGauge({id:String(i),format,x:.1,y:.2,width:.3,height:.4,artRef:'face',needleArtRef:'needle',overlayArtRef:'glass'}));
 const regions=drawCarGauges(c,{x:20,y:30,w:400,h:300},{widgets},{session:{speedMps:10}},{getArt:r=>r,drawMap:r=>maps.push(r)});
 assert.deepEqual(regions[0],{x:60,y:90,w:120,h:120,id:'0'});assert.equal(maps.length,1);assert.ok(text.includes('22'));
 assert.deepEqual(draws.slice(2,5),['face','needle','glass']);
});
test('direct gauge drag is undoable and independent of the other camera layout',()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'exterior');e.carGaugeViewport={x:10,y:20,w:400,h:300};
 const initial=e.selectedCar.art.gauges.exterior.widgets[0].x;
 assert.equal(gaugePointer(e,{x:30,y:40},'down'),true);gaugePointer(e,{x:70,y:70},'move');gaugePointer(e,{x:70,y:70},'up');
 assert.equal(e.selectedCar.art.gauges.exterior.widgets[0].x,initial+.1);assert.equal(e.selectedCar.art.gauges.interior.widgets[0].x,initial);
 e.undoRaceHistory();assert.equal(e.selectedCar.art.gauges.exterior.widgets[0].x,initial);e.redoRaceHistory();assert.equal(e.selectedCar.art.gauges.exterior.widgets[0].x,initial+.1);
});
test('gauge panel controls fit compact portrait and desktop context panels',()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'interior');
 for(const [w,h] of [[224,170],[320,240]]){const controls=[];e.registerDrawnButton=(_,b,config)=>controls.push({b,...config});drawCarGaugePanel(e,ctx(),{x:0,y:0,w,h});assert.equal(controls.length,18);for(const c of controls){assert.ok(c.b.x>=0&&c.b.y>=0);assert.ok(c.b.x+c.b.w<=w&&c.b.y+c.b.h<=h);}assert.ok(controls.some(c=>c.id==='gauge-font'));}
});
test('damage triggers cover all systems with inclusive minimum and maximum levels',()=>{
 for(const [key,damage] of [['engine',{engine:50}],['transmission',{transmission:50}],['suspension',{suspension:{fl:50,fr:0}}],['tire',{tires:{rr:50}}],['body',{panels:{rear:50}}]]){
 const fx=normalizeCarFx([{triggers:[key+'-damage'],damageLevels:{[key]:{min:50,max:75}}}])[0];assert.equal(carFxActive(fx,{damage}),true);assert.equal(carFxActive(fx,{damage:{}}),false);
 fx.damageLevels[key].max=49;assert.equal(carFxActive(fx,{damage}),false);
 }
});
test('weather temperature persists without changing skybox lighting; cancel and undo restore values',()=>{
 const e=new RaceEditor({},{mode:'race'});e.selectedRace.weatherTemperatureC=18;e.selectedRace.brightness=.8;
 e.openRaceWeatherDialog();Object.assign(e.raceSettingsDialogDraft,{weatherTemperatureC:-10,brightness:.2,timeOfDay:'night'});e.closeRaceSettingsDialog({accept:false});assert.equal(e.selectedRace.brightness,.8);
 e.openRaceWeatherDialog();Object.assign(e.raceSettingsDialogDraft,{weatherTemperatureC:-10,brightness:.2,timeOfDay:'night'});e.closeRaceSettingsDialog({accept:true});
 const race=e.normalizeLoadedRaceDocument(JSON.parse(JSON.stringify(e.serializeSelectedRaceDocument())));assert.equal(race.brightness,.8);assert.notEqual(race.timeOfDay,'night');assert.equal(createRaceTrackStateWeatherForcing({race}).ambientTemperatureC,-10);
 e.undoRaceHistory();assert.equal(e.selectedRace.weatherTemperatureC,18);assert.equal(e.selectedRace.brightness,.8);
 assert.equal(createRaceTrackStateWeatherForcing({race:{weather:'snow'}}).ambientTemperatureC,-4);
});
test('live HUD chooses the camera layout and never draws the default instruments on top',()=>{
 const e=new RaceEditor({},{mode:'car'}),car=e.selectedCar;car.art.gauges=normalizeCarGauges();for(const side of ['exterior','interior']){car.art.gauges[side].enabled=true;car.art.gauges[side].widgets=[normalizeGauge({format:'icon',artRef:side})];}
 e.playtestSession={runtimeCar:car,cameraView:'first-person'};e.drawRacePlaytestTopControls=()=>{};e.drawRaceSelectResetProgress=()=>{};e.drawRaceTrackMinimap=()=>{throw Error('Old HUD');};
 const drawn=[];e.getRaceArtSpriteCanvas=ref=>ref;const c=ctx();c.drawImage=r=>drawn.push(r);e.drawRacePlaytestHud(c,{x:0,y:0,w:400,h:300});assert.deepEqual(drawn,['interior']);
 drawn.length=0;e.playtestSession.cameraView='third-person';e.drawRacePlaytestHud(c,{x:0,y:0,w:400,h:300});assert.deepEqual(drawn,['exterior']);
});
test('moving gauges and changing fonts do not restart physics or allocate new preview canvases',()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'exterior');const before=e.getCarEditorPreviewTuningRevision();
 const cache={canvas:{},lastRenderMs:1000};e.carEditorPreviewFrameCache=cache;e.carGaugeViewport={x:0,y:0,w:400,h:300};
 gaugePointer(e,{x:12,y:12},'down');for(let i=1;i<=30;i++)gaugePointer(e,{x:12+i,y:12+i},'move');
 assert.equal(e.carEditorPreviewFrameCache,cache);assert.equal(cache.lastRenderMs,1000);assert.equal(e.getCarEditorPreviewTuningRevision(),before);
 e.selectedCar.art.gauges.exterior.widgets[0].fontData='data:font/ttf;base64,AA==';assert.equal(e.getCarEditorPreviewTuningRevision(),before);
 gaugePointer(e,{x:42,y:42},'up');assert.equal(cache.lastRenderMs,-Infinity);
});
test('brightness changes track sunlight without changing authored air temperature',()=>{
 const forcing=createRaceTrackStateWeatherForcing({race:{weather:'clear',brightness:.25,weatherTemperatureC:10}});assert.equal(forcing.sunIntensity,.225);assert.equal(forcing.ambientTemperatureC,10);
 assert.equal(createRaceTrackStateWeatherForcing({race:{brightness:0}}).sunIntensity,0);
});
test('brightness dims the scene before gauges',()=>{
 const e=new RaceEditor({},{mode:'race'}),calls=[];e.selectedRace.brightness=.25;e.playtestSession={};e.raceInput={};
 const c=ctx();c.fillRect=()=>{if(String(c.fillStyle).startsWith('rgba(0,0,0,'))calls.push(c.fillStyle);};
 e.drawMode7Preview=()=>calls.push('world');e.drawRaceThirdPersonCar=()=>{};e.drawRaceTireFxParticles=()=>{};e.drawRacePlaytestHud=()=>calls.push('hud');e.drawRaceCountdown=()=>{};e.drawRaceEdgeResetFade=()=>{};
 e.drawRacePlaytestScreenContents(c,{x:0,y:0,w:400,h:300});assert.deepEqual(calls.slice(0,3),['world','rgba(0,0,0,0.75)','hud']);
});
test('shared Art menu actions open both gauge workspaces',()=>{
 const e=new RaceEditor({},{mode:'car'});for(const side of ['interior','exterior']){e.handleMenuAction('car-gauges-'+side);assert.equal(e.activeRootId,'art');assert.equal(e.activeAction,'car-gauges-'+side);assert.equal(e.isCarArtEditorScreenActive(),true);}
});
test('temperature and lighting entry is reachable by touch in the weather dialog',()=>{
 const e=new RaceEditor({},{mode:'race'});e.openRaceWeatherDialog();e.drawRaceSettingsDialog(ctx(),390,844);
 const button=e.buttons.find(b=>b.id==='race-settings-environment');assert.ok(button);let opened=false;button.onClick=()=>{opened=true;};e.handlePointerDown({x:button.bounds.x+5,y:button.bounds.y+5});assert.equal(opened,true);
});

test('map gauge properties and all marker resources survive save/load, undo, and runtime collection',async()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'interior');e.carGaugeId=e.selectedCar.art.gauges.interior.widgets[0].id;
 await editGauge(e,async(_,fields)=>({...Object.fromEntries(fields.map(f=>[f.id,f.value])),mapMode:'local',mapRangeM:450,mapLineColor:'#123456',mapLineBorderWidth:3,carMarkerShape:'triangle'}));
 const g=e.selectedCar.art.gauges.interior.widgets[0];Object.assign(g,{markerArtRef:'player',carMarkerArtRef:'cars',startMarkerArtRef:'start',finishMarkerArtRef:'finish'});
 const saved=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument()).art.gauges.interior.widgets[0];
 assert.equal(saved.mapMode,'local');assert.equal(saved.mapRangeM,450);assert.equal(saved.mapLineBorderWidth,3);assert.equal(saved.mapLineColor,'#123456');assert.equal(saved.carMarkerShape,'triangle');
 for(const ref of ['player','cars','start','finish']){assert.ok(gaugeArtRefs(e.selectedCar).includes(ref));assert.ok(e.collectRaceCarArtRefs(e.selectedCar).includes(ref));}
 assert.equal(e.selectedCar.art.gauges.exterior.widgets[0].mapMode,'whole');e.undoRaceHistory();assert.equal(e.selectedCar.art.gauges.interior.widgets[0].mapMode,'whole');
 assert.equal(gaugeMapFields(g).find(f=>f.id==='mapRangeM').visibleWhen({format:'map',mapMode:'whole'}),false);
});
test('whole-map fits endpoints; local-map centers player and uses the configured metric width',()=>{
 const b={x:20,y:40,w:200,h:100},map={minX:0,maxX:1000,minZ:0,maxZ:600},player={x:800,z:400};
 let t=gaugeMinimapTransform(b,map,normalizeGauge({source:'map',format:'map'}),player);
 for(const p of [{x:0,z:0},{x:1000,z:600}]){const q=t.toScreen(p);assert.ok(q.x>b.x&&q.x<b.x+b.w&&q.y>b.y&&q.y<b.y+b.h);}
 t=gaugeMinimapTransform(b,map,normalizeGauge({mapMode:'local',mapRangeM:200}),player);assert.deepEqual(t.toScreen(player),{x:120,y:90});assert.equal(t.toScreen({x:900,z:400}).x,220);
});
test('map renderer uses configured route strokes and distinct artwork for player, AI, start and every finish',()=>{
 const c=ctx(),draws=[],strokes=[];c.drawImage=(art,...args)=>draws.push({ref:art.ref,args});c.stroke=()=>strokes.push({color:c.strokeStyle,width:c.lineWidth});
 const g=normalizeGauge({format:'map',markerArtRef:'player',carMarkerArtRef:'cars',startMarkerArtRef:'start',finishMarkerArtRef:'finish',mapLineColor:'#123456',mapLineWidth:3,mapLineBorderColor:'#654321',mapLineBorderWidth:2});
 const map={minX:0,maxX:100,minZ:0,maxZ:100,paths:[{points:[{x:0,z:0},{x:100,z:100}]}],start:{x:0,z:0},finishes:[{x:100,z:100},{x:100,z:0}]};
 drawGaugeMinimap(c,{x:0,y:0,w:200,h:200},map,g,{player:{x:50,z:50},cars:[{x:20,z:20}],getArt:ref=>({ref,width:16,height:8})});
 assert.deepEqual(draws.map(d=>d.ref),['start','finish','finish','cars','player']);assert.deepEqual(strokes,[{color:'#654321',width:7},{color:'#123456',width:3}]);assert.equal(draws.at(-1).args[2]/draws.at(-1).args[3],2);
});

test('all map marker images are prepared for the live preview before rendering',async()=>{
 const {saveProjectFile}=await import('../../src/ui/projectFiles.js');const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'exterior');
 const g=e.selectedCar.art.gauges.exterior.widgets[0],refs=['map-player-test','map-car-test','map-start-test','map-finish-test'];
 for(const ref of refs)saveProjectFile('art',ref,{width:1,height:1,frames:[['#ffffff']]});
 [g.markerArtRef,g.carMarkerArtRef,g.startMarkerArtRef,g.finishMarkerArtRef]=refs;
 const old=globalThis.document;try{
  globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){}})})};
  e.syncCarAnglePreviewArt();for(const ref of refs)assert.ok(e.racePreparedArtFrames.get(ref+':frame:0'));
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('Map Properties chooses background and icon artwork transactionally alongside local distance',async()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'exterior');
 const refs={artRef:'map-panel',markerArtRef:'my-car',carMarkerArtRef:'opponents',startMarkerArtRef:'start-flag',finishMarkerArtRef:'finish-flag'};
 const initial=JSON.stringify(e.selectedCar.art.gauges);let picked='';
 const form=async(title,fields)=>{
  assert.equal(title,'Map properties');assert.equal(fields.find(f=>f.id==='mapRangeM').section.label,'Map view / GPS');
  const draft=Object.fromEntries(fields.filter(f=>f.type!=='button').map(f=>[f.id,f.value]));
  for(const [id,ref] of Object.entries(refs)){picked=ref;Object.assign(draft,await fields.find(f=>f.id==='choose-'+id).onClick(draft));}
  assert.equal(JSON.stringify(e.selectedCar.art.gauges),initial,'picker must not mutate the car');
  return {...draft,mapMode:'local',mapRangeM:600};
 };
 const picker=async()=>({action:'open',name:picked});
 await editGauge(e,async(...args)=>{await form(...args);return null;},picker);assert.equal(JSON.stringify(e.selectedCar.art.gauges),initial);
 await editGauge(e,form,picker);const g=e.selectedCar.art.gauges.exterior.widgets[0];
 for(const [id,ref] of Object.entries(refs))assert.equal(g[id],ref);assert.equal(g.mapRangeM,600);
 const saved=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument()).art.gauges.exterior.widgets[0];assert.equal(saved.artRef,'map-panel');assert.equal(saved.mapRangeM,600);
 assert.deepEqual(gaugeMapFields(g).find(f=>f.id==='clear-artRef').onClick(),{artRef:''});
 e.undoRaceHistory();assert.equal(e.selectedCar.art.gauges.exterior.widgets[0].artRef,'');
});

test('map screen bounds and opacity keep the bezel separate from live map content',()=>{
 const g=normalizeGauge({format:'map',artRef:'bezel',mapScreenX:.1,mapScreenY:.2,mapScreenWidth:.8,mapScreenHeight:.6,mapOpacity:.4});
 const bounds={x:10,y:20,w:200,h:100};assert.deepEqual(gaugeMapScreenBounds(bounds,g),{x:30,y:40,w:160,h:60});
 const c=ctx(),clips=[],strokes=[];c.globalAlpha=1;c.rect=(...r)=>clips.push(r);c.stroke=()=>strokes.push(c.globalAlpha);
 const map={minX:0,maxX:100,minZ:0,maxZ:100,paths:[{points:[{x:0,z:0},{x:100,z:100}]}],finishes:[]};
 drawGaugeMinimap(c,bounds,map,g,{player:{x:50,z:50}});assert.deepEqual(clips[0],[30,40,160,60]);assert.ok(strokes.every(a=>a===.4));
 const clamped=normalizeGauge({mapScreenX:.9,mapScreenWidth:.8});assert.ok(clamped.mapScreenX+clamped.mapScreenWidth<=1);
});
test('heading-up keeps vehicle left/right correct at all eight bearings in flat and GPS views',()=>{
 const bounds={x:0,y:0,w:200,h:120},map={minX:-200,maxX:200,minZ:-100,maxZ:100},player={x:17,z:-23};
 for(let i=0;i<8;i++)for(const mode of ['local','whole'])for(const projection of ['flat','perspective']){
  const heading=i*Math.PI/4,g=normalizeGauge({mapMode:mode,mapOrientation:'heading',mapProjection:projection,mapRangeM:200});
  const f=RaceEditor.prototype.getRaceForwardVector(heading),r=RaceEditor.prototype.getRaceRightVector(heading);
  const point=(forward,right)=>({x:player.x+forward*f.x+right*r.x,z:player.z+forward*f.z+right*r.z});
  const t=gaugeMinimapTransform(bounds,map,g,player,heading),origin=t.toScreen(player),forward=t.toScreen(point(20,0)),right=t.toScreen(point(0,20)),left=t.toScreen(point(0,-20));
  assert.ok(Math.abs(forward.x-origin.x)<1e-8);assert.ok(forward.y<origin.y);
  assert.ok(right.x>origin.x);assert.ok(left.x<origin.x);assert.ok(Math.abs(right.y-origin.y)<1e-8);
  // An asymmetric right-hand bend must stay to the right ahead of the car.
  const bend=t.toScreen(point(40,30));assert.ok(bend.x>origin.x);assert.ok(bend.y<origin.y);
  if(mode==='whole')for(const x of [-200,200])for(const z of [-100,100]){const p=t.toScreen({x,z});assert.ok(p.x>=0&&p.x<=200&&p.y>=0&&p.y<=120);}
 }
});
test('fixed-north map axes remain independent of car heading',()=>{
 const bounds={x:0,y:0,w:200,h:120},map={minX:-100,maxX:100,minZ:-100,maxZ:100},g=normalizeGauge({mapMode:'local',mapOrientation:'north'});
 for(let i=0;i<8;i++){
  const t=gaugeMinimapTransform(bounds,map,g,{x:0,z:0},i*Math.PI/4);
  assert.ok(t.toScreen({x:20,z:0}).x>100);assert.ok(t.toScreen({x:0,z:-20}).y<60);
 }
});
test('GPS perspective foreshortens distant roads and clips behind-camera segments safely',()=>{
 const bounds={x:0,y:0,w:200,h:160},map={minX:-500,maxX:500,minZ:-500,maxZ:500};
 const t=gaugeMinimapTransform(bounds,map,normalizeGauge({mapMode:'local',mapOrientation:'heading',mapProjection:'perspective',mapRangeM:300,mapPlayerY:.75}),{x:0,z:0},0);
 assert.deepEqual(t.toScreen({x:0,z:0}),{x:100,y:120});
 const near=t.toScreen({x:-20,z:0}),far=t.toScreen({x:-20,z:200});assert.ok(far.x-100<near.x-100);assert.ok(far.y<near.y);
 assert.equal(t.visible({x:0,z:-1000}),false);assert.equal(t.segment({x:0,z:-1000},{x:100,z:-900}),null);
 const clipped=t.segment({x:0,z:-1000},{x:10,z:100});assert.equal(clipped.length,2);assert.ok(clipped.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
});
test('map inset, opacity and GPS settings save through Properties and do not alter background size',async()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'interior');
 const before={...e.selectedCar.art.gauges.interior.widgets[0]};
 await editGauge(e,async(_,fields)=>({...Object.fromEntries(fields.filter(f=>f.type!=='button').map(f=>[f.id,f.value])),mapScreenX:10,mapScreenY:20,mapScreenWidth:80,mapScreenHeight:60,mapOpacity:55,mapOrientation:'heading',mapProjection:'perspective',mapMode:'local',mapPitch:35,mapPlayerY:80}));
 const g=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument()).art.gauges.interior.widgets[0];
 assert.equal(g.width,before.width);assert.equal(g.height,before.height);assert.equal(g.mapScreenWidth,.8);assert.equal(g.mapOpacity,.55);assert.equal(g.mapPlayerY,.8);assert.equal(g.mapPitch,35);assert.equal(g.mapProjection,'perspective');assert.equal(g.mapOrientation,'heading');
 e.undoRaceHistory();assert.equal(e.selectedCar.art.gauges.interior.widgets[0].mapScreenWidth,1);
});

test('expandable map properties keep each icon together and distinguish background from drawing area',()=>{
 const g=normalizeGauge({format:'map'}),fields=groupMapPropertyFields(gaugeMapFields(g));
 for(const [kind,ref,label] of [['player','markerArtRef','Your car icon'],['car','carMarkerArtRef','Other cars icons'],['start','startMarkerArtRef','Start icon'],['finish','finishMarkerArtRef','Finish icon']]){
  for(const id of [ref,'choose-'+ref,'clear-'+ref,kind+'MarkerSize',kind+'MarkerColor',kind+'MarkerShape'])assert.equal(fields.find(f=>f.id===id).section.label,label);
 }
 assert.equal(fields.find(f=>f.id==='artRef').section.label,'Background / bezel');assert.equal(fields.find(f=>f.id==='mapScreenWidth').section.open,true);
 assert.ok(fields.some(f=>f.type==='preview'));
});
test('enlarge-background button preserves the exact drawing area, including at viewport edges',()=>{
 const rect=s=>({x:s.x+s.width*s.mapScreenX/100,y:s.y+s.height*s.mapScreenY/100,w:s.width*s.mapScreenWidth/100,h:s.height*s.mapScreenHeight/100});
 for(const x of [0,40,80]){
  const before={x,y:0,width:20,height:30,mapScreenX:10,mapScreenY:15,mapScreenWidth:80,mapScreenHeight:70},after={...before,...enlargeMapBackground(before)};
  assert.ok(after.width>before.width);for(const [key,value] of Object.entries(rect(before)))assert.ok(Math.abs(rect(after)[key]-value)<1e-8);
 }
});

test('gauge font weight, italic, underline and independent text color persist and draw',async()=>{
 const {gaugeFont,drawGaugeText}=await import('../../src/racing/CarGauges.js');
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'exterior');e.carGaugeId=e.selectedCar.art.gauges.exterior.widgets.find(g=>g.source==='lap').id;
 await editGauge(e,async(_,fields)=>{
  const values=Object.fromEntries(fields.filter(f=>!['button','preview'].includes(f.type)).map(f=>[f.id,f.value]));
  assert.deepEqual(fields.find(f=>f.id==='font-bold').onClick({fontWeight:'400'}),{fontWeight:'700'});
  return {...values,fontWeight:'800',fontItalic:true,fontUnderline:true,textColor:'#ffbbdd',color:'#00ff00'};
 });
 const g=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument()).art.gauges.exterior.widgets.find(g=>g.source==='lap');
 assert.equal(g.fontWeight,800);assert.equal(g.fontItalic,true);assert.equal(g.fontUnderline,true);assert.equal(g.textColor,'#ffbbdd');assert.equal(g.color,'#00ff00');assert.match(gaugeFont(g),/^italic 800 /);
 const c=ctx(),lines=[],fills=[];c.textAlign='center';c.textBaseline='middle';c.moveTo=(...p)=>lines.push(p);c.lineTo=(...p)=>lines.push(p);c.fillText=()=>fills.push(c.fillStyle);
 drawGaugeText(c,g,'12345',100,20,20);assert.deepEqual(fills,['#ffbbdd']);assert.equal(lines[1][0]-lines[0][0],20);
 e.undoRaceHistory();assert.equal(e.selectedCar.art.gauges.exterior.widgets.find(g=>g.source==='lap').fontWeight,400);
});

test('new gauges are decorations named new and draw order survives save and undo',()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'interior');
 const controls=[];e.registerDrawnButton=(_,b,c)=>controls.push(c);drawCarGaugePanel(e,ctx(),{x:0,y:0,w:224,h:170});
 controls.find(c=>c.id==='gauge-add').onClick();
 const widgets=()=>e.selectedCar.art.gauges.interior.widgets,id=e.carGaugeId;
 assert.equal(widgets().at(-1).name,'new');assert.equal(widgets().at(-1).source,'decoration');assert.equal(widgets().at(-1).format,'icon');
 const exterior=JSON.stringify(e.selectedCar.art.gauges.exterior);
 assert.equal(reorderGauge(e,'front'),false);
 assert.equal(reorderGauge(e,'back'),true);assert.equal(widgets()[0].id,id);
 e.undoRaceHistory();assert.equal(widgets().at(-1).id,id);e.redoRaceHistory();assert.equal(widgets()[0].id,id);
 assert.equal(reorderGauge(e,'backward'),false);reorderGauge(e,'forward');assert.equal(widgets()[1].id,id);reorderGauge(e,'backward');assert.equal(widgets()[0].id,id);
 const loaded=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())));assert.equal(loaded.art.gauges.interior.widgets[0].id,id);assert.equal(JSON.stringify(e.selectedCar.art.gauges.exterior),exterior);
});
test('draw order dialog ignores a changed camera layout',async()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'interior');const before=JSON.stringify(e.selectedCar.art.gauges);
 await editGaugeOrder(e,async()=>{enterCarGauges(e,'exterior');return {direction:'front'};});assert.equal(JSON.stringify(e.selectedCar.art.gauges),before);
});

test('ordering changes visible overlap and pointer selection together',()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'exterior');e.carGaugeViewport={x:0,y:0,w:100,h:100};
 e.selectedCar.art.gauges.exterior.widgets=['back','front'].map(id=>normalizeGauge({id,source:'decoration',format:'icon',artRef:id,x:.1,y:.1,width:.5,height:.5}));e.carGaugeId='front';
 reorderGauge(e,'back');const drawn=[],c=ctx();c.drawImage=art=>drawn.push(art);
 drawCarGauges(c,e.carGaugeViewport,e.selectedCar.art.gauges.exterior,{}, {getArt:r=>r});assert.deepEqual(drawn,['front','back']);
 gaugePointer(e,{x:20,y:20},'down');assert.equal(e.carGaugeId,'back');
});

test('gauge position and size sliders preserve offscreen artwork through save and undo',async()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'interior');e.carGaugeId=e.selectedCar.art.gauges.interior.widgets[1].id;
 const id=e.carGaugeId,read=()=>e.selectedCar.art.gauges.interior.widgets.find(g=>g.id===id),before=read().x;
 await editGauge(e,async(_,fields)=>{
  for(const id of ['x','y','width','height']){const f=fields.find(f=>f.id===id);assert.equal(f.type,'range');assert.equal(f.max,400);assert.equal(f.step,.1);}
  assert.equal(fields.find(f=>f.id==='x').min,-400);
  return {...Object.fromEntries(fields.filter(f=>f.type!=='button').map(f=>[f.id,f.value])),x:-25,y:110,width:150,height:125};
 });
 assert.deepEqual([read().x,read().y,read().width,read().height],[-.25,1.1,1.5,1.25]);
 const saved=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument()))).art.gauges.interior.widgets.find(g=>g.id===id);
 assert.deepEqual([saved.x,saved.y,saved.width,saved.height],[-.25,1.1,1.5,1.25]);
 e.undoRaceHistory();assert.equal(read().x,before);e.redoRaceHistory();assert.equal(read().x,-.25);
});
test('gauge drag and nudge can cross viewport edges without snapping oversized artwork',()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'exterior');e.carGaugeViewport={x:0,y:0,w:100,h:100};
 e.selectedCar.art.gauges.exterior.widgets=[normalizeGauge({id:'art',source:'decoration',format:'icon',x:-.1,y:-.1,width:1.4,height:1.4})];
 gaugePointer(e,{x:20,y:20},'down');gaugePointer(e,{x:0,y:0},'up');
 let g=e.selectedCar.art.gauges.exterior.widgets[0];assert.ok(Math.abs(g.x+.3)<1e-8);assert.ok(Math.abs(g.y+.3)<1e-8);
 const buttons=[];e.registerDrawnButton=(_,b,c)=>buttons.push(c);drawCarGaugePanel(e,ctx(),{x:0,y:0,w:224,h:170});buttons.find(b=>b.id==='gauge-left').onClick();
 g=e.selectedCar.art.gauges.exterior.widgets[0];assert.ok(Math.abs(g.x+.31)<1e-8);assert.equal(g.width,1.4);
 assert.equal(normalizeGauge({x:1.2,width:.5}).x,1.2);
});

test('quick geometry controls edit selected gauge with exact numbers and support cancel/undo',async()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'interior');const id=e.selectedCar.art.gauges.interior.widgets[0].id;e.carGaugeId=id;
 const read=()=>e.selectedCar.art.gauges.interior.widgets.find(g=>g.id===id),old=read().x;
 await editGaugeGeometry(e,'x',async(_,fields)=>{assert.equal(fields[0].type,'range');return {value:-23.4};});assert.ok(Math.abs(read().x+.234)<1e-8);
 await editGaugeGeometry(e,'width',async()=>({value:140}));assert.equal(read().width,1.4);
 await editGaugeGeometry(e,'height',async()=>null);assert.equal(read().width,1.4);
 e.undoRaceHistory();assert.notEqual(read().width,1.4);e.undoRaceHistory();assert.equal(read().x,old);
 const controls=[];e.registerDrawnButton=(_,b,c)=>controls.push(c);drawCarGaugePanel(e,ctx(),{x:0,y:0,w:224,h:170});for(const key of ['x','y','width','height'])assert.ok(controls.some(c=>c.id==='gauge-'+key));
});

test('gauge templates format live values, aliases, prefixes and suffixes without evaluating code',()=>{
 const state={session:{elapsedMs:90500,lapStartMs:60000,lap:2,gear:-1,speedMps:10,engineRpm:4500}};
 const lap=normalizeGauge({source:'lapTime',textTemplate:'Lap: ${lap.time}'});
 assert.equal(gaugeText(lap,gaugeValue(lap,state),state),'Lap: 0:30.5');
 assert.equal(gaugeText({...lap,textTemplate:'${value} elapsed'},30500,state),'0:30.5 elapsed');
 assert.equal(gaugeText({...lap,textTemplate:'Lap ${lap.number} | ${race.time} | ${speed} | ${rpm} | ${gear}'},30500,state),'Lap 2 | 1:30.5 | 22 | 4500 | R');
 assert.equal(gaugeText({...lap,textTemplate:'${unknown} ${globalThis.alert(1)}'},30500,state),'${unknown} ${globalThis.alert(1)}');
 assert.equal(gaugeText({...lap,textTemplate:''},30500,state),'0:30.5');
 const c=ctx(),drawn=[];c.fillText=text=>drawn.push(text);
 drawCarGauges(c,{x:0,y:0,w:400,h:300},{widgets:[lap]},state,{});assert.deepEqual(drawn,['Lap: 0:30.5']);
 state.session.elapsedMs+=1000;drawn.length=0;drawCarGauges(c,{x:0,y:0,w:400,h:300},{widgets:[lap]},state,{});assert.deepEqual(drawn,['Lap: 0:31.5']);
});
test('gauge text template properties persist independently and support cancel and undo',async()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'interior');const id=e.selectedCar.art.gauges.interior.widgets.find(g=>g.source==='lapTime')?.id||e.selectedCar.art.gauges.interior.widgets[1].id;e.carGaugeId=id;
 const read=()=>e.selectedCar.art.gauges.interior.widgets.find(g=>g.id===id);
 await editGauge(e,async(_,fields)=>{assert.equal(fields.find(f=>f.id==='textTemplate').required,false);return {...Object.fromEntries(fields.filter(f=>f.type!=='button').map(f=>[f.id,f.value])),source:'lapTime',textTemplate:'Lap: ${lap.time}'};});
 assert.equal(read().textTemplate,'Lap: ${lap.time}');
 const car=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())));assert.equal(car.art.gauges.interior.widgets.find(g=>g.id===id).textTemplate,'Lap: ${lap.time}');assert.ok(car.art.gauges.exterior.widgets.every(g=>!g.textTemplate));
 await editGauge(e,async()=>null);assert.equal(read().textTemplate,'Lap: ${lap.time}');e.undoRaceHistory();assert.equal(read().textTemplate,'');e.redoRaceHistory();assert.equal(read().textTemplate,'Lap: ${lap.time}');
});

test('completion gauges and templates report point-to-point progress and completed results',()=>{
 const g=normalizeGauge({source:'completion'}),state={race:{type:'destination',laps:3},session:{routeRuntimeType:'destination',routeLength:1000,distance:250,lap:1}};
 assert.equal(gaugeValue(g,state),25);assert.equal(gaugeText(g,gaugeValue(g,state),state),'25%');
 const auto=normalizeGauge({source:'raceProgress'});assert.equal(gaugeText(auto,gaugeValue(auto,state),state),'25%');
 assert.equal(gaugeText({...g,textTemplate:'Complete: ${race.completion} (${race.progress})'},25,state),'Complete: 25% (25%)');
 for(const [distance,expected] of [[-50,0],[500,50],[2000,100]]){state.session.distance=distance;assert.equal(gaugeValue(g,state),expected);}
 state.session.distance=0;state.session.networkProgress={finished:true};assert.equal(gaugeValue(g,state),100);
 state.session.networkProgress=null;state.session.raceResults=true;assert.equal(gaugeValue(g,state),100);
 state.session.raceResults=false;state.session.routeLength=0;assert.equal(gaugeValue(g,state),0);
});
test('automatic progress switches to laps on circuits and completion accounts for all laps',()=>{
 const state={race:{type:'circuit',laps:4},session:{routeRuntimeType:'circuit',routeLength:1000,distance:500,lap:2}};
 const auto=normalizeGauge({source:'raceProgress'}),percent=normalizeGauge({source:'completion'});
 assert.equal(gaugeValue(percent,state),37.5);assert.equal(gaugeText(auto,gaugeValue(auto,state),state),'Lap 2/4');
 assert.equal(gaugeText({...auto,lapTextTemplate:'${race.progress} — ${race.completion}'},2,state),'Lap 2/4 — 38%');
 assert.equal(gaugeText(normalizeGauge({source:'lap'}),2,state),'2');
 state.session.raceResults=true;assert.equal(gaugeValue(percent,state),100);
 assert.equal(normalizeCarGauges({interior:{widgets:[auto,percent]}}).interior.widgets[1].source,'completion');
});

test('circuit minimaps use one customizable start/finish marker instead of start and finish icons',()=>{
 const map=buildRaceMinimap({samples:[{x:0,z:0},{x:0,z:100},{x:100,z:100}],circuit:true});
 assert.equal(map.circuit,true);assert.equal(map.finishes.length,0);assert.deepEqual(map.startNext,{x:0,z:100});
 const g=normalizeGauge({format:'map',startMarkerArtRef:'start',finishMarkerArtRef:'finish',circuitMarkerArtRef:'circuit'}),drawn=[];
 const c=ctx();c.drawImage=art=>drawn.push(art.name);
 drawGaugeMinimap(c,{x:0,y:0,w:200,h:200},map,g,{player:{x:50,z:50},getArt:name=>({name,width:20,height:4})});assert.deepEqual(drawn,['circuit']);
 const pointMap=buildRaceMinimap({samples:[{x:0,z:0},{x:0,z:100}],circuit:false});drawn.length=0;
 drawGaugeMinimap(c,{x:0,y:0,w:200,h:200},pointMap,g,{player:{x:0,z:50},getArt:name=>({name,width:20,height:4})});assert.deepEqual(drawn,['start','finish']);
 const fields=groupMapPropertyFields(gaugeMapFields(g));for(const id of ['circuitMarkerArtRef','choose-circuitMarkerArtRef','circuitMarkerShape','circuitMarkerColor','circuitMarkerSize'])assert.equal(fields.find(f=>f.id===id).section.label,'Circuit start/finish line');
 assert.ok(gaugeArtRefs({art:{gauges:{interior:{widgets:[g]}}}}).includes('circuit'));
 assert.equal(normalizeGauge({format:'map'}).circuitMarkerShape,'line');assert.equal(normalizeGauge({format:'map'}).circuitMarkerColor,'#ffd34d');
 assert.equal(normalizeCarGauges(JSON.parse(JSON.stringify({interior:{widgets:[g]}}))).interior.widgets[0].circuitMarkerArtRef,'circuit');
});
test('start/finish line crosses the route direction and uses the chosen color',()=>{
 const c=ctx(),points=[],colors=[];c.moveTo=(x,y)=>points.push([x,y]);c.lineTo=(x,y)=>points.push([x,y]);c.stroke=()=>colors.push(c.strokeStyle);
 drawMinimapStartLine(c,{x:10,y:20},{x:10,y:40},12);assert.deepEqual(points,[[16,20],[4,20]]);assert.equal(colors.at(-1),'#ffd34d');
 points.length=0;drawMinimapStartLine(c,{x:10,y:20},{x:30,y:20},12,'#ffee00');assert.deepEqual(points,[[10,14],[10,26]]);assert.equal(colors.at(-1),'#ffee00');
});

test('tachometer scale and needle follow each car limiter and redline with manual overrides',async()=>{
 const {tachometerScale}=await import('../../src/racing/TachometerFace.js');
 const g=normalizeGauge({source:'rpm',format:'dial',max:9000}),car={tuning:{redlineRpm:6100,revLimitRpm:6300}};
 assert.deepEqual(tachometerScale(g,car),{min:0,max:6300,redline:6100});
 assert.deepEqual(tachometerScale(g,{tuning:{redlineRpm:7000,revLimitRpm:7400}}),{min:0,max:7400,redline:7000});
 const manual=normalizeGauge({...g,min:1000,tachometer:{...g.tachometer,autoScale:false,autoRedline:false,redline:7500}});assert.deepEqual(tachometerScale(manual,car),{min:1000,max:9000,redline:7500});
 const rotations=[],c=ctx();c.rotate=a=>rotations.push(a);drawCarGauges(c,{x:0,y:0,w:300,h:300},{widgets:[g]},{car,session:{engineRpm:6300}},{});
 assert.ok(Math.abs(rotations.at(-1)-(135+270+90)*Math.PI/180)<1e-8);
});
test('tachometer safe/danger colors, arc split and major/minor intervals match RPM settings',async()=>{
 const {drawTachometerFace,tachometerTicks}=await import('../../src/racing/TachometerFace.js');
 const g=normalizeGauge({source:'rpm',format:'dial',startAngle:0,sweepAngle:180,tachometer:{majorInterval:1000,minorInterval:100,safeColor:'#eeeeee',dangerColor:'#ff0000'}}),c=ctx(),arcs=[],labels=[];
 c.arc=(x,y,r,start,end,reverse)=>arcs.push({start,end,reverse});
 drawTachometerFace(c,{x:0,y:0,w:200,h:200},g,{tuning:{redlineRpm:6000,revLimitRpm:8000}},{getArt:()=>null,font:()=>'',text:(_,font,text)=>labels.push(text)});
 assert.equal(arcs.length,2);assert.equal(arcs[0].end,Math.PI*.75);assert.equal(arcs[1].start,arcs[0].end);assert.equal(arcs[1].end,Math.PI);
 assert.deepEqual(labels,['0','1','2','3','4','5','6','7','8']);assert.equal(tachometerTicks(0,8000,100).length,81);assert.equal(tachometerTicks(0,8000,0).length,0);assert.ok(tachometerTicks(0,100000,1).length<=1001);
});
test('tachometer arc artwork follows positive and negative sweeps with bounded drawing work',async()=>{
 const {drawTachometerFace}=await import('../../src/racing/TachometerFace.js');
 for(const sweepAngle of [270,-270]){
  const g=normalizeGauge({source:'rpm',format:'dial',sweepAngle,safeArcArtRef:'safe',dangerArcArtRef:'danger'}),c=ctx(),draws=[],arcs=[];
  c.drawImage=(image,...args)=>{draws.push(image.name);assert.ok(args.every(Number.isFinite));};c.arc=(x,y,r,a,b,reverse)=>arcs.push(reverse);
  drawTachometerFace(c,{x:0,y:0,w:200,h:200},g,{tuning:{redlineRpm:6000,revLimitRpm:8000}},{getArt:name=>({name,width:32,height:8}),font:()=>'',text:()=>{}});
  assert.ok(draws.includes('safe'));assert.ok(draws.includes('danger'));assert.ok(draws.length<=192);assert.deepEqual(arcs,[sweepAngle<0,sweepAngle<0]);
  assert.deepEqual(gaugeArtRefs({art:{gauges:{interior:{widgets:[g]}}}}),['safe','danger']);
 }
});
test('tachometer properties offer uploaded fonts, save face styling and support undo/cancel',async()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'interior');e.carGaugeId=e.selectedCar.art.gauges.interior.widgets.find(g=>g.source==='rpm').id;
 const read=()=>e.selectedCar.art.gauges.interior.widgets.find(g=>g.id===e.carGaugeId),before=JSON.stringify(read());
 const form=async(_,fields)=>{
  const field=id=>fields.find(f=>f.id===id);assert.ok(field('tach_fontChoice').options.some(o=>o.label==='Uploaded dial font'));assert.equal(field('tach_minorInterval').value,100);assert.equal(field('tach-preview').type,'preview');
  assert.equal(field('tach_majorInterval').visibleWhen({source:'speed',format:'dial'}),false);
  return {...Object.fromEntries(fields.filter(f=>!['button','preview'].includes(f.type)).map(f=>[f.id,f.value])),tach_autoScale:false,tach_autoRedline:false,tach_redline:7200,max:9000,tach_majorInterval:2000,tach_minorInterval:100,tach_fontChoice:'system:serif',tach_font_fontSize:16,tach_font_fontWeight:700,tach_font_fontItalic:true,tach_font_fontUnderline:true,tach_font_textColor:'#ffeecc',safeArcArtRef:'safe',dangerArcArtRef:'danger'};
 };
 const loadFonts=async()=>[{name:'Uploaded dial font',fontData:'data:font/ttf;base64,AA==',fontFileName:'dial.ttf'}];
 await editGauge(e,form,undefined,loadFonts);const g=read();assert.equal(g.tachometer.redline,7200);assert.equal(g.tachometer.majorInterval,2000);assert.equal(g.tachometer.font.fontFamily,'serif');assert.equal(g.tachometer.font.fontSize,16);assert.equal(g.tachometer.font.fontWeight,700);assert.equal(g.tachometer.font.fontItalic,true);assert.equal(g.tachometer.font.textColor,'#ffeecc');
 const saved=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument()))).art.gauges.interior.widgets.find(w=>w.id===g.id);assert.deepEqual(saved.tachometer,g.tachometer);assert.equal(saved.dangerArcArtRef,'danger');
 await editGauge(e,async()=>null);assert.equal(read().tachometer.redline,7200);e.undoRaceHistory();assert.equal(JSON.stringify(read()),before);e.redoRaceHistory();assert.equal(read().tachometer.redline,7200);
});

test('tachometer artwork changes preview resources while styling changes keep the simulation',()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'interior');const g=e.selectedCar.art.gauges.interior.widgets.find(g=>g.source==='rpm'),before=e.getCarEditorPreviewTuningRevision();
 g.tachometer.font.fontSize=22;g.tachometer.majorInterval=500;assert.equal(e.getCarEditorPreviewTuningRevision(),before);
 g.safeArcArtRef='whiteStrip';assert.notEqual(e.getCarEditorPreviewTuningRevision(),before);assert.ok(e.collectRaceCarArtRefs(e.selectedCar).includes('whiteStrip'));
});

test('RPM maximum and redline tokens always read the car, independent of custom gauge scale',()=>{
 const car={tuning:{revLimitRpm:6300,redlineRpm:6100}},state={car,session:{engineRpm:3500}},g=normalizeGauge({source:'rpm',max:10000,tachometer:{autoScale:false,autoRedline:false,redline:9000},textTemplate:'RPM ${rpm} / ${rpm.max}; redline ${rpm.redline}'});
 assert.equal(gaugeText(g,3500,state),'RPM 3500 / 6300; redline 6100');
 assert.equal(gaugeValue(normalizeGauge({source:'rpm.max'}),state),6300);assert.equal(gaugeValue(normalizeGauge({source:'rpm.redline'}),state),6100);
 car.tuning.revLimitRpm=7400;car.tuning.redlineRpm=7000;assert.equal(gaugeText(g,3500,state),'RPM 3500 / 7400; redline 7000');
});
test('both gauge editors expose RPM settings and car values before general appearance controls',async()=>{
 for(const side of ['exterior','interior']){
  const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,side);const g=e.selectedCar.art.gauges[side].widgets.find(w=>w.source==='rpm');e.carGaugeId=g.id;e.selectedCar.tuning.revLimitRpm=6300;e.selectedCar.tuning.redlineRpm=6100;
  const controls=[];e.registerDrawnButton=(_,b,c)=>controls.push(c);drawCarGaugePanel(e,ctx(),{x:0,y:0,w:224,h:170});assert.equal(controls.find(c=>c.id==='gauge-properties').label,'RPM settings');
  await editGauge(e,async(_,fields)=>{
   const max=fields.find(f=>f.id==='rpmMaxReadout'),redline=fields.find(f=>f.id==='rpmRedlineReadout'),dial=fields.find(f=>f.id==='rpm-use-dial');
   assert.equal(max.value,'6300 RPM');assert.equal(redline.value,'6100 RPM');assert.equal(max.readOnly,true);assert.equal(max.section.open,true);
   assert.ok(fields.indexOf(max)<fields.findIndex(f=>f.id==='fontChoice'));assert.ok(max.visibleWhen({source:'rpm',format:'number'}));assert.ok(dial.visibleWhen({source:'rpm',format:'icon'}));assert.deepEqual(dial.onClick(),{format:'dial',showValue:true,tach_showFace:true});
   return null;
  });
 }
});

test('filled tachometer arcs stop at live RPM and expose the dark range without a needle',async()=>{
 const {drawTachometerFace}=await import('../../src/racing/TachometerFace.js');
 const car={tuning:{redlineRpm:6000,revLimitRpm:8000}},g=normalizeGauge({source:'rpm',format:'dial',startAngle:0,sweepAngle:180,tachometer:{displayMode:'fill',darkColor:'#202020',showLabels:false}}),c=ctx(),arcs=[],strokes=[];
 c.arc=(x,y,r,start,end)=>arcs.push([start,end]);c.stroke=()=>strokes.push(c.strokeStyle);
 drawTachometerFace(c,{x:0,y:0,w:200,h:200},g,car,{getArt:()=>null,font:()=>'',text:()=>{},value:4000});
 assert.deepEqual(arcs,[[0,Math.PI],[0,Math.PI/2]]);assert.equal(strokes[0],'#202020');
 arcs.length=0;drawTachometerFace(c,{x:0,y:0,w:200,h:200},g,car,{getArt:()=>null,font:()=>'',text:()=>{},value:7000});assert.deepEqual(arcs,[[0,Math.PI],[0,Math.PI*.75],[Math.PI*.75,Math.PI*.875]]);
 const rotations=[];c.rotate=a=>rotations.push(a);drawCarGauges(c,{x:0,y:0,w:200,h:200},{widgets:[g]},{car,session:{engineRpm:4000}},{});assert.equal(rotations.length,0);
 g.tachometer.displayMode='both';drawCarGauges(c,{x:0,y:0,w:200,h:200},{widgets:[g]},{car,session:{engineRpm:4000}},{});assert.equal(rotations.length,1);
});
test('transparent ticks erase only the isolated arc layer, keeping labels and the scene intact',async()=>{
 const {drawTachometerFace}=await import('../../src/racing/TachometerFace.js');
 const g=normalizeGauge({source:'rpm',format:'dial',tachometer:{majorColor:'transparent',minorCutout:true}}),main=ctx(),layer=ctx(),mainOps=[],layerOps=[],labels=[];
 main.stroke=()=>mainOps.push(main.globalCompositeOperation);layer.stroke=()=>layerOps.push(layer.globalCompositeOperation);
 drawTachometerFace(main,{x:0,y:0,w:200,h:200},g,{tuning:{redlineRpm:6000,revLimitRpm:8000}},{getArt:()=>null,font:()=>'',text:()=>labels.push('label'),createLayer:(_,w,h)=>{assert.ok(w<=2048&&h<=2048);return {canvas:{},ctx:layer};}});
 assert.equal(g.tachometer.majorCutout,true);assert.ok(layerOps.includes('destination-out'));assert.ok(!mainOps.includes('destination-out'));assert.equal(labels.length,9);
});
test('fill and transparent tick properties persist through Apply, save and Undo',async()=>{
 const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,'exterior');e.carGaugeId=e.selectedCar.art.gauges.exterior.widgets.find(g=>g.source==='rpm').id;
 const read=()=>e.selectedCar.art.gauges.exterior.widgets.find(g=>g.id===e.carGaugeId);
 await editGauge(e,async(_,fields)=>{
  const f=id=>fields.find(f=>f.id===id);assert.ok(f('tach_displayMode').options.some(o=>o.value==='fill'));assert.equal(f('tach_majorColor').visibleWhen({source:'rpm',format:'dial',tach_majorCutout:true}),false);assert.equal(f('tach_darkColor').visibleWhen({source:'rpm',format:'dial',tach_displayMode:'fill'}),true);
  return {...Object.fromEntries(fields.filter(f=>!['preview','button'].includes(f.type)).map(f=>[f.id,f.value])),tach_displayMode:'fill',tach_majorCutout:true,tach_minorCutout:true,tach_darkColor:'#112233',tach_darkOpacity:.6};
 });
 const saved=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument()))).art.gauges.exterior.widgets.find(g=>g.id===e.carGaugeId);assert.equal(saved.tachometer.displayMode,'fill');assert.equal(saved.tachometer.majorCutout,true);assert.equal(saved.tachometer.minorCutout,true);assert.equal(saved.tachometer.darkColor,'#112233');assert.equal(saved.tachometer.darkOpacity,.6);
 e.undoRaceHistory();assert.equal(read().tachometer.displayMode,'needle');e.redoRaceHistory();assert.equal(read().tachometer.displayMode,'fill');
});


test('race progress uses independent lap and progress text and migrates existing text',()=>{
 const circuit={race:{type:'circuit',laps:4},session:{lap:2,routeLength:1000,distance:250}},destination={race:{type:'destination'},session:{routeLength:1000,distance:250}};
 const g=normalizeGauge({source:'raceProgress',lapTextTemplate:'Lap: ${lap.number} of ${lap.total}',progressTextTemplate:'Route: ${value}'});
 assert.equal(gaugeText(g,gaugeValue(g,circuit),circuit),'Lap: 2 of 4');
 assert.equal(gaugeText(g,gaugeValue(g,destination),destination),'Route: 25%');
 const legacy=normalizeGauge({source:'raceProgress',textTemplate:'Race: ${value}'});
 assert.equal(gaugeText(legacy,2,circuit),'Race: Lap 2/4');assert.equal(gaugeText(legacy,25,destination),'Race: 25%');
 const cleared=normalizeGauge({...legacy,lapTextTemplate:'',progressTextTemplate:''});
 assert.equal(gaugeText(cleared,2,circuit),'Lap 2/4');assert.equal(gaugeText(cleared,25,destination),'25%');
 assert.equal(gaugeText(normalizeGauge({source:'lap',textTemplate:'${lap.number}/${lap.total}'}),2,circuit),'2/4');
});

test('race progress text fields save independently in both gauge layouts and support undo',async()=>{
 for(const side of ['interior','exterior']){
  const e=new RaceEditor({},{mode:'car'});enterCarGauges(e,side);const id=e.selectedCar.art.gauges[side].widgets[1].id;e.carGaugeId=id;
  const read=()=>e.selectedCar.art.gauges[side].widgets.find(g=>g.id===id);
  await editGauge(e,async(_,fields)=>{
   for(const key of ['lapTextTemplate','progressTextTemplate']){const f=fields.find(f=>f.id===key);assert.equal(f.visibleWhen({source:'raceProgress'}),true);assert.equal(f.visibleWhen({source:'speed'}),false);}
   assert.equal(fields.find(f=>f.id==='textTemplate').visibleWhen({source:'raceProgress'}),false);
   return {...Object.fromEntries(fields.filter(f=>f.type!=='button').map(f=>[f.id,f.value])),source:'raceProgress',lapTextTemplate:'Lap ${lap.number}/${lap.total}',progressTextTemplate:'Progress: ${value}'};
  });
  const car=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument()))),saved=car.art.gauges[side].widgets.find(g=>g.id===id);
  assert.equal(saved.lapTextTemplate,'Lap ${lap.number}/${lap.total}');assert.equal(saved.progressTextTemplate,'Progress: ${value}');
  await editGauge(e,async()=>null);assert.equal(read().progressTextTemplate,'Progress: ${value}');
  e.undoRaceHistory();assert.equal(read().progressTextTemplate,'');e.redoRaceHistory();assert.equal(read().lapTextTemplate,'Lap ${lap.number}/${lap.total}');
 }
});

test('redline start, engine limiter and tachometer maximum are independent and persist',async()=>{
 const {tachometerScale,carRpmLimits}=await import('../../src/racing/TachometerFace.js');
 const e=new RaceEditor({},{mode:'car'});e.setCarTuneNumericValue('redlineRpm',6000);e.setCarTuneNumericValue('revLimitRpm',7000);
 const engineBefore=JSON.stringify(e.selectedCar.tuning.engineCurve);
 e.setCarTuneNumericValue('tachometerMaxRpm',8000);
 assert.equal(JSON.stringify(e.selectedCar.tuning.engineCurve),engineBefore);
 const car=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())));
 assert.deepEqual(carRpmLimits(car),{redline:6000,limit:7000,max:8000});
 const g=normalizeGauge({source:'rpm',format:'dial',textTemplate:'${rpm.redline} / ${rpm.limit} / ${rpm.max}'});
 assert.deepEqual(tachometerScale(g,car),{min:0,max:8000,redline:6000});
 assert.equal(gaugeText(g,6500,{car}),'6000 / 7000 / 8000');
 assert.equal(gaugeValue(normalizeGauge({source:'rpm.limit'}),{car}),7000);
 const manual=normalizeGauge({...g,max:10000,tachometer:{autoScale:false}});
 assert.deepEqual(tachometerScale(manual,car),{min:0,max:10000,redline:6000});
 for(const side of ['interior','exterior']){
  enterCarGauges(e,side);e.carGaugeId=e.selectedCar.art.gauges[side].widgets.find(w=>w.source==='rpm').id;
  await editGauge(e,async(_,fields)=>{
   assert.equal(fields.find(f=>f.id==='rpmRedlineReadout').value,'6000 RPM');
   assert.equal(fields.find(f=>f.id==='rpmLimitReadout').value,'7000 RPM');
   assert.equal(fields.find(f=>f.id==='rpmMaxReadout').value,'8000 RPM');return null;
  });
 }
});


test('speed text is number-only and unit labels are explicit templates',()=>{
 const state={session:{speedMps:10}};
 for(const [units,expected] of [['MPH','22'],['km/h','36']]){
  const g=normalizeGauge({source:'speed',units});const value=gaugeValue(g,state);
  assert.equal(gaugeText(g,value,state),expected);
  assert.equal(gaugeText({...g,textTemplate:'${value} '+units},value,state),expected+' '+units);
  assert.equal(gaugeText({...g,textTemplate:'${speed}'},value,state),expected);
 }
});


test('decoration labels draw authored text despite the new-decoration showValue default',()=>{
 const c=ctx(),texts=[],fills=[];c.fillText=t=>texts.push(t);c.fillRect=(...a)=>fills.push(a);
 for(const format of ['number','icon']){
  texts.length=0;fills.length=0;
  const label=normalizeGauge({source:'decoration',name:'gearlabel',format,textTemplate:'Gear',showValue:false});
  drawCarGauges(c,{x:0,y:0,w:400,h:300},{widgets:[label]},{},{});
  assert.deepEqual(texts,['Gear']);assert.equal(fills.length,0);
  texts.length=0;drawCarGauges(c,{x:0,y:0,w:400,h:300},{widgets:[{...label,enabled:false}]},{},{});assert.equal(texts.length,0);
  drawCarGauges(c,{x:0,y:0,w:400,h:300},{widgets:[{...label,textTemplate:''}]},{},{});assert.equal(texts.length,0);
 }
 const speed=normalizeGauge({source:'speed',showValue:false});texts.length=0;
 drawCarGauges(c,{x:0,y:0,w:400,h:300},{widgets:[speed]},{},{});assert.equal(texts.length,0);
});

test('gauge preview uses the actual gameplay viewport and a uniform fit in every device mode',()=>{
 for(const [width,height,mobile,gamepad] of [[390,844,true,false],[844,390,true,false],[390,844,true,true],[844,390,true,true],[1280,800,false,false]]){
  const e=new RaceEditor({deviceIsMobile:mobile,isMobile:mobile,viewport:{width,height},input:{isGamepadConnected:()=>gamepad}},{mode:'car'});
  e.hasPhysicalRaceGamepad=()=>gamepad;enterCarGauges(e,'interior');
  const slot={x:70,y:40,w:310,h:230},p=e.getCarEditorGaugePreviewLayout(slot);
  if(mobile){const actual=gamepad?{w:width,h:height}:e.getRaceHandheldLayout(width,height).screen;assert.equal(p.renderBounds.w,actual.w);assert.equal(p.renderBounds.h,actual.h);}
  else {let actual;e.drawRacePlaytestFrameSafely=(_,b)=>{actual=b;};e.isLivePlaytestSession=()=>true;e.drawDesktopContext=()=>{};e.drawRaceTopPlayControl=()=>{};e.drawDesktop(ctx(),width,height);assert.equal(p.renderBounds.w,actual.w);assert.equal(p.renderBounds.h,actual.h);}
  assert.ok(Math.abs(p.bounds.w/p.bounds.h-p.renderBounds.w/p.renderBounds.h)<1e-9);
  assert.ok(p.bounds.x>=slot.x&&p.bounds.y>=slot.y&&p.bounds.w<=slot.w+.001&&p.bounds.h<=slot.h+.001);
  e.bindCarEditorPreviewPlaytest=cb=>cb();e.playtestSession={};e.isCarExteriorArtPreview=()=>false;e.getNowMs=()=>1000;e.markRaceStartupFrameRendered=()=>{};
  let renderBounds,destination,requested;
  e.getCarEditorPreviewFrameCanvas=(w,h)=>{requested={w,h};return {w,h,canvas:{getContext:()=>ctx()},lastRenderMs:-Infinity};};
  e.drawRacePlaytestFrameSafely=(_,b)=>{renderBounds=b;};const c=ctx();c.drawImage=(_,x,y,w,h)=>{destination={x,y,w,h};};
  e.drawCarEditorPreview(c,slot);
  assert.deepEqual(requested,{w:p.renderBounds.w,h:p.renderBounds.h});assert.deepEqual(renderBounds,p.renderBounds);
  assert.deepEqual(destination,p.bounds);assert.deepEqual(e.carGaugeViewport,p.bounds);
 }
});


test('mechanical warnings only appear through configured instruments, never an automatic banner',()=>{
 const e=new RaceEditor({},{mode:'car'}),car=e.selectedCar;
 car.art.gauges=normalizeCarGauges();
 e.playtestSession={runtimeCar:car,cameraView:'third-person',mechanical:{config:{enabled:true},tick:0,coolantTemperatureC:125,warnings:['COOLANT HOT'],effects:{instruments:1}}};
 for(const method of ['drawRacePlaytestTopControls','drawRaceSelectResetProgress','drawRaceTrackMinimap','drawRaceTimePanel','drawRaceCarStatusPanel','drawRaceTachPanel'])e[method]=()=>{};
 const text=[],art=[],c=ctx();c.fillText=t=>text.push(t);c.strokeText=t=>text.push(t);c.drawImage=ref=>art.push(ref);e.getRaceArtSpriteCanvas=ref=>ref;
 for(const side of ['interior','exterior']){
  e.playtestSession.cameraView=side==='interior'?'first-person':'third-person';
  const layout=car.art.gauges[side];layout.widgets=[];
  for(const enabled of [false,true]){layout.enabled=enabled;e.drawRacePlaytestHud(c,{x:0,y:0,w:400,h:300});assert.deepEqual(text,[]);assert.deepEqual(art,[]);}
  layout.widgets=[normalizeGauge({source:'coolantlight',format:'icon',artRef:'coolant-icon'})];
  e.drawRacePlaytestHud(c,{x:0,y:0,w:400,h:300});assert.deepEqual(art,['coolant-icon']);assert.deepEqual(text,[]);art.length=0;
 }
});

test('damage artwork uses four condition colors and reuses cached transparent tint canvases',async()=>{
 const {tintDamageArtwork,gaugeDamageColor}=await import('../../src/racing/CarGauges.js');
 const original=globalThis.OffscreenCanvas;let allocations=0;const operations=[];
 globalThis.OffscreenCanvas=class {constructor(w,h){this.width=w;this.height=h;allocations++;}getContext(){return {drawImage(){operations.push(this.globalCompositeOperation||'source-over');},fillRect(){operations.push(this.fillStyle);}};}};
 try{
  const source={width:100,height:200};const colors=[0,25,50,75].map(value=>gaugeDamageColor(value,'#5bab9f'));
  assert.deepEqual(colors,['#5bab9f','#f2d45c','#ff8a2f','#ff4f4f']);
  const images=colors.map(color=>tintDamageArtwork(source,color));
  for(let i=0;i<4;i++)assert.equal(tintDamageArtwork(source,colors[i]),images[i]);
  assert.equal(allocations,4);assert.equal(operations.filter(op=>op==='destination-in').length,4);
  assert.deepEqual(operations.filter(op=>String(op).startsWith('#')),colors);
  assert.equal(normalizeGauge({source:'damage.engine',damageArtTint:true}).damageArtTint,true);
 }finally{if(original===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=original;}
});

test('gauge opacity defaults opaque, clamps, and fades text and its outline together',()=>{
 assert.equal(normalizeGauge({}).opacity,1);
 assert.equal(normalizeGauge({opacity:-1}).opacity,0);
 assert.equal(normalizeGauge({opacity:2}).opacity,1);
 const c=ctx(),alphas=[];
 c.fillText=()=>alphas.push(c.globalAlpha);c.strokeText=()=>alphas.push(c.globalAlpha);
 drawCarGauges(c,{x:0,y:0,w:512,h:288},{widgets:[normalizeGauge({source:'raceTime',opacity:.7,outline:1})]},{session:{elapsedMs:12345}},{});
 assert.ok(alphas.length>=2);assert.ok(alphas.every(a=>a===.7));
});

test('pause debug indicator test lights all configured lamps without changing vehicle state',()=>{
 const e=new RaceEditor({},{mode:'car'});e.raceInput.pauseMenuMode='debug-vehicle';
 const row=()=>e.getRacePauseMenuRows().find(r=>r.id==='race-test-indicators');
 assert.equal(row().value,'Off');row().onClick();assert.equal(row().value,'On');
 const session={authoritativeHandbrakeActive:false,absEnabled:true,tractionControlEnabled:true};
 const before=JSON.stringify(session);
 for(const source of ['enginelight','oillight','coolantlight','batterylight','brakelight','tirelight','transmissionlight','absofflight','tractioncontrolofflight','handbrakelight']){
  const c=ctx(),alphas=[];c.drawImage=()=>alphas.push(c.globalAlpha);
  const g=normalizeGauge({source,format:'icon',artRef:'lamp'});
  drawCarGauges(c,{x:0,y:0,w:512,h:288},{widgets:[g]},{session,testIndicators:e.raceInput.testIndicators},{getArt:()=>({width:8,height:8})});
  assert.deepEqual(alphas,[1],source);
 }
 assert.equal(JSON.stringify(session),before);row().onAdjust();assert.equal(row().value,'Off');
});

test('handbrake lamp appears while authoritative handbrake is active and clears on release',()=>{
 for(const active of [false,true,false]){
  const c=ctx(),alphas=[];c.drawImage=()=>alphas.push(c.globalAlpha);
  drawCarGauges(c,{x:0,y:0,w:512,h:288},{widgets:[normalizeGauge({source:'handbrakelight',format:'icon',artRef:'lamp'})]},{session:{authoritativeHandbrakeActive:active}},{getArt:()=>({width:8,height:8})});
  assert.deepEqual(alphas,[active?1:0]);
 }
});

test('low fuel and headlight lamps use actual fuel and switch state',()=>{
 const low=normalizeGauge({source:'lowfuellight'}),lights=normalizeGauge({source:'headlightslight'});
 assert.equal(gaugeValue(low,{}),0);assert.equal(gaugeValue(lights,{}),0);
 for(const [fuel,expected] of [[1,0],[.151,0],[.15,1],[.03,1],[0,1],[NaN,0]])assert.equal(gaugeValue(low,{session:{mechanical:{fuel}}}),expected);
 for(const headlights of [true,false])assert.equal(gaugeValue(lights,{session:{mechanical:{headlights}}}),Number(headlights));
 for(const source of ['lowfuellight','headlightslight']){
  const c=ctx(),alphas=[];c.drawImage=()=>alphas.push(c.globalAlpha);
  drawCarGauges(c,{x:0,y:0,w:512,h:288},{widgets:[normalizeGauge({source,format:'icon',artRef:'lamp'})]},{session:{mechanical:{fuel:1,headlights:false}},testIndicators:true},{getArt:()=>({width:32,height:32})});
  assert.deepEqual(alphas,[1]);
 }
});
