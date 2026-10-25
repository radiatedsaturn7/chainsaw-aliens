import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import DoodadEditor from '../../src/ui/DoodadEditor.js';
import { buildRaceFencePlacements } from '../../src/racing/RaceFences.js';
import { normalizeRaceDoodadDocument, serializeRaceDoodadDocument, getDoodadRuleForSpeed } from '../../src/racing/raceDoodads.js';
import { createRaceStaticColliderWorld } from '../../src/racing/RaceSimulation.js';
import { StaticColliderCollision } from '../../src/racing/simulation/StaticRaceColliderWorld.js';
const definition = { isFence: true, name: 'Barrier', artRef: 'Fence Art', widthM: 4, heightM: 3 };
const points = [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 5, z: 7 }];
const makeEditor = () => new RaceEditor({});

test('fence repeats continuously around corners with partial panels and survives race save/reopen', () => {
  const e = makeEditor();
  e.selectedRace.scenery = buildRaceFencePlacements(points, definition);
  const other = makeEditor();
  other.applyLoadedRaceDocument(JSON.parse(JSON.stringify(e.serializeSelectedRaceDocument())));
  assert.deepEqual(other.selectedRace.scenery, e.selectedRace.scenery);
  assert.equal(e.selectedRace.scenery.reduce((n,p) => n+p.widthM,0),12);
  const quads = other.selectedRace.scenery.map(p => other.getRaceDoodadWorldQuad(p));
  for (let i = 1; i < quads.length; i++) {
    const prev = quads[i-1].points[2], next = quads[i].points[3];
    assert.ok(Math.hypot(prev.x-next.x,prev.z-next.z)<1e-8);
    assert.ok(Math.abs((prev.u % 1)-next.u)<1e-8);
  }
  const fence = normalizeRaceDoodadDocument(serializeRaceDoodadDocument(definition));
  assert.equal(fence.isFence,true);
  assert.equal(getDoodadRuleForSpeed(fence,200).behavior,'collide');
});

test('draw fence is a single undoable stroke; group movement, rotation and deletion preserve panels', () => {
  const e=makeEditor(); e.selectedRace.scenery=[]; e.activeAction='draw-fence';
  e.raceMapBounds={x:0,y:0,w:100,h:100};
  e.getSelectedRaceDoodad=()=>definition;
  e.screenToRaceMapWorldPoint=(x,y)=>({x,y});
  assert.equal(e.beginRaceFenceDrag({x:2,y:2}),true);
  e.finishRaceFenceDrag({x:2,y:2});
  e.beginRaceFenceDrag({x:12,y:12}); e.finishRaceFenceDrag({x:12,y:12});
  assert.ok(e.selectedRace.scenery.length>1);
  e.undoRaceHistory(); assert.equal(e.selectedRace.scenery.length,0);
  e.redoRaceHistory();
  const before=structuredClone(e.selectedRace.scenery);
  e.raceSpriteDrag={id:'pointer',index:0};
  e.updateRaceSceneryDrag({x:before[0].x+7,y:before[0].z+9});
  for(let i=0;i<before.length;i++) assert.ok(Math.abs(e.selectedRace.scenery[i].x-before[i].x-7)<0.01);
  e.rotateRaceSceneryGroup(e.selectedRace.scenery[0],0);
  assert.equal(e.selectedRace.scenery.length,before.length);
  e.deleteSelectedRaceScenery(); assert.equal(e.selectedRace.scenery.length,0);
  e.undoRaceHistory(); assert.equal(e.selectedRace.scenery.length,before.length);
});

test('default plane texture persists and yields to painted tiles and painted surfaces', async () => {
  const e=makeEditor();
  await e.openRaceGroundTexture(async()=>({artRef:'Ground',repeatM:8}));
  const map=e.ensureRaceTileMap(); map.cells={'1,0':{tileId:'dirt',artRef:'Dirt Art'},'2,0':{tileId:'dirt'}};
  assert.equal(e.getRaceTileMapCell(0,0,map).artRef,'Ground');
  assert.equal(e.getRaceTileMapCell(1,0,map).artRef,'Dirt Art');
  assert.equal(e.getRaceTileMapCell(2,0,map).artRef,'');
  const other=makeEditor(); other.applyLoadedRaceDocument(JSON.parse(JSON.stringify(e.serializeSelectedRaceDocument())));
  assert.equal(other.selectedRace.groundPlaneArtRef,'Ground');
  assert.equal(other.getRaceGroundTextureBaseWorldM(),8);
});

test('fence toggle produces a roadside repeating preview', () => {
  const e=new DoodadEditor({}); e.doodad={...definition,isFence:false};
  e.getDesktopActionHandlers()['fence-toggle']();
  const preview=e.createStudioSprintPreviewScenery({getRaceRouteLength:()=>500,getRaceWorldPoseAtDistance:d=>({x:0,z:d,yaw:0})});
  assert.ok(preview.length>20); assert.ok(preview.every(p=>p.solid && p.fenceId && p.x!==0));
});

test('authored fence has thin solid boxes and stops a high speed crossing', () => {
  const e=makeEditor(); e.selectedRace.scenery=buildRaceFencePlacements([{x:-4,z:0},{x:4,z:0}],definition);
  e.sampleRaceDoodadGroundPoint=()=>({elevation:0});
  const authority={};
  const world=createRaceStaticColliderWorld(e,{authority,worldBake:{},runtimeType:'circuit',routeLength:100});
  const box=authority.staticColliderDefinitions.find(p=>p.source?.startsWith('scenery:'));
  assert.equal(box.size.z,.3); assert.ok(box.size.x>=2);
  const state={position:{x:-2,y:1,z:2},orientation:{x:0,y:0,z:0,w:1},velocity:{x:0,y:0,z:100},angularVelocityWorld:{x:0,y:0,z:0}};
  const solver=new StaticColliderCollision({candidates:[{id:'body-point',pieceId:'body',localPoint:{x:0,y:0,z:0}}]});
  solver.step({workingState:state,previousWorkingState:{...state,position:{x:-2,y:1,z:-2}},config:{massKg:1500,inertiaTensorBodyKgM2:{xx:600,xy:0,xz:0,yy:1900,yz:0,zz:2100},bodyCollisionFriction:.62,bodyCollisionSolverIterations:6,bodyCollisionToleranceM:.008},environment:{staticColliderWorld:world},dt:1/30});
  assert.ok(state.position.z<0,`crossed fence: ${state.position.z}`);
});


test('Paint exposes categories and fence node tools without a separate draw-fence button', async () => {
  const e = makeEditor(), doodad = { ...definition, isFence: false };
  e.getSelectedRaceDoodad = () => doodad;
  e.selectRacePaintCategory('fence');
  assert.deepEqual(e.getRacePaintActions().map(a=>a.label), ['Paint','Fence','Add','Art']);
  assert.ok(!e.getRacePaintActions().some(a=>a.id==='draw-fence'));
  assert.deepEqual(e.getRacePaintToolActions().map(a=>a.label), ['Add Node','Select / Move','Insert Node','Remove Node','New Fence','Delete Fence']);
  assert.equal(doodad.isFence, false);
});

test('tap-to-place extends one path through turns; nodes reshape and persist with undo', async () => {
  const e=makeEditor(); e.selectedRace.scenery=[];
  e.getSelectedRaceDoodad=()=>definition;
  e.raceMapBounds={x:0,y:0,w:500,h:500};
  e.screenToRaceMapWorldPoint=(x,y)=>({x,y});
  e.raceMapWorldToScreenPoint=p=>({screenX:p.x,screenY:p.y});
  await e.activateRaceFenceTool();
  for (const p of [{x:10,y:10},{x:100,y:10},{x:100,y:100}]) {
    e.beginRaceFenceDrag(p); e.finishRaceFenceDrag(p);
  }
  const fence=e.getEditableRaceFence();
  assert.equal(new Set(e.selectedRace.scenery.map(p=>p.fenceId)).size,1);
  assert.equal(fence.fencePath.points.length,3);
  e.activeAction='fence-select';
  assert.ok(e.beginRaceFenceNodeDrag({x:100,y:10}));
  e.updateRaceFenceNodeDrag({x:120,y:30}); e.raceFenceNodeDrag=null;
  assert.deepEqual(e.getEditableRaceFence().fencePath.points[1],{x:120,z:30});
  e.undoRaceHistory();
  assert.deepEqual(e.getEditableRaceFence().fencePath.points[1],{x:100,z:10});
  const other=makeEditor(); other.applyLoadedRaceDocument(JSON.parse(JSON.stringify(e.serializeSelectedRaceDocument())));
  assert.deepEqual(other.selectedRace.scenery.find(p=>p.fencePath).fencePath.points,fence.fencePath.points);
});

test('wide artwork follows hills through short spans without restarting texture phase', () => {
  const e=makeEditor();
  e.sampleRaceDoodadGroundPoint=(x,z)=>({x,z,elevation:Math.sin(x/4)});
  const panels=buildRaceFencePlacements([{x:0,z:0},{x:40,z:0}],{...definition,widthM:40});
  assert.ok(panels.every(p=>p.widthM<=2));
  const quads=panels.map(p=>e.getRaceDoodadWorldQuad(p));
  assert.ok(quads.some(q=>q.points[3].elevation>0.9));
  for(let i=1;i<quads.length;i++) {
    assert.ok(Math.abs(quads[i-1].points[2].elevation-quads[i].points[3].elevation)<1e-8);
    assert.ok(Math.abs(quads[i-1].points[2].u-quads[i].points[3].u)<1e-8);
  }
});

test('old panel-only fences recover editable corner points and original repeat width', () => {
  const e=makeEditor();e.selectedRace.scenery=buildRaceFencePlacements(points,definition);
  delete e.selectedRace.scenery[0].fencePath;
  e.activeRaceFenceId='fence';
  const recovered=e.getEditableRaceFence();
  assert.deepEqual(recovered.fencePath.points.map(p=>({x:Math.round(p.x)||0,z:Math.round(p.z)||0})),points);
  assert.equal(recovered.fencePath.definition.widthM,4);
});


test('pointer movement never creates fence nodes; Add and Remove are explicit', async () => {
  const e=makeEditor(); e.selectedRace.scenery=[]; e.getSelectedRaceDoodad=()=>definition;
  e.raceMapBounds={x:0,y:0,w:500,h:500}; e.screenToRaceMapWorldPoint=(x,y)=>({x,y});
  e.raceMapWorldToScreenPoint=p=>({screenX:p.x,screenY:p.y});
  await e.activateRaceFenceTool();
  for(const p of [{x:10,y:10},{x:100,y:10},{x:100,y:100}]) {
    e.beginRaceFenceDrag(p);
    for(let i=0;i<100;i++) e.updateRaceFenceDrag({x:p.x+i*.01,y:p.y});
    e.finishRaceFenceDrag(p);
  }
  assert.equal(e.getEditableRaceFence().fencePath.points.length,3);
  e.activeAction='fence-remove-node'; e.beginRaceFenceNodeDrag({x:100,y:10});
  assert.equal(e.getEditableRaceFence().fencePath.points.length,2);
  e.undoRaceHistory(); assert.equal(e.getEditableRaceFence().fencePath.points.length,3);
});

test('Art replaces every panel of the selected fence and persists through reshape, save and undo',async()=>{
 const e=makeEditor();e.selectedRace.scenery=buildRaceFencePlacements(points,definition,{id:'edited',ref:'Old'});
 const other=buildRaceFencePlacements(points,definition,{id:'untouched',ref:'Old'});
 e.selectedRace.scenery.push(...other);e.activeRaceFenceId='edited';e.activeAction='fence-select';
 const replacement={...definition,artRef:'New Art',name:'New fence',widthM:6,heightM:4};
 e.openRaceDoodadPicker=async()=>{e.activeAction='paint-sprite';return 'New';};
 e.getSelectedRaceDoodad=()=>replacement;
 await e.chooseRacePaintArt();
 assert.equal(e.activeAction,'fence-select');
 const panels=e.selectedRace.scenery.filter(p=>p.fenceId==='edited');
 assert.ok(panels.length);assert.ok(panels.every(p=>p.artRef==='New Art'&&p.previewDoodad.artRef==='New Art'&&p.doodadRef==='New'));
 assert.deepEqual(e.getEditableRaceFence().fencePath.points,points);
 assert.deepEqual(e.selectedRace.scenery.filter(p=>p.fenceId==='untouched'),other);
 const reopened=makeEditor();reopened.applyLoadedRaceDocument(JSON.parse(JSON.stringify(e.serializeSelectedRaceDocument())));
 reopened.activeRaceFenceId='edited';const path=structuredClone(reopened.getEditableRaceFence().fencePath);
 path.points[1].x+=1;reopened.rebuildRaceFence('edited',path);
 assert.ok(reopened.selectedRace.scenery.filter(p=>p.fenceId==='edited').every(p=>p.previewDoodad.artRef==='New Art'));
 e.undoRaceHistory();assert.ok(e.selectedRace.scenery.filter(p=>p.fenceId==='edited').every(p=>p.artRef==='Fence Art'));
 e.redoRaceHistory();assert.ok(e.selectedRace.scenery.filter(p=>p.fenceId==='edited').every(p=>p.artRef==='New Art'));
});

test('cancelling fence Art preserves the fence and select tool',async()=>{
 const e=makeEditor();e.selectedRace.scenery=buildRaceFencePlacements(points,definition,{id:'edited'});
 e.activeRaceFenceId='edited';e.activeAction='fence-select';const before=structuredClone(e.selectedRace.scenery);
 e.openRaceDoodadPicker=async()=>{e.activeAction='paint-sprite';return null;};
 await e.chooseRacePaintArt();assert.equal(e.activeAction,'fence-select');assert.deepEqual(e.selectedRace.scenery,before);
});

test('Insert Node splits the clicked fence segment, preserving artwork, undo and save',()=>{
 const e=makeEditor();e.selectedRace.scenery=buildRaceFencePlacements([{x:10,z:10},{x:110,z:10},{x:110,z:110}],definition,{id:'f',ref:'Barrier'});
 e.activeRaceFenceId='f';e.activeAction='fence-insert-node';e.raceMapBounds={x:0,y:0,w:500,h:500};
 e.raceMapWorldToScreenPoint=p=>({screenX:p.x,screenY:p.z});
 assert.equal(e.getRacePaintCategory(),'fence');
 assert.equal(e.insertRaceFenceNode({x:60,y:14}),true);
 assert.deepEqual(e.getEditableRaceFence().fencePath.points,[{x:10,z:10},{x:60,z:10},{x:110,z:10},{x:110,z:110}]);
 assert.ok(e.selectedRace.scenery.every(p=>p.artRef==='Fence Art'));
 e.insertRaceFenceNode({x:60,y:10});assert.equal(e.getEditableRaceFence().fencePath.points.length,4);
 e.insertRaceFenceNode({x:300,y:300});assert.equal(e.getEditableRaceFence().fencePath.points.length,4);
 e.undoRaceHistory();assert.equal(e.getEditableRaceFence().fencePath.points.length,3);
 e.redoRaceHistory();assert.equal(e.getEditableRaceFence().fencePath.points.length,4);
 const other=makeEditor();other.applyLoadedRaceDocument(JSON.parse(JSON.stringify(e.serializeSelectedRaceDocument())));
 other.activeRaceFenceId='f';assert.deepEqual(other.getEditableRaceFence().fencePath,e.getEditableRaceFence().fencePath);
});

test('map zoom reaches 20x and panning can reach the enlarged track',()=>{
 const e=makeEditor();e.raceMapZoomSliderBounds={x:10,w:200};e.raceMapBounds={x:0,y:0,w:960,h:540};
 e.updateRaceMapZoomFromSliderX(210);assert.equal(e.raceMapZoom,20);assert.equal(e.getRaceMapZoomRatio(),1);
 assert.equal(e.getRaceMapTransform(e.raceMapBounds).zoom,20);
 e.panRaceMapBy(5000,-5000);assert.equal(e.raceMapPan.x,5000);assert.equal(e.raceMapPan.y,-5000);
 e.updateRaceMapZoomFromSliderX(10);assert.equal(e.raceMapZoom,.5);assert.equal(e.getRaceMapZoomRatio(),0);
});
