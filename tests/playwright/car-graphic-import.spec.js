import { test, expect } from '@playwright/test';

async function openImporter(page, tire=false) {
  await page.goto('/index.html');
  const png = await page.evaluate(async (tire) => {
    const { default: RaceEditor } = await import('/src/ui/RaceEditor.js');
    const { default: TireEditor } = await import('/src/ui/TireEditor.js');
    const editor = tire ? new TireEditor({deviceIsMobile:true,isMobile:true}) : new RaceEditor({ deviceIsMobile: true, isMobile: true }, { mode: 'car' });
    editor.carArtActiveComponent = tire ? 'tires' : 'body';
    window.carImportEditor = editor;
    window.carBeforeImport = JSON.stringify(editor.selectedCar);
    window.carImportPending = editor.importCarGraphic();
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 16;
    const ctx = canvas.getContext('2d');
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = `rgb(${(i + 1) * 20},0,0)`;
      ctx.fillRect(i % 4 * 8 + 1, Math.floor(i / 4) * 8 + 1, 6, 6);
    }
    return canvas.toDataURL().split(',')[1];
  }, tire);
  await page.locator('.car-graphic-import input[type=file]').setInputFiles({ name: 'Eight cars.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  return page.getByRole('dialog', { name: tire ? 'Import tires graphic' : 'Import body graphic' });
}

test('portrait import rotates, swaps frame assignments and applies all eight graphics', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await openImporter(page);
  await expect(dialog.getByRole('status')).toContainText('Each frame: 8 × 8 pixels');
  const caption = dialog.locator('p').filter({ hasText: /° · .* · Frame/ });
  const initial = await caption.textContent();
  await expect(caption).not.toHaveText(initial);
  await dialog.getByLabel('0° · Front', { exact: true }).selectOption('4');
  await expect(dialog.getByLabel('180° · Rear', { exact: true })).toHaveValue('0');
  await expect(caption).toContainText('0° · Front · Frame 5');
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Import Graphic', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const result = await page.evaluate(async () => {
    await window.carImportPending;
    const { loadProjectFile } = await import('/src/ui/projectFiles.js');
    const layers = window.carImportEditor.selectedCar.art.angleLayers;
    const editor = window.carImportEditor;
    editor.playtestSession = { raceTravelPreparedArtOnly: true };
    const rendered = Object.values(layers).map(layer => {
      const canvas = editor.getRaceArtSpriteCanvas(layer.body.artRef, { frameIndex: layer.body.frameIndex });
      return canvas ? Array.from(canvas.getContext('2d').getImageData(1, 1, 1, 1).data) : null;
    });
    return { layers, rendered, art: loadProjectFile('art', layers.front.body.artRef).data };
  });
  expect(result.layers.front.body.frameIndex).toBe(4);
  expect(result.layers.rear.body.frameIndex).toBe(0);
  expect(result.art.frames).toHaveLength(8);
  expect(result.art.frames[4][9]).toBe('#640000');
  expect(result.rendered).toEqual([4,1,2,3,0,5,6,7].map(i => [(i+1)*20,0,0,255]));
});

test('cancel after remapping leaves the car unchanged', async ({ page }) => {
  const dialog = await openImporter(page);
  await expect(dialog.getByRole('button', { name: 'Import Graphic', exact: true })).toBeEnabled();
  await dialog.getByLabel('0° · Front', { exact: true }).selectOption('7');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(async () => {
    await window.carImportPending;
    return JSON.stringify(window.carImportEditor.selectedCar) === window.carBeforeImport;
  })).toBe(true);
});

test('rtgframes imports with adjustable faint background cleanup', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dialog = await openImporter(page);
  await dialog.locator('input[type=file]').setInputFiles('tests/fixtures/rtgframes.png');
  await expect(dialog.getByRole('status')).toContainText('Each frame: 148 × 82 pixels');
  const apply = dialog.getByRole('button', { name: 'Import Graphic', exact: true });
  await expect(apply).toBeEnabled();
  await dialog.getByLabel('Background cleanup', { exact: true }).selectOption('0');
  await expect(apply).toBeDisabled();
  await expect(dialog.getByRole('status')).toContainText('without cutting');
  await dialog.getByLabel('Background cleanup', { exact: true }).selectOption('8');
  await expect(apply).toBeEnabled();
  await apply.click();
  const result = await page.evaluate(async () => {
    await window.carImportPending;
    const { loadProjectFile } = await import('/src/ui/projectFiles.js');
    return loadProjectFile('art', window.carImportEditor.selectedCar.art.angleLayers.front.body.artRef).data;
  });
  expect(result.width).toBe(148); expect(result.height).toBe(82);
  expect(result.frames).toHaveLength(8);
});

test('import component selector and Art settings apply to the chosen component', async ({ page }) => {
  await openImporter(page);
  await page.getByLabel('Component', { exact:true }).selectOption('shadow');
  const dialog = page.getByRole('dialog', { name:'Import shadow graphic' });
  await expect(dialog.getByRole('status')).toContainText('shadow graphics');
  await dialog.getByRole('button', { name:'Import Graphic', exact:true }).click();
  expect(await page.evaluate(async () => {
    await window.carImportPending;
    return Object.values(window.carImportEditor.selectedCar.art.angleLayers).every(layer => layer.shadow?.artRef);
  })).toBe(true);
  await page.evaluate(() => { window.carArtSettingsPending = window.carImportEditor.handleMenuAction('car-art-settings'); });
  const settings = page.getByRole('dialog', { name:'Art Settings' });
  await settings.getByLabel('Mirror', { exact:true }).uncheck();
  await settings.getByRole('button', { name:'Done' }).click();
  expect(await page.evaluate(async () => { await window.carArtSettingsPending; return window.carImportEditor.selectedCar.art.mirrorAngleEdits; })).toBe(false);
});

test('reset dialog leaves unchecked categories unchanged', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(async () => {
    const { default: RaceEditor } = await import('/src/ui/RaceEditor.js');
    const { openCarArtReset } = await import('/src/ui/CarArtDialogs.js');
    const editor = window.resetArtEditor = new RaceEditor({ deviceIsMobile:false,isMobile:false }, {mode:'car'});
    editor.setCarArtScaleValue('body-offset-x', 9);
    editor.setCarArtScaleValue('body-x', 2);
    editor.setCarArtScaleValue('body-rotation', 15);
    openCarArtReset('body', choices => editor.resetCarArtAdjustments('body', choices));
  });
  const dialog = page.getByRole('dialog', {name:'Reset Art Adjustments'});
  await dialog.getByLabel('Position', {exact:true}).uncheck();
  await dialog.getByLabel('Scale', {exact:true}).uncheck();
  await dialog.getByRole('button', {name:'Reset Selected'}).click();
  const art = await page.evaluate(() => window.resetArtEditor.getCarEditorAngleCar().art);
  expect(art.bodyRotationDeg).toBe(0);
  expect(art.bodyOffsetX).toBe(9);
  expect(art.bodyScaleX).toBe(2);
});

for (const [columns, rows] of [[2,1],[1,2],[2,2],[4,2]]) {
  test(`tire import ${columns}x${rows} selects tread and rim and previews a cylinder`, async ({ page }) => {
    await page.setViewportSize({ width:390,height:844 });
    await openImporter(page, true);
    const dialog = page.getByRole('dialog', {name:'Import tires graphic'});
    await dialog.getByLabel('Tire sheet layout (columns × rows)', {exact:true}).selectOption(`${columns}x${rows}`);
    const png = await page.evaluate(({columns,rows}) => {
      const canvas=document.createElement('canvas'); canvas.width=columns*16;canvas.height=rows*16;
      const ctx=canvas.getContext('2d');
      for(let i=0;i<columns*rows;i++) {
        ctx.fillStyle=`rgb(${30+i*25},80,120)`;ctx.fillRect(i%columns*16+1,Math.floor(i/columns)*16+1,14,14);
        ctx.fillStyle='#ffffff';ctx.fillRect(i%columns*16+3,Math.floor(i/columns)*16+2,3,10);
      }
      return canvas.toDataURL().split(',')[1];
    }, {columns,rows});
    await dialog.locator('input[type=file]').setInputFiles({name:'Tire surfaces.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
    await expect(dialog.getByLabel('Tread frame',{exact:true})).toHaveValue('0');
    await expect(dialog.getByLabel('Wheel / rim frame',{exact:true})).toHaveValue(columns*rows===8?'2':'1');
    await expect(dialog.getByRole('status')).toContainText('3D wheel cylinder');
    await expect(dialog.getByLabel('0° · Front',{exact:true})).toBeHidden();
    expect(await dialog.locator('canvas').last().evaluate(canvas => {
      const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
      return rgba.some((value,index)=>index%4===3 && value>0);
    })).toBe(true);
    await dialog.getByRole('button',{name:'Import Graphic',exact:true}).click();
    const surfaces = await page.evaluate(async () => {await window.carImportPending;return window.carImportEditor.selectedCar.art.tireSurfaces;});
    expect(surfaces.tread.frameIndex).toBe(0);
    expect(surfaces.wheel.frameIndex).toBe(columns*rows===8?2:1);
  });
}

test('tire import blocks unsafe grid cuts instead of chopping opaque sprites', async ({ page }) => {
  await openImporter(page, true);
  const dialog=page.getByRole('dialog',{name:'Import tires graphic'});
  await dialog.getByLabel('Tire sheet layout (columns × rows)',{exact:true}).selectOption('2x1');
  const png=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=32;canvas.height=16;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#123456';ctx.fillRect(0,0,32,16);
    return canvas.toDataURL().split(',')[1];
  });
  await dialog.locator('input[type=file]').setInputFiles({name:'Unsafe tires.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await expect(dialog.getByRole('button',{name:'Import Graphic',exact:true})).toBeDisabled();
  await expect(dialog.getByRole('status')).toContainText('without cutting');
});

test('saved rtgtires opens directly in the importer and removes its baked checkerboard', async ({page}) => {
  await page.goto('/index.html');
  await page.evaluate(async()=>{
    const {openCarGraphicImport}=await import('/src/ui/CarGraphicImportModal.js');
    const image=new Image();image.src='/tests/fixtures/rtgtires.png';await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);
    window.savedTireResult=openCarGraphicImport('tires',{canvas,name:'rtgtires'});
  });
  const dialog=page.getByRole('dialog',{name:'Import tires graphic'});
  const remove=dialog.getByLabel('Remove light/checkerboard background',{exact:true});
  await expect(remove).toBeChecked();
  await expect(dialog.getByRole('button',{name:'Import Graphic',exact:true})).toBeEnabled();
  await remove.uncheck();
  await expect(dialog.getByRole('status')).toContainText('without cutting');
  await expect(dialog.getByRole('button',{name:'Import Graphic',exact:true})).toBeDisabled();
  await remove.check();
  await dialog.getByRole('button',{name:'Import Graphic',exact:true}).click();
  expect(await page.evaluate(async()=> (await window.savedTireResult).document.frames.length)).toBe(8);
});

test('saved Art choice supports single source frame, sheet and existing frames', async ({page}) => {
  await page.goto('/index.html');
  for(const [label,mode] of [['Single Frame','single'],['Sprite Sheet','sheet'],['Use Existing Frames','frames']]) {
    await page.evaluate(async()=>{
      const {chooseCarArtUse}=await import('/src/ui/CarArtDialogs.js');
      window.artUse=chooseCarArtUse('saved tires',4,'tires');
    });
    const dialog=page.getByRole('dialog',{name:'Use Car Artwork'});
    await dialog.getByLabel('Source frame',{exact:true}).selectOption('2');
    await dialog.getByRole('button',{name:label,exact:true}).click();
    expect(await page.evaluate(()=>window.artUse)).toEqual({mode,frameIndex:2});
  }
});
