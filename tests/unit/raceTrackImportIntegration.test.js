import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import RaceEditor from '../../src/ui/RaceEditor.js';

const race=JSON.parse(execFileSync('python3',['-c',`import sys,json
sys.path[:0]=['tools','tests/python']
from test_race_track_import import layout
from race_track_import import build
print(json.dumps(build(layout(),use_elevation=False)['race']))`],{encoding:'utf8'}));

test('Python track output loads as editable circuit and survives document round trip',()=>{
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
 const old=editor.selectedRace;
 assert.equal(editor.applyImageRace(race,'OpenStreetMap'),true);
 assert.notEqual(editor.selectedRace,old);assert.ok(editor.project.races.includes(old));
 const samples=editor.getRacePathSamples({step:10});
 assert.ok(samples.length>50);
 const restored=editor.normalizeLoadedRaceDocument(JSON.parse(JSON.stringify(editor.selectedRace)));
 assert.equal(restored.source.license,'ODbL-1.0');assert.equal(restored.road.nodes.length,race.road.nodes.length);
 assert.equal(restored.road.nodes[0].role,'start');assert.equal(restored.road.nodes.at(-1).role,'finish');
 assert.equal(restored.type,'circuit');assert.ok(editor.getMenuItems('file').some(i=>i.id==='race-import-real'&&!i.disabled));
});
test('imported elevation range supports hills beyond twelve metres without changing old races',()=>{
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
 assert.equal(editor.clampRaceElevation(4),1);
 editor.applyImageRace(race,'OpenStreetMap');
 assert.equal(editor.clampRaceElevation(4),4);
 editor.selectedRace.road.nodes[1].elevation=4;
 const samples=editor.getRacePathSamples({step:10});
 assert.ok(Math.max(...samples.map(s=>s.elevation))>3);
});
test('imported segment banking is editable using the shared form',async()=>{
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
 editor.applyImageRace(race,'OpenStreetMap');
 assert.equal(await editor.openRaceBankingDialog(async()=>({degrees:12})),true);
 assert.equal(editor.selectedSegment.banking,12);
});
test('mountain destination retains uphill finish and route references after loading',()=>{
 const editor=new RaceEditor({deviceIsMobile:true,isMobile:true,exitRaceEditor(){}});
 const open=structuredClone(race);open.type='destination';open.laps=1;
 open.road.nodes.at(-1).x+=100;open.road.nodes.at(-1).elevation=120;
 open.road.segments.at(-1).elevation=120;open.source.routeReference={waypoints:[{x:0,y:0},{x:100,y:100}]};
 assert.equal(editor.applyImageRace(open,'OpenStreetMap'),true);
 const restored=editor.normalizeLoadedRaceDocument(JSON.parse(JSON.stringify(editor.selectedRace)));
 assert.equal(restored.type,'destination');assert.equal(restored.road.nodes.at(-1).elevation,120);
 assert.deepEqual(restored.source.routeReference,open.source.routeReference);
 assert.equal(editor.clampRaceElevation(120),120);
});

test('imported mountain survey stays coarse during editing and save/reload',()=>{
 const editor=new RaceEditor({});
 const mountain=structuredClone(race);
 mountain.road.tileMap={minElevation:-1000,maxElevation:1000,cellSizeM:45,defaultTileId:'grass',cells:{'-2,1':{tileId:'grass',elevation:42},'0,0':{tileId:'dirt',elevation:3}}};
 editor.applyLoadedRaceDocument(mountain);
 const map=editor.ensureRaceTileMap();
 assert.equal(map.cellSizeM,45);assert.equal(Object.keys(map.cells).length,2);
 assert.equal(map.cells['-2,1'].elevation,42);
 assert.equal(editor.getRaceTilePaintSizeM()%45,0);
 editor.applyLoadedRaceDocument(editor.serializeSelectedRaceDocument());
 assert.equal(editor.ensureRaceTileMap().cellSizeM,45);
 assert.equal(Object.keys(editor.ensureRaceTileMap().cells).length,2);
});

test('legacy non-imported maps still migrate to their original 5-metre editing grid',()=>{
 const editor=new RaceEditor({});
 editor.selectedRace.road.tileMap={cellSizeM:10,cells:{'0,0':{tileId:'grass',elevation:0}}};
 const map=editor.ensureRaceTileMap();assert.equal(map.cellSizeM,5);assert.equal(Object.keys(map.cells).length,4);
});

test('long imported routes use bounded build detail while respecting an explicit surface step',()=>{
 const editor=new RaceEditor({});const mountain=structuredClone(race);mountain.source.mappedLengthM=12314;
 editor.applyLoadedRaceDocument(mountain);
 assert.equal(editor.getRaceWorldBakeSurfaceStep(),10);
 editor.selectedRace.road.renderSurfaceStepM=5;
 assert.equal(editor.getRaceWorldBakeSurfaceStep(),5);
});

test('imported hairpins cut the terrain out of the driving surface',async()=>{
 const {getRaceBakedSurfaceTrianglesInBounds}=await import('../../src/racing/RaceBakedSurfaceSampler.js');
 const editor=new RaceEditor({});const mountain=structuredClone(race);
 mountain.type='destination';mountain.road.nodes=[{x:0,y:0,elevation:0},{x:0,y:80,elevation:1},{x:25,y:80,elevation:2},{x:25,y:0,elevation:3}];
 mountain.road.segments=mountain.road.nodes.slice(1).map((p,i)=>({length:Math.hypot(p.x-mountain.road.nodes[i].x,p.y-mountain.road.nodes[i].y),elevation:p.elevation,surface:'asphalt',roadWidthM:10}));
 mountain.road.tileMap={preserveCellSize:true,cellSizeM:40,minElevation:-1000,maxElevation:1000,cells:Object.fromEntries(Array.from({length:12},(_,i)=>[`${i%3-1},${Math.floor(i/3)-1}`,{tileId:'grass',elevation:10}]))};
 editor.applyLoadedRaceDocument(mountain);
 const bake=editor.buildRaceWorldBake({routeLength:185,runtimeType:'destination',validate:false});
 assert.equal(bake.terrainGenerationStats.constrainedRoadFirst,true);
 let checks=0;
 for(const s of bake.surfaceBake.sections){
  const x=s.center.x,z=s.center.z??s.center.y;
  for(const tr of getRaceBakedSurfaceTrianglesInBounds(bake.surfaceSampler,{minX:x-.001,maxX:x+.001,minZ:z-.001,maxZ:z+.001})){
   if(['road','margin','shoulder'].includes(tr.region))continue;
   const [a,b,c]=tr.vertices,d=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(d)<1e-10)continue;
   const u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/d,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/d;
   assert.ok(!(u>1e-6&&v>1e-6&&u+v<1-1e-6),'terrain triangle overlaps road interior');
  }checks++;
 }assert.ok(checks>20);
});

test('surveyed road elevations are absolute and zero-height spawn stays on the deck',()=>{
 const editor=new RaceEditor({}); const imported=structuredClone(race);
 imported.type='destination';imported.road.nodes=[{x:0,y:0,elevation:0},{x:0,y:100,elevation:1}];
 imported.road.segments=[{length:100,curve:0,elevation:1,surface:'asphalt',roadWidthM:12}];
 imported.road.tileMap={cellSizeM:40,preserveCellSize:true,minElevation:-1000,maxElevation:1000,defaultTileId:'grass',cells:{}};
 for(let z=-2;z<5;z++)for(let x=-2;x<3;x++)imported.road.tileMap.cells[`${x},${z}`]={tileId:'grass',elevation:-10};
 editor.applyLoadedRaceDocument(imported);
 const deck=editor.getRaceRoadSurfaceProfileAtDistance(0,{allowVisualExtension:true});
 assert.equal(deck.elevation,0);assert.equal(editor.getRaceStartPose().elevation,0);
 const middle=editor.getRaceRoadSurfaceProfileAtDistance(50);
 assert.ok(Math.abs(middle.elevation-.5)<.02);
 assert.equal(editor.getRaceGroundElevationAtWorldPoint({x:1000,z:1000},0),-10);
 assert.equal(editor.getRaceGroundElevationAtWorldPoint({x:-1000,z:-1000},0),-10);
 editor.preloadSelectedRaceArtRefs=()=>{};editor.prewarmRacePlaytestRenderResources=()=>{};
 editor.startPlaytest(editor.selectedCar.id,{hydrateCars:false});
 assert.ok(Math.abs(editor.playtestSession.heightM) < 1, "body settles above the zero-height road, not the terrain below it");
});

test('chase camera uses baked terrain rather than terrain removed beneath the road',()=>{
 const editor=new RaceEditor({}); delete editor.selectedRace.road.network;
 editor.playtestSession={worldBake:{surfaceSampler:{}}};
 editor.getRaceBakedSurfaceAtWorldPoint=()=>({elevation:2});
 editor.getRaceGroundElevationAtWorldPoint=()=>100;
 editor.getRaceStitchedTerrainElevationAtWorldPoint=()=>100;
 assert.equal(editor.getRaceCameraSafeTerrainElevation({x:0,z:0,elevation:3},2),2);
});

test('survey boundary extension also survives compact Playtest terrain transfer',async()=>{
 const {packRaceTileMapForRuntime}=await import('../../src/racing/RacePackedTileMap.js');
 const editor=new RaceEditor({});const imported=structuredClone(race);
 imported.road.tileMap={cellSizeM:40,preserveCellSize:true,minElevation:-1000,maxElevation:1000,defaultTileId:'grass',cells:{'0,0':{tileId:'grass',elevation:-100},'1,0':{tileId:'grass',elevation:-99}}};
 editor.applyLoadedRaceDocument(imported);
 const map=editor.ensureRaceTileMap();map.runtimePackedCells=packRaceTileMapForRuntime(map);map.cells={};
 assert.equal(editor.getRaceGroundElevationAtWorldPoint({x:-500,z:-500},0),-100);
 assert.equal(editor.getRaceGroundElevationAtWorldPoint({x:500,z:500},0),-99);
});

test('legacy road heights remain offsets while imported heights use the survey datum',async()=>{
 const {buildRaceRoadbedProfile}=await import('../../src/racing/RaceRoadDeckProfile.js');
 const options={routeLength:100,adapter:{getWorldPoseAtDistance:d=>({x:0,z:d,elevation:2}),sampleTerrain:()=>5,clampElevation:v=>v}};
 assert.equal(buildRaceRoadbedProfile(options).samples[0].elevation,7);
 assert.equal(buildRaceRoadbedProfile({...options,absoluteRouteElevation:true}).samples[0].elevation,2);
});

test('large surveyed maps retain drivable terrain immediately beside both road edges',async()=>{
 const {sampleRaceBakedSurface}=await import('../../src/racing/RaceBakedSurfaceSampler.js');
 const e=new RaceEditor({});const mountain=structuredClone(race);
 mountain.type='destination';mountain.road.nodes=[{x:0,y:0,elevation:-100},{x:0,y:100,elevation:-99.5}];
 mountain.road.segments=[{length:100,elevation:-99.5,surface:'asphalt',roadWidthM:12}];
 mountain.road.tileMap={preserveCellSize:true,cellSizeM:40,minElevation:-1000,maxElevation:1000,cells:{}};
 for(let z=-16;z<17;z++)for(let x=-16;x<17;x++)mountain.road.tileMap.cells[`${x},${z}`]={tileId:'grass',elevation:-100};
 e.applyLoadedRaceDocument(mountain);
 const bake=e.buildRaceWorldBake({routeLength:100,runtimeType:'destination',validate:false});
 for(let z=10;z<90;z+=5)for(const sign of [-1,1])for(const offset of [.05,.5,1,2,4,8]){
  const sample=sampleRaceBakedSurface(bake.surfaceSampler,{x:sign*(6.22+offset),z});
  assert.ok(sample,`missing roadside support at ${sign*(6.22+offset)},${z}`);
  if(offset===.05)assert.ok(Math.abs(sample.elevation-e.getRaceRoadSurfaceProfileAtDistance(z).elevation)*12<.15,`roadside must meet road height: x=${sign*(6.22+offset)}, z=${z}, actual=${sample.elevation}, deck=${e.getRaceRoadSurfaceProfileAtDistance(z).elevation}`);
 }
});

test('coarse imported road meshes and fine spawn extensions share one elevation solution',()=>{
 const e=new RaceEditor({});const mountain=structuredClone(race);
 mountain.type='destination';mountain.road.renderSurfaceStepM=10;
 mountain.road.nodes=[{x:0,y:0,elevation:-100},{x:0,y:6,elevation:-100.01},{x:0,y:30,elevation:-100.2},{x:0,y:100,elevation:-100.4}];
 mountain.road.segments=mountain.road.nodes.slice(1).map((p,i)=>({length:p.y-mountain.road.nodes[i].y,elevation:p.elevation,surface:'asphalt',roadWidthM:12,banking:0}));
 e.applyLoadedRaceDocument(mountain);
 const bake=e.getRaceSurfaceBake({routeLength:100,runtimeType:'destination',allowVisualExtension:true,step:10});
 assert.equal(bake.sections.length,11,'coarse mesh stays coarse');
 for(const s of bake.sections){
  const fine=e.getRaceRoadSurfaceProfileAtDistance(s.center.distance,{routeLength:100,runtimeType:'destination',allowVisualExtension:true});
  assert.ok(Math.abs(s.center.elevation-fine.elevation)<1e-8,'LOD must not change physical road heights');
 }
});

test('survey terrain retains every road boundary height break across coarse grid cells',()=>{
 const e=new RaceEditor({});
 const tileMap={cellSizeM:40,defaultTileId:'grass',cells:{'-1,0':{tileId:'grass',elevation:0},'0,0':{tileId:'grass',elevation:0}}};
 const sections=[0,1,0,2].map((elevation,i)=>({
  center:{x:0,z:i*10,distance:i*10,elevation},
  left:{x:-6,z:i*10,elevation,roadDistance:i*10},
  right:{x:6,z:i*10,elevation,roadDistance:i*10},
  metrics:{outerHalfWidth:10}
 }));
 e.getRaceGroundElevationAtWorldPoint=()=>0;
 e.getRaceRouteProjectionForWorldPoint=()=>null;
 const cells=e.buildRaceExplicitHeightmapTerrainCells({tileMap,surfaceBake:{sections},runtimeType:'destination',routeLength:30});
 for(const section of sections)for(const side of ['left','right']){
  const edge=section[side];
  assert.ok(cells.some(c=>c.points.some(p=>Math.abs(p.x-edge.x)<1e-6&&Math.abs(p.z-edge.z)<1e-6&&Math.abs(p.elevation-edge.elevation)<1e-6)),`missing boundary vertex ${side} at ${edge.z}`);
 }
});
