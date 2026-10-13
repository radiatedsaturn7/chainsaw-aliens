import { test, expect } from '@playwright/test';

async function openImporter(page, { blank = false } = {}) {
  await page.goto('/index.html');
  const png = await page.evaluate(async (blank) => {
    const { default: RaceEditor } = await import('/src/ui/RaceEditor.js');
    const editor = new RaceEditor({ deviceIsMobile: true, isMobile: true }, { mode: 'race' });
    window.imageRaceEditor = editor;
    window.imageRaceBefore = JSON.stringify(editor.project);
    window.imageRaceImport = editor.importRaceFromImage();
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 360;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 600, 360);
    if (!blank) {
      ctx.strokeStyle = '#888'; ctx.lineWidth = 3;
      for (const x of [150,450]) {
        ctx.beginPath(); ctx.ellipse(x,180,100,120,0,0,Math.PI*2); ctx.stroke();
      }
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, blank);
  await page.locator('.race-image-import input[type=file]').first().setInputFiles({
    name: 'Child tracks.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64')
  });
}

test('portrait photo workflow crops one drawing and imports an editable circuit with undo', async ({ page }) => {
  await page.setViewportSize({ width:390, height:844 });
  await openImporter(page);
  const dialog = page.getByRole('dialog', { name:'Race From Image' });
  await expect(dialog.getByRole('status')).toContainText('2 routes found');
  await expect(dialog.getByRole('button', { name:'Import Track', exact:true })).toBeEnabled();
  await expect(dialog.locator('input[capture]')).toHaveAttribute('capture','environment');
  await dialog.getByRole('button', { name:'Crop One Track' }).click();
  const canvas = dialog.locator('canvas'); await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x+box.width*.03,box.y+box.height*.08);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width*.47,box.y+box.height*.94,{steps:8});
  await page.mouse.up();
  await expect(dialog.getByRole('status')).toContainText('1 route found');
  await dialog.getByLabel('Race name', { exact:true }).fill('My Paper Circuit');
  await dialog.getByLabel('Track length (metres)', { exact:true }).fill('1800');
  await dialog.getByLabel('Road width (metres)', { exact:true }).fill('8');
  await dialog.getByRole('button', { name:'Import Track', exact:true }).click();
  await expect(dialog).toHaveCount(0);
  const result = await page.evaluate(async () => {
    await window.imageRaceImport;
    const editor = window.imageRaceEditor;
    const race = editor.serializeSelectedRaceDocument().race;
    const runtime = editor.getSelectedRaceRuntimeType();
    const points = editor.getRaceRawMapPoints();
    editor.undoRaceHistory();
    return { race, runtime, pointCount:points.length, restored:JSON.stringify(editor.project)===window.imageRaceBefore };
  });
  expect(result.race.name).toBe('My Paper Circuit');
  expect(result.runtime).toBe('circuit');
  expect(result.pointCount).toBeGreaterThan(5);
  expect(result.race.road.width).toBe(8);
  expect(result.restored).toBe(true);
});

test('blank image cannot import; manual trace can supply an open route', async ({ page }) => {
  await openImporter(page, { blank:true });
  const dialog = page.getByRole('dialog', { name:'Race From Image' });
  await expect(dialog.getByRole('status')).toContainText('No complete route found');
  await expect(dialog.getByRole('button', { name:'Import Track', exact:true })).toBeDisabled();
  await dialog.getByRole('button', { name:'Trace by Hand' }).click();
  const canvas = dialog.locator('canvas');
  await canvas.click({position:{x:40,y:60}});
  await canvas.click({position:{x:120,y:120}});
  await canvas.click({position:{x:220,y:70}});
  await dialog.getByRole('button', { name:'Finish Open Route' }).click();
  await dialog.getByRole('button', { name:'Import Track', exact:true }).click();
  expect(await page.evaluate(async () => {
    await window.imageRaceImport;
    return window.imageRaceEditor.getSelectedRaceRuntimeType();
  })).toBe('destination');
});

test('cancel leaves project and history intact and releases modal input lock', async ({ page }) => {
  await openImporter(page);
  await page.getByRole('button', { name:'Cancel', exact:true }).click();
  expect(await page.evaluate(async () => {
    await window.imageRaceImport;
    const editor = window.imageRaceEditor;
    return { unchanged:JSON.stringify(editor.project)===window.imageRaceBefore, locked:editor.raceImageImportOpen, history:editor.raceHistory.length };
  })).toEqual({unchanged:true,locked:false,history:0});
});
