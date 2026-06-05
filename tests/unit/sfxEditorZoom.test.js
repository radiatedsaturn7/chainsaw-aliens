import test from 'node:test';
import assert from 'node:assert/strict';

test('SFX timeline zoom preserves visible center time', async () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return {
        style: {},
        addEventListener() {},
        set type(_value) {},
        set accept(_value) {},
        set multiple(_value) {}
      };
    },
    body: {
      appendChild() {}
    }
  };
  const { default: SfxEditor } = await import('../../src/ui/SfxEditor.js');
  const editor = new SfxEditor({});
  editor.timelineVisibleDuration = 4;
  editor.timelineScrollTime = 2;

  const viewport = editor.setTimelineVisibleDurationPreservingCenter(2, 10);

  assert.equal(viewport.duration, 2);
  assert.equal(viewport.start, 3);
  assert.equal(viewport.end, 5);
  assert.equal(editor.timelineScrollTime, 3);
  globalThis.document = previousDocument;
});
