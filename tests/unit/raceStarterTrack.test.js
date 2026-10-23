import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createNewRaceProject,createBranchingExampleRace} from '../../src/racing/RaceExample.js';
import {networkEditorActions,handleNetworkAction} from '../../src/ui/RaceNetworkEditor.js';

test('startup and File New have a straight start-only race; demo factory remains complete',()=>{
 const editor=new RaceEditor({}),race=editor.selectedRace;
 assert.equal(race.name,'New Race');assert.equal(editor.project.races.length,1);
 assert.equal(race.road.network.startNodeId,'start');assert.equal(race.road.network.finishNodeId,'');
 assert.equal(race.road.network.nodes.length,2);assert.equal(race.road.network.edges.length,1);
 assert.equal(race.scenery.length,0);assert.equal(race.waterRegions.length,0);assert.deepEqual(race.road.tileMap.cells,{});
 race.road.network.nodes[0].x=999;assert.equal(createNewRaceProject().races[0].road.network.nodes[0].x,0);
 assert.equal(createBranchingExampleRace().road.network.finishNodeId,'finish');
});

test('Track stays first in portrait; Add drawer contains Select, Add and Delete',async()=>{
 const editor=new RaceEditor({});editor.activeViewportMode='portrait';
 const actions=networkEditorActions(editor,true);assert.deepEqual(actions.map(a=>a.label),['Track','Add','Edit','Select 2']);
 actions[0].onClick();assert.equal(editor.racePortraitHotMenu,'ground-mode');
 assert.ok(editor.getRacePortraitTrackPopupActions().some(a=>a.label==='Ground'));
 actions[1].onClick();const drawer=editor.getRacePortraitTrackPopupActions();
 for(const id of ['network-select','network-add','network-delete'])assert.ok(drawer.some(a=>a.id===id));
 await handleNetworkAction(editor,'network-add');assert.equal(networkEditorActions(editor,true)[0].label,'Track');
 await handleNetworkAction(editor,'network-select');assert.equal(networkEditorActions(editor,true)[0].label,'Track');
});

test('Delete removes the selected node and connected road; Undo restores both',async()=>{
 const editor=new RaceEditor({});editor.networkNodeId='end';editor.networkEdgeId='';
 await handleNetworkAction(editor,'network-delete');
 assert.deepEqual(editor.selectedRace.road.network.nodes.map(n=>n.id),['start']);assert.equal(editor.selectedRace.road.network.edges.length,0);
 editor.undoRaceHistory();assert.equal(editor.selectedRace.road.network.nodes.length,2);assert.equal(editor.selectedRace.road.network.edges.length,1);
 editor.networkNodeId='start';await assert.rejects(handleNetworkAction(editor,'network-delete'),/marker/);
});
