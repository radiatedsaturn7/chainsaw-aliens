const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const rootDir = path.resolve(__dirname, '../..');
const outputDir = path.join(__dirname, 'output');
const reportPath = path.join(outputDir, 'report.json');
const screenshotPath = path.join(outputDir, 'final.png');

const contentTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png'
};

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/__repair__') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      const repairsPath = path.join(rootDir, 'src', 'content', 'repairs.json');
      fs.writeFileSync(repairsPath, body, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  let pathname = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = path.normalize(path.join(rootDir, pathname));
  if (!safePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(safePath);
  const contentType = contentTypes[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(safePath).pipe(res);
});

async function run() {
  const logs = [];
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/index.html`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', (msg) => {
    logs.push({ type: msg.type(), text: msg.text() });
  });

  try {
    await page.goto(baseUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__gameReady === true, { timeout: 15000 });
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyR');

    await page.waitForFunction(
      () => {
        const report = window.__testReport;
        if (!report || !report.results) return false;
        const golden = report.results.golden;
        return golden === 'pass' || golden === 'fail';
      },
      { timeout: 120000 }
    );

    const report = await page.evaluate(() => window.__testReport || {});
    const failures = Object.entries(report.results || {}).filter(([, status]) => status !== 'pass');
    const finalReport = {
      ...report,
      failures: failures.map(([name, status]) => ({ name, status })),
      console: logs,
      timestamp: new Date().toISOString()
    };

    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
    await page.screenshot({ path: screenshotPath });

    if (failures.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ error: error.message, console: logs, timestamp: new Date().toISOString() }, null, 2)
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

run();
