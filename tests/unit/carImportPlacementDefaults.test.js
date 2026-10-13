import test from 'node:test';
import assert from 'node:assert/strict';
import RaceEditor from '../../src/ui/RaceEditor.js';
import {createTireDefinition} from '../../src/racing/raceTires.js';
const editor=()=>new RaceEditor({},{mode:'car'});
const slots=['front','frontRight','right','rearRight','rear','rearLeft','left','frontLeft'];
const document={width:2,height:2,frames:Array.from({length:8},()=>['#ffffff',null,null,null])};
const mapping=[4,3,2,1,0,7,6,5];

test('car sheet import uses WRX4 placement without copying its artwork or frame order',()=>{
  const e=editor(),car=e.selectedCar,tuning=structuredClone(car.tuning);
  e.assignImportedCarGraphic(car,'body','New car',{mapping,document});
  for(const [i,slot] of slots.entries()){
    const body=car.art.angleLayers[slot].body;
    assert.equal(body.artRef,'New car');assert.equal(body.frameIndex,mapping[i]);assert.equal(body.fitToCar,true);
  }
  assert.equal(car.art.angleLayers.front.body.transforms.bodyOffsetX,0.03383458646616333);
  assert.equal(car.art.angleLayers.frontRight.body.transforms.bodyScaleX,4.083142548754699);
  assert.equal(car.art.angleLayers.frontLeft.body.transforms.bodyRotationDeg,3.753356361996481);
  assert.equal(car.art.angleLayers.rear.body.transforms.bodyRotationDeg,0);
  assert.deepEqual(car.tuning,tuning);
  const loaded=e.normalizeLoadedCarDocument(e.serializeSelectedCarDocument());
  assert.deepEqual(loaded.art.angleLayers,car.art.angleLayers);
  e.undoRaceHistory();assert.equal(e.selectedCar.art.angleLayers?.front?.body?.artRef,undefined);
});

test('replacing graphics preserves existing adjustments and leaves other components alone',()=>{
  const e=editor(),car=e.selectedCar;
  car.art.angleLayers={front:{body:{artRef:'Old body',frameIndex:1,transforms:{bodyScaleX:7,bodyRotationDeg:0}},tires:{artRef:'Custom tire',transforms:{frontTireOffsetX:9}}}};
  const tires=structuredClone(car.art.angleLayers.front.tires);
  e.assignImportedCarGraphic(car,'body','Replacement',{mapping,document});
  assert.equal(car.art.angleLayers.front.body.transforms.bodyScaleX,7);
  assert.equal(car.art.angleLayers.front.body.transforms.bodyRotationDeg,0);
  assert.deepEqual(car.art.angleLayers.front.tires,tires);
  car.art.angleLayers.rear.body.transforms.bodyScaleX=11;
  const other=editor();other.assignImportedCarGraphic(other.selectedCar,'body','Independent',{mapping,document});
  assert.equal(other.selectedCar.art.angleLayers.rear.body.transforms.bodyScaleX,2.0891652960526312);
});

test('applying a saved tire starts with WRX4 offsets and spacing but keeps its own surfaces and automatic visibility',()=>{
  const e=editor(),tire=createTireDefinition('snow');
  tire.graphics.angleLayers=Object.fromEntries(slots.map(slot=>[slot,{tires:{artRef:'New wheel',frameIndex:1,tireMode:'auto',cylinder:true}}]));
  e.applySelectedCarTire(tire,'New tire');
  const art=e.selectedCar.art;
  assert.equal(art.angleLayers.front.tires.transforms.tireSpacingScale,1.1041129434915415);
  assert.equal(art.angleLayers.right.tires.transforms.frontTireOffsetX,-0.5212640977443623);
  assert.equal(art.angleLayers.frontRight.tires.transforms.frontTireOffsetX,-1.0499295112781954);
  for(const slot of slots){assert.equal(art.angleLayers[slot].tires.artRef,'New wheel');assert.equal(art.angleLayers[slot].tires.tireMode,'auto');}
  art.angleLayers.front.tires.transforms.tireScaleX=8;
  e.applySelectedCarTire(tire,'Another tire');
  assert.equal(e.selectedCar.art.angleLayers.front.tires.transforms.tireScaleX,8);
});
