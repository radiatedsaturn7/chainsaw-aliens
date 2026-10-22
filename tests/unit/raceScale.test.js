import test from 'node:test';
import assert from 'node:assert/strict';
import {scaleRace} from '../../src/racing/RaceScale.js';
import {packRaceTileMapForRuntime} from '../../src/racing/RacePackedTileMap.js';
const fixture=()=>({id:'race',road:{nodes:[{x:-10,y:20,elevation:.2,role:'start'},{x:40,y:60,role:'finish'}],segments:[{length:50,curve:.2,roadWidthM:8}],tileMap:{cellSizeM:5,cells:{'-1,0':{tileId:'sand',artRef:'art',elevation:.2}},revision:1},network:{nodes:[{x:2,z:3,heightM:1}],edges:[{widthM:8,points:[{x:4,z:5,heightM:2}]}]}},scenery:[{x:10,z:5,widthM:2,heightM:3,trackDistance:50}],decals:[{x:5,z:10,widthM:10,heightM:20}],waterRegions:[{x:10,z:20,widthM:40,lengthM:50,levelM:0,bottomM:-1}],triggers:[{x:5,z:10,radiusM:3,action:{params:{offsetX:2,durationMs:100}}}],hazards:[{at:50,lane:1}],codriver:{calls:[{at:30,text:'Left'}]},finishBehavior:{spawnX:20,spawnY:50}});
test('scales layout together without changing physical sizes, directions or external destinations',()=>{
 const race=fixture(),before=JSON.stringify(race),r=scaleRace(race,2);
 assert.equal(JSON.stringify(race),before);assert.deepEqual(r.road.nodes[0],{x:-20,y:40,elevation:.2,role:'start'});
 assert.equal(r.road.segments[0].length,100);assert.equal(r.road.segments[0].curve,.2);assert.equal(r.road.segments[0].roadWidthM,8);
 assert.equal(r.scenery[0].x,20);assert.equal(r.scenery[0].widthM,2);assert.equal(r.scenery[0].trackDistance,100);
 assert.equal(r.decals[0].widthM,20);assert.equal(r.waterRegions[0].lengthM,100);assert.equal(r.waterRegions[0].bottomM,-1);
 assert.equal(r.triggers[0].radiusM,6);assert.equal(r.triggers[0].action.params.offsetX,4);assert.equal(r.triggers[0].action.params.durationMs,100);
 assert.equal(r.hazards[0].at,100);assert.equal(r.hazards[0].lane,1);assert.equal(r.codriver.calls[0].at,60);assert.deepEqual(r.finishBehavior,race.finishBehavior);
 assert.equal(Object.keys(r.road.tileMap.cells).length,4);assert.equal(r.road.tileMap.cells['-2,1'].artRef,'art');assert.equal(r.road.tileMap.cellSizeM,5);
});
test('optional physical sizes and elevations scale, including packed terrain with edited overrides',()=>{
 const race=fixture(),map=race.road.tileMap;map.runtimePackedCells=packRaceTileMapForRuntime(map);map.cells={'-1,0':{tileId:'asphalt',elevation:.3}};
 const r=scaleRace(race,2,{sizes:true,elevations:true});assert.equal(r.scenery[0].widthM,4);assert.equal(r.road.nodes[0].elevation,.4);assert.equal(r.road.network.edges[0].points[0].heightM,4);
 assert.equal(r.road.tileMap.cells['-1,0'].elevation,.6);assert.equal(r.road.tileMap.cells['-1,0'].tileId,'asphalt');assert.equal(r.road.tileMap.runtimePackedCells,undefined);
});
test('shrinking terrain uses inverse center sampling, invalid scales do not mutate race',()=>{
 const race=fixture();race.road.tileMap.cells={'0,0':{tileId:'grass'},'1,1':{tileId:'sand'}};
 assert.deepEqual(scaleRace(race,.5).road.tileMap.cells,{'0,0':{tileId:'sand'}});
 const before=JSON.stringify(race);for(const factor of [NaN,0,-1,11])assert.throws(()=>scaleRace(race,factor));
 assert.throws(()=>scaleRace(race,4,{sizes:true}),/width/);assert.equal(JSON.stringify(race),before);
});
test('editor Scale command supports cancellation, undo, redo, and saved document reload',async()=>{
 const {default:RaceEditor}=await import('../../src/ui/RaceEditor.js');const editor=new RaceEditor({});
 const race=fixture(),map=race.road.tileMap;Object.defineProperty(map,'runtimePackedCells',{value:packRaceTileMapForRuntime(map),configurable:true});map.cells={};
 editor.applyLoadedRaceDocument(race,{normalized:true,name:'Scale test'});
 await editor.openRaceScale(async()=>null);assert.equal(editor.selectedRace.road.nodes[0].x,-10);
 await editor.openRaceScale(async()=>({percent:200,sizes:false,elevations:false}));assert.equal(editor.selectedRace.road.nodes[0].x,-20);
 editor.undoRaceHistory();assert.equal(editor.selectedRace.road.nodes[0].x,-10);assert.equal(editor.selectedRace.road.tileMap.cells['-1,0'].tileId,'sand');
 editor.redoRaceHistory();assert.equal(editor.selectedRace.road.nodes[0].x,-20);
 const loaded=editor.normalizeLoadedRaceDocument(editor.serializeSelectedRaceDocument());assert.equal(loaded.road.nodes[0].x,-20);
});
