import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

async function bootstrap(reject = null) {
  const elements = Object.fromEntries(['studio-boot', 'studio-boot-status', 'studio-boot-retry', 'studio-boot-error'].map(id => [id, {hidden: true, addEventListener(){}, remove(){}}]));
  const listeners = {};
  let imports = 0;
  const context = {document: {getElementById: id => elements[id], querySelectorAll: () => []},
    window: {addEventListener: (name, fn) => listeners[name] = fn},
    navigator: {userAgentData: {mobile: false}}, setTimeout: () => 1, clearTimeout(){},
    console: {error(){}}, location: {search: ''}, URLSearchParams,
    loadMain: () => {imports++; return reject ? Promise.reject(reject) : Promise.resolve();}};
  const source = fs.readFileSync(new URL('../../src/bootstrap.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/, '')
    .replace(/import\('\.\/main\.js\?[^']+'\)/, 'loadMain()');
  vm.runInNewContext(source, context);
  await Promise.resolve(); await Promise.resolve();
  return {elements, listeners, imports};
}

test('startup reports the actual imported dependency error', async () => {
  const error = new Error('Failed to fetch dynamically imported module: /src/missing.js');
  const {elements, imports} = await bootstrap(error);
  assert.equal(imports, 1);
  assert.match(elements['studio-boot-error'].textContent, /missing.js/);
  assert.equal(elements['studio-boot-retry'].hidden, false);
});

test('preload failure does not falsely fail a successful module import', async () => {
  const {elements, listeners} = await bootstrap();
  listeners.error({target: {tagName: 'LINK', rel: 'modulepreload', href: '/src/main.js'}});
  assert.equal(elements['studio-boot-error'].hidden, true);
});

test('HTML delegates main startup once to bootstrap and preloads the same version', () => {
  const html = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const source = fs.readFileSync(new URL('../../src/bootstrap.js', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /<script[^>]+src="src\/main\.js/);
  const version = source.match(/import\('\.\/main\.js\?([^']+)'\)/)[1];
  assert.ok(html.includes(`href="src/main.js?${version}"`));
});
