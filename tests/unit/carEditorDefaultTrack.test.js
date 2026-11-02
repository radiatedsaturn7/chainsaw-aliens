import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createDefaultRace,extendCarEditorDefaultTrack} from '../../src/racing/raceData.js';
import {saveProjectFile,resetProjectFilesForTests} from '../../src/ui/projectFiles.js';
test('Car Editor default is ten times longer and reloads do not grow it again',()=>{
 resetProjectFilesForTests();const e=new RaceEditor({},{mode:'car'});
 assert.equal(e.getRaceRouteLength(),7400);assert.equal(e.getCarEditorPreviewRace(),e.selectedRace);
 extendCarEditorDefaultTrack(e.selectedRace);assert.equal(e.getRaceRouteLength(),7400);
 const race=createDefaultRace();saveProjectFile('races','Studio Sprint',{race},{createVersion:false});
 assert.equal(e.getCarEditorPreviewRace().road.segments.reduce((n,s)=>n+s.length,0),7400);
 assert.equal(e.getCarEditorPreviewRace().road.segments.reduce((n,s)=>n+s.length,0),7400);
 assert.equal(race.road.segments.reduce((n,s)=>n+s.length,0),740);
 resetProjectFilesForTests();
});
test('authored routes and Race Editor blank defaults stay unchanged',()=>{
 const race=createDefaultRace();race.road.nodes.push({x:0,y:50});const before=JSON.stringify(race);extendCarEditorDefaultTrack(race);assert.equal(JSON.stringify(race),before);
 const e=new RaceEditor({},{mode:'race'});assert.equal(e.selectedRace.road.nodes.length,1);assert.equal(e.selectedRace.road.segments.length,0);
});
