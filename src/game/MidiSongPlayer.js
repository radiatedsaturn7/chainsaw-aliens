import {
  GM_DRUM_BANK_LSB,
  GM_DRUM_BANK_MSB,
  GM_DRUM_CHANNEL,
  clampDrumPitch,
  isDrumChannel,
  mapPitchToDrumRow
} from '../audio/gm.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const MIDI_RUNTIME_MAX_CATCHUP_SECONDS = 0.35;
export const MIDI_RUNTIME_STALE_BACKLOG_SECONDS = 1.25;
export const MIDI_RUNTIME_SCHEDULE_LOOKAHEAD_SECONDS = 0.42;
export const MIDI_RUNTIME_MIN_SCHEDULE_LATENCY_SECONDS = 0.08;
export const MIDI_RUNTIME_MAX_EVENTS_PER_UPDATE = 256;

export default class MidiSongPlayer {
  constructor(audio) {
    this.audio = audio;
    this.song = null;
    this.trackId = null;
    this.ticksPerBeat = 8;
    this.beatsPerBar = 4;
    this.playheadTick = 0;
    this.volume = 0;
    this.targetVolume = 0;
    this.fadeSpeed = 0;
    this.loop = true;
    this.finished = false;
    this.events = [];
    this.droppedEvents = 0;
    this.scheduledUntilTick = 0;
    this.audioAnchorTime = null;
    this.audioAnchorTick = 0;
  }

  setSong(song, trackId, { loop = true, startTick = null, offsetMs = 0 } = {}) {
    this.song = song;
    this.trackId = trackId;
    this.volume = 0;
    this.targetVolume = 1;
    this.fadeSpeed = 0;
    this.loop = loop !== false;
    this.finished = false;
    this.events = this.buildEvents();
    const tempo = this.getTempo();
    const ticksPerSecond = this.getTicksPerSecond(tempo);
    const offsetTick = Number.isFinite(offsetMs) && offsetMs > 0
      ? (offsetMs / 1000) * ticksPerSecond
      : 0;
    this.playheadTick = clamp(Number.isFinite(startTick) ? startTick : offsetTick, 0, this.getLoopTicks());
    this.scheduledUntilTick = this.playheadTick;
    this.droppedEvents = 0;
    this.resetAudioAnchor(this.playheadTick);
  }

  resetAudioAnchor(tick = this.playheadTick) {
    const now = this.audio?.ctx?.currentTime;
    this.audioAnchorTime = Number.isFinite(now)
      ? now + Math.max(this.audio?.midiLatency || 0, MIDI_RUNTIME_MIN_SCHEDULE_LATENCY_SECONDS)
      : null;
    this.audioAnchorTick = tick;
  }

  setFade(target, duration) {
    this.targetVolume = clamp(target ?? 0, 0, 1);
    if (!duration || duration <= 0) {
      this.volume = this.targetVolume;
      this.fadeSpeed = 0;
      return;
    }
    this.fadeSpeed = (this.targetVolume - this.volume) / duration;
  }

  getLoopTicks() {
    if (!this.song) return 0;
    if (typeof this.song.loopEndTick === 'number') {
      return Math.max(1, this.song.loopEndTick);
    }
    const loopBars = Number.isFinite(this.song.loopBars) ? this.song.loopBars : 8;
    return loopBars * this.beatsPerBar * this.ticksPerBeat;
  }

  getTempo() {
    return Number.isFinite(this.song?.tempo) ? this.song.tempo : 120;
  }

  getTicksPerSecond(tempo = this.getTempo()) {
    return (tempo / 60) * this.ticksPerBeat;
  }

  buildEvents() {
    if (!this.song?.tracks) return [];
    const events = [];
    const soloTracks = this.song.tracks.filter((entry) => entry?.solo);
    this.song.tracks.forEach((track) => {
      if (!track) return;
      if (soloTracks.length > 0 ? !track.solo : track.mute) return;
      const pattern = track.patterns?.[0];
      if (!pattern?.notes) return;
      pattern.notes.forEach((note) => {
        if (!Number.isFinite(note?.startTick)) return;
        events.push({
          tick: note.startTick,
          track,
          note
        });
      });
    });
    events.sort((a, b) => a.tick - b.tick || (a.note.pitch ?? 0) - (b.note.pitch ?? 0));
    return events;
  }

  findEventIndexAtOrAfter(tick) {
    let low = 0;
    let high = this.events.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (this.events[mid].tick < tick) low = mid + 1;
      else high = mid;
    }
    return low;
  }

  getLoopStartTick() {
    if (!this.song || typeof this.song.loopStartTick !== 'number') return 0;
    return clamp(this.song.loopStartTick, 0, this.getLoopTicks());
  }

  update(dt) {
    if (!this.song || this.finished) return;
    if (this.volume !== this.targetVolume && this.fadeSpeed !== 0) {
      const next = this.volume + this.fadeSpeed * dt;
      if ((this.fadeSpeed > 0 && next >= this.targetVolume) || (this.fadeSpeed < 0 && next <= this.targetVolume)) {
        this.volume = this.targetVolume;
        this.fadeSpeed = 0;
      } else {
        this.volume = clamp(next, 0, 1);
      }
    }

    if (this.volume <= 0) return;

    const tempo = this.getTempo();
    const ticksPerSecond = this.getTicksPerSecond(tempo);
    const loopTicks = this.getLoopTicks();
    const loopStart = this.getLoopStartTick();
    const prevTick = this.playheadTick;
    const elapsedSeconds = clamp(Math.max(0, Number(dt) || 0), 0, MIDI_RUNTIME_STALE_BACKLOG_SECONDS);
    const nextTick = prevTick + ticksPerSecond * elapsedSeconds;

    if (nextTick >= loopTicks) {
      this.triggerPlayback(this.scheduledUntilTick, loopTicks, loopTicks, ticksPerSecond, loopTicks);
      if (!this.loop) {
        this.playheadTick = loopTicks;
        this.volume = 0;
        this.targetVolume = 0;
        this.fadeSpeed = 0;
        this.finished = true;
        return;
      }
      this.playheadTick = loopStart + (nextTick - loopTicks);
      this.scheduledUntilTick = loopStart;
      this.resetAudioAnchor(this.playheadTick);
      const lookaheadTicks = MIDI_RUNTIME_SCHEDULE_LOOKAHEAD_SECONDS * ticksPerSecond;
      const targetScheduleTick = Math.min(loopTicks, this.playheadTick + lookaheadTicks);
      if (targetScheduleTick > this.scheduledUntilTick) {
        this.triggerPlayback(this.scheduledUntilTick, targetScheduleTick, loopTicks, ticksPerSecond, this.playheadTick);
      }
      return;
    }

    this.playheadTick = nextTick;
    const lookaheadTicks = MIDI_RUNTIME_SCHEDULE_LOOKAHEAD_SECONDS * ticksPerSecond;
    const targetScheduleTick = Math.min(loopTicks, this.playheadTick + lookaheadTicks);
    if (targetScheduleTick > this.scheduledUntilTick) {
      this.triggerPlayback(this.scheduledUntilTick, targetScheduleTick, loopTicks, ticksPerSecond, this.playheadTick);
    }
  }

  triggerPlayback(startTick, endTick, loopTicks, ticksPerSecond = this.getTicksPerSecond(), currentTick = startTick) {
    if (!this.song || !this.events.length || endTick <= startTick) return;
    const staleTicks = MIDI_RUNTIME_STALE_BACKLOG_SECONDS * ticksPerSecond;
    const catchupTicks = MIDI_RUNTIME_MAX_CATCHUP_SECONDS * ticksPerSecond;
    const audibleStart = currentTick - startTick >= staleTicks
      ? Math.max(startTick, currentTick - catchupTicks)
      : startTick;
    if (audibleStart > startTick) {
      this.droppedEvents += this.countEventsInRange(startTick, audibleStart);
    }
    let played = 0;
    for (let index = this.findEventIndexAtOrAfter(audibleStart); index < this.events.length; index += 1) {
      const event = this.events[index];
      if (event.tick >= endTick) break;
      if (played >= MIDI_RUNTIME_MAX_EVENTS_PER_UPDATE) {
        this.droppedEvents += 1;
        continue;
      }
      const secondsFromAnchor = Math.max(0, (event.tick - this.audioAnchorTick) / Math.max(0.0001, ticksPerSecond));
      const secondsFromPlayhead = Math.max(0, (event.tick - currentTick) / Math.max(0.0001, ticksPerSecond));
      const minWhen = this.audio?.ctx?.currentTime != null
        ? this.audio.ctx.currentTime + Math.max(this.audio?.midiLatency || 0, MIDI_RUNTIME_MIN_SCHEDULE_LATENCY_SECONDS)
        : null;
      const anchoredWhen = this.audioAnchorTime != null
        ? this.audioAnchorTime + secondsFromAnchor
        : null;
      const when = minWhen != null
        ? Math.max(minWhen, anchoredWhen ?? (minWhen + secondsFromPlayhead))
        : null;
      this.playNote(event.track, event.note, { when, ticksPerSecond });
      played += 1;
    }
    this.scheduledUntilTick = Math.max(this.scheduledUntilTick, endTick);
  }

  countEventsInRange(startTick, endTick) {
    if (!this.events.length || endTick <= startTick) return 0;
    let count = 0;
    for (let index = this.findEventIndexAtOrAfter(startTick); index < this.events.length; index += 1) {
      if (this.events[index].tick >= endTick) break;
      count += 1;
    }
    return count;
  }

  isTrackMuted(track) {
    const soloTracks = this.song.tracks.filter((entry) => entry.solo);
    if (soloTracks.length > 0) {
      return !track.solo;
    }
    return track.mute;
  }

  playNote(track, note, { when = null, ticksPerSecond = this.getTicksPerSecond() } = {}) {
    if (!this.audio?.playGmNote) return;
    const duration = Math.max(0.03, note.durationTicks / Math.max(0.0001, ticksPerSecond));
    const velocity = note.velocity ?? 0.8;
    const volume = clamp(velocity * (track.volume ?? 0.8) * this.volume, 0, 1);
    const pan = track.pan ?? 0;
    const isDrums = track.instrument === 'drums' || track.isPercussion === true || isDrumChannel(track.channel);
    const channel = isDrums ? GM_DRUM_CHANNEL : track.channel;
    const pitch = isDrums ? mapPitchToDrumRow(clampDrumPitch(note.pitch)) : note.pitch;
    const bankMSB = isDrums ? (track.bankMSB ?? GM_DRUM_BANK_MSB) : (track.bankMSB ?? 0);
    const bankLSB = isDrums ? (track.bankLSB ?? GM_DRUM_BANK_LSB) : (track.bankLSB ?? 0);
    if (this.audio?.soundfont?.debug) {
      // eslint-disable-next-line no-console
      console.debug('[MIDI] noteOn', {
        trackId: track.id ?? null,
        channel,
        note: pitch,
        velocity,
        drum: isDrums,
        bankMSB,
        bankLSB,
        program: track.program ?? 0
      });
    }
    this.audio.playGmNote({
      pitch,
      duration,
      volume,
      program: track.program ?? 0,
      channel,
      bankMSB,
      bankLSB,
      pan,
      pedals: track?.midiPedals || [],
      trackId: track.id ?? null,
      when,
      maxScheduleLatenessSeconds: MIDI_RUNTIME_MAX_CATCHUP_SECONDS
    });
  }
}
