import test from 'node:test';
import assert from 'node:assert/strict';
import { carSheetDocument, carSheetDimensions, prepareCarSheet, assignCarSheet } from '../../src/racing/CarGraphicImport.js';
import { RACE_CAR_SHELL_FRAME_SLOTS as slots } from '../../src/racing/raceData.js';
import RaceEditor from '../../src/ui/RaceEditor.js';

function sheetFixture() {
  const width = 83, height = 43, data = new Uint8ClampedArray(width * height * 4);
  // Crosses the old x=20.75 grid line; second row uses different spacing.
  const boxes = [[3,3,20,8], [26,2,9,10], [44,4,11,7], [65,2,12,9],
    [2,24,12,10], [22,25,13,8], [43,23,15,12], [66,26,10,9]];
  boxes.forEach(([x,y,w,h], frame) => {
    for (let dy=0; dy<h; dy++) for (let dx=0; dx<w; dx++) data.set([frame+1,dx,dy,frame === 1 ? 128 : 255], ((y+dy)*width+x+dx)*4);
  });
  return { width, height, data, boxes };
}

test('finds staggered sprite gutters, crops and centers on a common padded canvas', () => {
  const image = sheetFixture();
  const prepared = prepareCarSheet(image);
  assert.equal(prepared.width, 22); assert.equal(prepared.height, 14);
  const doc = carSheetDocument(image);
  image.boxes.forEach(([x,y,w,h], i) => {
    assert.deepEqual(prepared.crops[i], { x,y,width:w,height:h });
    const frame = doc.frames[i];
    assert.equal(frame.filter(Boolean).length, w*h);
    const dx = Math.floor((doc.width-w)/2), dy = Math.floor((doc.height-h)/2);
    assert.equal(frame[dy*doc.width+dx], i === 1 ? '#02000080' : '#' + (i+1).toString(16).padStart(2,'0') + '0000');
    assert.equal(frame[0], null);
    for (let py=0; py<h; py++) for (let px=0; px<w; px++) {
      const actual = prepared.frames[i].slice(((dy+py)*doc.width+dx+px)*4, ((dy+py)*doc.width+dx+px)*4+4);
      const offset = ((y+py)*image.width+x+px)*4;
      assert.deepEqual(actual, image.data.slice(offset,offset+4));
    }
  });
});

test('rejects opaque sheets, missing sprites, and oversized input without cutting pixels', () => {
  assert.throws(() => prepareCarSheet({ width: 40, height: 20, data: new Uint8ClampedArray(40*20*4).fill(255) }), /without cutting/);
  const image = sheetFixture();
  const [x,y,w,h] = image.boxes[0];
  for (let dy=0; dy<h; dy++) for(let dx=0; dx<w; dx++) image.data[((y+dy)*image.width+x+dx)*4+3] = 0;
  assert.throws(() => prepareCarSheet(image), /empty/);
  for (const pair of [[0,0], [4096,4096]]) assert.throws(() => carSheetDimensions(...pair));
  assert.doesNotThrow(() => carSheetDimensions(83,43));
});

test('remapped imports preserve other components and overrides through car save/load', () => {
  const e = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });
  const car = e.selectedCar;
  car.art.angleLayers = { front: { body: { transforms: { bodyScaleX: 2 }, visible: false }, tires: { artRef: 'tires', frameIndex: 3 } } };
  const mapping = [4,3,2,1,0,7,6,5];
  assignCarSheet(car, 'body', 'Imported', mapping);
  const restored = e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())).car);
  slots.forEach((slot, i) => {
    assert.equal(restored.art.angleLayers[slot].body.artRef, 'Imported');
    assert.equal(restored.art.angleLayers[slot].body.frameIndex, mapping[i]);
  });
  assert.equal(restored.art.angleLayers.front.body.transforms.bodyScaleX, 2);
  assert.equal(restored.art.angleLayers.front.body.visible, false);
  assert.equal(restored.art.angleLayers.front.tires.artRef, 'tires');
  const before = JSON.stringify(car);
  assert.throws(() => assignCarSheet(car, 'body', 'Bad', [0,0,2,3,4,5,6,7]));
  assert.equal(JSON.stringify(car), before);
});

test('rtgframes: faint alpha haze no longer blocks all eight crops', async () => {
  const { readFileSync } = await import('node:fs');
  const { inflateSync } = await import('node:zlib');
  // Fixture is a lossless RGBA PNG exported from the user-provided art document.
  const png = readFileSync(new URL('../fixtures/rtgframes.png', import.meta.url));
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  const chunks = [];
  for (let pos = 8; pos < png.length;) {
    const length = png.readUInt32BE(pos);
    if (png.toString('ascii', pos + 4, pos + 8) === 'IDAT') chunks.push(png.subarray(pos + 8, pos + 8 + length));
    pos += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks)), data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const offset = y * (width * 4 + 1);
    assert.equal(raw[offset], 0);
    data.set(raw.subarray(offset + 1, offset + 1 + width * 4), y * width * 4);
  }
  const image = { width, height, data }, original = data.slice();
  assert.throws(() => prepareCarSheet(image, { alphaThreshold: 0 }), /without cutting/);
  const result = prepareCarSheet(image);
  assert.equal(result.width, 148); assert.equal(result.height, 82);
  assert.equal(result.frames.length, 8);
  assert.ok(result.cleanedPixels > 2000);
  assert.deepEqual(data, original);
  // Every pixel above the cleanup threshold survives, including antialiasing.
  const count = values => { let n=0; for(let i=3;i<values.length;i+=4) if(values[i]>8) n++; return n; };
  assert.equal(result.frames.reduce((n, frame) => n + count(frame), 0), count(data));
  assert.deepEqual(result.crops.map(c => c.width), [87,123,144,112,89,117,146,118]);
});

test('newly imported angles render immediately in a prepared-only live preview', async () => {
  const { saveProjectFile } = await import('../../src/ui/projectFiles.js');
  const e = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });
  const originalDocument = globalThis.document;
  const documentRef = {
    createElement() {
      const canvas = { width: 0, height: 0 };
      canvas.getContext = () => ({
        createImageData: (w,h) => ({ data: new Uint8ClampedArray(w*h*4) }),
        putImageData: image => { canvas.pixels = image.data; }
      });
      return canvas;
    }
  };
  const car = e.selectedCar;
  const session = { runtimeCar: JSON.parse(JSON.stringify(car)), raceTravelPreparedArtOnly: true, carEditorPreview: true };
  e.carEditorPreviewPlaytest = { carId: car.id, session };
  e.playtestSession = session;
  const ref = 'import-preview-regression';
  saveProjectFile('art', ref, { width: 1, height: 1, frames: slots.map((_,i) => ['#' + (i+1).toString(16).padStart(2,'0') + '0000']) });
  const mapping = [4,3,2,1,0,7,6,5];
  assignCarSheet(car, 'body', ref, mapping);
  try {
    globalThis.document = documentRef;
    assert.equal(e.getRaceArtSpriteCanvas(ref), null, 'prepared-only preview cannot see newly saved art');
    e.syncCarAnglePreviewArt(car);
    for (let i=0; i<8; i++) {
      const entry = session.runtimeCar.art.angleLayers[slots[i]].body;
      const canvas = e.getRaceArtSpriteCanvas(entry.artRef, { frameIndex: entry.frameIndex });
      assert.ok(canvas, `angle ${i*45} is renderable`);
      assert.equal(canvas.pixels[0], mapping[i]+1, 'uses the actual assigned frame, not frame zero fallback');
      assert.equal(canvas.pixels[3], 255);
    }
    assert.equal(e.racePreparedArtFrames.size, 8);
    assert.equal(session.raceTravelPreparedArtOnly, true);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test('body import compensates for each frame’s transparent borders and keeps mapped fit after save/load', () => {
  const doc = carSheetDocument(sheetFixture());
  const e = new RaceEditor({ deviceIsMobile: false, isMobile: false, exitRaceEditor() {} }, { mode: 'car' });
  const mapping = [4,3,2,1,0,7,6,5];
  assignCarSheet(e.selectedCar, 'body', 'fitted-car', mapping, doc);
  const restored = e.normalizeLoadedCarDocument(JSON.parse(JSON.stringify(e.serializeSelectedCarDocument())).car);
  slots.forEach((slot,i) => {
    const entry = restored.art.angleLayers[slot].body;
    const box = sheetFixture().boxes[mapping[i]];
    assert.equal(entry.fitToCar, true);
    assert.equal(entry.transforms.bodyScaleX * box[2] / doc.width, 1);
    assert.equal(entry.transforms.bodyScaleY * box[3] / doc.height, 1);
  });
});
