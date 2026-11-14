import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeRaceRecce,steeringSeverity,recceTurnShape} from '../../src/racing/RaceRecce.js';
const fixture=(yaw,extra={})=>({selectedRace:{scenery:[]},getSelectedRaceRuntimeType:()=> 'destination',getRaceRouteLength:()=>600,
 getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:yaw(d),elevation:0}),getRaceRoadHalfWidthWorld:()=>4,...extra});
const bend=(start,span,turn)=>d=>d<start?0:d>start+span?turn:(d-start)*turn/span;
test('reference steering scale is monotonic, independent of gears',()=>{
 assert.deepEqual([.2,.9,1.8,3,5,10].map(steeringSeverity),[6,5,4,3,2,1]);
});
test('square and hairpin describe overall shape, not a single tight radius',()=>{
 assert.equal(analyzeRaceRecce(fixture(bend(200,30,Math.PI/2)))[0].shape,'Square');
 assert.equal(analyzeRaceRecce(fixture(bend(200,40,Math.PI)))[0].shape,'Hairpin');
 const wide=analyzeRaceRecce(fixture(bend(200,200,Math.PI/2)))[0];assert.equal(wide.shape,null);assert.ok(wide.modifiers.includes('long'));
 const short=analyzeRaceRecce(fixture(bend(200,12,.5)))[0];assert.notEqual(short.shape,'Hairpin');
});
test('steering noise on a straight cannot invent a sequence of corners',()=>{
 assert.deepEqual(analyzeRaceRecce(fixture(d=>Math.sin(d*2)*.008)),[]);
});
test('tightening steering and acceleration/braking are recorded by virtual recce',()=>{
 const yaw=d=>{const t=Math.max(0,Math.min(120,d-180));return .004*t+.00012*t*t;};
 const note=analyzeRaceRecce(fixture(yaw))[0];
 assert.ok(note.modifiers.some(m=>m.startsWith('tightens')));
 assert.ok(note.recce.steeringDeg>0);assert.ok(note.recce.apexSpeedMps<note.recce.entrySpeedMps);
 assert.equal(note.recce.braking,true);assert.ok(Number.isFinite(note.recce.exitAccelerationMps2));
});
test('inside apex obstacle warns, outside or distant scenery does not',()=>{
 const editor=fixture(bend(200,80,1.4));
 const note=analyzeRaceRecce(editor)[0],pose=editor.getRaceWorldPoseAtDistance(note.apexAt);
 const object=(id,lateral,along=0)=>({id,presetId:'doodad',x:pose.x+Math.cos(pose.yaw)*lateral+Math.sin(pose.yaw)*along,
 z:pose.z-Math.sin(pose.yaw)*lateral+Math.cos(pose.yaw)*along,previewDoodad:{widthM:2,defaultRule:{behavior:'collide'}}});
 editor.selectedRace.scenery=[object('outside',-5),object('far',40),object('later',5,120)];
 assert.ok(!analyzeRaceRecce(editor)[0].modifiers.includes("don't cut"));
 editor.selectedRace.scenery.push(object('apex-rock',5));
 const updated=analyzeRaceRecce(editor)[0];assert.ok(updated.modifiers.includes("don't cut"));assert.deepEqual(updated.hazardIds,['apex-rock']);
});
test('close opposite turns link into; elevation crests are detected separately',()=>{
 const notes=analyzeRaceRecce(fixture(d=>bend(150,40,.7)(d)-bend(200,40,.7)(d)));
 assert.equal(notes.length,2);assert.equal(notes[0].link,'into');assert.match(notes[0].text,/into Right/);
 const hill=fixture(()=>0,{getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:0,elevation:(d<300?d*.1:60-d*.1)/12})});
 assert.ok(analyzeRaceRecce(hill).some(n=>n.kind==='crest'));
});
test('one corner crossing a circuit seam stays one call',()=>{
 const editor=fixture(d=>d<50?d*.02:d>550?1+(d-550)*.02:1,{getSelectedRaceRuntimeType:()=> 'circuit'});
 // Use a continuous heading across the seam; the straight returns gradually
 // through a separate opposite-direction bend on the far side of the lap.
 editor.getRaceWorldPoseAtDistance=d=>{d=((d%600)+600)%600;return {x:0,z:d,elevation:0,yaw:d<50?d*.02:d<250?1:d<350?1-(d-250)*.02:d<550?-1:-1+(d-550)*.02};};
 const notes=analyzeRaceRecce(editor);
 assert.equal(notes.filter(n=>n.direction==='Left').length,1);
 const seam=notes.find(n=>n.direction==='Left');assert.ok(seam.at>500);assert.ok(seam.endAt<100);
});
test('vertical calls follow the smoothed driving surface rather than raw GPS heights',()=>{
 const editor=fixture(()=>0,{getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:0,elevation:(d<300?d*.2:120-d*.2)/12}),
 getRaceRoadbedProfile:()=>({}),sampleRaceRoadbedProfileAtDistance:()=>({elevation:0})});
 assert.ok(!analyzeRaceRecce(editor).some(n=>n.kind==='crest'));
});

test('recce calls persistent surfaces, structures and bumps without inventing them',()=>{
 const editor=fixture(()=>0,{getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:0,elevation:0,segment:{surface:d<120?'asphalt':'gravel',structure:d>=240&&d<300?'bridge':d>=400?'tunnel':'road',bumpiness:d>=320?.4:0}})});
 const notes=analyzeRaceRecce(editor).map(n=>n.body).join('; ');
 assert.match(notes,/onto gravel/);assert.match(notes,/over bridge/);assert.match(notes,/through tunnel/);assert.match(notes,/bumps/);
 assert.doesNotMatch(notes,/junction|flat out/);
});
test('adverse banking and actual width changes add modifiers to turns',()=>{
 const yaw=bend(200,80,1.4),editor=fixture(yaw,{getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:yaw(d),elevation:0,segment:{banking:-8,width:d<240?6:10}}),getRaceRoadHalfWidthWorld:s=>s.width/2});
 const note=analyzeRaceRecce(editor)[0];assert.ok(note.modifiers.includes('off camber'));assert.ok(note.modifiers.includes('widens'));
});
test('a tiny alternating surface patch is not a spoken surface transition',()=>{
 const editor=fixture(()=>0,{getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:0,elevation:0,segment:{surface:d>=120&&d<128?'gravel':'asphalt'}})});
 assert.deepEqual(analyzeRaceRecce(editor),[]);
});

test('surface transitions coincident with a standalone crest combine safely',()=>{
 const editor=fixture(()=>0,{getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:0,elevation:(d<300?d*.1:60-d*.1)/12,segment:{surface:d<300?'asphalt':'gravel'}})});
 const notes=analyzeRaceRecce(editor);assert.ok(notes.some(n=>n.body.includes('Crest')&&n.body.includes('onto gravel')));
});

test('hairpins require a compact reversal; broad U bends and long spirals stay numbered',()=>{
 assert.equal(recceTurnShape(180,55,9),'Hairpin');
 assert.equal(recceTurnShape(180,25,18),'Acute');
 assert.equal(recceTurnShape(180,170,3),null);
 assert.equal(recceTurnShape(150,110,6),null);
 assert.equal(recceTurnShape(120,35,12),null);
 assert.equal(recceTurnShape(300,85,9),null);
});

test('drive-through foliage and non-solid scenery never request do not cut',()=>{
 const editor=fixture(bend(200,80,1.4)),note=analyzeRaceRecce(editor)[0],p=editor.getRaceWorldPoseAtDistance(note.apexAt);
 const inside={id:'inside',presetId:'doodad',x:p.x+Math.cos(p.yaw)*5,z:p.z-Math.sin(p.yaw)*5};
 for(const definition of [
  {name:'grass clump',defaultRule:{behavior:'collide'}},
  {name:'bush',defaultRule:{behavior:'flatten',speedDrainPercent:18,damage:{panels:2.5}}},
  {name:'loose litter',defaultRule:{behavior:'fly-off',speedDrainPercent:16,damage:{panels:4.5}}},
  {name:'decoration'},
  {name:'pickup',itemType:'mix-tape',defaultRule:{behavior:'collide'}}
 ]){
  editor.selectedRace.scenery=[{...inside,previewDoodad:{widthM:2,...definition}}];
  assert.deepEqual(analyzeRaceRecce(editor)[0].hazardIds,[],definition.name);
 }
 editor.selectedRace.scenery=[{...inside,solid:false,previewDoodad:{widthM:2,defaultRule:{behavior:'collide'}}}];
 assert.deepEqual(analyzeRaceRecce(editor)[0].hazardIds,[]);
 editor.selectedRace.scenery=[{...inside,previewDoodad:{widthM:2,isFence:true}}];
 assert.ok(analyzeRaceRecce(editor)[0].modifiers.includes("don't cut"));
});
