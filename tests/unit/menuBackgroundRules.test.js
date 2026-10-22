import test from 'node:test';
import assert from 'node:assert/strict';
import {createMenuDocument,normalizeMenuDocument,resolveMenuBackground} from '../../src/menus/MenuDocument.js';

test('background rules survive saves, match current progress only, and respect priority',()=>{
 const doc=createMenuDocument(),screen=doc.screens[0];
 screen.backgroundArt='providenceSplashBackground';screen.useDefaultBackground=false;screen.effect='snow';
 screen.backgroundRules=[
  {when:'lastCompletedRace',value:'Final',artRef:'final'},
  {when:'chapter',value:'California',artRef:'california'}
 ];
 const saved=normalizeMenuDocument(JSON.parse(JSON.stringify(doc))),s=saved.screens[0];
 assert.equal(resolveMenuBackground(saved,s,{}).backgroundArt,'providenceSplashBackground');
 assert.equal(resolveMenuBackground(saved,s,{lastCompletedRace:'Final',chapter:'California'}).backgroundArt,'final');
 assert.equal(resolveMenuBackground(saved,s,{lastCompletedRace:'Other',chapter:'California'}).backgroundArt,'california');
 assert.equal(resolveMenuBackground(saved,s,{'raceCompleted.Final':true}).backgroundArt,'providenceSplashBackground');
 assert.equal(resolveMenuBackground(saved,s,{chapter:'California'}).effect,'snow');
 assert.equal(s.backgroundArt,'providenceSplashBackground');
});
test('fixed garage ignores progress and inherited backgrounds can use rules',()=>{
 const doc=createMenuDocument(),garage=doc.screens.find(s=>s.id==='garage');
 Object.assign(garage,{backgroundArt:'garage',useDefaultBackground:false});
 assert.equal(resolveMenuBackground(doc,garage,{chapter:'California',lastCompletedRace:'Final'}).backgroundArt,'garage');
 const splash=doc.screens[0];splash.useDefaultBackground=true;
 doc.defaultBackground.backgroundArt='default';
 splash.backgroundRules=[{when:'chapter',value:'2',artRef:'chapter-two'}];
 assert.equal(resolveMenuBackground(doc,splash,{chapter:2}).backgroundArt,'chapter-two');
 assert.equal(resolveMenuBackground(doc,splash,{}).backgroundArt,'default');
});
