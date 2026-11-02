import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RACE_SNOW_ENVIRONMENT_LIMITS,
  createRaceSnowEnvironmentState,
  updateRaceSnowEnvironmentField
} from '../../src/racing/RaceSnowEnvironment.js';

const BOUNDS = { x: 0, y: 0, w: 640, h: 360 };
const WEATHER = {
  id: 'snow',
  visualIntensity: 1,
  visibilityDistanceM: 260
};

const hydrateField = (state, options = {}) => updateRaceSnowEnvironmentField(state, {
  camera: { x: 0, z: 0, heightM: 3 },
  cameraYaw: 0,
  bounds: BOUNDS,
  weatherState: WEATHER,
  elapsedMs: 12000,
  maxGroundSamples: RACE_SNOW_ENVIRONMENT_LIMITS.maxParticles,
  sampleGroundHeightM: ({ x, z }) => x * 0.01 + z * 0.002,
  ...options
});

test('environment snowfall covers the visible landscape instead of ending at the old local box', () => {
  const state = createRaceSnowEnvironmentState({ raceSeed: 'studio-sprint-wrx2' });
  const particles = hydrateField(state);

  assert.equal(particles.length, RACE_SNOW_ENVIRONMENT_LIMITS.maxParticles);
  assert.equal(state.coverageDistanceM, 312);
  assert.equal(Math.max(...particles.map((particle) => particle.cameraDepthM)) > 260, true);
  assert.equal(particles.some((particle) => particle.cameraDepthM < 18), true);
  assert.equal(particles.some((particle) => particle.cameraDepthM > 52), true);
  const depthBands = [0, 0, 0];
  particles.forEach((particle) => {
    const ratio = particle.cameraDepthM / state.coverageDistanceM;
    if (ratio < 0.2) depthBands[0] += 1;
    else if (ratio < 0.55) depthBands[1] += 1;
    else depthBands[2] += 1;
  });
  assert.equal(depthBands.every((count) => count > 0), true);
  assert.equal(particles.every((particle) => (
    particle.cameraDepthM >= RACE_SNOW_ENVIRONMENT_LIMITS.nearFadeStartM
    && particle.cameraDepthM <= state.coverageDistanceM
  )), true);
});

test('environment snowfall keeps overlapping world identities stable across streamed camera cells', () => {
  const state = createRaceSnowEnvironmentState({ raceSeed: 'stable-world-snow' });
  const initial = hydrateField(state);
  const initialById = new Map(initial.map((particle) => [particle.id, {
    baseX: particle.baseX,
    baseZ: particle.baseZ,
    groundHeightM: particle.groundHeightM
  }]));
  const initialKey = state.activeKey;

  const withinSnapCell = hydrateField(state, {
    camera: { x: 8, z: 7, heightM: 3 },
    elapsedMs: 12500
  });
  assert.equal(state.activeKey, initialKey);
  assert.deepEqual(
    withinSnapCell.map((particle) => particle.id),
    initial.map((particle) => particle.id)
  );

  const streamed = hydrateField(state, {
    camera: { x: 24, z: 20, heightM: 3 },
    elapsedMs: 13000
  });
  const overlap = streamed.filter((particle) => initialById.has(particle.id));
  assert.equal(overlap.length > RACE_SNOW_ENVIRONMENT_LIMITS.maxParticles * 0.45, true);
  overlap.forEach((particle) => {
    assert.deepEqual(
      {
        baseX: particle.baseX,
        baseZ: particle.baseZ,
        groundHeightM: particle.groundHeightM
      },
      initialById.get(particle.id)
    );
  });
});

test('environment snowfall hydrates terrain incrementally and falls in bounded terrain-relative columns', () => {
  const sampled = [];
  const state = createRaceSnowEnvironmentState({ raceSeed: 'terrain-snow' });
  const options = {
    camera: { x: 0, z: 0, heightM: 3 },
    cameraYaw: Math.PI / 7,
    bounds: BOUNDS,
    weatherState: WEATHER,
    elapsedMs: 2000,
    maxGroundSamples: 17,
    sampleGroundHeightM: ({ x, z }) => {
      sampled.push([x, z]);
      return 4 + x * 0.005 - z * 0.003;
    }
  };
  let particles = updateRaceSnowEnvironmentField(state, options);
  assert.equal(sampled.length, 17);
  assert.equal(particles.filter((particle) => particle.hydrated).length, 17);

  for (let pass = 1; pass < 30 && particles.some((particle) => !particle.hydrated); pass += 1) {
    particles = updateRaceSnowEnvironmentField(state, {
      ...options,
      elapsedMs: 2000 + pass * 16
    });
  }
  assert.equal(particles.every((particle) => particle.hydrated), true);
  particles.forEach((particle) => {
    assert.equal(particle.heightM >= particle.groundHeightM + 0.35, true);
    assert.equal(
      particle.heightM <= particle.groundHeightM + RACE_SNOW_ENVIRONMENT_LIMITS.columnHeightM + 0.35,
      true
    );
  });
  assert.equal(state.particleCache.size <= RACE_SNOW_ENVIRONMENT_LIMITS.maxCachedParticles, true);
});

test('environment snowfall is deterministic and clears without snow weather', () => {
  const first = createRaceSnowEnvironmentState({ raceSeed: 'mirror-field' });
  const second = createRaceSnowEnvironmentState({ raceSeed: 'mirror-field' });
  const firstParticles = hydrateField(first);
  const secondParticles = hydrateField(second);

  assert.deepEqual(
    firstParticles.slice(0, 32).map((particle) => [
      particle.id,
      particle.worldX,
      particle.worldZ,
      particle.heightM,
      particle.opacity
    ]),
    secondParticles.slice(0, 32).map((particle) => [
      particle.id,
      particle.worldX,
      particle.worldZ,
      particle.heightM,
      particle.opacity
    ])
  );

  const cleared = updateRaceSnowEnvironmentField(first, {
    camera: { x: 0, z: 0, heightM: 3 },
    cameraYaw: 0,
    bounds: BOUNDS,
    weatherState: { id: 'clear', visualIntensity: 0 },
    elapsedMs: 13000
  });
  assert.deepEqual(cleared, []);
  assert.equal(first.activeParticles.length, 0);
  assert.equal(first.particleCache.size, 0);
});

test('environment snowfall bounds streamed cache growth and per-frame terrain sampling', () => {
  const state = createRaceSnowEnvironmentState({ raceSeed: 'long-stage-snow' });
  for (let step = 0; step < 24; step += 1) {
    let samples = 0;
    const particles = updateRaceSnowEnvironmentField(state, {
      camera: {
        x: step * 48,
        z: step * 31,
        heightM: 3
      },
      cameraYaw: step * 0.08,
      bounds: BOUNDS,
      weatherState: WEATHER,
      elapsedMs: step * 100,
      maxGroundSamples: RACE_SNOW_ENVIRONMENT_LIMITS.defaultGroundSamplesPerUpdate,
      sampleGroundHeightM: () => {
        samples += 1;
        return 0;
      }
    });
    assert.equal(particles.length, RACE_SNOW_ENVIRONMENT_LIMITS.maxParticles);
    assert.equal(samples <= RACE_SNOW_ENVIRONMENT_LIMITS.defaultGroundSamplesPerUpdate, true);
    assert.equal(state.particleCache.size <= RACE_SNOW_ENVIRONMENT_LIMITS.maxCachedParticles, true);
  }
});

test('rain and storm share bounded world coverage, fall faster and switch cleanly back to snow',()=>{
 for(const id of ['rain','storm']){
  const state=createRaceSnowEnvironmentState({raceSeed:'rain-coverage'});
  const particles=hydrateField(state,{weatherState:{id,visualIntensity:1,visibilityDistanceM:865}});
  assert.equal(particles.length,384);
  assert.ok(particles.some(p=>p.cameraDepthM>400));
  assert.ok(particles.some(p=>p.cameraDepthM<50));
  assert.ok(particles.every(p=>p.rain&&p.fallVelocityMps>=(id==='storm'?60:30)&&p.fallVelocityMps<=(id==='storm'?76:38)));
  const old=particles.map(p=>[p.id,p.baseX,p.baseZ]);
  hydrateField(state,{weatherState:{id,visualIntensity:1,visibilityDistanceM:865},elapsedMs:12100});
  assert.deepEqual(particles.map(p=>[p.id,p.baseX,p.baseZ]),old);
  const snow=hydrateField(state);
  assert.ok(snow.every(p=>!p.rain&&p.fallVelocityMps<3));
  assert.equal(hydrateField(state,{weatherState:{id:'clear',visualIntensity:0}}).length,0);
 }
});

test('rain uses the shared depth-tested GPU buffer without a foreground overlay', async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');
 // Editor builds the production Three.js scene through its own rendering code;
 // streamed field identity/coverage above is independently tested without a GPU.
 const e=new RaceEditor({});
 const renderer={};const material=e.getRaceThreeEnvironmentSnowMaterial(renderer);
 assert.equal(material.depthTest,true);assert.equal(material.depthWrite,false);
 assert.match(material.fragmentShader,/uniform float rainMode/);
 assert.match(material.fragmentShader,/rainMode > 0.5/);
 assert.equal(e.getRaceThreeEnvironmentSnowMaterial(renderer),material);
});


test('rain starts higher and physically traverses its column faster without changing snow',()=>{
 const state=createRaceSnowEnvironmentState({raceSeed:'fast-rain'});
 const options={weatherState:{id:'rain',visualIntensity:1,visibilityDistanceM:865},sampleGroundHeightM:()=>0,elapsedMs:10000};
 const drops=hydrateField(state,options);
 assert.ok(drops.some(p=>p.heightM>40));
 const heights=new Map(drops.map(p=>[p.id,p.heightM]));
 const moved=hydrateField(state,{...options,elapsedMs:10100});
 const falling=moved.filter(p=>p.heightM<heights.get(p.id));
 assert.ok(falling.length>300);
 for(const p of falling)assert.ok(Math.abs(heights.get(p.id)-p.heightM-p.fallVelocityMps*.1)<1e-8);
 const snow=hydrateField(state,{sampleGroundHeightM:()=>0});
 assert.ok(snow.every(p=>p.heightM<=24.35&&p.fallVelocityMps<3));
});

test('precipitation follows world wind and rain speed rises with intensity without phase jumps',()=>{
 const make=(id,intensity,gust)=>{
  const state=createRaceSnowEnvironmentState({raceSeed:'wind-motion'});
  const options={weatherState:{id,visualIntensity:intensity,visibilityDistanceM:300},elapsedMs:1000,gustXMps:gust,gustZMps:0};
  return {state,options,particles:hydrateField(state,options)};
 };
 for(const id of ['snow','rain','storm']){
  const calm=make(id,1,0),windy=make(id,1,10);
  assert.ok(windy.particles.some(p=>p.worldX-p.baseX>2));
  assert.ok(windy.particles.every(p=>p.windVelocityX>0&&p.windVelocityZ===0));
  assert.ok(calm.particles.every(p=>p.windVelocityX===0));
 }
 const light=make('rain',.2,2),heavy=make('rain',1,12);
 const same=heavy.particles.find(p=>light.particles.some(q=>q.id===p.id));
 assert.ok(same.fallVelocityMps>light.particles.find(p=>p.id===same.id).fallVelocityMps);
 const before=new Map(light.particles.map(p=>[p.id,p.heightM]));
 const after=hydrateField(light.state,{...light.options,weatherState:{...light.options.weatherState,visualIntensity:1}});
 for(const p of after)if(before.has(p.id))assert.equal(p.heightM,before.get(p.id));
});


test('full storm rain falls twice as fast as full rain while retaining the same particle budget',()=>{
 const sample=id=>hydrateField(createRaceSnowEnvironmentState({raceSeed:'storm-speed'}),{weatherState:{id,visualIntensity:1,visibilityDistanceM:300}});
 const rain=sample('rain'),storm=sample('storm');
 assert.equal(storm.length,rain.length);
 const speeds=new Map(rain.map(p=>[p.id,p.fallVelocityMps]));
 for(const p of storm)assert.equal(p.fallVelocityMps,2*speeds.get(p.id));
});

test('bounded weather selection retains exactly the same ranked candidates, including ties',async()=>{
 const {retainWeatherCandidate}=await import('../../src/racing/RaceSnowEnvironment.js');
 const compare=(a,b)=>a.score-b.score||a.id.localeCompare(b.id);
 const candidates=Array.from({length:12000},(_,i)=>({id:String(i),score:(Math.imul(i,1664525)>>>0)%901}));
 for(const limit of [1,32,384]){
 const heap=[];for(const candidate of candidates)retainWeatherCandidate(heap,candidate,limit);
 assert.deepEqual(heap.sort(compare),[...candidates].sort(compare).slice(0,limit));
 }
});
