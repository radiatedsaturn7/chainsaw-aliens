import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createRaceTrackState,createRaceTrackStateWeatherForcing} from '../../src/racing/trackState/TrackStateIntegration.js';
import {getTrackStateCellSample} from '../../src/racing/trackState/TrackStateCell.js';
import {getSurfaceById} from '../../src/racing/raceData.js';
import {runClimb} from '../../tools/vehicle-validation/low-speed-traction-audit.mjs';
const raw=JSON.parse(fs.readFileSync('data/server-storage/files/races/Mount Washington Auto Road %E2%80%94 point-to-point/document.json'));
const {race}=raw.encoding?JSON.parse(zlib.gunzipSync(Buffer.from(raw.data,'base64'))):raw;
function fixture(){
 const forcing=createRaceTrackStateWeatherForcing({race,weatherState:{id:'snow',effectiveIntensity:.75}});
 const track=createRaceTrackState({initialSurfaceTemperatureC:forcing.ambientTemperatureC,profileOverrides:race.trackState.surfaceProfiles,surfaceModel:{getSurfaceById,sampleWorld:()=>({region:'road',segment:race.road.segments[0]})}});
 return {track,forcing,cell:track.getOrCreateCell({x:0,z:0})};
}
test('campaign Mount Washington starts with one inch of cold fresh snow, independent of storm strength',()=>{
 const {cell}=fixture();assert.equal(cell.snowDepthMm,25.4);assert.equal(cell.baseGrip,.4);assert.equal(cell.surfaceTemperatureC,-12);assert.equal(cell.iceDepthMm,0);
 assert.ok(race.road.segments.every(s=>s.surface!=='snow'||s.snowCondition==='fresh'));
 const editor=new RaceEditor({});
 for(const weatherIntensity of [.1,.75,1])assert.equal(editor.getRaceWeatherState({...race,weatherIntensity},{elapsedMs:600000}).snowDepthInches,1);
});
test('cold snowfall and compacted snow do not manufacture glaze ice; liquid water still freezes',()=>{
 const {track,forcing,cell}=fixture();cell.compaction=1;
 for(let i=0;i<6000;i++)track.applyWeatherToCell(cell,forcing,.1,i,{prepareMutation:false,countTotals:false});
 assert.equal(cell.iceDepthMm,0);assert.ok(cell.snowDepthMm>25.4 && cell.snowDepthMm<31);
 assert.ok(getTrackStateCellSample(cell).effectiveGripMultiplier>.9);
 cell.standingWaterDepthMm=1;track.applyWeatherToCell(cell,forcing,.1,6001,{prepareMutation:false,countTotals:false});assert.ok(cell.iceDepthMm>0);
});
for(const tc of [true,false])test(`Mount Washington: stock tires remain climbable and Snow tires help (TC ${tc})`,()=>{
 const {track,forcing,cell}=fixture();
 // Test after ten minutes of snowfall, not just the pristine start line.
 for(let i=0;i<6000;i++)track.applyWeatherToCell(cell,forcing,.1,i,{prepareMutation:false,countTotals:false});
 const sample=getTrackStateCellSample(cell);
 const material={...cell,surfaceId:'snow',surfaceGripScale:cell.baseGrip*sample.effectiveGripMultiplier,trackStateConditionApplied:true};
 const common={carName:'RTG-001',snowMm:cell.snowDepthMm,temperatureC:-12,slope:.18,tc,throttle:tc?.55:.25,seconds:8,initialSpeedMps:3.13,materialOverride:material};
 const stock=runClimb({...common,tireName:'Stock'}),snow=runClimb({...common,tireName:'Snow'});
 console.log(JSON.stringify({tc,stockMph:stock.mph,snowMph:snow.mph}));
 // With TC disabled use gentle throttle: both tires may be engine-torque
 // limited at that input, so compare grip reserve rather than demand a speed
 // advantage where neither tire is slipping.
 assert.ok(stock.mph>=(tc?5:3),JSON.stringify(stock));
 assert.ok(stock.travelM>15,JSON.stringify(stock));
 // TC must regulate slip; with TC off, wheelspin is allowed but must not
 // prevent climbing or destabilize the straight-line run.
 if(tc)assert.ok(stock.maxSlip<.2,JSON.stringify(stock));
 assert.ok(Math.abs(stock.lateralM)<.1,JSON.stringify(stock));
 assert.ok(snow.mu>stock.mu*1.4,JSON.stringify({stock,snow}));
 if(tc)assert.ok(snow.mph>stock.mph+3,JSON.stringify({stock,snow}));
});
