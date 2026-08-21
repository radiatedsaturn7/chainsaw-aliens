import { spawnSync } from 'node:child_process';

const mode = process.argv[2];
const smokeScenarios = [
  'straight-line acceleration',
  'step steer',
  'emergency braking',
  'curb strike',
  'airborne landing'
];
const fullScenarios = [
  'wrx gt physical suspension launch', 'straight-line acceleration', 'coast-down',
  'constant-speed cruising', 'skidpad constant-radius steering', 'step steer',
  'emergency braking', 'split-grip acceleration', 'split-grip braking', 'curb strike',
  'airborne motion and landing', 'reverse driving', 'render hitch recovery',
  'collision impulse', 'rollover', 'countersteer recovery'
];
const allSpecs = mode === 'smoke'
  ? smokeScenarios.map((name) => ({ file: 'tests/heavy/vehicleDynamicsSmoke.test.js', name: `replay smoke: ${name}` }))
  : fullScenarios.flatMap((name) => ['full determinism', 'full replay'].map((kind) => ({
      file: 'tests/heavy/vehicleDynamicsDeterminism.full.test.js', name: `${kind}: ${name}`
    })));

const shardTotal = Math.max(1, Math.trunc(Number(
  process.env.VEHICLE_DYNAMICS_SHARD_TOTAL || 1
)));
const shardIndex = Math.trunc(Number(process.env.VEHICLE_DYNAMICS_SHARD_INDEX || 0));
if (shardIndex < 0 || shardIndex >= shardTotal) {
  throw new Error(`Invalid vehicle dynamics shard ${shardIndex}/${shardTotal}`);
}
const specs = allSpecs.filter((_spec, index) => index % shardTotal === shardIndex);

if (!['smoke', 'full'].includes(mode)) throw new Error(`Unknown vehicle dynamics test mode: ${mode}`);
if (mode === 'full' && process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('The full vehicle dynamics matrix is restricted to GitHub Actions.');
}

if (mode === 'full') {
  console.log(`Vehicle dynamics full shard ${shardIndex + 1}/${shardTotal}: ${specs.length} exact tests`);
}

for (const spec of specs) {
  const result = spawnSync(process.execPath, [
    '--test', '--test-concurrency=1', `--test-name-pattern=^${spec.name}$`, spec.file
  ], {
    env: { ...process.env, ...(mode === 'full' ? { FULL_PHYSICS_MATRIX: '1' } : {}) },
    stdio: 'inherit'
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
