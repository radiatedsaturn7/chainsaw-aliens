import {test,expect} from '@playwright/test';
test('artwork action temporarily releases the form modal and preserves unapplied properties',async({page})=>{
 await page.goto('/index.html');
 await page.evaluate(async()=>{
  const {openEditorForm}=await import('/src/ui/shared/editorForm.js');
  window.formResult='pending';
  openEditorForm('FX properties test',[
   {id:'name',label:'Effect name',type:'text',value:'Brake lights'},
   {id:'artRef',label:'Artwork',type:'text',readOnly:true,value:'original'},
   {id:'pick',label:'Choose artwork',type:'button',onClick:()=>new Promise(resolve=>{window.finishArtPicker=()=>resolve({artRef:'new-art'});})}
  ]).then(result=>{window.formResult=result;});
 });
 await page.getByLabel('Effect name',{exact:true}).fill('Edited name');await page.getByRole('button',{name:'Choose artwork',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeHidden();await page.evaluate(()=>window.finishArtPicker());
 await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Effect name',{exact:true})).toHaveValue('Edited name');await expect(page.getByLabel('Artwork',{exact:true})).toHaveValue('new-art');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await page.evaluate(()=>window.formResult)).toBeNull();
});

test('Effects picker selects newly added effects and Cancel discards removals',async({page})=>{
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 await page.evaluate(async()=>{
  const {selectCarFx}=await import('/src/ui/CarFxEditor.js');
  window.__game.transitionTo('car-editor');const e=window.__game.carEditor;e.selectedCar.art.fx=[];
  void selectCarFx(e);
 });
 await page.getByRole('button',{name:'Add effect',exact:true}).click();
 await expect(page.getByLabel('Effect to edit',{exact:true})).not.toHaveValue('');
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 expect(await page.evaluate(()=>window.__game.carEditor.selectedCar.art.fx.length)).toBe(1);
 await page.evaluate(async()=>{const {selectCarFx}=await import('/src/ui/CarFxEditor.js');void selectCarFx(window.__game.carEditor);});
 await page.getByRole('button',{name:'Remove selected effect',exact:true}).click();
 await expect(page.getByLabel('Effect to edit',{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 expect(await page.evaluate(()=>window.__game.carEditor.selectedCar.art.fx.length)).toBe(1);
});

test('FX Properties accepts fractional placement coordinates without native step validation errors',async({page})=>{
 await page.goto('/index.html');await page.waitForFunction(()=>window.__gameReady);
 await page.evaluate(async()=>{
  const {addCarFx,editCarFx}=await import('/src/ui/CarFxEditor.js');
  const g=window.__game;g.transitionTo('car-editor');const e=g.carEditor;
  e.selectedCarShellFrameSlot='rear';addCarFx(e);const fx=e.selectedCar.art.fx.find(f=>f.id===e.carFxId);
  fx.views.rear.placements=[{x:.21234567,y:.12345678}];e.carFxPlacementIndex=0;
  window.fxPropertiesApplied=false;void editCarFx(e).then(()=>{window.fxPropertiesApplied=true;});
 });
 await expect(page.getByRole('dialog')).toBeVisible();
 expect(await page.getByRole('dialog').locator('form').evaluate(form=>form.checkValidity())).toBe(true);
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 await page.waitForFunction(()=>window.fxPropertiesApplied);
 expect(await page.evaluate(()=>window.__game.carEditor.selectedCar.art.fx.find(f=>f.id===window.__game.carEditor.carFxId).views.rear.placements[0].x)).toBeCloseTo(.21234567,8);
});

test('shared range fields accept exact numeric entry and keep the slider synchronized',async({page})=>{
 await page.goto('/index.html?hideFullscreenForTesting');
 await page.evaluate(async()=>{const {openEditorForm}=await import('/src/ui/shared/editorForm.js');window.formResult='pending';void openEditorForm('Geometry',[{id:'x',label:'X position',type:'range',value:0,min:-400,max:400,step:.1}]).then(r=>window.formResult=r);});
 await page.getByLabel('X position value',{exact:true}).fill('-23.4');
 await expect(page.getByLabel('X position',{exact:true})).toHaveValue('-23.4');
 await page.getByRole('button',{name:'Apply',exact:true}).click();
 expect(await page.evaluate(()=>window.formResult)).toEqual({x:-23.4});
});

test('vertical touch swipes over a slider scroll the form without adjusting it',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/index.html?hideFullscreenForTesting');
 await page.evaluate(async()=>{const {openEditorForm}=await import('/src/ui/shared/editorForm.js');void openEditorForm('Scroll test',Array.from({length:16},(_,i)=>({id:'n'+i,label:'Slider '+i,type:'range',value:50,min:0,max:100,step:1})));});
 const slider=page.getByLabel('Slider 1',{exact:true}),box=await slider.boundingBox();
 const client=await page.context().newCDPSession(page),x=box.x+box.width/2,y=box.y+box.height/2;
 await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
 for(let step=1;step<=8;step++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*10}]});
 await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await expect(slider).toHaveValue('50');await expect(page.getByLabel('Slider 1 value',{exact:true})).toHaveValue('50');
 await expect.poll(()=>page.getByRole('dialog',{name:'Scroll test'}).evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
});

test('track import progress can be cancelled or closed when the request finishes',async({page})=>{
 await page.goto('/index.html');
 await page.evaluate(async()=>{
  const {openEditorForm}=await import('/src/ui/shared/editorForm.js');
  window.importProgressController=new AbortController();window.importProgressResult='pending';
  void openEditorForm('Building editable track',[],{pending:true,signal:window.importProgressController.signal,description:'Downloading elevations…'}).then(r=>window.importProgressResult=r);
 });
 await expect(page.getByRole('dialog')).toBeVisible();
 await expect(page.getByRole('button',{name:'Apply',exact:true})).toBeHidden();
 await page.evaluate(()=>window.importProgressController.abort());
 await expect(page.getByRole('dialog')).toHaveCount(0);
 expect(await page.evaluate(()=>window.importProgressResult)).toBeNull();
});

for(const viewport of [{width:390,height:844},{width:960,height:540}])test(`real-track picker previews distance and imports all layouts at ${viewport.width}px`,async({page})=>{
 await page.setViewportSize(viewport);await page.goto('/index.html');
 await page.evaluate(async()=>{
  const {importRealTrack}=await import('/src/ui/RaceTrackImport.js');
  window.importedLayouts=[];
  const editor={mode:'race',selectedRace:{name:'Existing'},game:{input:{reset(){}}},applyImageRace(race){window.importedLayouts.push(race.name);this.selectedRace=race;return true;},applyLoadedRaceDocument(race){this.selectedRace=race;}};
  const layouts=[{id:'main',name:'Lime Rock Park',lengthM:2400,points:[{x:0,y:0},{x:100,y:200},{x:200,y:0},{x:0,y:0}]},{id:'small',name:'Autocross Course',lengthM:750,points:[{x:0,y:0},{x:20,y:20},{x:0,y:0}]}];
  void importRealTrack(editor,{request:async body=>body.action==='search'?{places:[{id:'venue',name:'Lime Rock Park'}]}:body.action==='layouts'?{layouts}:{race:{name:body.layoutId},attribution:'OSM',warnings:[]}});
 });
 await page.getByLabel('Track or area name',{exact:true}).fill('Lime Rock Park');await page.getByRole('button',{name:'Find track',exact:true}).click();
 await page.getByRole('button',{name:'Find layouts',exact:true}).click();
 await expect(page.getByRole('option',{name:'Lime Rock Park — 2.40 km / 1.49 mi'})).toHaveCount(1);
 const preview=page.getByRole('img',{name:'Circuit outline — yellow dot is provisional start'});await expect(preview).toBeVisible();
 await page.getByLabel('Import all 2 listed layouts as separate races').check();
 await page.getByRole('button',{name:'Build track',exact:true}).click();
 await page.getByRole('button',{name:'Open in editor',exact:true}).click();
 expect(await page.evaluate(()=>window.importedLayouts)).toEqual(['main','small']);
});

for(const width of [390,960])test(`point-to-point map places start and finish at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/index.html?hideFullscreenForTesting');
 await page.evaluate(async()=>{
  const {chooseRoadRoute}=await import('/src/ui/RaceRouteImport.js');
  const {openEditorForm}=await import('/src/ui/shared/editorForm.js');
  window.routeRequest=null;
  void chooseRoadRoute({form:openEditorForm,placeId:'hill',busy:async(label,body)=>{
   if(body.action==='network')return {networkId:'roads',roads:[{id:1,name:'Hill Road',points:[{x:0,y:0},{x:1000,y:0}]}]};
   window.routeRequest=body;return {layouts:[]};
  }});
 });
 await page.getByRole('button',{name:'Preview route',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Place Start');
 const canvas=page.getByRole('img',{name:'Tap a road to place the selected point. Yellow: start; red: finish; blue: via.'});
 await canvas.scrollIntoViewIfNeeded();let b=await canvas.boundingBox();
 await canvas.click({position:{x:b.width*.1,y:b.height/2+8}});
 await canvas.scrollIntoViewIfNeeded();b=await canvas.boundingBox();
 await canvas.click({position:{x:b.width*.9,y:b.height/2+8}});
 await page.getByRole('button',{name:'Preview route',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.routeRequest?.waypoints?.length)).toBe(2);
 expect(await page.evaluate(()=>window.routeRequest.waypoints[0].x<window.routeRequest.waypoints[1].x)).toBe(true);
 expect(await page.evaluate(()=>window.routeRequest.waypoints.map(p=>p.y))).toEqual([0,0]);
});
