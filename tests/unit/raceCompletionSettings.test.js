import test from 'node:test';
import assert from 'node:assert/strict';

import RaceEditor from '../../src/ui/RaceEditor.js';

const createEditor = () => new RaceEditor({
  deviceIsMobile: false,
  isMobile: false,
  exitRaceEditor() {}
});

test('On Race Complete saves a selected level and arrival tile', () => {
  const editor = createEditor();

  editor.openRaceCompleteDialog();
  assert.equal(editor.raceSettingsDialog, 'complete');
  assert.equal(editor.raceSettingsDialogDraft.type, 'return-to-origin');

  Object.assign(editor.raceSettingsDialogDraft, {
    type: 'level',
    targetLevel: 'Garage',
    spawnX: 12.8,
    spawnY: 7.2
  });
  editor.closeRaceSettingsDialog({ accept: true });

  assert.deepEqual(editor.selectedRace.finishBehavior, {
    type: 'level',
    targetLevel: 'Garage',
    targetRace: null,
    spawnX: 12,
    spawnY: 7
  });
  assert.equal(editor.status, 'On complete: Garage');
});

test('On Race Complete clears fields that do not belong to the selected destination type', () => {
  const editor = createEditor();
  editor.selectedRace.finishBehavior = {
    type: 'level',
    targetLevel: 'Garage',
    targetRace: 'Old Race',
    spawnX: 4,
    spawnY: 6
  };

  editor.openRaceCompleteDialog();
  Object.assign(editor.raceSettingsDialogDraft, {
    type: 'race',
    targetRace: 'Desert Run'
  });
  editor.closeRaceSettingsDialog({ accept: true });

  assert.deepEqual(editor.selectedRace.finishBehavior, {
    type: 'race',
    targetLevel: null,
    targetRace: 'Desert Run',
    spawnX: null,
    spawnY: null
  });
});
