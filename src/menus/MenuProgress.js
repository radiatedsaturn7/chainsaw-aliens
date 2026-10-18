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
 await loadMenuProgress(game);Object.assign(game.menuProgress,values);
 if(flow?.active)for(const [key,value] of Object.entries(values))flow.setParameter(key,value);
 const snapshot={...game.menuProgress};game.menuProgressSaving=(game.menuProgressSaving||Promise.resolve()).catch(()=>{}).then(async()=>{const result=await saveServerPreference('menu-progress',snapshot);if(!result.ok)throw Error('Could not save menu progress');});
 await game.menuProgressSaving;
}
