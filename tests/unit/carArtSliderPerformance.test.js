import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';

const game={deviceIsMobile:false,isMobile:false};
function setup(){
  const editor=new RaceEditor(game,{mode:'car'});editor.currentCarDocumentName='Scale Test';
  const revision=editor.getCarEditorPreviewTuningRevision();
  editor.carEditorPreviewPlaytest={baseKey:'studio-sprint:Scale Test',key:`studio-sprint:Scale Test:${revision}`,carId:editor.selectedCar.id,
    session:{runtimeCar:structuredClone(editor.selectedCar),worldBake:{key:'prepared-track'}},input:{}};
  return editor;
}

test('continuous art dragging reuses the simulation, textures, and frame canvas at the normal render cadence',()=>{
  const editor=setup(),preview=editor.carEditorPreviewPlaytest,previousWorker=globalThis.Worker;
  globalThis.Worker=class{constructor(){throw new Error('Art drag must not start a preparation worker');}};
  let now=1000;editor.getNowMs=()=>now;
  editor.installPreparedCarEditorPreview=()=>{throw new Error('Art drag must not restart physics');};
  const frame={canvas:{},w:400,h:300,lastRenderMs:900};editor.carEditorPreviewFrameCache=frame;
  const layer={},tread={};editor.raceCarBillboardLayerCache.set('unchanged-body',layer);editor.raceCarTireScrollCache.set('unchanged-tread',tread);
  let framePreparations=0;const sync=editor.syncCarAnglePreviewArt.bind(editor);
  editor.syncCarAnglePreviewArt=(car,options)=>{if(options?.prepareFrames!==false)framePreparations++;return sync(car,options);};
  const region={id:'body-x',min:0.25,max:4,track:{x:0,w:100}};
  editor.carArtSliderDrag={id:'drag',region};
  try{
    for(let i=0;i<120;i++){
      now+=50;editor.updateCarArtSlider(region,i%101);
      assert.equal(editor.ensureCarEditorPreviewPlaytestSession(),preview);
    }
    assert.equal(framePreparations,0);
    assert.equal(editor.carEditorPreviewFrameCache,frame);
    assert.equal(frame.lastRenderMs,900,'pointer events must not force extra preview renders');
    assert.equal(editor.raceCarBillboardLayerCache.get('unchanged-body'),layer);
    assert.equal(editor.raceCarTireScrollCache.get('unchanged-tread'),tread);
    assert.deepEqual(preview.session.runtimeCar.art.angleLayers,editor.selectedCar.art.angleLayers);
    editor.carArtSliderDrag=null;editor.invalidateCarEditorPreviewFrame();
    assert.equal(frame.lastRenderMs,-Infinity,'release schedules the final size for redraw');
  }finally{globalThis.Worker=previousWorker;}
});

test('art transform edits are absent from physics revisions but graphics and physical tuning still invalidate them',()=>{
  const editor=setup(),before=editor.getCarEditorPreviewTuningRevision();
  for(const [id,value] of [['body-x',2],['body-y',3],['body-offset-x',1],['body-rotation',15],['tire-x',2],['tire-spacing',1.5],['front-offset-y',3],['brake-x',2],['shadow-y',2],['dashboard-x',2],['steering-wheel-offset-x',1]]){
    editor.setCarArtScaleValue(id,value);
    assert.equal(editor.getCarEditorPreviewTuningRevision(),before,id);
  }
  assert.equal(editor.carEditorPreviewPlaytest.session.runtimeCar.art.interior.dashboard.scaleX,2);
  assert.equal(editor.carEditorPreviewPlaytest.session.runtimeCar.art.interior.steeringWheel.offsetX,1);
  editor.selectedCar.tuning.powerHp+=20;assert.notEqual(editor.getCarEditorPreviewTuningRevision(),before);
  const physical=editor.getCarEditorPreviewTuningRevision();
  editor.setCarAngleArt('body','front','new-body',editor.selectedCar,1);
  assert.notEqual(editor.getCarEditorPreviewTuningRevision(),physical);
});

test('drag rendering scales original artwork directly without allocating resized or scrolled canvases',()=>{
  const previousDocument=globalThis.document;let canvases=0,draws=0;
  globalThis.document={createElement:()=>{canvases++;return {getContext:()=>({drawImage(){}})};}};
  try{
    const editor=setup(),source={width:100,height:200};editor.carArtSliderDrag={id:'drag'};
    for(let width=50;width<170;width++){
      assert.equal(editor.getRaceCarBillboardLayerCanvas(source,width,width*2,'body:test'),source);
      editor.drawScrolledCarTireArt({drawImage(){draws++;}},source,0,0,width,width*2,{scroll:0.25});
    }
    assert.equal(canvases,0);assert.equal(draws,240,'tread continues scrolling using two source rectangles');
    editor.carArtSliderDrag=null;
    assert.notEqual(editor.getRaceCarBillboardLayerCanvas(source,70,140,'body:test'),source);
    assert.equal(canvases,1,'normal caching resumes after release');
  }finally{globalThis.document=previousDocument;}
});

test('100 pointer updates render only at the existing preview cadence and reuse one canvas',()=>{
  const editor=setup(),previousDocument=globalThis.document;let allocations=0,renders=0,now=1000,lastScale;
  globalThis.document={createElement:()=>{allocations++;return {getContext:()=>({clearRect(){}})};}};
  editor.ensureCarEditorPreviewPlaytestSession=()=>editor.carEditorPreviewPlaytest;
  editor.getNowMs=()=>now;editor.markRaceStartupFrameRendered=()=>{};
  editor.drawRacePlaytestFrameSafely=()=>{renders++;lastScale=editor.playtestSession.runtimeCar.art.angleLayers.front.body.transforms.bodyScaleX;return true;};
  const region={id:'body-x',min:0.25,max:4,track:{x:0,w:100}};
  editor.carArtSliderDrag={id:'drag',region};
  try{
    for(let i=0;i<100;i++){
      now=1000+i*10;editor.updateCarArtSlider(region,i);
      editor.drawCarEditorPreview({drawImage(){}},{x:0,y:0,w:400,h:300});
    }
    assert.equal(renders,20);assert.equal(allocations,1);
    editor.handlePointerUp({id:'drag',x:99,y:0});now++;
    assert.equal(editor.carArtSliderDrag,null);
    editor.drawCarEditorPreview({drawImage(){}},{x:0,y:0,w:400,h:300});
    assert.equal(renders,21);assert.equal(allocations,1);
    assert.equal(lastScale,editor.selectedCar.art.angleLayers.front.body.transforms.bodyScaleX);
  }finally{globalThis.document=previousDocument;}
});
