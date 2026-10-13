import {test,expect} from '@playwright/test';

test('saved tire graphics and physical properties can be selected on a car',async({page,request})=>{
  const name=`Browser Tire ${Date.now()}`;
  await page.setViewportSize({width:390,height:844});
  await page.goto('/index.html');
  await page.waitForFunction(()=>window.__gameReady && window.__game?.state!=='loading');
  try {
    await page.evaluate(()=>{window.__game.enterCarEditor();window.__game.enterTireEditor();});
    expect(await page.evaluate(()=>window.__game.state)).toBe('tire-editor');
    await page.evaluate(()=>{window.__game.tireEditor.handleMenuAction('tire-select');});
    const library=page.getByRole('dialog',{name:'Select Tire',exact:true});
    await library.getByLabel('Tire',{exact:true}).selectOption('builtin:dirt');
    await library.getByRole('button',{name:'Apply',exact:true}).click();
    await page.evaluate(()=>window.__game.tireEditor.handleMenuAction('tire-properties'));
    const properties=page.getByRole('dialog',{name:'Tire Properties'});
    await expect(properties.getByLabel(/weather grip/i)).toHaveCount(0);
    await expect(properties.getByLabel('Snow grip',{exact:true})).toBeVisible();
    await expect(properties.getByLabel('Slush grip',{exact:true})).toHaveCount(1);
    await properties.getByLabel('Name',{exact:true}).fill(name);
    await properties.getByLabel('Dirt grip',{exact:true}).fill('1.35');
    await properties.getByLabel('Tread depth (mm)',{exact:true}).fill('11');
    await properties.getByRole('button',{name:'Apply',exact:true}).click();
    await page.evaluate(()=>{window.tireImport=window.__game.tireEditor.importCarGraphic();});
    const importer=page.getByRole('dialog',{name:'Import tires graphic'});
    await expect(importer.getByLabel('Component',{exact:true})).toBeDisabled();
    await importer.locator('input[type=file]').setInputFiles('tests/fixtures/rtgtires.png');
    await expect(importer.getByRole('button',{name:'Import Graphic',exact:true})).toBeEnabled();
    await importer.getByRole('button',{name:'Import Graphic',exact:true}).click();
    await page.evaluate(async name=>{await window.tireImport;await window.__game.tireEditor.saveTireToName(name);window.__game.exitTireEditor();},name);
    expect(await page.evaluate(()=>window.__game.state)).toBe('car-editor');
    await page.evaluate(()=>{
      const e=window.__game.carEditor;e.selectedCar.art.tireScaleX=1.6;
      window.tirePick=e.openCarArtPickerForComponent('tires');
    });
    await library.getByLabel('Tire',{exact:true}).selectOption(`saved:${name}`);
    await library.getByRole('button',{name:'Apply',exact:true}).click();
    const result=await page.evaluate(async()=>{
      await window.tirePick;const e=window.__game.carEditor,car=e.selectedCar;
      return {ref:car.setup.tireDefinition.ref,grip:e.getRaceTireCompound('dirt',car).surfaceGrip.dirt,scale:car.art.tireScaleX,surfaces:car.art.tireSurfaces};
    });
    expect(result.ref).toBe(name);expect(result.grip).toBe(1.35);expect(result.scale).toBe(1.6);
    expect(result.surfaces.tread.frameIndex).toBe(0);expect(result.surfaces.wheel.frameIndex).toBe(2);
    const response=await request.get(`/__storage/file?folder=tires&name=${encodeURIComponent(name)}`);
    expect(response.ok()).toBe(true);expect((await response.json()).file.data.compound.treadDepthMm).toBe(11);
  }finally{
    await request.delete(`/__storage/file?folder=tires&name=${encodeURIComponent(name)}`);
  }
});

test('Offroad saved artwork is offered before the bare template and Apply installs all views',async({page})=>{
  await page.goto('/index.html');
  await page.waitForFunction(()=>window.__gameReady && window.__game?.state!=='loading');
  await page.evaluate(async()=>{
    const {upsertCachedProjectFile}=await import('/src/ui/serverStorage.js');
    const {createTireDefinition}=await import('/src/racing/raceTires.js');
    const {assignCarTireSheet}=await import('/src/racing/CarGraphicImport.js');
    const art={width:8,height:8,frames:[Array(64).fill('#ff0000'),Array(64).fill('#00ff00')]};
    const car={art:{}};assignCarTireSheet(car,'Offroad test art',art);
    const tire=createTireDefinition('offroad');tire.graphics=car.art;
    upsertCachedProjectFile('art','Offroad test art',JSON.stringify({folder:'art',name:'Offroad test art',savedAt:Date.now(),data:art}));
    upsertCachedProjectFile('tires','Offroad',JSON.stringify({folder:'tires',name:'Offroad',savedAt:Date.now(),data:tire}));
    window.__game.enterCarEditor();window.__game.carEditor.selectedCar.setup.tireDefinition=undefined;
    window.offroadPick=window.__game.carEditor.openCarArtPickerForComponent('tires');
  });
  const dialog=page.getByRole('dialog',{name:'Select Tire',exact:true});
  // Other saved tires may already exist on the test server. Select the saved
  // entry explicitly and verify that both identically named choices are clear.
  await expect(dialog.locator('option[value="saved:Offroad"]')).toHaveText('Offroad (saved)');
  await expect(dialog.locator('option[value="builtin:offroad"]')).toContainText('no artwork');
  await dialog.getByLabel('Tire',{exact:true}).selectOption('saved:Offroad');
  await expect(dialog.getByRole('status')).toContainText('Saved artwork is ready');
  await dialog.getByRole('button',{name:'Apply',exact:true}).click();
  const result=await page.evaluate(async()=>{
    await window.offroadPick;
    const {RACE_CAR_SHELL_FRAME_SLOTS}=await import('/src/racing/raceData.js');
    const {getCarViewCameraYaw}=await import('/src/racing/CarDirectionalArt.js');
    const editor=window.__game.carEditor;
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const ctx=canvas.getContext('2d');
    const visible=RACE_CAR_SHELL_FRAME_SLOTS.map(slot=>{
      ctx.clearRect(0,0,256,256);
      editor.drawRaceCarBillboardLayers(ctx,{car:editor.selectedCar,centerX:128,anchorY:128,baseWidth:100,baseHeight:100,
        artChoice:editor.getRaceCarProjectedArtRef(editor.selectedCar,0,getCarViewCameraYaw(slot)),drawBodyLayer:false,drawShadowLayer:false});
      const pixels=ctx.getImageData(0,0,256,256).data;
      return pixels.some((value,index)=>index%4===3&&value>0);
    });
    return {ref:editor.selectedCar.setup.tireDefinition.ref,label:editor.getSelectedCarTireLabel(),visible,status:editor.status};
  });
  expect(result.ref).toBe('Offroad');expect(result.label).toBe('Offroad');
  expect(result.status).toContain('Applied Offroad');expect(result.visible).toEqual(Array(8).fill(true));
});
