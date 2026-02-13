import { GM_DRUM_BANK_LSB, GM_DRUM_BANK_MSB, GM_DRUM_CHANNEL, isDrumChannel } from './gm.js';

const DRUM_PRESET = 0;

const toInt = (value, fallback = 0) => (Number.isInteger(value) ? value : fallback);

export default class SoundfontLoader {
  constructor({
    soundfont,
    enabled = false,
    preloadCommonSet = false,
    commonPrograms = [0, 24, 32],
    includeCommonDrumKit = true
  } = {}) {
    this.soundfont = soundfont || null;
    this.enabled = Boolean(enabled);
    this.preloadCommonSet = Boolean(preloadCommonSet);
    this.commonPrograms = Array.isArray(commonPrograms) ? commonPrograms : [0, 24, 32];
    this.includeCommonDrumKit = Boolean(includeCommonDrumKit);
    this.loaded = new Map();
    this.loading = new Map();
    this.preloadPromise = null;
  }

  buildKey({ channel = 0, program = 0, bankMSB = 0, bankLSB = 0, isDrum = false, kitName = 'standard_kit' } = {}) {
    const resolvedDrum = isDrumChannel(channel) || isDrum;
    if (resolvedDrum) {
      return `drum:${GM_DRUM_CHANNEL}:${GM_DRUM_BANK_MSB}:${bankLSB}:${DRUM_PRESET}:${kitName}`;
    }
    return `inst:${channel}:${bankMSB}:${bankLSB}:${program}`;
  }

  async ensureLoaded(request = {}) {
    if (!this.soundfont) return null;
    if (!this.enabled) {
      if (isDrumChannel(request.channel) || request.isDrum) {
        return this.soundfont.loadDrumKit(request.kitName, {
          bankMSB: GM_DRUM_BANK_MSB,
          bankLSB: toInt(request.bankLSB, GM_DRUM_BANK_LSB),
          preset: DRUM_PRESET
        });
      }
      return this.soundfont.loadInstrument(toInt(request.program, 0));
    }

    const isDrum = isDrumChannel(request.channel) || request.isDrum;
    const cacheKey = this.buildKey({ ...request, isDrum });
    if (this.loaded.has(cacheKey)) {
      return this.loaded.get(cacheKey);
    }
    if (this.loading.has(cacheKey)) {
      return this.loading.get(cacheKey);
    }

    const loadPromise = (isDrum
      ? this.soundfont.loadDrumKit(request.kitName, {
        bankMSB: GM_DRUM_BANK_MSB,
        bankLSB: toInt(request.bankLSB, GM_DRUM_BANK_LSB),
        preset: DRUM_PRESET
      })
      : this.soundfont.loadInstrument(toInt(request.program, 0)))
      .then((instrument) => {
        if (instrument) {
          this.loaded.set(cacheKey, instrument);
        }
        return instrument;
      })
      .finally(() => {
        this.loading.delete(cacheKey);
      });

    this.loading.set(cacheKey, loadPromise);
    return loadPromise;
  }

  preloadCommon() {
    if (!this.enabled || !this.preloadCommonSet || !this.soundfont) {
      return Promise.resolve([]);
    }
    if (this.preloadPromise) return this.preloadPromise;

    const commonLoads = this.commonPrograms.map((program) => this.ensureLoaded({
      channel: 0,
      program: toInt(program, 0),
      bankMSB: 0,
      bankLSB: 0,
      isDrum: false
    }));

    if (this.includeCommonDrumKit) {
      commonLoads.push(this.ensureLoaded({
        channel: GM_DRUM_CHANNEL,
        isDrum: true,
        bankMSB: GM_DRUM_BANK_MSB,
        bankLSB: GM_DRUM_BANK_LSB,
        kitName: this.soundfont.getDrumKitName?.() || 'standard_kit'
      }));
    }

    this.preloadPromise = Promise.allSettled(commonLoads)
      .finally(() => {
        this.preloadPromise = null;
      });

    return this.preloadPromise;
  }

  reset() {
    this.loaded.clear();
    this.loading.clear();
    this.preloadPromise = null;
  }
}
