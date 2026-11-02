import test from 'node:test';
import assert from 'node:assert/strict';
import { recordRaceRecoveryPosition, getRaceRecoveryHistoryCandidates,
  getRaceRecoveryHistoryDiagnostics, clearRaceRecoveryHistory } from '../../src/racing/RaceRecoveryHistory.js';

test('history diagnostics distinguish rejected recording from traffic-blocked safe poses', () => {
  const session = {};
  const state = { position:{x:0,y:.55,z:0}, orientation:{x:0,y:0,z:0,w:1},
    grounded:true, supportedWheelCount:4, contactPatches:{} };
  const editor = {getRaceSurfaceModel:()=>({samplePhysicsGeometry:()=>({valid:true,region:'road',heightM:0})}),
    getRaceRouteProjectionForWorldPoint:()=>({distance:0,edgeId:'road',x:0,z:0,yaw:0,heightM:0})};
  recordRaceRecoveryPosition(editor,session,state,1,.25);
  assert.equal(getRaceRecoveryHistoryDiagnostics(session).lastRejection,'invalid-contact');
  for (const id of ['fl','fr','rl','rr']) state.contactPatches[id] = {
    validTreadContact:true,normalLoadN:1000,contactPointWorld:{x:0,y:0,z:0}};
  recordRaceRecoveryPosition(editor,session,state,1,.25);
  session.aiRuntime=[{worldX:0,worldZ:0}];
  assert.equal(getRaceRecoveryHistoryCandidates(session).length,0);
  const blocked=getRaceRecoveryHistoryDiagnostics(session);
  assert.equal(blocked.accepted,1);
  assert.equal(blocked.selection.traffic,1);
  session.aiRuntime=[];
  assert.equal(getRaceRecoveryHistoryCandidates(session).length,1);
  assert.equal(getRaceRecoveryHistoryDiagnostics(session).selection.selected,1);
  assert.equal(blocked.selection.selected,0,'captured diagnostics are immutable snapshots');
  clearRaceRecoveryHistory(session);
  assert.equal(getRaceRecoveryHistoryDiagnostics(session),null);
});
