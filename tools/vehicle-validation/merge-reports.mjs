import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = new Map(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.replace(/^--/, '').split('=');
  return [key, value.join('=') || true];
}));
const input = resolve(String(args.get('input') || 'artifacts/vehicle-validation'));
const output = resolve(String(args.get('output') || 'artifacts/vehicle-validation-report.md'));

async function jsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return jsonFiles(path);
    return entry.name.endsWith('.json') ? [path] : [];
  }));
  return nested.flat();
}

const reports = [];
for (const path of await jsonFiles(input)) {
  try { reports.push({ path, data: JSON.parse(await readFile(path, 'utf8')) }); } catch { /* artifact may be partial */ }
}
const vehicleResults = reports.flatMap(({ data }) => Array.isArray(data.results) ? data.results : []);
const performance = reports.filter(({ data }) => Array.isArray(data.runs)
  && String(data.fixture || '').includes('Studio Sprint2'));
const lines = [
  '# Vehicle Dynamics Required-Gate Report', '',
  `Generated: ${new Date().toISOString()}`, '',
  'This report is authoritative only when attached to a successful `Vehicle dynamics required gate` GitHub check.', '',
  '## Vehicle acceptance and parity', '',
  '| Vehicle | Case | Aids | Acceptance | Reference parity | Determinism |',
  '|---|---|---:|---|---|---|'
];
for (const result of vehicleResults) {
  const statuses = Object.values(result.checks || {}).map((check) => check.status);
  const acceptance = statuses.includes('fail') ? 'FAIL' : statuses.includes('pass') ? 'PASS' : 'BASELINE';
  lines.push(`| ${result.vehicle?.label || result.vehicleKey} | ${result.caseName} | ${result.aidsEnabled ? 'on' : 'off'} | ${acceptance} | ${result.referenceStatus || 'missing-baseline'} | ${(result.determinismChecksum || '').slice(0, 16)} |`);
}
lines.push('', '## Studio Sprint 2 performance', '',
  '| Authority | Mode | FPS | p50 ms | p95 ms | p99 ms | Backlog | Recoveries |',
  '|---|---|---:|---:|---:|---:|---:|---:|');
for (const { data } of performance) {
  for (const sample of data.runs) {
    const metrics = sample.physicsUpdateMs || {};
    lines.push(`| ${data.environment?.referenceMachineId || 'desktop-reference'} | ${data.settings?.physicsSurfaceDebug ? 'Physics Surface' : 'normal'} | ${sample.fps} | ${Number(metrics.p50 || 0).toFixed(3)} | ${Number(metrics.p95 || 0).toFixed(3)} | ${Number(metrics.p99 || 0).toFixed(3)} | ${sample.peakBacklogSteps ?? 'n/a'} | ${sample.recovery?.count ?? 'n/a'} |`);
  }
}
const discrepancies = vehicleResults.flatMap((result) => Object.entries(result.checks || {})
  .filter(([, check]) => check.status === 'fail')
  .map(([metric]) => `${result.vehicleKey}/${result.caseName}/${metric}`));
lines.push('', '## Known discrepancies', '', ...(discrepancies.length
  ? discrepancies.map((entry) => `- ${entry}`)
  : ['- None reported by completed artifacts.']), '',
  '## External performance authority', '',
  '- Target Android normal and Physics Surface measurements must be attached separately; GitHub-hosted desktop data does not claim Android authority.',
  '- Full-matrix status comes from the visible sharded workflow jobs, not from this report file alone.');
await writeFile(output, `${lines.join('\n')}\n`);
process.stdout.write(`${output}\n`);
