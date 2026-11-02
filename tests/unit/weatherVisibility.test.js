import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {rainVisibilityM,skyVisibilityOpacity} from '../../src/racing/WeatherVisibility.js';
test('rain visibility follows measured inverse power law and rejects invalid forcing',()=>{
 assert.equal(rainVisibilityM(1),12500);
 assert.ok(rainVisibilityM(50.8)>850&&rainVisibilityM(50.8)<875);
 for(const bad of [0,-1,NaN,Infinity])assert.equal(rainVisibilityM(bad),Infinity);
 let previous=Infinity;
 for(let i=1;i<=100;i++){const v=rainVisibilityM(50.8*i/100);assert.ok(v<previous);previous=v;}
});
test('debug intensity overrides authored distance, updates continuously and restores authored state',()=>{
 const e=new RaceEditor({});e.selectedRace.weather='storm';e.selectedRace.weatherIntensity=.5;e.selectedRace.weatherVisibilityM=50;e.playtestSession={};
 assert.equal(e.getRaceWeatherState().visibilityDistanceM,50);
 e.adjustRaceDebugEnvironment('weatherIntensity',1);const a=e.getRaceWeatherState().visibilityDistanceM;
 assert.ok(a>50);e.adjustRaceDebugEnvironment('weatherIntensity',1);assert.ok(e.getRaceWeatherState().visibilityDistanceM<a);
 assert.equal(e.selectedRace.weatherVisibilityM,50);
 e.playtestSession.debugEnvironment={weather:'snow',weatherIntensity:1};e.adjustRaceDebugEnvironment('weather',1);
 assert.equal(e.getRaceWeatherState().visibilityDistanceM,50);
});
test('sky disappears in severe storms and clear weather leaves sky unchanged',()=>{
 assert.equal(skyVisibilityOpacity(Infinity),0);assert.equal(skyVisibilityOpacity(10000),0);
 assert.equal(skyVisibilityOpacity(rainVisibilityM(50.8)),1);
 assert.ok(skyVisibilityOpacity(3000)<skyVisibilityOpacity(1500));
 const e=new RaceEditor({});e.selectedRace.weather='storm';e.selectedRace.weatherIntensity=1;
 const calls=[];const ctx={save(){},restore(){},fillRect(...r){calls.push([this.fillStyle,...r]);}};
 e.raceSunScreenPoints=[{x:1,y:2}];e.drawRaceSkyVisibility(ctx,{x:-100,y:-100,w:800,h:600});
 assert.deepEqual(calls,[['rgba(129,137,142,1)',-100,-100,800,600]]);assert.deepEqual(e.raceSunScreenPoints,[]);
 e.selectedRace.weather='clear';assert.equal(e.drawRaceSkyVisibility(ctx,{}),false);assert.equal(calls.length,1);
});
test('visibility slider modifies only weather draft',()=>{
 const e=new RaceEditor({});e.selectedRace.weatherVisibilityM=400;e.openRaceWeatherDialog();
 e.updateRaceSettingsSlider({key:'weather-visibility',min:25,max:10000,step:25,scale:'log',track:{x:0,w:100}},0);
 assert.equal(e.raceSettingsDialogDraft.weatherVisibilityM,25);assert.equal(e.selectedRace.weatherVisibilityM,400);
 e.closeRaceSettingsDialog({accept:false});assert.equal(e.selectedRace.weatherVisibilityM,400);
 e.openRaceWeatherDialog();e.raceSettingsDialogDraft.weatherVisibilityM=750;e.closeRaceSettingsDialog({accept:true});assert.equal(e.selectedRace.weatherVisibilityM,750);
});
