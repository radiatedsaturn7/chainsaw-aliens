export default class GoldenPathTest {
  constructor(runner) {
    this.runner = runner;
  }

  start(game) {
    if (!this.runner.data) {
      return { status: 'fail', lines: ['✗ Golden path data missing.', '  Fix: verify src/content/criticalPath.json.'] };
    }
    this.runner.start(game);
    return { status: 'running', lines: ['… Golden path simulation running.'] };
  }

  buildReport(game) {
    if (this.runner.status === 'pass') {
      return { status: 'pass', lines: ['✓ Golden path completed.', '✓ Mission victory reached.'] };
    }
    if (this.runner.status === 'fail') {
      const report = this.runner.failReport;
      const lines = ['✗ Golden path failed.'];
      if (report) {
        lines.push(`  Stage: ${report.stage}`);
        lines.push(`  Target: ${report.target}`);
        lines.push(`  Region: ${report.region}`);
        lines.push(`  Constraint: ${report.constraint}`);
        lines.push(`  Suggestion: ${report.suggestion}`);
      }
      return { status: 'fail', lines };
    }
    return { status: 'idle', lines: [] };
  }
}
