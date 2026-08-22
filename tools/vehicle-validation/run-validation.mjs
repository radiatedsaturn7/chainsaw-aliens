import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import VehicleValidationHarness from './VehicleValidationHarness.mjs';
import { validateAllTireCompoundCycles } from './TireCompoundValidation.mjs';
import {
  TRACE_ENVELOPE_TOLERANCES,
  TIRE_COMPOUND_VALIDATION_PROFILES,
  VEHICLE_VALIDATION_CASES,
  VEHICLE_VALIDATION_VERSION,
  VEHICLE_VALIDATION_VEHICLES
} from './validationCatalog.mjs';

function valuesWithinEnvelope(actual, expected, tolerance) {
  if (typeof expected === 'number') {
    const difference = Math.abs(Number(actual) - expected);
    return Number.isFinite(Number(actual)) && difference <= Math.max(
      Number(tolerance?.absolute || 0), Math.abs(expected) * Number(tolerance?.relative || 0)
    );
  }
  if (!expected || typeof expected !== 'object') return actual === expected;
  return Object.keys(expected).every((key) => valuesWithinEnvelope(
    actual?.[key], expected[key], tolerance
  ));
}

function compareTraceEnvelope(actual = [], expected = []) {
  if (actual.length !== expected.length) return { pass: false, reason: 'sample-count' };
  for (let index = 0; index < expected.length; index += 1) {
    for (const [field, tolerance] of Object.entries(TRACE_ENVELOPE_TOLERANCES)) {
      if (!valuesWithinEnvelope(actual[index]?.[field], expected[index]?.[field], tolerance)) {
        return { pass: false, reason: `${field}@${index}` };
      }
    }
  }
  return { pass: true, reason: null };
}

function traceOverlaySvg(result, prior) {
  const width = 900;
  const height = 320;
  const traces = [result.trace, prior?.trace].filter(Boolean);
  const maximumTime = Math.max(0.001, ...traces.flatMap((trace) => trace.map((sample) => sample.timeSeconds)));
  const maximumSpeed = Math.max(1, ...traces.flatMap((trace) => trace.map((sample) => sample.speedMps)));
  const path = (trace) => trace.map((sample, index) => {
    const x = 40 + Number(sample.timeSeconds || 0) / maximumTime * (width - 60);
    const y = height - 30 - Number(sample.speedMps || 0) / maximumSpeed * (height - 60);
    return `${index ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="100%" height="100%" fill="#111827"/><path d="M40 20V${height - 30}H${width - 20}" fill="none" stroke="#64748b"/>
${prior ? `<path d="${path(prior.trace)}" fill="none" stroke="#94a3b8" stroke-width="2"/>` : ''}
<path d="${path(result.trace)}" fill="none" stroke="#22d3ee" stroke-width="2"/>
<text x="48" y="38" fill="#e2e8f0" font-family="sans-serif" font-size="14">speed vs time — cyan current${prior ? ', grey reference' : ''}</text>
</svg>\n`;
}

const args = new Map(process.argv.slice(2).map((argument) => {
  const [key, ...value] = argument.replace(/^--/, '').split('=');
  return [key, value.join('=') || true];
}));
const vehicleKeys = args.get('vehicle') === 'all'
  ? Object.keys(VEHICLE_VALIDATION_VEHICLES)
  : String(args.get('vehicle') || 'wrx-manual').split(',');
const cases = args.get('case') === 'all' || !args.has('case')
  ? VEHICLE_VALIDATION_CASES
  : String(args.get('case')).split(',');
const aidsModes = args.get('aids') === 'both' || !args.has('aids')
  ? [true, false] : [String(args.get('aids')) !== 'off'];
const reportPath = resolve(String(args.get('report') || 'artifacts/vehicle-validation/report.json'));
const referencePath = args.get('reference') ? resolve(String(args.get('reference'))) : null;
const updateReference = args.get('update-reference') === true;
const enforce = args.get('enforce') === true;

const harness = new VehicleValidationHarness();
const results = [];
for (const vehicleKey of vehicleKeys) {
  for (const caseName of cases) {
    for (const aidsEnabled of aidsModes) {
      process.stdout.write(`validate ${vehicleKey} ${caseName} aids=${aidsEnabled ? 'on' : 'off'}\n`);
      results.push(await harness.runCase({ vehicleKey, caseName, aidsEnabled }));
    }
  }
}

let reference = null;
if (referencePath && !updateReference) {
  try { reference = JSON.parse(await readFile(referencePath, 'utf8')); } catch { reference = null; }
}
const referenceByKey = new Map((reference?.results || []).map((result) => [
  `${result.vehicleKey}:${result.caseName}:${result.aidsEnabled}`, result
]));
for (const result of results) {
  const prior = referenceByKey.get(`${result.vehicleKey}:${result.caseName}:${result.aidsEnabled}`);
  result.referenceTraceChecksum = prior?.traceChecksum || null;
  const envelope = prior ? compareTraceEnvelope(result.trace, prior.trace) : null;
  result.referenceStatus = !prior ? 'missing-baseline'
    : prior.traceChecksum === result.traceChecksum ? 'exact'
      : envelope.pass ? 'within-envelope' : `outside-envelope:${envelope.reason}`;
}
const report = {
  calibrationVersion: VEHICLE_VALIDATION_VERSION,
  generatedAt: new Date().toISOString(),
  platform: `${process.platform}-${process.arch}`,
  node: process.version,
  tireCompoundProfiles: TIRE_COMPOUND_VALIDATION_PROFILES,
  tireCompoundCycles: validateAllTireCompoundCycles(),
  results,
  summary: {
    pass: results.reduce((count, result) => count + Object.values(result.checks)
      .filter((check) => check.status === 'pass').length, 0),
    fail: results.reduce((count, result) => count + Object.values(result.checks)
      .filter((check) => check.status === 'fail').length, 0),
    baselineOnly: results.reduce((count, result) => count + Object.values(result.checks)
      .filter((check) => check.status === 'baseline-only').length, 0),
    recoveries: results.reduce((sum, result) => sum + result.recoveryCount, 0),
    growingBacklogCases: results.filter((result) => result.backlogSteps > 0).length
  },
  knownDiscrepancies: results.flatMap((result) => Object.entries(result.checks)
    .filter(([, check]) => check.status === 'fail')
    .map(([metric, check]) => ({ vehicleKey: result.vehicleKey, caseName: result.caseName,
      aidsEnabled: result.aidsEnabled, metric, measured: result.values[metric], target: check.acceptance })))
};
await mkdir(dirname(reportPath), { recursive: true });
const markdownPath = reportPath.replace(/\.json$/i, '.md');
const overlayDirectory = resolve(dirname(reportPath), 'trace-overlays');
await mkdir(overlayDirectory, { recursive: true });
for (const result of results) {
  const key = `${result.vehicleKey}-${result.caseName}-aids-${result.aidsEnabled ? 'on' : 'off'}`;
  const prior = referenceByKey.get(`${result.vehicleKey}:${result.caseName}:${result.aidsEnabled}`);
  result.traceOverlay = `trace-overlays/${key}.svg`;
  await writeFile(resolve(overlayDirectory, `${key}.svg`), traceOverlaySvg(result, prior));
}
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const lines = [
  `# Vehicle Dynamics Validation — ${VEHICLE_VALIDATION_VERSION}`,
  '', `Generated: ${report.generatedAt}`, '',
  `Pass: ${report.summary.pass}  Fail: ${report.summary.fail}  Baseline-only: ${report.summary.baselineOnly}`,
  '', '| Vehicle | Case | Aids | Status | Measurements | Trace |',
  '|---|---|---:|---|---|---|'
];
for (const result of results) {
  const statuses = Object.values(result.checks).map((check) => check.status);
  const status = statuses.includes('fail') ? 'FAIL' : statuses.includes('pass') ? 'PASS' : 'BASELINE';
  const measurements = Object.entries(result.values).filter(([, value]) => value !== null)
    .map(([name, value]) => `${name}=${Number(value).toFixed(3)}`).join('<br>');
  lines.push(`| ${result.vehicle.label} | ${result.caseName} | ${result.aidsEnabled ? 'on' : 'off'} | ${status} | ${measurements} | [${result.traceChecksum.slice(0, 12)}](${result.traceOverlay}) |`);
}
lines.push('', '## Tire compound lifecycle', '',
  '| Compound | Heating | Peak | Degradation | Cooling | Pressure cycle |',
  '|---|---:|---:|---:|---:|---:|');
for (const cycle of report.tireCompoundCycles) {
  lines.push(`| ${cycle.name} | ${cycle.checks.heating ? 'pass' : 'fail'} | ${cycle.checks.peakPerformance ? 'pass' : 'fail'} | ${cycle.checks.degradation ? 'pass' : 'fail'} | ${cycle.checks.cooling ? 'pass' : 'fail'} | ${cycle.checks.pressureCycle ? 'pass' : 'fail'} |`);
}
lines.push('', '## Known discrepancies', '', ...(report.knownDiscrepancies.length
  ? report.knownDiscrepancies.map((entry) => entry.target
    ? `- ${entry.vehicleKey}/${entry.caseName}: ${entry.metric} measured ${entry.measured}; target ${entry.target.range.join('–')} ${entry.target.unit}.`
    : `- ${entry.vehicleKey}/${entry.caseName}: required ${entry.metric} was not measured.`)
  : ['- None.']));
await writeFile(markdownPath, `${lines.join('\n')}\n`);
if (referencePath && updateReference) {
  await mkdir(dirname(referencePath), { recursive: true });
  await writeFile(referencePath, `${JSON.stringify(report, null, 2)}\n`);
}
process.stdout.write(`${markdownPath}\n`);
const outsideReferenceEnvelope = results.some((result) =>
  String(result.referenceStatus).startsWith('outside-envelope'));
const missingReference = results.some((result) => result.referenceStatus === 'missing-baseline');
const missingRequiredMeasurement = results.some((result) => Object.entries(result.checks)
  .some(([name, check]) => check.status === 'fail'
    && !Number.isFinite(Number(result.values[name]))));
const compoundFailure = report.tireCompoundCycles.some((cycle) =>
  Object.values(cycle.checks).some((pass) => !pass));
if (report.summary.recoveries > 0 || report.summary.growingBacklogCases > 0
  || (enforce && (!referencePath || missingReference || missingRequiredMeasurement
    || report.summary.fail > 0 || outsideReferenceEnvelope || compoundFailure))) {
  process.exitCode = 1;
}
