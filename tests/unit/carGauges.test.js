import {gaugeMinimapTransform,drawGaugeMinimap,gaugeMapScreenBounds} from '../../src/racing/RaceMinimap.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {normalizeCarGauges,normalizeGauge,gaugeValue,gaugeText,drawCarGauges,gaugeArtRefs} from '../../src/racing/CarGauges.js';
import {enterCarGauges,gaugePointer,drawCarGaugePanel,editGauge,gaugeMapFields,enlargeMapBackground,groupMapPropertyFields} from '../../src/ui/CarGaugeEditor.js';
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
 assert.deepEqual(regions[0],{x:60,y:90,w:120,h:120,id:'0'});assert.equal(maps.length,1);assert.ok(text.includes('22 MPH'));
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
 for(const [w,h] of [[224,170],[320,240]]){const controls=[];e.registerDrawnButton=(_,b,config)=>controls.push({b,...config});drawCarGaugePanel(e,ctx(),{x:0,y:0,w,h});assert.equal(controls.length,12);for(const c of controls){assert.ok(c.b.x>=0&&c.b.y>=0);assert.ok(c.b.x+c.b.w<=w&&c.b.y+c.b.h<=h);}assert.ok(controls.some(c=>c.id==='gauge-font'));}
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
