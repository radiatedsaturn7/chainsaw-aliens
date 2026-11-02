import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';

for (const id of ['rain', 'snow', 'storm']) test(`${id} loading render survives first physics weather update`, () => {
 const editor = new RaceEditor({}, {mode:'race'});
 editor.playtestSession = {raceId:'startup', worldX:0, worldZ:0, heightM:0, elapsedMs:0};
 editor.getRaceCompositedSurfaceAtWorldPoint = () => ({elevation:0});
 const weatherState = {id, intensity:1, visualIntensity:1, visibilityDistanceM:300};
 const options = {weatherState, camera:{x:0,z:0,elevation:1}, bounds:{width:800,height:600}};
 editor.updateRaceSnowEnvironmentRenderField(options);
 const field = editor.playtestSession.snowEnvironmentState;
 assert.equal(editor.playtestSession.weatherFxState.weatherId,id);
 assert.ok(field.particleCache.size>0);
 const count=field.particleCache.size;
 editor.updateRaceWeatherFxState(1/60,{weatherState});
 assert.equal(editor.playtestSession.snowEnvironmentState,field);
 assert.equal(field.particleCache.size,count,'first physics update must retain warmed particles');
});
