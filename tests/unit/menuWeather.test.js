import test from 'node:test';import assert from 'node:assert/strict';
import {menuWeatherState} from '../../src/menus/MenuWeather.js';
import {createMenuDocument,normalizeMenuDocument,resolveMenuBackground} from '../../src/menus/MenuDocument.js';
import {WEATHER_PROFILES} from '../../src/shared/weatherEffects.js';

test('menu snow uses shared weather particles and stays still when preview time is paused',()=>{
 const doc={},screen={id:'splash',effect:'snow',effectIntensity:1,effectWind:0},b={x:10,y:20,w:390,h:600};
 const state=menuWeatherState(doc,screen,b,0);assert.ok(state.particles.length>0);assert.ok(state.particles.length<=360);
 assert.equal(state.particles[0].style.color,WEATHER_PROFILES['weather-snow'].color);assert.ok(state.particles[0].style.swayAmplitude>0);
 const positions=state.particles.map(p=>[p.x,p.y]);menuWeatherState(doc,screen,b,0);assert.deepEqual(state.particles.map(p=>[p.x,p.y]),positions);
 menuWeatherState(doc,screen,b,.1);assert.notDeepEqual(state.particles.map(p=>[p.x,p.y]),positions);
 for(let i=1;i<500;i++)menuWeatherState(doc,screen,b,i);assert.ok(state.particles.length<=360);
});
test('changing weather, resizing, rewinding or disabling FX resets bounded weather state',()=>{
 const doc={},b={x:0,y:0,w:1280,h:720},s={id:'splash',effect:'snow'};
 const snow=menuWeatherState(doc,s,b,5),rain=menuWeatherState(doc,{...s,effect:'rain'},b,5);assert.notEqual(snow,rain);assert.equal(rain.particles[0].style.weatherType,'weather-rain');
 const resized=menuWeatherState(doc,s,{...b,w:390},6);assert.notEqual(resized,snow);
 assert.notEqual(menuWeatherState(doc,s,{...b,w:390},0),resized);
 assert.equal(menuWeatherState(doc,{...s,effect:'none'},b,1),null);
 assert.equal(menuWeatherState(doc,{...s,effectIntensity:0},b,0).particles.length,0);
});
test('screen FX settings persist and default-background settings inherit',()=>{
 const doc=createMenuDocument();Object.assign(doc.screens[0],{effect:'snow',effectIntensity:1.5,effectWind:-.4});
 const loaded=normalizeMenuDocument(JSON.parse(JSON.stringify(doc)));assert.equal(loaded.screens[0].effectIntensity,1.5);assert.equal(loaded.screens[0].effectWind,-.4);
 loaded.defaultBackground={background:'#000000',backgroundArt:'',effect:'rain',effectIntensity:2,effectWind:1};loaded.screens[0].useDefaultBackground=true;
 assert.equal(resolveMenuBackground(loaded,loaded.screens[0]).effect,'rain');
});
