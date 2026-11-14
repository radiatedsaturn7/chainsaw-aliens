import {musicMediaVolume} from '../audio/musicVolume.js';
import {MENU_SETTINGS} from './MenuDocument.js';
import {KEYMAP} from '../game/Input.js';
import {loadServerPreferenceAsync,saveServerPreference} from '../ui/serverPreferences.js';

export class MenuSettings {
  constructor(game){this.game=game;this.values={};this.revision=0;this.persist=Promise.resolve();}
  restore(saved={}){
    this.revision++;this.values={};
    for(const [key,spec] of Object.entries(MENU_SETTINGS))this.apply(`settings.${key}`,saved[`settings.${key}`]??spec.default);
    if(this.game.input)this.game.input.actionKeymap={};
    for(const action of Object.keys(KEYMAP))if(saved[`input.${action}`])this.apply(`input.${action}`,saved[`input.${action}`]);
  }
  async load(){
    if(this.game.campaignSaves?.hasActive){this.restore(this.game.campaignSaves.slots[this.game.campaignSaves.activeSlot]?.settings||{});return;}
    const revision=this.revision,saved=await loadServerPreferenceAsync('menu-settings',{});
    if(revision===this.revision)this.restore(saved||{});
  }
  apply(key,value){
    if(key.startsWith('settings.')){const setting=key.slice(9),spec=MENU_SETTINGS[setting];if(!spec||!Number.isFinite(Number(value)))throw Error('Unknown or invalid setting');value=Math.max(spec.min,Math.min(spec.max,Number(value)));this.values[key]=value;
      if(setting==='fxVolume')this.game.audio?.setEffectsVolume?.(value);
      if(setting==='musicVolume'&&this.game.audio){this.game.audio.midiBusVolume=value;if(this.game.audio.ctx)this.game.audio.setMidiVolume?.(value);
        const mediaVolume=musicMediaVolume(this.game.audio);this.game.radio?.setVolume(mediaVolume);this.game.radioEditor?.preview?.setVolume(mediaVolume);}
      if(setting==='brightness'&&this.game.canvas)this.game.canvas.style.filter=`brightness(${value})`;
      if(setting==='sensitivity'&&this.game.input)this.game.input.controlSensitivity=value;
    }else if(key.startsWith('input.')){const action=key.slice(6);if(!Object.hasOwn(KEYMAP,action)||typeof value!=='string'||!/^[A-Za-z][A-Za-z0-9]{0,39}$/.test(value))throw Error('Unknown action or key');this.values[key]=value;this.game.input.actionKeymap||={};this.game.input.actionKeymap[action]=[value];}
    else return false;
    return true;
  }
  async set(key,value){if(!this.apply(key,value))return;this.revision++;const snapshot=structuredClone(this.values);this.persist=this.persist.catch(()=>{}).then(async()=>{const result=this.game.campaignSaves?.hasActive&&!this.game.menuPlayer?.preview
      ?await this.game.campaignSaves.save({settings:snapshot}):await saveServerPreference('menu-settings',snapshot);if(!result.ok)throw Error(`Settings could not be saved: ${result.reason}`)});return this.persist;}
  parameters(){const result={...this.values};for(const [key,spec] of Object.entries(MENU_SETTINGS))result[`settings.${key}`]??=spec.default;for(const [key,codes] of Object.entries(KEYMAP))result[`input.${key}`]??=codes[0]||'';return result;}
}
