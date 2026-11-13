import test from 'node:test';
import assert from 'node:assert/strict';
import {paceNoteLookahead,codriverChain,codriverPhrase,updateCodriverEvents,speakCodriver,stopCodriver} from '../../src/racing/RaceCodriver.js';
import {updateRaceDrivingAssists} from '../../src/racing/RaceDrivingAssists.js';
function withSpeech(run){
 const prior=[globalThis.speechSynthesis,globalThis.SpeechSynthesisUtterance],spoken=[];
 const speech={speaking:false,pending:false,speak(u){this.speaking=true;this.current=u;spoken.push(u.text);},cancel(){this.speaking=false;this.current?.onerror?.();this.current=null;},finish(){this.speaking=false;this.current?.onend?.();this.current=null;}};
 globalThis.speechSynthesis=speech;globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 try{run(speech,spoken);}finally{[globalThis.speechSynthesis,globalThis.SpeechSynthesisUtterance]=prior;}
}
const fixture=(calls=[])=>({selectedRace:{codriver:{enabled:true,spoken:true,icons:true}},raceInput:{paused:false},selectedCar:{},getRaceSessionCar:()=>null,getRaceCarTuning:()=>({}),getRaceWorldPoseAtDistance:()=>({yaw:0}),
 playtestSession:{worldX:0,worldZ:0,distance:0,speedMps:30,routeLength:2000,routeRuntimeType:'destination',codriverCalls:calls}});
test('call window scales with speed, braking demand and grip, but is bounded on straights',()=>{
 const fast={text:'Left 6',recce:{minimumSpeedMps:50}},tight={text:'Hairpin right',recce:{minimumSpeedMps:8}};
 assert.ok(paceNoteLookahead(tight,60)>paceNoteLookahead(tight,20));
 assert.ok(paceNoteLookahead(tight,60)>paceNoteLookahead(fast,60));
 assert.ok(paceNoteLookahead(tight,35,.3)>paceNoteLookahead(tight,35,1));
 assert.equal(paceNoteLookahead(tight,0),30);
 assert.ok(paceNoteLookahead(tight,100,.1)<=450);
});
test('chains close features with into/and, stops at long gaps and limits reading load',()=>{
 const notes=[{text:'6 left',remaining:100,announcedDistance:100,spanM:30},{text:'3 right widens',remaining:140,spanM:20},{text:'over crest',remaining:190},{text:'1 left',remaining:450}];
 const chain=codriverChain(notes,30);
 assert.equal(codriverPhrase(chain),'100 6 left, into 3 right widens, and over crest');
 assert.equal(chain.length,3);assert.equal(codriverChain(notes,5).length,1);
});
test('busy speech never queues stale corners; dispatch distance reflects current position',()=>withSpeech((speech,spoken)=>{
 const e=fixture([{at:200,text:'Left 3'},{at:600,text:'Right 2'}]),s=e.playtestSession;
 speech.speaking=true;s.distance=150;updateRaceDrivingAssists(e,.1);assert.equal(spoken.length,0);
 s.distance=250;speech.speaking=false;updateRaceDrivingAssists(e,.1);assert.equal(spoken.length,0);
 s.distance=540;speech.speaking=true;updateRaceDrivingAssists(e,.1);
 s.distance=560;speech.speaking=false;updateRaceDrivingAssists(e,.1);assert.deepEqual(spoken,['40 Right 2']);
}));
test('pause cancels owned speech and retries an interrupted upcoming call; icons stay after slowing',()=>withSpeech((speech,spoken)=>{
 const e=fixture([{at:200,text:'Left 3'}]),s=e.playtestSession;s.distance=150;
 updateRaceDrivingAssists(e,.1);assert.equal(spoken.length,1);
 e.raceInput.paused=true;updateRaceDrivingAssists(e,.1);assert.equal(speech.speaking,false);assert.equal(s.drivingAssists.note,null);
 e.raceInput.paused=false;updateRaceDrivingAssists(e,.1);assert.equal(spoken.length,2);speech.finish();
 s.speedMps=0;updateRaceDrivingAssists(e,.1);assert.equal(s.drivingAssists.note.at,200);
 s.distance=201;updateRaceDrivingAssists(e,.1);assert.equal(s.drivingAssists.note,null);
}));
test('circuit seam notes speak once for the incoming lap and finish only on final lap',()=>withSpeech((speech,spoken)=>{
 const e=fixture([{at:20,text:'Right 2'}]),s=e.playtestSession;
 e.selectedRace.laps=2;s.routeLength=1000;s.routeRuntimeType='circuit';s.lap=1;s.distance=980;
 updateRaceDrivingAssists(e,.1);speech.finish();assert.equal(spoken.length,1);assert.ok(!spoken[0].includes('finish'));
 s.lap=2;s.distance=5;updateRaceDrivingAssists(e,.1);assert.equal(spoken.length,1);
 s.distance=960;updateRaceDrivingAssists(e,.1);assert.match(spoken.at(-1),/Over finish/);
}));
test('countdown follows race clock, never repeats held numbers, and speaks Go at release',()=>withSpeech((speech,spoken)=>{
 const state={},s={countdownRemainingMs:6000},options={enabled:true,active:false};
 for(const ms of [6000,5900,5000,4000,3000,2000,1000]){s.countdownRemainingMs=ms;updateCodriverEvents(state,s,.1,options);}
 assert.deepEqual(spoken,['5','4','3','2','1','Go!']);
 stopCodriver(state);assert.equal(speech.speaking,false);
}));
test('damage chatter waits for a safe gap, respects cooldown and does not repeat steady damage',()=>withSpeech((speech,spoken)=>{
 const state={},s={damage:{suspension:{fl:40}},speedMps:20},options={enabled:true,active:true};
 updateCodriverEvents(state,s,.1,{...options,roadDue:true,nextRemaining:20});assert.equal(spoken.length,0);
 updateCodriverEvents(state,s,1,{...options,nextRemaining:400});assert.deepEqual(spoken,['Careful with the suspension.']);speech.finish();
 updateCodriverEvents(state,s,21,options);assert.equal(spoken.length,1);
 s.damage.suspension.fl=75;updateCodriverEvents(state,s,1,options);assert.equal(spoken.length,2);
}));
test('impact events produce occasional chatter, road calls preempt it and disabled voice is silent',()=>withSpeech((speech,spoken)=>{
 const state={},s={vehicleDynamicsRunner:{impactHistory:[{sequence:1,bodyNormalImpulseNs:5000}]}},options={enabled:true,active:true};
 updateCodriverEvents(state,s,.1,options);assert.match(spoken[0],/hard hit/);
 assert.equal(speakCodriver(state,'Left 2'),true);assert.equal(spoken.at(-1),'Left 2');speech.finish();
 updateCodriverEvents(state,s,30,options);assert.equal(spoken.length,2);
 s.vehicleDynamicsRunner.impactHistory.push({sequence:2,bodyNormalImpulseNs:5000});
 updateCodriverEvents(state,s,.1,{...options,enabled:false});assert.equal(spoken.length,2);
}));
