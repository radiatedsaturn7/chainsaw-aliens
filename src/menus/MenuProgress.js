import {loadServerPreferenceAsync,saveServerPreference} from '../ui/serverPreferences.js';
const valid=key=>typeof key==='string'&&/^[a-zA-Z][\w.-]{0,79}$/.test(key)&&!key.split('.').some(k=>['__proto__','prototype','constructor'].includes(k));
export function normalizeMenuVariables(value){return Object.fromEntries(Object.entries(value&&typeof value==='object'&&!Array.isArray(value)?value:{}).filter(([key,v])=>valid(key)&&['string','boolean','number'].includes(typeof v)));}
export async function loadMenuProgress(game){
 if(!game.menuProgress){game.menuProgressLoading||=loadServerPreferenceAsync('menu-progress',{}).then(value=>game.menuProgress=normalizeMenuVariables(value));await game.menuProgressLoading;}
 return game.menuProgress;
}
export async function setMenuProgress(game,variables){
 const values=normalizeMenuVariables(variables),flow=game.menuPlayer?.flow;
 if(game.menuPlayer?.preview&&flow?.active){for(const [key,value] of Object.entries(values))flow.setParameter(key,value);return;}
 await loadMenuProgress(game);
 delete values.selectedGameCar;
 game.menuProgressSaving=(game.menuProgressSaving||Promise.resolve()).catch(()=>{}).then(async()=>{
  const snapshot={...game.menuProgress,...values};
  const result=await saveServerPreference('menu-progress',snapshot);if(!result.ok)throw Error('Could not save menu progress');
  game.menuProgress=snapshot;
  if(flow?.active)for(const [key,value] of Object.entries(values))flow.setParameter(key,value);
 });
 await game.menuProgressSaving;
}

export async function commitMenuCar(game,carRef,{save=saveServerPreference,newGame=false}={}){
 await loadMenuProgress(game);
 if(!newGame&&game.menuProgress.selectedGameCar)return game.menuProgress.selectedGameCar;
 const task=(game.menuProgressSaving||Promise.resolve()).catch(()=>{}).then(async()=>{
  if(!newGame&&game.menuProgress.selectedGameCar)return game.menuProgress.selectedGameCar;
  const snapshot={...game.menuProgress,selectedGameCar:carRef};
  const result=await save('menu-progress',snapshot);
  if(!result?.ok)throw Error('Could not save your car selection');
  game.menuProgress=snapshot;return carRef;
 });
 game.menuProgressSaving=task;return task;
}


export function parseMenuVariableAssignments(text = '') {
 const entries = [];
 for (const line of String(text).split('\n').filter(line => line.trim())) {
  const index = line.indexOf('=');
  if (index < 1) throw Error('Use one name = value assignment per line.');
  const key = line.slice(0,index).trim(), raw = line.slice(index+1).trim();
  let value; try { value=JSON.parse(raw); } catch { value=raw; }
  if (!valid(key) || !['string','boolean','number'].includes(typeof value) || typeof value==='number'&&!Number.isFinite(value)) throw Error('Variable names must use letters, numbers, dots, underscores or hyphens; values must be text, numbers or booleans.');
  entries.push([key,value]);
 }
 return Object.fromEntries(entries);
}

export function formatMenuVariableAssignments(variables = {}) {
 return Object.entries(normalizeMenuVariables(variables)).map(([key,value]) => `${key} = ${JSON.stringify(value)}`).join('\n');
}
