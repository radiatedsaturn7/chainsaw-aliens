import builtins from '../content/items.json' with {type:'json'};
import {normalizeItemDocument, serializeItemDocument} from './ItemDocument.js';
import {listProjectFiles,loadProjectFile,saveProjectFileAndConfirm} from '../ui/projectFiles.js';
import {hydrateProjectFile} from '../ui/serverStorage.js';

export class ItemLibrary {
  async loadDefaults() {return builtins.items;}
  async list() {
    const defaults=await this.loadDefaults();
    const saved=listProjectFiles('items').filter(entry=>!entry.deleted);
    return [...saved.map(entry=>({id:entry.name,name:entry.name,saved:true})),...defaults.filter(item=>!saved.some(entry=>entry.name===item.name)).map(item=>({...item,saved:false}))];
  }
  async load(name) {
    const defaults=await this.loadDefaults();
    const builtin=defaults.find(item=>item.id===name||item.name===name||item.aliases?.includes(name));
    const entry=listProjectFiles('items').find(entry=>!entry.deleted&&(entry.name===name||entry.name===builtin?.name));
    if(entry)name=entry.name;
    if(entry){await hydrateProjectFile('items',name);const payload=loadProjectFile('items',name);if(!payload)throw Error(`Could not load item: ${name}`);return normalizeItemDocument(payload.data);}
    const item=defaults.find(item=>item.id===name||item.name===name||item.aliases?.includes(name));
    if(!item)throw Error(`Item not found: ${name}`);return normalizeItemDocument(item);
  }
  async forLegacyTile(tile) {
    const defaults=await this.loadDefaults(),item=defaults.find(item=>item.legacyTile===tile);
    return item?this.load(item.name):null;
  }
  save(name,item){return saveProjectFileAndConfirm('items',name,serializeItemDocument(item),{timeoutMs:60000});}
}
export const itemLibrary = new ItemLibrary();
