import { GM_DRUM_BANK_LSB, GM_DRUM_BANK_MSB, GM_DRUM_KITS } from './gm.js';

const DEFAULT_DRUM_KIT_ID = 'standard';
const DEFAULT_BANK_MSB = GM_DRUM_BANK_MSB;
const DEFAULT_BANK_LSB = GM_DRUM_BANK_LSB;
const ALTERNATE_BANK_MSBS = new Set([0, GM_DRUM_BANK_MSB]);

const normalizeId = (value) => (value ? String(value).toLowerCase() : '');

export default class DrumKitManager {
  constructor({ soundfont } = {}) {
    this.soundfont = soundfont || null;
    this.kits = GM_DRUM_KITS.map((kit) => ({ ...kit }));
    this.currentKit = this.kits.find((kit) => kit.id === DEFAULT_DRUM_KIT_ID) || this.kits[0];
    if (this.currentKit?.soundfont) {
      this.soundfont?.setDrumKitName?.(this.currentKit.soundfont);
    }
  }

  listAvailableDrumKits() {
    return this.kits.map((kit) => ({ ...kit }));
  }

  getDrumKit() {
    return this.currentKit ? { ...this.currentKit } : null;
  }

  setDrumKit(nameOrId) {
    const target = this.findKitByNameOrId(nameOrId) || this.kits.find((kit) => kit.id === DEFAULT_DRUM_KIT_ID);
    this.currentKit = target || this.kits[0] || null;
    if (this.currentKit?.soundfont) {
      this.soundfont?.setDrumKitName?.(this.currentKit.soundfont);
    }
    return this.getDrumKit();
  }

  resolveKitFromBankProgram(bankMSB, bankLSB, program) {
    const msb = Number.isInteger(bankMSB) ? bankMSB : DEFAULT_BANK_MSB;
    const lsb = Number.isInteger(bankLSB) ? bankLSB : DEFAULT_BANK_LSB;
    const prog = Number.isInteger(program) ? program : this.currentKit?.program ?? 0;
    const kit = this.kits.find((entry) => this.matchesBankProgram(entry, msb, lsb, prog));
    return kit || this.kits.find((entry) => entry.id === DEFAULT_DRUM_KIT_ID) || this.kits[0] || null;
  }

  matchesBankProgram(kit, bankMSB, bankLSB, program) {
    if (!kit) return false;
    const msbMatches = kit.bankMSB === bankMSB
      || (ALTERNATE_BANK_MSBS.has(bankMSB) && ALTERNATE_BANK_MSBS.has(kit.bankMSB));
    return msbMatches && kit.bankLSB === bankLSB && kit.program === program;
  }

  findKitByNameOrId(nameOrId) {
    const normalized = normalizeId(nameOrId);
    if (!normalized) return null;
    return this.kits.find((kit) =>
      normalizeId(kit.id) === normalized || normalizeId(kit.label) === normalized);
  }
}
