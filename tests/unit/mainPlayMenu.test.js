import test from 'node:test';
import assert from 'node:assert/strict';
import {saveServerPreference} from '../../src/ui/serverPreferences.js';
import {upsertCachedProjectFile,clearCachedProjectFilesForTests} from '../../src/ui/serverStorage.js';
import {createMenuDocument} from '../../src/menus/MenuDocument.js';
const previousWindow=globalThis.window;
globalThis.window={};
const {default:Game}=await import('../../src/game/GameCore.js');
if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;

test('Main Play opens the designated document at its first screen and defaults to splash',async()=>{
 const originalFetch=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,json:async()=>({ok:true})});
 const opened=[];
 const game={menuPlayer:{open:async document=>opened.push(document)},showSystemToast:message=>assert.fail(message),playMostRecentLevel:()=>assert.fail('Play must open a menu')};
 try{
  await saveServerPreference('menu-launch',{menuRef:''});
  await Game.prototype.playStartingMenu.call(game);
  assert.equal(opened[0].startScreen,'splash');
  const document=createMenuDocument();document.name='My Splash';document.startScreen='settings';
  upsertCachedProjectFile('menus','My Splash',JSON.stringify({folder:'menus',name:'My Splash',data:document}));
  await saveServerPreference('menu-launch',{menuRef:'My Splash'});
  await Game.prototype.playStartingMenu.call(game);
  assert.equal(opened[1].name,'My Splash');
  assert.equal(opened[1].startScreen,'settings');
  assert.equal(game.menuLaunchPending,false);
 }finally{await saveServerPreference('menu-launch',{menuRef:''});globalThis.fetch=originalFetch;clearCachedProjectFilesForTests();}
});
