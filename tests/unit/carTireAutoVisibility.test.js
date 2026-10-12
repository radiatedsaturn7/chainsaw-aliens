import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {resolveCarAngleLayers,getCarViewCameraYaw} from '../../src/racing/CarDirectionalArt.js';
import {assignCarTireSheet} from '../../src/racing/CarGraphicImport.js';
import {applyTireDefinition,createTireDefinition} from '../../src/racing/raceTires.js';

const views={front:['fl','fr'],frontRight:['fr','rr'],right:['fr','rr'],rearRight:['fr','rr'],rear:['rl','rr'],rearLeft:['fl','rl'],left:['fl','rl'],frontLeft:['fl','rl']};
const wheels=['fl','fr','rl','rr'];
const editor=()=>new RaceEditor({deviceIsMobile:false,isMobile:false},{mode:'car'});
const document={width:4,height:4,frames:[Array(16).fill('#777777'),Array(16).fill('#999999')]};
function visible(e,car,slot){const flags=e.getCarArtLayerVisibility(resolveCarAngleLayers(car,slot));return wheels.filter(id=>e.isCarWheelVisible(flags,id));}

test('tire sheet import and saved tire selection automatically choose the near pair for all eight views',()=>{
  const e=editor();assignCarTireSheet(e.selectedCar,'tires',document);
  const tire=createTireDefinition();tire.graphics=structuredClone(e.selectedCar.art);
  const selected=editor();applyTireDefinition(selected.selectedCar,tire,'Saved Tire');
  const loaded=e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())));
  for(const [slot,expected] of Object.entries(views)){
    for(const car of [e.selectedCar,selected.selectedCar,loaded]){
      assert.equal(car.art.angleLayers[slot].tires.tireMode,'auto');
      assert.deepEqual(visible(e,car,slot),expected,slot);
    }
  }
});

test('existing imported artwork defaults to auto while procedural tires and explicit overrides are retained',()=>{
  const e=editor();
  assert.deepEqual(visible(e,e.selectedCar,'front'),wheels);
  e.selectedCar.art.tires=['legacy-art'];
  for(const [slot,expected] of Object.entries(views))assert.deepEqual(visible(e,e.selectedCar,slot),expected);
  e.selectedCarShellFrameSlot='frontRight';e.setCarTireVisibilityMode('visible');
  assert.deepEqual(visible(e,e.selectedCar,'frontRight'),wheels);
  assignCarTireSheet(e.selectedCar,'replacement',document);
  assert.deepEqual(visible(e,e.selectedCar,'frontRight'),wheels,'reimport preserves a manual choice');
  e.setCarTireVisibilityMode('auto');assert.deepEqual(visible(e,e.selectedCar,'frontRight'),views.frontRight);
  e.setCarTireVisibilityMode('hidden');assert.deepEqual(visible(e,e.selectedCar,'frontRight'),[]);
  e.undoRaceHistory();assert.deepEqual(visible(e,e.selectedCar,'frontRight'),views.frontRight);
});

test('billboard renderer draws the automatic tire pair at each physical camera bearing',()=>{
  const e=editor();
  for(const slot of Object.keys(views))e.setCarAngleArt('tires',slot,'single-frame');
  e.getRaceArtSpriteCanvas=()=>({width:8,height:16});e.getRaceCarBillboardLayerCanvas=c=>c;
  for(const [slot,expected] of Object.entries(views)){
    let x;const drawn=[];
    const ctx=new Proxy({translate:value=>{x=value;}},{get:(o,k)=>k in o?o[k]:()=>{}});
    e.drawScrolledCarTireArt=()=>{drawn.push(wheels[x-1]);return true;};
    e.drawRaceCarBillboardLayers(ctx,{car:e.selectedCar,
      artChoice:e.getRaceCarProjectedArtRef(e.selectedCar,0,getCarViewCameraYaw(slot)),
      drawBodyLayer:false,drawShadowLayer:false,
      wheelBillboards:Object.fromEntries(wheels.map((id,i)=>[id,{x:i+1,y:10,width:8,height:16}]))});
    assert.deepEqual(drawn,expected,slot);
    e.selectedCarShellFrameSlot=slot;
    assert.equal(e.getCarTireVisibilityMode(e.getCarEditorAngleCar()),'auto');
  }
});
