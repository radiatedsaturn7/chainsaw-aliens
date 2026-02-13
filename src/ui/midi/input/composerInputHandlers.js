export function registerComposerInputHandlers(composer) {
  composer.inputBus.on('noteon', (event) => composer.handleRecordedNoteOn(event));
  composer.inputBus.on('noteoff', (event) => composer.handleRecordedNoteOff(event));
  composer.inputBus.on('cc', (event) => composer.handleRecordedCc(event));
  composer.inputBus.on('pitchbend', (event) => composer.handleRecordedPitchBend(event));
  composer.inputBus.on('toggleRecord', () => {
    if (composer.recordModeActive) {
      if (composer.recorder.isRecording) {
        composer.stopRecording();
      } else {
        composer.startRecording();
      }
    } else {
      composer.enterRecordMode();
    }
  });
}
