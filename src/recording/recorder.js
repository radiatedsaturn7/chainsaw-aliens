const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const quantizeTick = (tick, step) => {
  if (!step || step <= 0) return Math.max(0, tick);
  return Math.max(0, Math.round(tick / step) * step);
};

export default class MidiRecorder {
  constructor({ getTime }) {
    this.getTime = getTime || (() => performance.now() / 1000);
    this.reset();
  }

  reset() {
    this.isRecording = false;
    this.startTime = 0;
    this.stopTime = 0;
    this.ticksPerBeat = 8;
    this.beatsPerBar = 4;
    this.tempo = 120;
    this.quantizeDivisor = null;
    this.noteCounter = 0;
    this.activeNotes = new Map();
    this.completedNotes = [];
    this.automation = [];
  }

  startRecording({ tempo, ticksPerBeat, beatsPerBar, startTime = null, quantizeDivisor = null }) {
    this.reset();
    this.isRecording = true;
    this.tempo = tempo || 120;
    this.ticksPerBeat = ticksPerBeat || 8;
    this.beatsPerBar = beatsPerBar || 4;
    this.quantizeDivisor = quantizeDivisor;
    this.startTime = typeof startTime === 'number' ? startTime : this.getTime();
    this.stopTime = 0;
  }

  stopRecording(stopTime = null) {
    if (!this.isRecording) return;
    this.stopTime = typeof stopTime === 'number' ? stopTime : this.getTime();
    const closeTime = Math.max(this.stopTime, this.startTime);
    this.activeNotes.forEach((note) => {
      note.endTime = closeTime;
      this.completedNotes.push(note);
    });
    this.activeNotes.clear();
    this.isRecording = false;
  }

  isArmed(time) {
    return time >= this.startTime;
  }

  ensureNoteId(id) {
    if (id) return id;
    this.noteCounter += 1;
    return `rec-note-${this.noteCounter}`;
  }

  recordNoteOn({ id, pitch, velocity = 100, time = null, channel = 0, trackId = null }) {
    if (!this.isRecording) return null;
    const eventTime = typeof time === 'number' ? time : this.getTime();
    if (!this.isArmed(eventTime)) {
      return null;
    }
    const noteId = this.ensureNoteId(id);
    this.activeNotes.set(noteId, {
      id: noteId,
      pitch,
      velocity,
      startTime: eventTime,
      endTime: null,
      channel,
      trackId
    });
    return noteId;
  }

  recordNoteOff({ id, time = null }) {
    if (!this.isRecording) return;
    const eventTime = typeof time === 'number' ? time : this.getTime();
    const note = this.activeNotes.get(id);
    if (!note) return;
    note.endTime = Math.max(eventTime, note.startTime);
    this.completedNotes.push(note);
    this.activeNotes.delete(id);
  }

  recordCC({ controller, value, time = null, channel = 0, trackId = null }) {
    if (!this.isRecording) return;
    const eventTime = typeof time === 'number' ? time : this.getTime();
    if (!this.isArmed(eventTime)) return;
    this.automation.push({
      type: 'cc',
      controller,
      value: clamp(Math.round(value), 0, 127),
      time: eventTime,
      channel,
      trackId
    });
  }

  recordPitchBend({ value, time = null, channel = 0, trackId = null }) {
    if (!this.isRecording) return;
    const eventTime = typeof time === 'number' ? time : this.getTime();
    if (!this.isArmed(eventTime)) return;
    this.automation.push({
      type: 'pitchbend',
      value: clamp(Math.round(value), 0, 16383),
      time: eventTime,
      channel,
      trackId
    });
  }

  getActiveNotes() {
    return Array.from(this.activeNotes.values());
  }

  getRecordedNotes() {
    return this.completedNotes;
  }

  getAutomation() {
    return this.automation;
  }

  secondsToTicks(seconds) {
    const ticksPerSecond = (this.tempo / 60) * this.ticksPerBeat;
    return seconds * ticksPerSecond;
  }

  getQuantizeStep() {
    if (!this.quantizeDivisor) return null;
    return (this.ticksPerBeat * this.beatsPerBar) / this.quantizeDivisor;
  }

  commitRecordedTakeToScore({ pattern, startTickOffset = 0 }) {
    if (!pattern) return { notes: [], automation: [] };
    const step = this.getQuantizeStep();
    const notes = this.completedNotes
      .filter((note) => typeof note.endTime === 'number')
      .map((note) => {
        const startSeconds = Math.max(0, note.startTime - this.startTime);
        const durationSeconds = Math.max(0.05, note.endTime - note.startTime);
        const rawStartTick = startTickOffset + this.secondsToTicks(startSeconds);
        const rawDuration = this.secondsToTicks(durationSeconds);
        const startTick = quantizeTick(rawStartTick, step);
        const endTick = quantizeTick(startTick + rawDuration, step) || startTick + 1;
        const durationTicks = Math.max(1, endTick - startTick);
        return {
          id: note.id,
          startTick,
          durationTicks,
          pitch: note.pitch,
          velocity: clamp(note.velocity / 127, 0.05, 1)
        };
      });

    notes.forEach((note) => {
      pattern.notes.push({ ...note, id: note.id || `note-${Math.random()}` });
    });

    const automation = this.automation.map((event) => {
      const timeSeconds = Math.max(0, event.time - this.startTime);
      const rawTick = startTickOffset + this.secondsToTicks(timeSeconds);
      const tick = quantizeTick(rawTick, step);
      return { ...event, tick };
    });

    if (automation.length) {
      if (!pattern.automation) {
        pattern.automation = [];
      }
      pattern.automation.push(...automation);
    }

    return { notes, automation };
  }
}
