import { test, expect } from '@playwright/test';

const MODES = [
  { mode: 'desktop', width: 1280, height: 800 },
  { mode: 'portrait', width: 390, height: 844, mobile: true },
  { mode: 'landscape-touch', width: 844, height: 390, mobile: true },
  { mode: 'gamepad', width: 1280, height: 720, gamepad: true }
];
async function setup(page, config) {
  await page.setViewportSize({ width: config.width, height: config.height });
  await page.goto('/index.html');
  await page.evaluate(async config => {
    const { default: RaceEditor } = await import('/src/ui/RaceEditor.js');
    const canvas = document.createElement('canvas');
    canvas.id = 'network-editor'; canvas.width = config.width; canvas.height = config.height;
    document.body.replaceChildren(canvas); document.body.style.cssText = 'margin:0;overflow:hidden';
    canvas.style.cssText = 'display:block;width:100vw;height:100vh;touch-action:none';
    const editor = new RaceEditor({ canvas, deviceIsMobile: Boolean(config.mobile), isMobile: Boolean(config.mobile),
      input: { isGamepadConnected: () => Boolean(config.gamepad) } });
    editor.selectedRace.road.nodes = [{ x: 0, y: 0, elevation: 0 }, { x: 0, y: 300, elevation: 0 }];
    editor.selectedRace.road.segments = [{ length: 300, curve: 0, elevation: 0, surface: 'asphalt', roadWidthM: 11 }];
    editor.selectedRace.name = `Network browser ${config.mode}`;
    window.networkEditor = editor;
    window.drawNetwork = () => editor.draw(canvas.getContext('2d'), canvas.width, canvas.height);
    for (const [eventName, handler] of [['pointerdown', 'handlePointerDown'], ['pointermove', 'handlePointerMove'], ['pointerup', 'handlePointerUp']]) {
      canvas.addEventListener(eventName, event => {
        const box = canvas.getBoundingClientRect();
        editor[handler]({ x: (event.clientX - box.x) * canvas.width / box.width,
          y: (event.clientY - box.y) * canvas.height / box.height, id: event.pointerId, button: event.button });
        window.drawNetwork();
      });
    }
    window.drawNetwork();
  }, config);
}
async function action(page, id) {
  await page.evaluate(id => {
    const item = window.networkEditor.getMenuItems('track').find(item => item.id === id);
    if (!item || item.disabled) throw new Error(`Missing usable Track action: ${id}`);
    window.networkAction = Promise.resolve(item.onSelect()).then(() => window.drawNetwork());
  }, id);
}
async function mapClick(page, x, z) {
  const point = await page.evaluate(({ x, z }) => {
    window.drawNetwork();
    const p = window.networkEditor.raceMapWorldToScreenPoint({ x, y: z });
    return { x: p.screenX, y: p.screenY };
  }, { x, z });
  await page.mouse.click(point.x, point.y);
}
async function apply(page, title) {
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  await dialog.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => window.networkAction);
}
for (const config of MODES) test(`${config.mode}: edit a split/rejoined route, bridge, water, and save/reload`, async ({ page }) => {
  test.setTimeout(120000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await setup(page, config);
  await action(page, 'network-enable');
  await page.evaluate(() => window.networkAction);
  expect(await page.evaluate(() => window.networkEditor.activeViewportMode)).toBe(config.mode);
  await action(page, 'network-split'); await mapClick(page, 0, 75);
  await action(page, 'network-split'); await mapClick(page, 0, 225);
  expect(await page.evaluate(() => window.networkEditor.selectedRace.road.network.nodes.length)).toBe(4);
  await action(page, 'network-select'); await mapClick(page, 0, 75);
  await action(page, 'network-add'); await mapClick(page, 35, 150); await mapClick(page, 0, 225);
  expect(await page.evaluate(() => window.networkEditor.selectedRace.road.network.edges.length)).toBe(5);
  await action(page, 'network-select'); await mapClick(page, 35, 150);
  await action(page, 'network-properties');
  let dialog = page.getByRole('dialog', { name: 'Junction properties', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('Bridge crest');
  await dialog.getByLabel('Height (m)', { exact: true }).fill('6');
  await apply(page, 'Junction properties');
  await mapClick(page, 17.5, 112.5);
  await action(page, 'network-properties');
  dialog = page.getByRole('dialog', { name: 'Route properties', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('Bridge ramp');
  await dialog.getByLabel('Structure', { exact: true }).selectOption('bridge');
  await apply(page, 'Route properties');
  await action(page, 'network-water');
  dialog = page.getByRole('dialog', { name: 'Water level', exact: true });
  await dialog.getByLabel('Name', { exact: true }).fill('Shallow ford');
  await dialog.getByLabel('Water surface height (m)', { exact: true }).fill('0.2');
  await apply(page, 'Water level');
  await action(page, 'network-markers');
  await apply(page, 'Start / finish');
  const saved = await page.evaluate(async () => {
    const editor = window.networkEditor;
    const before = editor.serializeSelectedRaceDocument();
    const result = editor.saveSelectedRaceToName(editor.selectedRace.name);
    await result.syncPromise;
    const { loadProjectFile } = await import('/src/ui/projectFiles.js');
    const loaded = loadProjectFile('races', editor.selectedRace.name);
    editor.applyLoadedRaceDocument(loaded.data);
    window.drawNetwork();
    const { validateRaceRouteNetwork } = await import('/src/racing/RaceRouteNetwork.js');
    return { before: before.race.road.network, after: editor.selectedRace.road.network,
      water: editor.selectedRace.waterRegions, errors: validateRaceRouteNetwork(editor.selectedRace.road.network) };
  });
  expect(saved.before).toEqual(saved.after);
  expect(saved.errors).toEqual([]);
  expect(saved.water[0].name).toBe('Shallow ford');
  expect(saved.after.startNodeId).not.toBe(saved.after.finishNodeId);
  await page.locator('#network-editor').screenshot({ path: `test-results/network-editor-${config.mode}.png` });
  expect(errors).toEqual([]);
});

for (const kind of ['y', 't', 'cross']) test(`place a ${kind} junction with editable connected arms`, async ({ page }) => {
  await setup(page, MODES[0]); await action(page, 'network-enable');
  await page.evaluate(() => window.networkAction);
  await action(page, 'network-junction');
  await page.getByRole('dialog', { name: 'Add junction' }).getByLabel('Shape', { exact: true }).selectOption(kind);
  await apply(page, 'Add junction'); await mapClick(page, 60, 150);
  const arms = await page.evaluate(() => {
    const e = window.networkEditor, n = e.selectedRace.road.network;
    return n.edges.filter(edge => edge.from === e.networkNodeId || edge.to === e.networkNodeId).length;
  });
  expect(arms).toBe(kind === 'cross' ? 4 : 3);
});
