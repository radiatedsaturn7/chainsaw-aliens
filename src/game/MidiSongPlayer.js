import { isDrumChannel } from '../audio/gm.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
  }

  setSong(song, trackId) {
    this.song = song;
    this.trackId = trackId;
    this.playheadTick = 0;
    this.volume = 0;
    this.targetVolume = 1;
    this.fadeSpeed = 0;
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

  getLoopStartTick() {
    if (!this.song || typeof this.song.loopStartTick !== 'number') return 0;
    return clamp(this.song.loopStartTick, 0, this.getLoopTicks());
  }

  update(dt) {
    if (!this.song) return;
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

    const tempo = Number.isFinite(this.song.tempo) ? this.song.tempo : 120;
    const ticksPerSecond = (tempo / 60) * this.ticksPerBeat;
    const loopTicks = this.getLoopTicks();
    const loopStart = this.getLoopStartTick();
    const prevTick = this.playheadTick;
    const nextTick = prevTick + ticksPerSecond * dt;

    if (nextTick >= loopTicks) {
      this.triggerPlayback(prevTick, loopTicks, loopTicks);
      this.playheadTick = loopStart + (nextTick - loopTicks);
      this.triggerPlayback(loopStart, this.playheadTick, loopTicks);
      return;
    }

    this.playheadTick = nextTick;
    this.triggerPlayback(prevTick, this.playheadTick, loopTicks);
  }

  triggerPlayback(startTick, endTick, loopTicks) {
    if (!this.song) return;
    this.song.tracks.forEach((track) => {
      if (this.isTrackMuted(track)) return;
      const pattern = track.patterns?.[0];
      if (!pattern) return;
      pattern.notes.forEach((note) => {
        const noteStart = note.startTick;
        if (noteStart >= startTick && noteStart < endTick) {
          this.playNote(track, note);
        }
      });
    });
  }

  isTrackMuted(track) {
    const soloTracks = this.song.tracks.filter((entry) => entry.solo);
    if (soloTracks.length > 0) {
      return !track.solo;
    }
    return track.mute;
  }

  playNote(track, note) {
    if (!this.audio?.playGmNote) return;
    const duration = note.durationTicks / this.ticksPerBeat;
    const velocity = note.velocity ?? 0.8;
    const volume = clamp(velocity * (track.volume ?? 0.8) * this.volume, 0, 1);
    const pan = track.pan ?? 0;
    const channel = isDrumChannel(track.channel) ? 9 : track.channel;
    this.audio.playGmNote({
      pitch: note.pitch,
      duration,
      volume,
      program: track.program ?? 0,
      channel,
      bankMSB: track.bankMSB ?? 0,
      bankLSB: track.bankLSB ?? 0,
      pan
    });
  }
}
