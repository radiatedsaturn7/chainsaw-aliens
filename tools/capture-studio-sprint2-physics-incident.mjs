import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import RaceEditor from '../src/ui/RaceEditor.js';
import { hashTrackStateValue } from '../src/racing/trackState/TrackStateMath.js';

const racePath = process.argv[2]
  || 'data/server-storage/files/races/Studio Sprint2/document.json';
const carPath = process.argv[3]
  || 'data/server-storage/files/cars/2022 Subaru WRX2/document.json';
const outputPath = process.argv[4]
  || join(tmpdir(), 'studio-sprint2-hill-incident.json');

function decodeDocument(path) {
  const bytes = readFileSync(path);
  const envelope = JSON.parse(bytes.toString('utf8'));
  const document = envelope?.__chainsawStorage === 'compact-v1'
    ? JSON.parse(gunzipSync(Buffer.from(envelope.data, 'base64')).toString('utf8'))
    : envelope;
  return {
    bytes,
    document,
    sha256: createHash('sha256').update(bytes).digest('hex')
  };
}

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const normalizeAngle = (value) => Math.atan2(Math.sin(value), Math.cos(value));
const raceSource = decodeDocument(racePath);
const carSource = decodeDocument(carPath);
globalThis.__RTG_CAPTURE_PHYSICS_INCIDENTS__ = true;
const editor = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} });

if (!editor.applyLoadedRaceDocument(raceSource.document, { name: 'Studio Sprint2' })) {
  throw new Error('Studio Sprint2 race document could not be loaded');
}
if (!editor.applyLoadedCarDocument(carSource.document, { name: '2022 Subaru WRX2' })) {
  throw new Error('WRX2 car document could not be loaded');
}

const worldBake = editor.buildRaceWorldBake({ retainTerrainCells: false });
editor.startPlaytest(editor.getRaceCarProjectIdentity(editor.selectedCar), {
  hydrateCars: false,
  preparedWorldBake: worldBake
});
editor.playtestSession.countdownRemainingMs = 0;
editor.playtestSession.startupFramePending = false;
editor.applyRaceCarRouteCenterReset({ projection: { distance: 450 }, preserveMotion: false });
Object.assign(editor.playtestSession, {
  speedMps: 0,
  velocityYaw: editor.playtestSession.carYaw,
  gear: 3,
  engineRpm: 900
});

let fixture = null;
let leadInFrames = null;
for (let frame = 0; frame < 900 && editor.playtestSession; frame += 1) {
  // Keep a genuine two-second safe lead-in, then initialize the authoritative
  // runner at the serialized failure location exactly as a runtime recovery
  // does. The automatically triggered recorder receives the preceding ring.
  if (frame === 120) {
    leadInFrames = [...editor.playtestSession.vehicleDynamicsRunner.physicsIncidentRecorder.ring];
    editor.endPlaytest();
    editor.startPlaytest(editor.getRaceCarProjectIdentity(editor.selectedCar), {
      hydrateCars: false,
      preparedWorldBake: worldBake
    });
    editor.playtestSession.countdownRemainingMs = 0;
    editor.playtestSession.startupFramePending = false;
    editor.applyRaceCarRouteCenterReset({ projection: { distance: 500 }, preserveMotion: false });
  }
  const session = editor.playtestSession;
  const projection = editor.getRaceRouteProjectionForWorldPoint({
    x: session.worldX,
    z: session.worldZ
  });
  const distance = Number(projection?.distance ?? session.distance ?? 0);
  const target = editor.getRaceWorldPoseAtDistance(
    distance + clamp(Math.abs(Number(session.speedMps || 0)) * 1.5 + 20, 20, 55)
  );
  const near = editor.getRaceWorldPoseAtDistance(distance + 6);
  const targetYaw = normalizeAngle(
    Number(near.yaw || 0)
      + normalizeAngle(Number(target.yaw || 0) - Number(near.yaw || 0)) * 0.6
  );
  const yawError = normalizeAngle(targetYaw - Number(session.carYaw || 0));
  const lateral = clamp(
    Number(projection?.lateral || 0) / Math.max(1, editor.getRaceRoadHalfWidthWorld()),
    -1.5,
    1.5
  );
  editor.raceInput.keyboardThrottle = frame >= 120;
  editor.raceInput.keyboardBrake = false;
  editor.raceInput.rawThrottleAxis = frame >= 120 ? 0.35 : 0;
  editor.raceInput.rawBrakeAxis = 0;
  editor.raceInput.analogSteeringActive = true;
  editor.raceInput.analogSteeringIntent = clamp(yawError * 3.6 - lateral * 0.9, -1, 1);
  editor.raceInput.syntheticAnalogSteering = true;
  editor.raceInput.gear = 3;
  editor.raceInput.autoShift = false;
  editor.raceInput.paused = false;
  if (!editor.updatePlaytestSafely(1 / 60)) throw new Error(`Race update failed at frame ${frame}`);

  const recorder = editor.playtestSession.vehicleDynamicsRunner.physicsIncidentRecorder;
  if (frame === 120 && recorder.active && leadInFrames?.length) {
    recorder.active.frames.unshift(...leadInFrames);
  }
  recorder.configureMetadata({ sourceDocumentChecksum: raceSource.sha256 });
  fixture = recorder.completed[0] || null;
  if (frame % 60 === 59) {
    process.stderr.write(`capture frame=${frame + 1} distance=${Number(editor.playtestSession.distance || 0).toFixed(2)} speed=${Number(editor.playtestSession.speedMps || 0).toFixed(2)} active=${recorder.active ? 'yes' : 'no'}\n`);
  }
  if (fixture) break;
}

if (!fixture) throw new Error('Studio Sprint2 hill incident was not reproduced within 15 seconds');
fixture.sourceCarDocumentChecksum = carSource.sha256;
fixture.capture = {
  raceDocumentName: 'Studio Sprint2',
  carDocumentName: '2022 Subaru WRX2',
  preparedTriangleCount: worldBake.surfaceSampler?.triangleCount || 0,
  elevationScaleM: 12,
  renderFps: 60,
  completeAuthoritativeSolver: true,
  tireSubsystem: 'ContactPatchTireModel'
};
delete fixture.fixtureChecksum;
fixture.fixtureChecksum = hashTrackStateValue(JSON.stringify(fixture));
writeFileSync(outputPath, JSON.stringify(fixture));

process.stdout.write(`${JSON.stringify({
  outputPath,
  bytes: statSync(outputPath).size,
  frames: fixture.frames.length,
  durationSeconds: fixture.durationSeconds,
  triangles: fixture.preparedWorldTriangles.length,
  trigger: fixture.trigger,
  sourceDocumentChecksum: fixture.sourceDocumentChecksum,
  replayChecksum: fixture.replayChecksum
}, null, 2)}\n`);
