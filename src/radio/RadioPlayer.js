import { normalizeRadioLibrary, normalizeRadioProgress, radioStationTracks } from './RadioLibrary.js';
import { loadServerPreferenceAsync, saveServerPreference } from '../ui/serverPreferences.js';

export const RADIO_LIBRARY_KEY = 'rtg-radio-library';
export const RADIO_PROGRESS_KEY = 'rtg-radio-progress';

export class RadioPlayer {
  constructor({ createAudio = () => new Audio(), load = loadServerPreferenceAsync, save = saveServerPreference, onChange = () => {} } = {}) {
    this.createAudio = createAudio;this.loadPreference = load;this.savePreference = save;this.onChange = onChange;
    this.library = normalizeRadioLibrary();this.progress = normalizeRadioProgress();
    this.contextEnabled = false;this.audio = null;this.trackId = '';this.playing = false;this.error = '';
    this.generation = 0;this.saveQueue = Promise.resolve();this.volume = 0.8;
  }
  async load() {
    if (!this.loading) this.loading = Promise.all([this.loadPreference(RADIO_LIBRARY_KEY, {}), this.loadPreference(RADIO_PROGRESS_KEY, {})]).then(([library, progress]) => {
      this.library = normalizeRadioLibrary(library);this.progress = normalizeRadioProgress(progress);this.onChange();return this;
    });
    return this.loading;
  }
  persist(key, value) {
    const snapshot = structuredClone(value);
    // Serialize writes so a slow earlier unlock cannot overwrite a later pickup.
    const pending = this.saveQueue.then(() => this.savePreference(key, snapshot)).then(result => {
      if (result?.ok === false) throw Error(result.reason || 'Radio could not be saved');
      return result;
    });
    this.saveQueue = pending.catch(error => {this.error = error.message;this.onChange();});
    return pending;
  }
  async saveLibrary(value) {
    await this.load();const library = normalizeRadioLibrary(value);
    await this.persist(RADIO_LIBRARY_KEY, library);this.library = library;
    if (!this.tracks.some(track => track.id === this.trackId)) this.stop();this.onChange();
  }
  get available() { return this.progress.enabled && this.contextEnabled; }
  get stationId() { return this.library.stations.some(s => s.id === this.progress.stationId) ? this.progress.stationId : this.library.stations[0]?.id || ''; }
  get tracks() { return radioStationTracks(this.library, this.progress, this.stationId); }
  get currentTrack() { return this.library.tracks.find(track => track.id === this.trackId) || null; }
  setContext(enabled) { this.contextEnabled = enabled !== false;if (!this.available) this.stop();this.onChange(); }
  async setEnabled(enabled) { await this.load();this.progress.enabled = Boolean(enabled);if (!this.available) this.stop();this.onChange();await this.persist(RADIO_PROGRESS_KEY, this.progress); }
  async unlock(trackId) {
    await this.load();if (!this.library.tracks.some(track => track.id === trackId)) return false;
    if (this.progress.unlocked.includes(trackId)) {await this.persist(RADIO_PROGRESS_KEY, this.progress);return false;}
    this.progress.unlocked.push(trackId);this.onChange();await this.persist(RADIO_PROGRESS_KEY, this.progress);return true;
  }
  async setTrackEnabled(trackId, enabled) {
    await this.load();if (!this.library.tracks.some(track => track.id === trackId)) return;
    this.progress.disabled = this.progress.disabled.filter(id => id !== trackId);
    if (!enabled) this.progress.disabled.push(trackId);
    if (!enabled && this.trackId === trackId) {if (this.playing) await this.skip();else this.stop();}
    this.onChange();await this.persist(RADIO_PROGRESS_KEY, this.progress);
  }
  async selectStation(id) {
    await this.load();if (!this.library.stations.some(station => station.id === id)) return;
    const resume = this.playing;this.stop();this.progress.stationId = id;this.onChange();
    await this.persist(RADIO_PROGRESS_KEY, this.progress);if (resume) await this.play();
  }
  setVolume(volume) { this.volume = Math.max(0, Math.min(1, Number(volume) || 0));if (this.audio) this.audio.volume = this.volume; }
  async play(trackId = this.trackId) {
    await this.load();if (!this.available) return false;
    const track = this.tracks.find(item => item.id === trackId) || this.tracks[0];
    if (!track) {this.stop();return false;}
    if (!this.audio || track.id !== this.trackId) {
      this.stop();this.trackId = track.id;this.audio = this.createAudio();this.audio.src = track.src;this.audio.volume = this.volume;
      const audio = this.audio;
      audio.onended = () => {if (this.audio === audio) void this.skip();};
      audio.onerror = () => {if (this.audio === audio) {this.error = `Could not play ${track.title}`;this.pause();}};
    }
    const audio = this.audio, generation = ++this.generation;this.error = '';
    try {await audio.play();if (generation !== this.generation || this.audio !== audio) return false;this.playing = true;this.onChange();return true;}
    catch (error) {if (generation === this.generation) {this.playing = false;this.error = error.message || 'Press Play to start radio';this.onChange();}return false;}
  }
  pause() {this.generation++;this.audio?.pause();this.playing = false;this.onChange();}
  stop() {
    this.pause();if (this.audio) {this.audio.onended = null;this.audio.onerror = null;this.audio.removeAttribute('src');this.audio.load();}
    this.audio = null;this.trackId = '';
  }
  async skip(direction = 1) {
    const tracks = this.tracks;if (!tracks.length) {this.stop();return false;}
    const index = tracks.findIndex(track => track.id === this.trackId);
    return this.play(tracks[(index + direction + tracks.length) % tracks.length].id);
  }
  async rewind() {
    if (this.audio && this.audio.currentTime > 3) {this.audio.currentTime = 0;this.onChange();return;}
    return this.skip(-1);
  }
}
